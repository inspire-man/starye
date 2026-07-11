# Phase 06 Plan 03 Verification

## Purpose

本工单固定 `06-03` 的验证顺序，确保 Phase 6 只交付 read-only 审计脚本、报告契约和 no-delete guardrail，而不会漂移到 cleanup phase。

## Preconditions

- 当前仓库根目录：`D:\my-workspace\starye`
- 依赖已安装：`pnpm install`
- Phase 6 既有文档已存在：`06-STORAGE-POLICY.md`、`06-R2-WRITE-INVENTORY.md`、`06-RISK-BASELINES.md`
- 如需 live dry-run，执行者需要以下只读环境变量：
  - `CLOUDFLARE_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `CLOUDFLARE_DATABASE_ID`
  - `CLOUDFLARE_D1_TOKEN`
  - 可选：`R2_PUBLIC_URL`

## Automated Checks Shipped In This Plan

1. 运行定向测试：

```powershell
pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts
```

2. 检查 CLI 帮助输出：

```powershell
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --help
```

3. 确认脚本未引入 destructive storage API：

```powershell
$bad = Select-String -Path 'packages/crawler/scripts/audit-r2-storage.ts' -Pattern 'DeleteObjectCommand|PutBucketLifecycleConfigurationCommand|\.delete\('
if ($bad) { Write-Error 'destructive storage API found'; exit 1 }
```

## Dry-Run Command

### Contract-Only Run (No Cloudflare Credentials)

这个命令验证脚本在“本地只看契约、不触发远端盘点”的前提下能展示参数帮助：

```powershell
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --help
```

### Credentialed Read-Only Dry Run

提供只读凭据后，使用下面的命令生成真实报告。该命令只允许 list/query/report 输出，不允许 delete/apply/upload：

```powershell
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts `
  --dry-run `
  --strict-env `
  --md-out .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md `
  --json-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.json `
  --csv-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.csv
```

### Targeted Prefix Dry Run

如果只想先看高风险前缀，可限定 prefix：

```powershell
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts `
  --dry-run `
  --strict-env `
  --prefix images/ `
  --prefix comics/demo-slug `
  --prefix ops/d1-backups/ `
  --sample-limit 3 `
  --md-out .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md `
  --json-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.json `
  --csv-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.csv
```

## Output File Checks

执行 dry-run 后必须确认 3 个输出文件都落盘：

```powershell
Test-Path '.planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md'
Test-Path '.planning/phases/06-storage-policy-audit/06-r2-audit-details.json'
Test-Path '.planning/phases/06-storage-policy-audit/06-r2-audit-details.csv'
```

然后确认关键章节和风险字段仍然存在：

```powershell
rg -n "Executive Summary|Prefix Matrix|Runtime Write Paths|Docs-Declared Entries|DB Reference Checks|No-Delete Confirmation|Follow-up Candidates|delete_risk|cost_risk|combined_recommendation|comics/<slug>|comics/<slug>/<chapter>|ops/d1-backups/|system/" `
  .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md `
  .planning/phases/06-storage-policy-audit/06-r2-audit-details.json `
  .planning/phases/06-storage-policy-audit/06-r2-audit-details.csv
```

## Fail-Closed Check Without Credentials

当 Cloudflare 凭据缺失时，脚本必须明确失败，而不是把失败伪装成“0 hits / 空 bucket”：

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = $null
$env:R2_ACCESS_KEY_ID = $null
$env:R2_SECRET_ACCESS_KEY = $null
$env:R2_BUCKET_NAME = $null
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --dry-run
```

预期结果：

- 进程退出码非 0
- 输出包含 `Missing required R2 environment variables`
- 不生成伪造的空报告

如果只缺 D1 凭据但使用了 `--strict-env`，预期结果是：

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = 'example-account'
$env:R2_ACCESS_KEY_ID = 'example-access'
$env:R2_SECRET_ACCESS_KEY = 'example-secret'
$env:R2_BUCKET_NAME = 'example-bucket'
$env:CLOUDFLARE_DATABASE_ID = $null
$env:CLOUDFLARE_D1_TOKEN = $null
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --dry-run --strict-env
```

预期输出包含：

- `Missing required strict-env variables`
- 非 0 退出码

## No-Delete Proof

本 phase 不允许做以下任何动作：

- object delete
- lifecycle apply
- upload enforcement
- DB 字段改名
- R2 deletion

验证方式：

```powershell
$bad = Select-String -Path 'packages/crawler/scripts/audit-r2-storage.ts' -Pattern 'DeleteObjectCommand|PutBucketLifecycleConfigurationCommand|\.delete\('
if ($bad) { Write-Error 'destructive storage API found'; exit 1 }
rg -n "Phase 6 不做|object delete|lifecycle apply|upload enforcement|DB 字段改名|R2 deletion" .planning/phases/06-storage-policy-audit/06-VERIFICATION.md
```

还要确认 dry-run 文档明确声明只做 list/query/report：

```powershell
rg -n "read-only|No-Delete Confirmation|只允许|不做 object delete|不做 object delete、lifecycle apply、upload enforcement、DB 字段改名或 R2 deletion" `
  .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md `
  .planning/phases/06-storage-policy-audit/06-VERIFICATION.md
```

## Pre-Commit Guardrail

提交前必须运行 GitNexus scope check：

```powershell
npx gitnexus detect-changes --repo starye --scope all
```

验收标准：

- 风险级别不是 `HIGH` 或 `CRITICAL`
- 结果没有显示超出本 plan 预期范围的运行时流程
- 若输出只包含既有脏文件 `AGENTS.md` / `CLAUDE.md`，执行者仍需只暂存本 plan 相关文件

## Terminal-Only Validation Checklist

1. `vitest` 测试通过
2. `--help` 输出正常
3. 无 Cloudflare 凭据时脚本 fail closed
4. 有只读凭据时 dry-run 能写出 3 个报告文件
5. 输出文件保留固定章节和关键风险字段
6. `audit-r2-storage.ts` 不包含 destructive storage API
7. 提交前运行 `npx gitnexus detect-changes --repo starye --scope all`
