# Starye RUNBOOK

单一正式运维手册。覆盖 Cloudflare Workers / Pages / D1 / GitHub Actions 的生产部署、回滚、迁移安全、可观测性和常见故障处理。

## Documentation Ownership

- `RUNBOOK.md` 是长期有效的运维与 storage-policy canonical owner。
- 当前 phase 执行中的新规则先落在 `.planning/*`；只有在规则稳定后才回写这里。
- [`06-STORAGE-POLICY.md`](.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md) 与 [`08-VERIFICATION.md`](.planning/phases/08-cost-guardrails/08-VERIFICATION.md) 保留为历史快照 / 验证证据，不反向覆盖本手册。

---

## 1. Operations ownership and local entry

- `RUNBOOK.md` 只保存稳定的操作步骤；当前 phase 的结果、证据对和 requirement matrix 仍留在 `.planning/phases/`。
- 每次远程操作都从明确的 `TargetProfile` 开始。域名、账户、资源和 Pages 项目均由 profile 解析，不能从本手册复制或手填。
- 所有本地浏览器验证统一经由 Gateway：
  - `http://localhost:8080/dashboard/`
  - `http://localhost:8080/blog/`
  - `http://localhost:8080/movie/`
  - `http://localhost:8080/comic/`
  - `http://localhost:8080/auth/login`

---

## 2. Target-first operations procedure

此流程适用于切换、deploy、migration、crawl、smoke 与恢复。文中的 `<target-id>`、`<app>`、`<surface>`、`<run-id>` 和 `<closed-command>` 必须由操作者在当前受跟踪配置中选择；它们不是默认生产值。

### 2.1 Select an explicit TargetProfile

1. 先选择一个明确的受跟踪目标，不使用默认别名、域名或账户名代替 target ID。
2. 先验证目标的非 secret metadata：

   ```bash
   pnpm target-profile validate --target <target-id>
   ```

3. 后续每个 workflow、preflight、deploy、migration、crawl 和 smoke 都使用同一个 `<target-id>`。解析出的 canonical Gateway URL、资源绑定和 Pages surface 是操作输入，不复制到本手册。

### Required-secret metadata matrix

该矩阵只镜像 `TargetProfile.requiredSecrets` 的 name、consumer、local file 与 CI environment metadata；它不记录任何 secret value、账户 ID、资源 ID、bucket 名称或 canonical domain。每一行的 validation/preflight entry 都在使用前检查存在性和 target 边界。

| Target profile | Required secret name | Consumers | Local files | CI environment | Validation / preflight entry |
|----------------|----------------------|-----------|-------------|----------------|------------------------------|
| `starye-org` | `CLOUDFLARE_API_TOKEN` | `ci` | - | `starye-org` | `target-profile preflight` |
| `starye-org` | `BETTER_AUTH_SECRET` | `api, auth` | `apps/api/.dev.vars` | `starye-org` | `target-profile preflight` |
| `starye-org` | `CRAWLER_SECRET` | `api, crawler, ci` | `apps/api/.dev.vars`, `packages/crawler/.env` | `starye-org` | `target-profile preflight` |
| `starye-org` | `R2_ACCESS_KEY_ID` | `crawler` | `packages/crawler/.env` | `starye-org` | `target-profile preflight` |
| `starye-org` | `R2_SECRET_ACCESS_KEY` | `crawler` | `packages/crawler/.env` | `starye-org` | `target-profile preflight` |

若未来某个受跟踪 profile 的 `requiredSecrets` 为空，仍须保留该 profile 的 `No required secrets` 显式行，而不能省略此阶段或把它理解为跳过 preflight。

### 2.2 Project local configuration and preflight

1. 仅对已在 2.1 验证的 target 写入或检查本地 managed projection：

   ```bash
   pnpm target-profile project-local --target <target-id> --check
   pnpm target-profile preflight --target <target-id> --scope local --command <closed-command>
   ```

2. projection 或 preflight 不通过时，在本地停止；不得继续 deploy、migration、crawl 或 smoke。修复由 preflight 报告的本地边界问题后，重新从本阶段开始。
3. 本地浏览器证据只从 Gateway canonical entry 取得，例如 `http://localhost:8080/dashboard/`；直连应用端口仅用于诊断，不能作为操作证据。

### 2.3 Operator-triggered deploy, migration, and crawl

1. 完成 local preflight 后，操作者才可选择一个闭合的 app/surface 进行部署，或在带 explicit target input 的 workflow 中触发对应 deploy、migration 或 crawl。credentialed workflow 执行是操作者动作，不是本手册或静态测试自动执行的动作。
2. 本地 target-aware deploy 的形状为：

   ```bash
   pnpm target-deploy -- --target <target-id> --app <app> [--surface <surface>]
   ```

3. migration 前后遵循既有的 [D1 migration safety](#4-d1-migration-safety)；不要绕过 reviewer、backup 或恢复门禁。Pages 的部署输入必须保留已解析 target 的闭合 surface。
4. 每个 mutation 只在其前置步骤已通过时开始。未完成的步骤不能由过去的 phase evidence、requirement checkbox 或另一个 target 的结果替代。

### 2.4 Smoke with mode, target, and run ID

1. smoke 必须声明 explicit `<mode>`、`<target-id>` 和 `<run-id>`，并把同一 tuple 用于运行和后续验证：

   ```bash
   pnpm smoke:data-chain -- --mode <mode> --target <target-id> --run-id <run-id>
   pnpm smoke:data-chain:verify -- --mode <mode> --target <target-id> --run-id <run-id>
   ```

2. `passed` is the only completed smoke result.
3. `failed` and `checkpoint` stop immediately and preserve the current evidence.
4. `failed`、`checkpoint`、pending、缺失 artifact 或 tuple 不一致均不是成功；不得进行后续 mutation，也不得写成完成记录。当前 phase 的 evidence matrix 与历史状态继续由 phase artifact owner 保存。

### 2.5 Rollback and recovery

1. `failed` 或 `checkpoint` 后，先停止后续 mutation，并保留 mode/target/run ID tuple 与当前 evidence 对。
2. Classify recovery as local, target, or provider handling; do not continue the current run.
3. 对修复后的目标重新执行 selected-target preflight，再按故障边界选择 [Worker rollback](#31-worker-rollback)、[Pages rollback](#32-pages-rollback) 或 [D1 migration safety](#4-d1-migration-safety) 的既有人工步骤。Pages 回滚仍为手工、fail-closed 边界。
4. After recovery, start a new validation run with a new mode/target/run ID tuple.

---

## 3. Rollback procedure

### 3.1 Worker rollback

适用：
- `api`
- `gateway`

统一入口：
- `.github/workflows/rollback.yml`

输入：
- `target`
- `app`
- `version_id`

行为：
- selected-target workflow 先解析 profile，再为所选 Worker 生成受控配置并执行 rollback。
- 不从 RUNBOOK 填写 Worker 名称、账户或资源身份。

操作步骤：

1. 在 Cloudflare Worker Versions 页面或之前 deploy 记录中找到目标 `version_id`。
2. 打开 GitHub Actions -> `Rollback Deployment`。
3. 输入 selected `target`、`app` 和 `version_id`。
4. 运行 workflow。
5. 通过 selected target 的 canonical Gateway URL 验证对应 API health 或应用路径。

### 3.2 Pages rollback

适用：
- `auth`
- `blog`
- `dashboard`
- `movie`
- `comic`

当前策略：
- workflow 明确 fail-closed，不伪装成自动回滚。
- 实际回退走 Cloudflare Pages deployment history。

操作步骤：

1. 用 selected target 与 explicit Pages surface 触发 rollback workflow；该 workflow 只解析 profile，不自动执行 Pages 回退。
2. 在 workflow 输出所解析的 Pages 项目中进入 Deployments。
3. 找到上一条稳定 deployment。
4. 使用 Cloudflare Pages 控制台的 rollback / promote 上一版本能力执行回退。
5. 通过 selected target 的 canonical Gateway URL 验证对应 surface 可用。

### 3.3 回滚优先级

1. 先回滚最外层入口故障：
   - `gateway`
2. 再回滚核心请求链路：
   - `api`
3. 最后回滚单个前端：
   - `auth/blog/dashboard/movie/comic`

---

## 4. D1 migration safety

### 4.1 标准顺序

生产 migration 必须严格遵循：

1. 检查本次 SQL 是否包含 destructive 语句
2. 如命中 destructive 模式，先完成 reviewer ack
3. 在远程 apply 前导出 selected target 解析出的 D1 数据库：
   - `wrangler d1 export <selected-d1-database> --remote --output=<backup.sql>`
4. 上传 backup 到 R2：
   - `wrangler r2 object put <selected-backup-bucket>/ops/d1-backups/<backup.sql> --file=<backup.sql> --remote`
5. 上传 backup artifact 副本
6. 再对 selected target 解析出的数据库执行：
   - `wrangler d1 migrations apply <selected-d1-database> --remote`
7. apply 后立即做 smoke query / 业务 smoke

### 4.2 Dangerous SQL Gate

当前 gate 覆盖：

- `DROP COLUMN`
- `DROP TABLE`
- `ALTER TABLE ... DROP`

触发路径：

- `ci.yml`：检测本次 diff 是否包含危险 SQL
- `deploy-migrations.yml`：若命中，则进入 `production-migration-review` protected environment，需要 reviewer ack

### 4.3 备份与恢复

当前 workflow 行为：

- backup 在 apply 前导出为 SQL，并上传到 R2
- 同一份 SQL 额外保留为 GitHub Actions artifact
- artifact 保留 14 天
- 文件名格式：
  - `<target-id>-d1-<run_id>-<run_attempt>.sql`

恢复原则：

- 不做自动逆迁移
- 优先使用 Cloudflare D1 原生 restore / time-travel 能力恢复到最近健康点
- 结构问题优先 forward-fix 新 migration
- 导出的 SQL 备份（R2 object + artifact 副本）用作审计与兜底恢复材料

### 4.4 恢复路径

首选：

1. 在 Cloudflare D1 控制台确认故障时间点
2. 使用 `wrangler d1 time-travel restore` 或 Cloudflare 控制台对应恢复能力回到健康点
3. 重新验证：
   - schema 存在性
   - 关键表行数
   - 应用 smoke

次选：

1. 下载 workflow 导出的 SQL artifact
2. 如需交叉核对，确认 R2 中存在对应 `ops/d1-backups/...sql` 对象
3. 在隔离环境确认 SQL 内容
4. 通过 D1 手动恢复路径执行回灌或重建
5. 重新补 forward-fix migration

### 4.5 Migration Smoke

每次关键 schema 变更后至少确认：

- 目标新表/新列存在
- 旧表/旧索引是否按预期退场
- API 启动和基础 query 不报错
- 前台关键路径能读写新 schema

---

## 5. Observability

### 5.1 Sentry 接入矩阵

| Surface | SDK | 接入位置 |
|---------|-----|----------|
| api | `@sentry/cloudflare` | `apps/api/src/index.ts` |
| gateway | `@sentry/cloudflare` | `apps/gateway/src/index.ts` |
| movie | `@sentry/vue` | `apps/movie-app/src/main.ts` + `Player.vue` |
| comic | `@sentry/vue` | `apps/comic-app/src/main.ts` |
| dashboard | `@sentry/vue` | `apps/dashboard/src/main.ts` |
| blog | `@sentry/nuxt` | `apps/blog/nuxt.config.ts` + `sentry.client/server.config.ts` |
| auth | `@sentry/nuxt` | `apps/auth/nuxt.config.ts` + `sentry.client/server.config.ts` |

### 5.2 首轮噪音过滤

Worker `beforeSend` 第一轮过滤目标：

- `AbortError`
- `NetworkError`
- `Failed to fetch`
- `request timed out`
- 用户主动中止或离线类请求噪音

### 5.3 Video Failure Contract

`movie-app` 的播放器错误不上抛 crash，改为 message/event 级观测，至少带：

- `error.kind`
- `playback.mode`
- `movieCode`
- `movieTitle`
- `sourceUrl`
- `streamUrl`（若为 TorrServer 模式）
- `userAgent`
- `route`

### 5.4 生产事件 smoke

至少做以下 3 类：

1. Worker error:
   - 人为触发一条 5xx 或 proxy failure
2. Video failure:
   - 触发一个无效播放源 / 缓冲失败
3. Frontend exception:
   - 人为触发一个页面异常或 Promise rejection

验收标准：

- 事件进入同一 Sentry 项目
- 不包含 cookie / session token 等敏感信息
- 已知网络中止噪音不过量堆积

---

## 6. Crawler 告警

当前策略：

- 保持 GitHub Actions 默认失败邮件提醒
- 不新增 Slack / Discord / Telegram

现有 crawler workflows：

- `daily-movie-crawl.yml`
- `daily-manga-crawl.yml`
- `daily-actor-crawl.yml`
- `daily-publisher-crawl.yml`

运维动作：

1. 失败时先看对应 workflow run
2. 下载 artifact：
   - `crawler-logs-*`
   - `actor-crawler-logs-*`
   - `publisher-crawler-logs-*`
3. 检查：
   - API health
   - `CRAWLER_SECRET`
   - R2 credentials
   - 目标源站可访问性

---

## 7. R2 成本护栏

### 7.1 Lifecycle Guidance

| Prefix | Retention / Count Guardrail | Audit Meaning | Notes |
|--------|------------------------------|---------------|-------|
| `tmp/` | 3 天 | 超龄对象 = hard failure | 短期临时对象，不能无限滞留。 |
| `crawler-debug/` | 3 天 | 超龄对象 = hard failure | 仅用于短期诊断输出，不能变成长期证据桶。 |
| `import-staging/` | 7 天 | 超龄对象 = hard failure | 导入暂存前缀，必须有明确清理窗口。 |
| `mappings/backups/` | 14 天 + 每类最近 20 份 | 超龄对象或超量 series = hard failure | 以 `actor-name-map-*` / `publisher-name-map-*` / `series-to-publisher-map-*` 等 series 粒度审计。 |
| `system/` | audit-only | 不参与短期生命周期 hard failure | 记录运行时 inventory，不自动套用短期清理规则。 |
| `ops/d1-backups/` | audit-only | 不参与短期生命周期 hard failure | 用于 D1 SQL 备份留痕，不在本阶段自动判定过期。 |

### 7.2 Repeatable Audit Procedure

以下动作前必须先跑一次 R2 成本审计：`storage policy change`、cleanup、migration、bulk import。

```bash
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --dry-run --strict-env --md-out .planning/phases/08-cost-guardrails/08-r2-audit.md --json-out .planning/phases/08-cost-guardrails/08-r2-audit.json --csv-out .planning/phases/08-cost-guardrails/08-r2-audit.csv
```

将以下结果视为 stop condition，不得继续 cleanup / lifecycle 变更：

- `guardrail_status=hard_failure`
- `cleanup_blocked=true`
- `db_reference_status=missing_credentials`
- `db_reference_status=partial`
- `db_reference_status=missing_query_context`

当前 hard failure 条件包括：

- `images/` 仍有对象
- `comics/<slug>/<chapter>` 仍有对象
- `tmp/`、`crawler-debug/`、`import-staging/` 存在超龄对象
- `mappings/backups/` 存在超过 14 天的备份
- `mappings/backups/` 任一 series 超过最近 20 份

### 7.3 Cloudflare Budget Alerts

配置位置：Cloudflare Billing → Budget Alerts。

至少创建两条阈值：

- `$1` warning
- `$3` escalation

`Budget Alerts` 是 `notify only`; they do not stop billing automatically。不要把告警误当成自动成本封顶或自动停写保护。

### 7.4 Accidental Upload Remediation

如果 audit 发现新的 forbidden prefix 或 generic writer（例如新的 `images/` 写入），按以下顺序处理：

1. 先冻结对应 writer / route / script，阻止继续写入。
2. 保留当次 Markdown / JSON / CSV audit artifacts，作为 cleanup 前的证据快照。
3. 复核 `guardrail_findings`、`cleanup_blocked_reason` 与 `db_reference_status`，确认是 runtime drift 还是历史遗留。
4. 进入后续 cleanup / migration 评估；没有完整证据前不要直接删除对象。

`accidental upload` 的第一响应目标是止血和保留证据，而不是立刻删对象。

### 7.5 Storage Policy Ownership Note

- 长期有效的 storage policy、cleanup procedure、rollback note、accidental upload remediation 都以本手册为准。
- phase 级文档只保留历史语境：
  - [`06-STORAGE-POLICY.md`](.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md) 是 policy snapshot
  - [`08-VERIFICATION.md`](.planning/phases/08-cost-guardrails/08-VERIFICATION.md) 是 verification evidence
- 后续若规则变化，先在当前 phase 的 `.planning` 工件中锁定，再在 closeout 时回写本手册。

---

## 8. 常见故障处理

### 8.1 API / Gateway 故障

现象：
- selected target 的 canonical Gateway `/api/health` 不通
- 前台全部 502 / 504

处理顺序：

1. 看 `deploy-api` / `deploy-gateway` 最近 run
2. 若是最近 deploy 引入故障，先 rollback 对应 Worker
3. 检查 Cloudflare logs / traces
4. 再决定是否 forward-fix

### 8.2 Pages 单应用白屏

现象：
- 只有某一前端白屏，其他 app 正常

处理顺序：

1. 查对应 `deploy-*.yml`
2. 在 Pages deployment history 回退上一条稳定 deployment
3. 确认 gateway 路由未改坏

### 8.3 D1 Migration 失败

现象：
- migration workflow 失败
- API 启动后 schema/query 报错

处理顺序：

1. 不继续重复 apply
2. 保存失败 run 的 backup artifact 信息
3. 判断是否需要 D1 restore / time-travel
4. 用 forward-fix migration 修补

### 8.4 Sentry 没事件

检查顺序：

1. DSN 是否已配置到对应 app
2. Worker / Pages 是否已重新部署
3. `beforeSend` 是否把事件过滤掉
4. 浏览器 devtools / worker logs 是否确实触发错误

### 8.5 WAF / 登录受阻

先看：

- Cloudflare WAF rule
- `/api/auth/sign-in` 速率限制是否误伤
- `ADMIN_GITHUB_ID` 是否缺失或配置错误

---

## 9. WAF Rate Limiting 手配记录

**需求：** PUBSEC-03 — `/api/auth/sign-in` 限制 10 req/min/IP

**配置位置：** Cloudflare Dashboard → Security → WAF → Rate Limiting Rules

**规则配置：**

| 字段 | 值 |
|------|-----|
| 规则名 | `starye-signin-ratelimit` |
| 匹配条件 | URI Path equals `/api/auth/sign-in` AND Request Method equals `POST` |
| 阈值 | 10 requests per 1 minute per IP |
| 动作 | Block（返回 429 Too Many Requests） |
| 响应码 | 429 |
| 适用范围 | selected target 的 root domain |

**配置步骤：**

1. 登录 Cloudflare Dashboard → 选择 selected target 的 root domain
2. 进入 Security → WAF → Rate Limiting Rules
3. 点击 "Create rule"
4. 填写规则名：`starye-signin-ratelimit`
5. 在 "When incoming requests match..." 设置：
   - Field: URI Path，Operator: equals，Value: `/api/auth/sign-in`
   - 点击 "And"，Field: Request Method，Operator: equals，Value: `POST`
6. 在 "Rate limit" 设置：Requests: 10，Period: 1 minute，Characteristics: IP
7. 在 "Then take action..." 选择：Block
8. 保存规则

**验证方式：**

```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST <selected-gateway-origin>/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

**配置日期：** _（配置完成后填写）_

**配置人：** _（填写）_

---

## 10. ADMIN_GITHUB_ID 白名单配置

**需求：** D-03, D-04 — 使用 GitHub 数字 ID 作为硬编码白名单，覆盖 DB 中的 `user.role`，用于个人自用场景。

**配置位置：** Cloudflare Workers → API Worker / Gateway Worker → Settings → Variables & Secrets

**步骤：**

1. 找到 GitHub 数字 ID
2. 在 API Worker 添加 Secret：
   - `ADMIN_GITHUB_ID`
3. 在 Gateway Worker 添加 Secret：
   - `ADMIN_GITHUB_ID`

CLI 示例：

```bash
cd apps/api
wrangler secret put ADMIN_GITHUB_ID

cd ../gateway
wrangler secret put ADMIN_GITHUB_ID
```

**效果：**

- API：命中白名单 session 通过 admin guard
- Gateway：命中白名单 session 可进入 `/dashboard/*`

**配置日期：** _（配置完成后填写）_

**配置人：** _（填写）_
