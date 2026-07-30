# Phase 16: Task Domain Foundation - Research

**Researched:** 2026-07-30
**Domain:** Cloudflare Workers + D1 上的 crawler 任务控制面持久化与可信回调
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### 受控发起与并发

- **D-01:** 服务端封闭 template registry 只允许 `movie` 与 `manga` 两类任务；Dashboard/API 输入只可选择模板，拒绝任意命令、来源 URL、workflow、target-profile、环境变量和密钥。
- **D-02:** `crawler_task` 是逻辑任务，保存操作者和受控输入快照；同一 D1 控制面中同一模板最多一个活动 attempt。本地 runner、GitHub Actions 和定时任务共用此 lease，执行器来源不构成并发豁免。
- **D-03:** 活动任务的重复点击或网络重试为幂等操作：返回现有任务，不排队创建第二项。只有终态后的管理员显式重试才创建新的 attempt。
- **D-04:** 状态语义固定为 `queued → dispatching → running`：仅 runner 的首个签名心跳可进入 `running`，dispatch 受理本身不是已运行或成功。
- **D-05:** attempt 采用可续租 lease；runner 每 60 秒心跳，连续 10 分钟未续租时以失联原因转为失败，保留末条日志，并允许管理员显式重试。

### 取消、终态与重试

- **D-06:** `queued` 任务取消后立即进入 `cancelled`；`dispatching` 或 `running` 进入 `cancel_requested`，由 runner 的签名终态事件确认 `cancelled`。取消请求后不得继续分发。
- **D-07:** 取消与完成竞态中，经过校验且满足 receipt 契约的成功 receipt 优先；任务进入成功，时间线须记录“取消未生效”的竞态事件。
- **D-08:** 失败或取消只允许管理员确认后手动重试；重试在同一 `crawler_task` 下新建递增的不可变 attempt，历史状态、输入快照和日志不覆盖。无自动重试。
- **D-09:** 状态迁移须使用条件更新和 sequence 校验；终态不可逆。乱序或晚到的非终态事件保留为过期审计，绝不覆盖当前状态。

### 日志与审计

- **D-10:** 只持久化结构化生命周期和进度事件：时间、级别、事件码、安全消息、计数和 receipt 摘要。不得持久化原始 HTML、请求头、Cookie、完整控制台输出或任意二进制/调试 dump。
- **D-11:** 单条日志最多 4 KiB，每个 attempt 最多 500 条；达到上限写入一次 `log_truncated`。终态错误和 receipt 摘要在截断后仍可追加。
- **D-12:** task、attempt、终态、失败码与 receipt 摘要永久保留；明细日志保留 90 天。
- **D-13:** API 在写入 D1 前统一执行日志脱敏。密钥、认证头、Cookie、查询参数和敏感 URL 必须替换为 `[REDACTED]`，Dashboard 只读取脱敏后的数据。

### 可信 runner 回调

- **D-14:** 心跳、日志、终态和 receipt 使用独立 runner-event HMAC secret；本地与生产按环境分别注入，不复用 `CRAWLER_SECRET`，也不暴露给 Dashboard。
- **D-15:** 每个事件的签名载荷必须绑定 `run_id`、attempt、`event_id`、`timestamp`、`nonce` 与 `sequence`。时间偏差最多 5 分钟，nonce 和事件 ID 在 D1 中幂等记录；重复投递返回既有结果。
- **D-16:** 回调携带非敏感 `key_id`；API 同时接受当前密钥与上一版本 24 小时，随后淘汰旧版本。密钥值只存在于受管环境 secret。

### the agent's Discretion

- 表名/字段名、路由路径、事件码名称、日志分页游标和具体 migration 编号由实现决定，但必须完整满足以上状态、容量、脱敏、幂等和历史保留契约。

### Deferred Ideas (OUT OF SCOPE)

- 本地 runner 的实际执行、心跳、取消协作与 receipt 验收：Phase 17。
- GitHub fine-grained PAT、workflow dispatch/cancel、provider 补偿和 schedule 注册：Phase 18。
- Dashboard 任务列表/详情/自动刷新/分页日志、内容 CRUD 跳转、密钥轮换和日志清理 RUNBOOK：Phase 19。
- 实时流式日志、通知、后台定时策略编辑、额外模板和任何自动重试：未来需求，未纳入 v1.3 Phase 16。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTRL-01 | 管理员可从固定的视频或漫画模板创建爬虫任务，接口拒绝任意命令、URL、密钥和 workflow 参数。 | 服务器拥有的 `movie`/`manga` strict DTO、registry 与按模板资源授权。 |
| CTRL-02 | 系统持久化任务、每次 attempt、结构化日志、操作者与受控输入快照。 | D1 六表模型、Drizzle relation/index/migration 方案与审计复用。 |
| CTRL-03 | 任务状态支持排队、分发、运行、成功、失败、取消请求和已取消；非法状态迁移被拒绝。 | 封闭状态矩阵、`state_version`/`sequence` CAS、append-only transition 审计。 |
| CTRL-04 | 失败或已取消任务可创建新的可追溯 attempt，历史状态和日志保持不变。 | 同 task 的递增 `attempt_number`、不可改 snapshot、独立 run/log/transition 行。 |
| CTRL-05 | 视频/漫画模板的重复活动执行受 D1 claim/lease 约束，避免双重运行。 | 模板主键 lease、原子创建、冲突后返回 existing run、60 秒续租/10 分钟失联。 |
| OPS-01 | runner 回调使用独立 HMAC、时间窗、nonce、事件幂等和日志脱敏。 | 原始 body Web Crypto 验签、current/previous key、event receipt、结构化 allowlist/redaction。 |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 协作、验证与交付结论默认使用中文；执行中的 `.planning/*` 是当前 phase 的事实源。
- 本地验收的 canonical 入口只能是 Gateway `http://localhost:8080/...`，不可把 API/Vite 直连端口写成 canonical URL。
- 工作树已脏；计划和执行必须只触及本 phase 的文件，不回滚、覆盖、暂存或清理无关改动。
- 改动函数、类或方法前必须执行 GitNexus impact analysis；若为 HIGH/CRITICAL，先显式报告 blast radius；提交前必须执行 GitNexus detect-changes。
- 数据库结构变更遵循项目技能：更新 `packages/db/src/schema.ts`（含外键对应 `relations()`）、生成 Drizzle SQL、在 API Worker scope 本地 apply，并运行 `@starye/api-types` build 与 API type-check。 [VERIFIED: .agents/skills/starye-db-migration/SKILL.md]
- 新 API 使用现有 Hono + Valibot + 路由挂载链；前端只经 typed RPC wrapper 访问 API。Phase 16 不交付 Dashboard UI。 [VERIFIED: .agents/skills/starye-hono-rpc/SKILL.md]
- Worker 只做控制面；crawler 保持在 Node/Puppeteer 的本地 runner 或 GitHub Actions，且既有 crawler parser/strategy 分层与 fixture-first 测试边界不变。 [VERIFIED: .agents/skills/starye-crawler-strategy/SKILL.md]

## Summary

Phase 16 应交付一个独立、持久化的 crawler 控制面：D1 是任务、attempt、状态与可显示日志的唯一业务事实；Worker 只负责受控命令、鉴权、状态写入和 runner-event 验证。`packages/crawler` 的 Node/Puppeteer、`ApiClient.syncMovie()` 和两个 daily Actions workflow 仍是后续执行器，不在本 phase 改写或直接触发。现有 `/api/admin/crawlers` 只统计内容的 `crawlStatus`，失败记录仍提示到本地/Actions 文件，因而不能承载本 phase 的 run 事实。 [VERIFIED: apps/api/src/routes/admin/crawlers/index.ts] [VERIFIED: packages/crawler/src/utils/api-client.ts] [VERIFIED: .github/workflows/daily-movie-crawl.yml] [VERIFIED: .github/workflows/daily-manga-crawl.yml]

持久化设计的关键是把逻辑 task 与每次 run 分开，以模板 lease 拦住并发，再以条件更新和 event receipt 处理网络重投、乱序与取消竞态。Cloudflare D1 的 `batch()` 会顺序执行 prepared statements，作为一个 SQL transaction；绑定参数可避免 SQL injection，适合 task/run/lease/audit 的小而封闭写入。 [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] [CITED: https://developers.cloudflare.com/d1/worker-api/prepared-statements/]

**Primary recommendation:** 新建 session-only 的管理任务路由与独立 HMAC runner-event 路由；使用 `crawler_task` + `crawler_run` + lease/event/transition/log 表，任何用户输入只允许 `{ template: 'movie' | 'manga' }`，并以 D1 CAS 贯彻状态机。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 固定模板创建、查询、取消、重试 | API / Backend | Database / Storage | 只有 API 能将 session 身份与 server-owned registry 合并，D1 保存命令结果。 [VERIFIED: apps/api/src/index.ts] |
| task、run、lease、状态历史和日志 | Database / Storage | API / Backend | D1 是跨本地 runner、Actions 与 schedule 的持久化事实源；API 仅执行受限状态写入。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |
| HMAC runner event、nonce 与幂等结果 | API / Backend | Database / Storage | Worker 验签并拒绝请求，D1 以唯一约束和 sequence 保存已处理结果。 [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |
| Node/Puppeteer crawler 实际运行与安全清理 | GitHub Actions / Local Node runner | API / Backend | 生产数据面仍在 Actions，本地数据面仍在 Node；Worker 不运行 crawler。 [VERIFIED: .planning/ROADMAP.md] |
| Dashboard 任务页面、轮询与 receipt 到内容 CRUD 跳转 | Browser / Client | API / Backend | 完整 UI 属 Phase 19；本 phase 只提供稳定 command/query DTO。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |

## Standard Stack

### Core

| Library / Platform | Locked version | Purpose | Why Standard |
|--------------------|----------------|---------|--------------|
| Cloudflare Workers D1 binding | Native Worker API | 条件更新、lease、事件 receipt 与结构化日志持久化 | `prepare().bind()` 和 `batch()` 已覆盖本 phase 所需的参数化查询与小事务，无需新增队列或数据库。 [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| `drizzle-orm` | installed `0.45.2`; registry current `0.45.2` | schema、relations、常规查询和 migration generation | 现有 `@starye/db` 已以 D1 driver 创建 Drizzle client，并已有 SQLite unique/index 迁移模式。 [VERIFIED: packages/db/src/index.ts] [VERIFIED: packages/db/src/schema.ts] |
| `hono` | installed `4.12.18`; registry current `4.12.32` | Worker 路由和 middleware | API 已由 `Hono<AppEnv>` 全局挂载 DB/auth/error middleware；保持同一类型链。 [VERIFIED: apps/api/src/index.ts] [VERIFIED: npm registry] |
| `valibot` | installed `1.3.1`; registry current `1.4.2` | strict request/event DTO | 仓库已经使用 `v.strictObject` 约束 target 配置；新命令 DTO 以同模式拒绝未知字段。 [VERIFIED: packages/config/src/deployment-target/target-profile.schema.ts] [VERIFIED: npm registry] |
| Workers Web Crypto | Native Worker API | HMAC-SHA-256 导入、验签 | `crypto.subtle.verify()` 直接返回 signature 与数据是否匹配；避免手写密码学或把 secret 放进 Dashboard。 [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |

### Supporting

| Library / Platform | Locked version | Purpose | When to Use |
|--------------------|----------------|---------|-------------|
| `hono-openapi` | installed `1.3.0`; registry current `1.3.1` | 管理命令的 `describeRoute`/validator 说明 | 新 admin routes 与既有 API 文档保持一致。 [VERIFIED: apps/api/src/routes/admin/crawlers/index.ts] [VERIFIED: npm registry] |
| `vitest` | installed `4.1.4`; registry current `4.1.10` | domain、route、HMAC、race 和 migration regression tests | API 与 crawler 都已有 Node Vitest 配置；本 phase 不升级版本。 [VERIFIED: apps/api/vitest.config.ts] [VERIFIED: packages/crawler/package.json] [VERIFIED: npm registry] |
| `wrangler` | workspace `4.90.1` | local D1 migration/schema probe | Drizzle SQL 生成后，在 Worker project scope 执行本地 apply；远程 migration 保持既有 target/preflight 流程。 [VERIFIED: packages/db/MIGRATION.md] [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D1 task/run/lease 控制面 | GitHub Actions concurrency | Actions concurrency 不能保存应用级 attempt、lease、取消竞态、nonce 或历史；只能作为 Phase 18 的执行器附加保护。 [VERIFIED: .planning/research/ARCHITECTURE.md] |
| native Worker `fetch` 与后续固定 workflow adapter | Octokit / 通用 GitHub SDK | Phase 16 不 dispatch workflow，Phase 18 只有固定入口；新增 SDK 没有当前价值。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |
| 结构化 D1 日志 | 原始 crawler console / HTML / R2 dump | 原始内容违背 D-10，且现有 R2 policy 已限制诊断写入；仅保留受限摘要。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |

**Installation:** 本 phase 不新增任何生产或测试 package；不得以顺手升级 Hono、Valibot、Workers types 或 Vitest 代替实现。 [VERIFIED: package.json] [VERIFIED: apps/api/package.json]

**Version verification:** 上表版本由当前 workspace `pnpm --filter api list` 和 `npm view <package> version` 于 2026-07-30 核对；registry 的较新版本只记录漂移，不是升级授权。 [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
管理员 session
  -> POST /api/admin/crawler-tasks { template }
       -> server-owned movie/manga registry
       -> D1 batch: task + queued run + template lease + audit_log
       -> 返回 existing run（已有同模板 active lease）或新 run_id

本地 runner / GitHub Actions（Phase 17/18，均不由本 phase 启动）
  -> POST /api/internal/crawler-runs/:runId/events
       -> key_id allowlist + raw-body HMAC verify + 5 min window
       -> D1 event receipt (event_id + nonce + digest)
       -> CAS transition + transition audit + redacted bounded log
       -> run status / lease / receipt summary

管理员 session
  -> GET task/run/log query; POST cancel/retry
       -> template-resource authorization + D1 read/CAS
       -> no shell, URL, workflow, target, secret or provider call

D1 expiry sweep
  -> expired lease => failed(runner_lost), release lease
  -> expired detailed logs => delete only crawler_run_log rows
```

### Recommended Project Structure

```text
packages/db/
├── src/schema.ts                         # crawler task/run/event/lease/log Drizzle definitions + relations
└── drizzle/0027_<task-domain>.sql        # generated D1 migration (number/name determined at execution)

apps/api/src/
├── domain/crawler-tasks/
│   ├── template-registry.ts               # exhaustive movie/manga mapping; no user-owned executable/options
│   ├── state-machine.ts                   # pure transition matrix, event/status types
│   ├── repository.ts                      # D1 CAS, lease, transition/event/log batches
│   ├── runner-event-auth.ts               # raw body HMAC/key rotation/time window
│   └── log-redaction.ts                   # structured allowlist + URL/query/header redaction
├── schemas/crawler-tasks.ts               # strict command/query/event DTOs
├── routes/admin/crawler-tasks/index.ts    # session-only command/query/cancel/retry routes
├── routes/internal/crawler-runs/index.ts  # HMAC-only event route; deliberately outside /admin
└── .../__tests__/                         # focused domain and route tests adjacent to owner
```

### Pattern 1: Logical task + append-only run history

**What:** `crawler_task` 表示一次管理员受控请求；`crawler_run` 表示一次 attempt，`attempt_number` 在 task 内唯一递增。`crawler_run_transition` 与 `crawler_runner_event` 记录每次状态决定和 callback receipt，不能以 retry 覆盖旧行。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**When to use:** 创建、取消、失联、终态及管理员 retry 的每一个写路径。

**Required tables and constraints:**

| Table | Required fields | Constraints / indexes |
|-------|-----------------|-----------------------|
| `crawler_task` | `id`, `template_key`, `template_version`, `requested_by_user_id`, `request_snapshot_json`, `idempotency_key`, `latest_run_id`, timestamps | `template_key` is `movie`/`manga` only in API registry; unique `(requested_by_user_id, idempotency_key)` when key exists. Snapshot is registry-produced, never a copied client payload. |
| `crawler_run` | `id` (`run_id`), `task_id`, `attempt_number`, `status`, `state_version`, `last_event_sequence`, `lease_expires_at`, `last_heartbeat_at`, `cancel_requested_at`, `failure_code`, `receipt_summary_json`, timestamps | unique `(task_id, attempt_number)`; status only changes through CAS; terminal state/receipt/failure fields never nulled or overwritten. |
| `crawler_run_transition` | `id`, `run_id`, `sequence`, `from_status`, `to_status`, `reason_code`, `safe_summary`, `created_at` | unique `(run_id, sequence)`; records normal, stale, lost and cancel-race decisions. |
| `crawler_template_lease` | `template_key`, `run_id`, `expires_at`, `renewed_at` | primary key `template_key`; one active owner across local, Actions and schedule. Deleting it is conditional on the owner run becoming terminal. |
| `crawler_runner_event` | `run_id`, `event_id`, `nonce`, `body_sha256`, `key_id`, `received_at`, `outcome` | unique `(run_id, event_id)` and `(run_id, nonce)`; duplicate matching digest returns stored outcome, mismatch/reused nonce is rejected. |
| `crawler_run_log` | `id`, `run_id`, `sequence`, `level`, `code`, `safe_message`, `counts_json`, `expires_at`, `created_at` | index `(run_id, sequence)` for cursor reads and `(expires_at)` for cleanup. Only structured, redacted rows are inserted. |

Add foreign keys and matching Drizzle `relations()` for `task -> requester`, `run -> task`, and each child -> run; this is the project's migration skill requirement. [VERIFIED: .agents/skills/starye-db-migration/SKILL.md] Existing schema already uses `sqliteTable`, `uniqueIndex`, `index`, timestamps and an `audit_log` relation, so this is an extension rather than a parallel persistence style. [VERIFIED: packages/db/src/schema.ts]

### Pattern 2: Registry first, then template-scoped authorization

**What:** Create a closed `CrawlerTaskTemplate` map owned by the API:

```ts
// Source: existing crawler entry and permission boundaries
export const crawlerTaskTemplates = {
  movie: { resource: 'movie', crawlerEntry: 'crawler-optimized', version: 'v1' },
  manga: { resource: 'comic', crawlerEntry: 'crawler-comic', version: 'v1' },
} as const
```

`manga` is the task-domain key locked by D-01; it maps to the existing `comic` resource permission and `crawler-comic` entry. [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] [VERIFIED: apps/api/src/lib/permissions.ts] [VERIFIED: packages/config/src/deployment-target/mutation-entry.ts]

**When to use:** create, query-by-id, cancel and retry all resolve `template_key` server-side before checking `canAccessCrawler`.

**Implementation rule:** add a new `admin/crawler-tasks` router protected by session-derived user/resource permission only. Do not mount it under the old `adminCrawlers` middleware: `serviceAuth` and `requireResource` both accept `x-service-token` equal to `CRAWLER_SECRET`, while D-14 requires the new callback boundary to be independent. [VERIFIED: apps/api/src/middleware/service-auth.ts] [VERIFIED: apps/api/src/middleware/resource-guard.ts] The global auth middleware already attaches a logged-in user to the Hono context. [VERIFIED: apps/api/src/middleware/auth.ts]

Use a strict Valibot command object with only `template`; reject unknown keys rather than silently discarding `url`, `command`, `workflow`, `target`, `env`, `secret` or provider parameters. This is especially important because the old `CrawlerActionSchema` currently has an optional `url` field. [VERIFIED: apps/api/src/schemas/admin.ts] [VERIFIED: packages/config/src/deployment-target/target-profile.schema.ts]

### Pattern 3: Lease-backed, compare-and-set state machine

**What:** hold the template primary-key lease in the same D1 transaction that inserts task/run/audit. A conflicting insert rolls the whole creation batch back; then read the owner lease and return its existing task/run for D-03. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]

**Transition matrix:**

| Current state | Actor/event | Next state | Required checks |
|---------------|-------------|------------|-----------------|
| — | admin create | `queued` | registry snapshot, template permission, idempotency key; acquire template lease. |
| `queued` | controlled dispatcher claim | `dispatching` | active lease owner and CAS version. Phase 16 exposes the contract but does not dispatch runner/Actions. |
| `dispatching` | first signed heartbeat | `running` | valid HMAC/key/time/nonce/event ID; exact next event sequence; renew 10-minute lease. |
| `running` | signed heartbeat/progress/log | `running` | owner run, strictly next sequence; renew lease; bounded redacted log. |
| `queued` | admin cancel | `cancelled` | CAS then terminal transition/audit; release matching lease. |
| `dispatching` / `running` | admin cancel | `cancel_requested` | CAS; block later dispatch claim; retain lease until signed terminal outcome. |
| `dispatching` / `running` / `cancel_requested` | signed valid success receipt | `succeeded` | receipt schema non-empty and template-compatible; if cancelling, append `cancel_not_effective`; release matching lease. |
| `dispatching` / `running` / `cancel_requested` | signed failed/cancelled terminal event | `failed` / `cancelled` | terminal event sequence and safe reason; release matching lease. |
| active nonterminal | 10-minute lease expiry sweep | `failed` | CAS `failure_code='runner_lost'`, retain last log, append transition, then release matching lease. |
| `failed` / `cancelled` | admin retry | new `queued` run | explicit confirmation, increment attempt, copy frozen task snapshot, acquire fresh template lease; never mutate old run. |
| terminal or sequence behind | late nonterminal callback | unchanged | persist a safe `stale_event` outcome/transition audit; do not change current state. |

Every state write must predicate on both `state_version` and `last_event_sequence`; a successful mutation increments both relevant version fields. Implement the `UPDATE`, dependent transition insert, safe log insert and event-outcome update as one bounded D1 batch, and treat `meta.changes !== 1` as stale/conflict rather than success. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] No terminal transition has an outgoing edge.

### Pattern 4: Independent raw-body HMAC event boundary

**What:** mount `POST /api/internal/crawler-runs/:runId/events` outside `/api/admin`. It accepts only a strict, signed lifecycle envelope (`heartbeat`, `progress`, `log`, `succeeded`, `failed`, `cancelled`) and never reads `CRAWLER_SECRET` or session cookies for authorization. [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**When to use:** all later local runner and Actions lifecycle writes. Phase 16 builds and tests this contract; Phase 17 and 18 become its callers.

```ts
// Source: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
const rawBody = await c.req.arrayBuffer()
const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(selectedKey.secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['verify'],
)

const verified = await crypto.subtle.verify(
  'HMAC',
  key,
  base64UrlToBytes(c.req.header('x-runner-signature') ?? ''),
  rawBody,
)
if (!verified) throw new HTTPException(401, { message: 'Invalid runner signature' })

// Only after verification: strict-parse the body, require path/body run_id equality,
// validate attempt/event_id/timestamp/nonce/sequence, then enforce the 5-minute window.
```

`key_id` chooses only one configured current key or the configured previous key. The previous key must have a server-side expiry at `now + 24h` from rotation; after it expires, reject it even if the secret is still present. Only the values of `TASK_RUNNER_CALLBACK_SECRET_CURRENT` and optional `..._PREVIOUS` reside in Worker/Actions/local managed secret injection; the key IDs and cut-off are non-secret metadata. This implements D-14–D-16 while leaving operational rotation guidance to Phase 19. [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/]

### Pattern 5: Allowlisted, bounded, redact-before-write logs

**What:** parse events to `{ timestamp, level, code, message, counts, receiptSummary? }`; reject all other payload shape. Redact before producing either `crawler_run_log`, `crawler_run_transition.safe_summary`, `crawler_runner_event.outcome`, `audit_log.changes` or an error response. [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**When to use:** every callback and admin command error path.

**Capacity rule:** cap a normal safe log at 4 KiB UTF-8 and count at most 500 nonterminal log rows. At the cap, write a single `log_truncated` transition/log marker and suppress later nonterminal detail. Preserve terminal failure code and receipt summary in permanent `crawler_run`/`crawler_run_transition` fields, so terminal facts survive log truncation and the 90-day log purge. Detail log rows carry `expires_at = created_at + 90 days`; a daily Worker scheduled cleanup deletes only expired `crawler_run_log` rows. [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

### Anti-Patterns to Avoid

- **沿用 `movies`/`comics.crawlStatus` 作为 run 状态：** 它只描述内容完整度，无法表达 attempt、lease、provider、取消或 nonce。任务状态必须独立。 [VERIFIED: apps/api/src/routes/admin/crawlers/index.ts]
- **把旧 `/admin/crawlers/recover` 的手工指令变成任务 API：** 该 route 仍返回 workflow/CLI 文本，且它的 schema 带 optional URL；新任务只可读取 registry。 [VERIFIED: apps/api/src/routes/admin/crawlers/index.ts] [VERIFIED: apps/api/src/schemas/admin.ts]
- **复用 `CRAWLER_SECRET` 或 `serviceAuth` 接 callback：** 这会把广泛的内容同步 token 变成 run 状态写 token，违反独立 HMAC 边界。 [VERIFIED: apps/api/src/middleware/service-auth.ts]
- **让 Worker/Dashboard 启动 Puppeteer 或改变 `ApiClient.syncMovie()`：** 实际 crawler 是 Phase 17/18 adapter 的责任，已有同步 transport 调用面保持不变。 [VERIFIED: packages/crawler/src/utils/api-client.ts] [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]
- **用 Actions workflow concurrency 或本地 JSON 当队列：** 两者都不能形成 D1 attempt 历史、跨执行器 lease 或可验证 callback receipt。 [VERIFIED: .planning/research/ARCHITECTURE.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL 拼接 | interpolated SQL / 自制 escaping | D1 prepared statements with `bind()` | 官方文档明确绑定参数可防 SQL injection。 [CITED: https://developers.cloudflare.com/d1/worker-api/prepared-statements/] |
| 多行 task 创建与状态写入 | 多个独立 await 写入 | D1 `batch()` + SQL CAS/unique constraints | batch 是事务；失败会 abort/rollback sequence，避免 half-created task/lease。 [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| HMAC 比对 | 手写 hash / string equality | `crypto.subtle.importKey` + `crypto.subtle.verify` | Workers 原生 API 支持 HMAC、sign、verify，且不暴露 secret。 [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |
| 通用异步队列 | Redis/BullMQ/Temporal/自建 Worker browser executor | D1 task/run/lease 领域模型 + 既有 Node/Actions 执行器 | 当前仅两个固定模板，D1 是锁定事实源且没有新增常驻服务需求。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |
| 日志“脱敏” | 先存原文再靠 Dashboard mask | DTO 字段 allowlist、URL query/header/cookie redaction 后写入 | 原文一旦入库即违反 D-10/D-13；显示层不能补救存储泄漏。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md] |

**Key insight:** Phase 16 的复杂度在状态所有权和写入顺序，不在新框架。用 D1 的唯一约束、条件更新和原生 Web Crypto 达到控制面正确性，比引入另一套 runtime 更符合既有 Workers/Drizzle/Actions 边界。 [VERIFIED: .planning/research/SUMMARY.md] [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]

## Common Pitfalls

### Pitfall 1: 创建路径的并发窗口

**What goes wrong:** 两个点击都先读到“没有 active run”，随后各自插入 task，形成同模板双执行。

**Why it happens:** 先 read、后 insert 不是 lease；仅在应用内存中标记不能跨 Worker request、local runner 和 Actions 生效。

**How to avoid:** 以 `crawler_template_lease.template_key` 主键作为最终裁决；同一 batch 写 task/run/lease/audit，lease 冲突后重新读取 owner 并返回 existing run。 [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]

**Warning signs:** 两个不同 `run_id` 同时持有同一 `template_key`，或创建失败后留下孤立 task/run。

### Pitfall 2: 把 dispatch 或首个非心跳事件宣告为 running

**What goes wrong:** UI 在没有任何 runner 的情况下显示“运行中”，或 dispatch 失败后永远悬挂。

**Why it happens:** 将 provider 受理与实际 runner 生命期混为一谈。

**How to avoid:** 只有签名 `heartbeat` 可执行 `dispatching -> running`；超时 sweep 把失联 run 标为 `failed/runner_lost`。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**Warning signs:** `running` run 没有 `last_heartbeat_at`，或 `dispatching` 没有 transition 记录。

### Pitfall 3: 乱序/重投覆盖终态

**What goes wrong:** 已成功 run 被晚到 `failed` 或 progress 事件改写，日志重复计数。

**Why it happens:** 只用 `run_id` 查找、不保存 `event_id`/`nonce`、不要求 next `sequence`。

**How to avoid:** event receipt 的双唯一键加 body digest；CAS 要求精确 version/sequence；对有效但过期的非终态事件写 `stale_event` 审计，不更新 run。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**Warning signs:** terminal run 的 `state_version` 继续增加、同一 event ID 出现多个日志行、sequence 出现回退。

### Pitfall 4: 日志成为秘密或成本泄漏面

**What goes wrong:** cookie、Authorization、签名、带 query 的 URL 或 crawler HTML 被存进 D1，并随后被 Dashboard 或 audit export 读取。

**Why it happens:** 接受任意 console 文本，或在 redaction 前写失败分支。

**How to avoid:** 只接受结构化 event code/message/counts；删除 URL query/credentials、header/cookie values 和 key-shaped values，再计算 4 KiB 限制并写库。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**Warning signs:** `safe_message` 中含 `Bearer`, `cookie`, `token=`, `signature`, `authorization` 或完整 `?` query。

### Pitfall 5: retry 修改历史或绕过 lease

**What goes wrong:** retry 把失败 run 的 status/log 更新为 queued，或在另一任务仍 active 时开始相同模板。

**Why it happens:** 把 task 与 attempt 混成一行，或只检查 task 本身是否 terminal。

**How to avoid:** retry 始终插入同 task 的下一 attempt，并再次取得模板 lease；旧 run/read-only snapshot/log 永远不改。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

**Warning signs:** attempt number 没有递增、retry 前后 run ID 相同、同模板 lease 归属与 latest run 不一致。

## Code Examples

Verified patterns from official/current sources:

### Strict command boundary

```ts
// Source: packages/config/src/deployment-target/target-profile.schema.ts
// Route must reject unknown properties rather than accepting arbitrary crawler options.
export const CreateCrawlerTaskSchema = v.strictObject({
  template: v.picklist(['movie', 'manga']),
})

const template = crawlerTaskTemplates[input.template]
if (!canAccessCrawler(c.get('user')!, template.resource)) {
  throw new HTTPException(403, { message: 'Insufficient permissions' })
}
```

### CAS transition tied to its audit row

```ts
// Source: Cloudflare D1 batch semantics
const statements = [
  env.DB.prepare(`
    UPDATE crawler_run
    SET status = ?, state_version = state_version + 1,
        last_event_sequence = ?, lease_expires_at = ?
    WHERE id = ? AND status IN (?, ?) AND state_version = ?
      AND last_event_sequence = ?
  `).bind(nextStatus, event.sequence, leaseExpiry, runId, 'dispatching', 'running', expectedVersion, expectedSequence),
  env.DB.prepare(`
    INSERT INTO crawler_run_transition
      (id, run_id, sequence, from_status, to_status, reason_code, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM crawler_run
      WHERE id = ? AND state_version = ? AND status = ?
    )
  `).bind(transitionId, runId, event.sequence, currentStatus, nextStatus, event.code, now, runId, expectedVersion + 1, nextStatus),
]
const results = await env.DB.batch(statements)
if (results[0].meta.changes !== 1) return recordStaleEvent()
```

The planner must keep the actual event-receipt update in this same bounded batch/transactional path; it must not append an accepted transition if the CAS failed. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]

### HMAC then parse, never parse then trust

```ts
// Source: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
const rawBody = await c.req.arrayBuffer()
const verified = await verifyRunnerSignature({
  rawBody,
  signature: c.req.header('x-runner-signature') ?? '',
  candidateKeys: keyFor(c.req.header('x-runner-key-id')),
})
if (!verified) throw new HTTPException(401, { message: 'Invalid runner signature' })

const event = v.parse(RunnerEventSchema, JSON.parse(new TextDecoder().decode(rawBody)))
assertRunAndAttemptMatch(event, c.req.param('runId'))
assertTimestampWithinFiveMinutes(event.timestamp, Date.now())
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/admin/crawlers/failed-tasks` reports that logs live only in local/Actions files; recover returns manual CLI/workflow instructions. | D1 task/run/event/log contract provides API-queryable truth, but does not run crawler itself. | Phase 16 | Enables local runner and Actions to report to one control plane in Phase 17/18. [VERIFIED: apps/api/src/routes/admin/crawlers/index.ts] [VERIFIED: .planning/ROADMAP.md] |
| `serviceAuth` accepts the broad `CRAWLER_SECRET` and is marked deprecated in favor of narrower auth/resource guards. | Session-only admin task routes plus independent HMAC internal runner-event route. | Phase 16 | Prevents a content-sync token from becoming a general run-status write token. [VERIFIED: apps/api/src/middleware/service-auth.ts] |

**Deprecated/outdated:**

- `serviceAuth` is not a suitable new task-control authorization primitive: its own source marks it deprecated and it grants service-token requests a virtual super-admin identity. Preserve it for existing crawler sync callers; do not extend its reach. [VERIFIED: apps/api/src/middleware/service-auth.ts]
- `target-crawl-mutation.ts` currently permits only the registry-owned smoke operation after prepared-context validation. Do not relax it in Phase 16; actual movie/manga adapter work belongs to Phase 17 and requires dedicated tests. [VERIFIED: packages/crawler/scripts/target-crawl-mutation.ts] [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

## Security Domain

### Applicable ASVS Categories

OWASP ASVS 5.0 contains the relevant V2 Validation and Business Logic, V4 API and Web Service, V6 Authentication, V7 Session Management, V8 Authorization, V11 Cryptography, V13 Configuration, V14 Data Protection and V16 Security Logging/Error Handling categories. [CITED: https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en]

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Validation and Business Logic | yes | strict `{template}`/event schemas, closed status matrix, lease and CAS checks. |
| V4 API and Web Service | yes | split session command route from HMAC event route; no user-controlled executable, URL, workflow or environment input. |
| V6 Authentication / V7 Session Management | yes | existing Better Auth session supplied by global auth middleware; management mutations are session-only. [VERIFIED: apps/api/src/middleware/auth.ts] |
| V8 Authorization | yes | resolve task template server-side, then apply existing `canAccessCrawler` resource matrix for movie/comic. [VERIFIED: apps/api/src/lib/permissions.ts] |
| V11 Cryptography | yes | native Web Crypto HMAC-SHA-256 current/previous key verification; never custom crypto. [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |
| V13 Configuration | yes | callback key values only in managed Worker/runner secrets; `key_id` is non-secret; no Dashboard exposure. |
| V14 Data Protection / V16 Security Logging | yes | redact before persistence; structured allowlist, byte/row cap, 90-day detailed-log expiry, permanent safe terminal summary. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| arbitrary command/URL/workflow injection | Tampering / Elevation | `strictObject({ template })` plus server-owned exhaustive registry; no forwarded options. |
| replayed or modified runner event | Spoofing / Tampering | raw-body HMAC, 5-minute window, `key_id`, unique event ID/nonce, SHA-256 digest and cached duplicate outcome. |
| late callback overwrites terminal state | Tampering / Repudiation | state-version + sequence CAS; terminal state has no outgoing transition; stale event audit. |
| duplicate active run | Denial of Service / Tampering | template primary-key lease created atomically with task/run; release only by same terminal run. |
| secret/PII in log/audit | Information Disclosure | redact before any D1/error/audit write and store only structured safe fields. |
| log flood | Denial of Service | 4 KiB safe message cap, 500 nonterminal rows, one truncation marker, expiry index and daily purge. |

## Assumptions Log

All architectural and security decisions in this research are either locked by `16-CONTEXT.md`, verified in the current repository, or cited from official Cloudflare/OWASP documentation. No user-confirmation assumption is required before planning.

## Open Questions

无阻塞问题。表/字段名、route path、event code、cursor encoding 与具体 migration 编号均在用户明确授权的 implementation discretion 内；planner 应把它们固定为一次实现选择，而不是暴露为 API 输入。 [VERIFIED: .planning/phases/16-task-domain-foundation/16-CONTEXT.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | API type-check、Vitest、Drizzle generation | ✓ | v24.0.1 | — |
| pnpm | monorepo scripts | ✓ | 10.33.0 | — |
| Wrangler | local D1 apply/schema probe | ✓ | 4.90.1 | — |
| Git | narrow research commit | ✓ | 2.39.2.windows.1 | — |
| GitHub CLI | Phase 16 planning only；不执行 Actions 操作 | ✓ | 2.92.0 | 不需要用于本 phase 实现 |
| Docker daemon | 不属于 Phase 16 路径 | ✗ | — | 不需要；D1 local/Worker tests 不依赖 Docker |

**Missing dependencies with no fallback:** 无。Phase 16 的远程 D1 apply 仍属于已有 explicit-target/preflight 迁移流程，未在本次研究中执行。 [VERIFIED: RUNBOOK.md] [VERIFIED: packages/db/MIGRATION.md]

**Missing dependencies with fallback:** Docker daemon 未运行，但本 phase 无容器依赖。

## Sources

### Primary (HIGH confidence)

- [`.planning/phases/16-task-domain-foundation/16-CONTEXT.md`](16-CONTEXT.md) - 全部锁定状态、lease、容量、脱敏和回调契约。
- [`packages/db/src/schema.ts`](../../../packages/db/src/schema.ts) 与 [`packages/db/drizzle/0026_unified_progress_cutover.sql`](../../../packages/db/drizzle/0026_unified_progress_cutover.sql) - Drizzle SQLite table/index/relation 与 migration 现状。
- [`apps/api/src/routes/admin/crawlers/index.ts`](../../../apps/api/src/routes/admin/crawlers/index.ts), [`apps/api/src/middleware/service-auth.ts`](../../../apps/api/src/middleware/service-auth.ts), [`apps/api/src/middleware/auth.ts`](../../../apps/api/src/middleware/auth.ts), [`apps/api/src/lib/permissions.ts`](../../../apps/api/src/lib/permissions.ts) - 当前 crawler/认证/资源授权边界。
- [`packages/crawler/src/utils/api-client.ts`](../../../packages/crawler/src/utils/api-client.ts), [`packages/crawler/scripts/target-crawl-mutation.ts`](../../../packages/crawler/scripts/target-crawl-mutation.ts) - 内容同步与现有 smoke-only prepared mutation guard。
- [`daily-movie-crawl.yml`](../../../.github/workflows/daily-movie-crawl.yml) 与 [`daily-manga-crawl.yml`](../../../.github/workflows/daily-manga-crawl.yml) - 固定 Node 24/target-profile crawler 执行入口。

### Secondary (MEDIUM confidence)

- [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) - prepared statements、`batch()` 的 transaction/rollback 语义（页面标注 modified 2026-06-22）。
- [Cloudflare D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) - `bind()` 参数化查询与 injection 防护（页面标注 modified 2026-06-22）。
- [Cloudflare D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) - migration apply/rollback 行为。
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) - HMAC、`sign()`、`verify()` API。
- [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en) - 本 phase 适用的 validation/API/auth/session/authorization/crypto/config/data/logging 类别。

### Tertiary (LOW confidence)

- 无；本研究未把训练数据或非官方搜索结果作为实现依据。

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - 现有 workspace 锁定版本、API/DB runtime 和 package registry 均已核对；不新增依赖。
- Architecture: HIGH - task/run/lease/callback 边界由已锁定 CONTEXT 与真实 Hono/Drizzle/crawler/Actions 接点共同约束。
- Pitfalls: MEDIUM - D1 transaction/Web Crypto 行为来自官方文档；具体并发 SQL 和 event replay cases 仍须以本 phase Vitest tests 固化。

**Research date:** 2026-07-30
**Valid until:** 2026-08-13（Workers/D1 文档和 package registry 变化较快；执行前复核）。
