# Phase 06: Storage Policy Audit - Pattern Map

**Mapped:** 2026-07-12  
**Files analyzed:** 5  
**Analogs found:** 4 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` | policy doc | audit policy / human guidance | `docs/r2-mapping-storage-implementation-report.md` | role-match |
| `.planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md` | audit report | read-only inventory / batch report | `.planning/milestones/v1.0-phases/05-migration/05-RESEARCH.md` | role-match |
| `.planning/phases/06-storage-policy-audit/06-r2-audit-details.json` | data artifact | machine-readable audit / transform | `packages/crawler/src/lib/mapping-file-manager.ts` | partial-match |
| `packages/crawler/scripts/audit-r2-storage.ts` | utility script | batch / read-only inventory | `packages/crawler/src/scripts/enrich-players.ts` | role-match |
| `.planning/phases/06-storage-policy-audit/06-r2-audit-details.csv` | data artifact | export / transform | `无` | none |

## Pattern Assignments

### `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`（policy doc, audit policy / human guidance）

**Primary analog:** `docs/r2-mapping-storage-implementation-report.md`  
**Supplementary analog:** `RUNBOOK.md`

**文档总览段落**（`docs/r2-mapping-storage-implementation-report.md:7-10`）:

```md
## 实施概述

为 Dashboard 的名字映射管理功能添加了完整的 R2 存储支持，实现了映射文件的自动上传、版本管理和在线查看。
```

**分节展开模式**（`docs/r2-mapping-storage-implementation-report.md:11-31`）:

```md
## 已实施的组件

### 1. 爬虫侧 - R2 上传功能

#### 1.1 MappingFileManager（新建）
...
```

**存储结构展示模式**（`docs/r2-mapping-storage-implementation-report.md:116-135`）:

```md
## R2 存储结构

starye-assets (R2 Bucket)
├── mappings/
│   ├── actor-name-map.json
│   └── backups/
...
```

**运维式分节与表格模式**（`RUNBOOK.md:7-20`）:

```md
## 1. 运维入口总览

| Surface | Production URL | Deploy Path | Rollback Path |
|---------|----------------|-------------|---------------|
...
```

**Apply to this file:**

- 保持一个 canonical policy 文档，不要把 allowlist / forbidden / glossary 分散到多份历史 `docs/r2-mapping-*`。
- 章节结构直接套用“总览 -> 分类章节 -> 表格/树状结构 -> 限制与后续”的写法。
- `STOR-01` 到 `STOR-03` 推荐拆成固定章节：
  - `Purpose and Scope`
  - `Allowlist`
  - `Restricted Allowed`
  - `Short-Term Allowed`
  - `Historical Risk`
  - `Forbidden Uses`
  - `Naming Glossary`
  - `Current Heuristics`
  - `Future Enforcement Hooks`
- 如果 planner 改选 `docs/storage-policy.md` 而不是 phase-local 文件，仍应复制同一结构，不要重发明模板。

---

### `.planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md`（audit report, read-only inventory / batch report）

**Primary analog:** `.planning/milestones/v1.0-phases/05-migration/05-RESEARCH.md`  
**Supplementary analog:** `docs/actor-mapping-audit-process.md`

**Executive Summary 开头模式**（`05-RESEARCH.md:10-31`）:

```md
## Executive Summary

当前仓库已经具备“每个应用大致都能单独部署”的基础，但还没有达到 ...

最重要的现状判断：

1. **Deploy workflows 已存在，但分散且不一致。**
...
```

**风险分段模式**（`05-RESEARCH.md:166-190`）:

```md
## Risk Assessment

### Highest risk items for planning

1. **Rollback across Workers and Pages is asymmetric**
...
```

**流程/检查清单写法**（`docs/actor-mapping-audit-process.md:33-45`）:

```md
## 审核流程

### 步骤 1: 导出待审核清单

```bash
cd packages/crawler
...
```
```

**Apply to this file:**

- 报告正文保持“先结论、后证据、再后续”的 phase research 风格，不要直接写成脚本 README。
- 固定章节建议按 `06-RESEARCH.md` 的报告形状落：
  - `Executive Summary`
  - `Prefix Matrix`
  - `Runtime Write Paths`
  - `Docs-Declared Entries`
  - `DB Reference Checks`
  - `No-Delete Confirmation`
  - `Follow-up Candidates`
- `Prefix Matrix` 直接用 markdown 表格，不要嵌复杂 JSON。
- 所有命令段只允许 read-only / dry-run 形态；命令块格式可照搬 `docs/actor-mapping-audit-process.md` 的步骤 + fenced code block。

---

### `.planning/phases/06-storage-policy-audit/06-r2-audit-details.json`（data artifact, machine-readable audit / transform）

**Primary analog:** `packages/crawler/src/lib/mapping-file-manager.ts`  
**Supplementary analog:** `apps/api/src/routes/admin/crawlers/index.ts`

**metadata 类型定义**（`packages/crawler/src/lib/mapping-file-manager.ts:16-21`）:

```ts
interface MappingMetadata {
  version: string
  uploadedAt: number
  totalEntries: number
  source: 'index-crawler' | 'manual' | 'api'
}
```

**payload 包装模式**（`packages/crawler/src/lib/mapping-file-manager.ts:68-76`）:

```ts
const payload = {
  metadata: {
    version,
    uploadedAt,
    totalEntries,
    source: metadata.source || 'index-crawler',
  },
  data,
}
```

**list 结果对象模式**（`apps/api/src/routes/admin/crawlers/index.ts:741-758`）:

```ts
return {
  key: obj.key,
  version: payload.metadata?.version || obj.uploaded.toISOString(),
  uploadedAt: payload.metadata?.uploadedAt || obj.uploaded.getTime(),
  totalEntries: payload.metadata?.totalEntries || 0,
  source: payload.metadata?.source || 'unknown',
  size: obj.size,
}
```

**Apply to this file:**

- 如果 planner 要产出 JSON 明细，优先沿用 repo 现有的 `metadata + data` 包装习惯；这比裸数组更贴近仓库已有 R2 审计/版本数据形状。
- `metadata` 至少应包含：`generatedAt`、`runtimeInventoryAvailable`、`source`、`notes`。
- `data` 数组里的单条记录字段，应直接使用 `06-RESEARCH.md` 已锁定的字段名：
  - `prefix`
  - `source_kind`
  - `writer`
  - `caller_or_schedule`
  - `object_count`
  - `rough_size_bytes`
  - `sample_keys`
  - `oldest_last_modified`
  - `newest_last_modified`
  - `db_reference_hits`
  - `referenced_tables_fields`
  - `docs_references`
  - `delete_risk`
  - `cost_risk`
  - `combined_recommendation`
  - `evidence_sources`
  - `notes`
- 这里没有完全一致的现成 JSON audit 模板；最接近的是 mapping payload 与 `r2.list()` 返回对象组合。

---

### `packages/crawler/scripts/audit-r2-storage.ts`（utility script, batch / read-only inventory）

**Primary analog:** `packages/crawler/src/scripts/enrich-players.ts`  
**Supplementary analogs:** `packages/crawler/scripts/verify-r2-upload.ts`, `apps/api/src/routes/admin/crawlers/index.ts`

**CLI 参数解析**（`packages/crawler/src/scripts/enrich-players.ts:20-37`）:

```ts
function parseArgs(): { limit: number, dryRun: boolean } {
  const args = process.argv.slice(2)
  let limit = 50
  let dryRun = false
  ...
  if (args[i] === '--dry-run') {
    dryRun = true
  }
  ...
}
```

**dry-run / 汇总输出模式**（`packages/crawler/src/scripts/enrich-players.ts:57-63`, `185-191`）:

```ts
console.log(`📌 模式: ${dryRun ? 'DRY-RUN（不写入）' : '写入数据库'}`)
...
console.log('📊 处理汇总')
console.log(`  ✅ 成功: ${stats.success}`)
console.log(`  ⚠️ 未找到: ${stats.noResult}`)
console.log(`  ❌ 失败: ${stats.failed}`)
```

**环境变量校验模式**（`packages/crawler/scripts/verify-r2-upload.ts:14-25`）:

```ts
const required = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('❌ 缺少必需的环境变量:')
  ...
  process.exit(1)
}
```

**R2 版本列举模式（Worker 侧）**（`apps/api/src/routes/admin/crawlers/index.ts:736-759`）:

```ts
const listed = await r2.list({ prefix, limit: 50 })

const versions = await Promise.all(
  listed.objects.map(async (obj: any) => {
    const file = await r2.get(obj.key)
    ...
  }),
)
```

**Apply to this file:**

- 如果 planner 选择补一个只读 inventory script，CLI 骨架直接复制 `enrich-players.ts` 的 `parseArgs()`、模式打印和汇总输出。
- 强制保留 `--dry-run` 语义，即使本脚本默认就是 read-only，也要在输出里明确声明“本次未删除对象、未写入 D1、未应用 lifecycle”。
- 环境变量/凭据缺失时，行为照 `verify-r2-upload.ts`：清楚打印缺失项并退出；不要静默降级成半成功。
- Node 侧没有现成的 `ListObjectsV2Command` 样例；如果 planner 想避免自己拼 AWS list 代码，优先走 `wrangler r2 object list ... --remote` 命令编排，或参考 Worker 侧 `r2.list()` 的结果处理方式。
- 错误处理要保持脚本式 `console.error + process.exit(1)`，不要引入应用级 logger。

## Shared Patterns

### 现有 R2 写入基线

**Sources:** `apps/api/src/routes/upload/index.ts:79-98`, `121-128`; `packages/crawler/src/lib/image-processor.ts:148-189`; `packages/crawler/src/lib/mapping-file-manager.ts:78-101`

```ts
const key = `images/${timestamp}-${uniqueId}${ext}`
await bucket.put(key, file.stream(), {
  httpMetadata: {
    contentType: file.type,
  },
})
...
await db.insert(media).values({
  id: mediaId,
  key,
  url,
  mimeType: file.type,
  size: file.size,
})
```

```ts
const key = `${prefix}/${filename}-${variant}.webp`
const upload = new Upload({
  client: this.s3,
  params: {
    Bucket: this.bucket,
    Key: key,
    Body: processor,
    ContentType: 'image/webp',
  },
})
```

```ts
const key = `mappings/${fileName}`
const backupKey = `mappings/backups/${fileName.replace('.json', '')}-${Date.now()}.json`
```

**Apply to:** 所有 policy / audit 文档、inventory script  
**Use:** phase 6 里所有 prefix 盘点都应以这些真实 key 生成模式为依据，而不是只看文档命名。

### 现有“外部 URL vs R2 URL”语义基线

**Sources:** `packages/db/src/schema.ts:84-93`, `141-148`; `apps/api/src/routes/public/comics/index.ts:298-305`

```ts
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  url: text('url').notNull(),
  variants: text('variants', { mode: 'json' }),
  ...
})
```

```ts
export const pages = sqliteTable('page', {
  ...
  imageUrl: text('image_url').notNull(),
  ...
})
```

```ts
return c.json({
  success: true,
  data: {
    ...
    images: chapter.pages.map(p => p.imageUrl),
  },
})
```

**Apply to:** `06-STORAGE-POLICY.md`, `06-R2-AUDIT-DRY-RUN.md`, `06-r2-audit-details.json`  
**Use:** phase 6 文档必须明确区分 `media.key/url` 的 R2 语义与 `page.image_url` / public `images: string[]` 的章节图片语义。

### 当前 forbidden-risk 漂移基线

**Source:** `packages/crawler/src/crawlers/comic-crawler.ts:362-377`, `477-505`

```ts
const coverImages = await this.imageProcessor.process(
  info.cover,
  `comics/${info.slug}`,
  'cover',
)
...
const processed = await this.imageProcessor.process(
  rawUrl,
  `comics/${info.slug}/${chapter.slug}`,
  String(globalIndex + 1).padStart(3, '0'),
)
...
images: imageUrls,
```

**Apply to:** 所有 phase 6 报告与风险矩阵  
**Use:** `comics/<slug>/cover` 与 `comics/<slug>/<chapter>` 必须分开记录；前者是 cover 资产漂移，后者是章节正文 forbidden-risk 基线。

### 脚本式 no-delete / dry-run 表达

**Sources:** `packages/crawler/src/scripts/enrich-players.ts:57-63`, `151-155`; `RUNBOOK.md:229-235`

```ts
console.log(`📌 模式: ${dryRun ? 'DRY-RUN（不写入）' : '写入数据库'}`)
...
if (dryRun) {
  console.log(`  🚫 DRY-RUN：跳过写入`)
  ...
}
```

```md
每次关键 schema 变更后至少确认：

- 目标新表/新列存在
- 旧表/旧索引是否按预期退场
- API 启动和基础 query 不报错
- 前台关键路径能读写新 schema
```

**Apply to:** `packages/crawler/scripts/audit-r2-storage.ts`, `06-R2-AUDIT-DRY-RUN.md`  
**Use:** 所有 read-only 命令和检查项都要显式声明“做了什么检查”和“没有做什么 destructive 操作”。

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.planning/phases/06-storage-policy-audit/06-r2-audit-details.csv` | data artifact | export / transform | 仓库里没有现成的 CSV 审计模板；planner 应直接按 `06-RESEARCH.md` 指定字段顺序导出，不要强行套用应用代码中的 JSON payload。 |

## Metadata

**Analog search scope:** `.planning/`, `docs/`, `packages/crawler/`, `packages/db/`, `apps/api/`, `RUNBOOK.md`, `.github/workflows/`  
**Files scanned:** 18  
**Pattern extraction date:** 2026-07-12

## PATTERN MAPPING COMPLETE

**Phase:** 06 - storage-policy-audit  
**Files classified:** 5  
**Analogs found:** 4 / 5

### Coverage

- Files with exact analog: 0
- Files with role-match analog: 3
- Files with partial-match analog: 1
- Files with no analog: 1

### Key Patterns Identified

- 所有 phase 文档类产物都适合沿用现有 `.planning/*RESEARCH.md` / `RUNBOOK.md` 的“先结论、后表格、再检查清单”结构。
- 机器可读 audit 明细最接近 repo 现有的 `metadata + data` JSON payload 习惯，而不是裸数组。
- 只读 inventory script 应复制现有 crawler 脚本的 `--dry-run`、环境变量校验、汇总输出与 `console.error + process.exit(1)` 风格。
- storage 语义必须以真实代码基线为准：`media.key/url` 是 R2 资产，`page.image_url` 与 public `images: string[]` 是章节图片语义入口。

### File Created

`.planning/phases/06-storage-policy-audit/06-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
