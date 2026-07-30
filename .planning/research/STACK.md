# Technology Stack

**Project:** Starye v1.3 - 后台爬虫任务与内容运维
**Researched:** 2026-07-30

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Turborepo + pnpm workspace | Turbo `^2.9.6`, pnpm `10.33.0` | 保持 API、dashboard、crawler 和共享类型同仓交付 | 已是生产构建路径；任务状态契约必须由 API、Vue 页面与 Node runner 同时消费，不能新建独立服务仓库。 |
| TypeScript | `^6.0.2` | 任务模板、状态机、回调事件与日志上下文的共享类型 | 沿用严格 TypeScript，新增判别联合 `CrawlerTaskTemplate`、`CrawlerRunState`、`CrawlerLogEvent` 到 `@starye/api-types`，不复制 dashboard 专有类型。 |
| Cloudflare Worker + Hono | Workers types `^4.20260417.1`; Hono `^4.12.14`; `hono-openapi ^1.3.0` | 受控控制面：创建/查询/取消/重试任务、向 Actions 发起请求、接收 runner 回调 | `apps/api` 已有 Hono、D1 binding、角色认证与 OpenAPI。Worker 只处理短请求与状态汇总，绝不承载 Puppeteer。 |
| Valibot + `@hono/standard-validator` | Valibot `^1.3.1`; validator `^0.2.2` | 验证固定的漫画/视频模板、回调事件和分页查询 | 已用于 API schema；服务端只接受模板 ID、允许的 target、受限选项和 task ID，不能接收任意命令、URL、环境变量或 workflow 名。 |
| 原生 Workers `fetch` GitHub REST client | GitHub REST API version header `2022-11-28`; 无新增 npm 包 | 触发、取消、有限查询 Actions workflow run | Cloudflare 官方文档确认 Worker handler 可进行 HTTP `fetch`。这里只有 dispatch/cancel/status 三类调用，自写约 100 行的窄客户端比引入 Octokit 更适合 Worker 和当前单仓边界。 |
| 原生 Web Crypto | Workers `crypto.subtle`; 无新增 npm 包 | 验证本地/Actions runner 的 HMAC-SHA-256 回调 | Cloudflare 官方文档确认 `crypto.subtle.verify` 及 HMAC 支持；保持签名验签运行在边缘，不需要 Node crypto 兼容层。 |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cloudflare D1 | 现有 Worker binding | 任务队列、执行记录、结构化日志和回调幂等键的唯一业务事实源 | v1.3 是单作者、低并发运维面；D1 已在 API 中通过 Drizzle 使用。把任务状态留在 Actions 或本地文件会重现当前 `failed-tasks` 无法在 Worker 查询的缺口。 |
| Drizzle ORM + drizzle-kit | ORM `0.45.2`; kit `^0.31.10` | schema、关系、migration、D1 测试数据库 | 延续现有 `@starye/db` 边界。新增 `crawler_task`、`crawler_run`、`crawler_run_log` 和每模板一个 active lease/claim，而不是复用语义过宽的旧 `job` 表。 |
| D1 prepared statements + `batch()` | Cloudflare binding API | 原子写入状态转换、run 元数据和首/末条生命周期日志 | 官方 D1 文档说明 `batch()` 按顺序在一个 SQL transaction 中执行，任一失败回滚整个序列。请求参数一律 `prepare().bind()`；禁止对 API 或回调输入使用 `exec()`。 |
| `nanoid` | `^5.1.9` (现有) | task/run/callback nonce 的可追踪 ID | 已被数据库包采用；每次重试新建 run ID，并用 `retry_of_run_id` 关联，不能复用旧 run ID。 |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | 现有 GitHub-hosted runner | 生产实际运行 Node/Puppeteer crawler | 项目已用 `daily-manga-crawl.yml` 与 `daily-movie-crawl.yml`，并把 Cloudflare/R2 凭据置于 GitHub Environment；继续使用而非把浏览器自动化迁入 Worker。 |
| `workflow_dispatch` + typed inputs | GitHub Actions workflow syntax | Worker 只向两个允许的 workflow 传递 `task_id`、`run_id`、`template`、`attempt` 与回调 nonce | GitHub REST dispatch 要求 workflow 声明 `workflow_dispatch`。将 `ref` 固定为 `main`，workflow 文件名固定为现有两份，不让 dashboard 指定 YAML、branch 或 shell 参数。 |
| GitHub Actions concurrency | workflow-level guard | 防止同一视频/漫画模板的直接并发执行 | 设 `group: crawler-${{ inputs.template }}` 且 `cancel-in-progress: false`，但不把它当队列。官方文档说明同组 pending run 会被替换；D1 负责 FIFO/claim，Worker 仅在无 active lease 时 dispatch 下一项。 |
| Node.js + `tsx` runner | Node `24` in current workflows; `tsx ^4.21.0` | 本地和 Actions 共用的任务 runner CLI | 将 runner 做成 `@starye/crawler` 的显式 `task-runner --task-id --mode local|actions` 入口；本地仍经 Gateway `http://localhost:8080/api`，生产经 selected target profile。 |
| Puppeteer stack | `puppeteer-core ^24.41.0`, `puppeteer ^24.41.0`, `puppeteer-extra ^3.3.6` | 视频 crawler 浏览器自动化 | 已验证且只在 Node 环境可用。不能在 Cloudflare Worker、Pages Function 或 dashboard 浏览器进程执行。 |
| GitHub Environment + Cloudflare secrets | 现有 `starye-org` target/environment | 隔离 crawler 的 Cloudflare/R2/回调凭据 | 复用工作流的 `target-profile validate`、`prepare-mutation` 与 `run-prepared-entry`，不要旁路为手填 account ID、D1 ID 或临时 `.env`。 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@starye/api-types` | workspace | 任务 DTO、日志事件、状态值和 API client 类型 | API route、dashboard 与 runner 都通过它消费同一 JSON contract。 |
| `p-queue` | `^9.1.2` (现有) | 单个 Node runner 内的抓取子工作并发和 `AbortSignal` 停止 | 仅用于一个已 claim run 内的 URL/页面并发；不能替代跨 Actions run 的 D1 队列。 |
| `p-map` | `^7.0.4` (现有) | 有界批处理 | 子资源并行抓取且每项都能检查 cancellation 后使用；保留已有 concurrency 上限。 |
| `got` / `got-scraping` | `^15.0.2` / `^4.2.1` (现有) | Node crawler 的来源 HTTP 请求 | 继续用于 crawler 数据面；Worker 的 GitHub 控制面使用原生 `fetch`，不要把 Node HTTP client 打进 Worker。 |
| Vitest | `^4.1.4` (现有) | 状态机、claim、回调验签、GitHub client 与 runner cancellation 测试 | 以 stubbed `fetch` 与 D1 fixture 覆盖；不新增端到端 SaaS 或队列测试框架。 |

## Integration Boundaries

### GitHub Actions REST API

**控制面只允许四种资源操作：**

| Operation | REST API | Request boundary | D1 effect |
|-----------|----------|------------------|-----------|
| Dispatch | `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` | 固定 workflow ID、`ref: main`、经 schema 验证的固定模板 inputs | task 从 `queued` 原子 claim 至 `dispatching`；收到 runner started callback 后才是 `running`。 |
| Cancel | `POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel` | 只接受 task 当前保存的 `github_run_id` | REST 成功仅写 `cancelling` 与审计日志；终态必须由 callback 或 Action terminal result 确认。 |
| Reconcile | `GET /repos/{owner}/{repo}/actions/runs/{run_id}` | 仅查询该 task 已关联的 run ID；限频作为 callback 异常兜底 | 更新缺失的 GitHub URL/结论，不能从外部 run 猜测或接管任务。 |
| Retry | 再次 dispatch 同一固定模板 | 创建新 `crawler_run`，递增 attempt，关联 `retry_of_run_id` | 旧 run 永久保留，新的 task/run ID 与 nonce 使晚到回调不能覆盖当前状态。 |

Dispatch API 的默认响应在不同服务版本可能只确认受理，因而不能以 HTTP 204/202 推断 `running`。workflow 首步必须用 `${{ github.run_id }}`、`${{ github.run_attempt }}` 和原始 `task_id` 调用 `started` 回调，作为 `github_run_id` 的可信绑定；这也适用于本地 runner 的模拟 run ID。不要依赖扫描最近 workflow run 来做关联。

### Credential Decision: Fine-grained PAT Now, GitHub App Only on a Clear Trigger

**v1.3 production credential: one fine-grained PAT。** 原因是 Starye 是单作者单仓，现有 GitHub Environment 已负责 crawler secrets；GitHub App 会额外引入私钥、JWT 签发、installation ID、token exchange 和轮换运维，而 v1.3 只需要对一个仓库的 Actions 控制面调用。

| Credential | v1.3 Decision | Exact boundary |
|------------|---------------|----------------|
| Fine-grained PAT | **Use** | 保存为 API Worker secret `STARYE_GITHUB_ACTIONS_TOKEN`，resource owner/repository 限定为 Starye；仅授予 GitHub 文档要求的 `Actions: write`（metadata read 为平台固有）。Worker 使用 `Authorization: Bearer`，绝不返回 dashboard、写入 D1 日志或传入 runner。设置过期日和轮换 runbook。 |
| GitHub App installation token | **Defer, do not combine** | 当需要跨仓库、组织级安装或强制短期凭据时替换 PAT。届时 App 仅安装到目标 repo、仅 `Actions: write`；Worker 以 App 私钥 secret 生成 JWT，再换 installation token。不得把 App 私钥或 installation token 下发给 Pages/dashboard。 |
| Classic PAT | **Do not use** | `repo` scope 过宽，和 v1.3 的单仓最小权限边界不符。 |
| `GITHUB_TOKEN` | **Do not use for Worker dispatch/cancel** | 它属于当前 Actions run；Worker 没有可供复用的 Actions job token。workflow 内部仍用最小 `permissions`，例如 checkout 所需的 `contents: read`。 |

### Secure Runner Callbacks

1. 新增独立的 `TASK_RUNNER_CALLBACK_SECRET`，分别作为 Worker secret 与 GitHub Environment/local ignored env 的值；不要复用更宽用途的 `CRAWLER_SECRET`。
2. runner 对原始 JSON body 签名：`timestamp + '.' + body` 的 HMAC-SHA-256；传 `X-Starye-Timestamp`、`X-Starye-Signature`、`task_id`、`run_id`、递增 `sequence` 和 D1 保存的 nonce。
3. Worker 先在常数时间/`crypto.subtle.verify` 完成验签，再校验时间窗、run nonce、task-run 对应关系和 `sequence` 唯一索引，之后才写状态或日志。任何重放、乱序、过期或不同 task 的回调返回 401/409 并记录最小审计信息。
4. `started`、`heartbeat`、`log`、`completed`、`failed`、`cancelled` 是封闭事件集。message/context 有大小上限、字段 allowlist 与 secret redaction；不存请求头、token、完整 HTML 或长期 debug dump。

### Task/Run/Log Persistence

| Entity | Required fields | Index / invariant |
|--------|-----------------|-------------------|
| `crawler_task` | id, template, state, requested_by, queued_at, cancel_requested_at, current_run_id, idempotency_key | `(template, state, queued_at)`；同一用户操作的 idempotency key 唯一。只允许固定 video/comic template。 |
| `crawler_run` | id, task_id, attempt, mode, state, github_run_id, github_run_attempt, started_at, finished_at, result summary, retry_of_run_id, callback_nonce | `(task_id, attempt)` 唯一，`github_run_id` 唯一非空；状态转换是 compare-and-set。 |
| `crawler_run_log` | run_id, sequence, level, event, message, context_json, emitted_at | `(run_id, sequence)` 唯一；按 `(run_id, sequence)` 分页读取。日志只作受限 JSON，保留期与数量上限须随 migration 记录。 |
| template lease/claim | template, active_run_id, acquired_at | 每个视频/漫画模板最多一个 production active run；D1 transaction 获得/释放，避免 API 与 schedule 双 dispatch。 |

状态转换、claim 和第一条/最后一条审计日志使用 D1 `batch()`；普通进度日志可小批量写入。runner 每个安全检查点读取 `cancel_requested_at`，以 `AbortController` 停止新的抓取、等待安全清理、回传终态。GitHub cancel 是第二道中断，不是唯一取消机制。

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Durable queue | D1 task/run/lease + Worker dispatch | GitHub Actions concurrency | Actions concurrency 会替换 pending run，不能表示 v1.3 的排队/重试历史。 |
| Orchestration client | 原生 Worker `fetch` | `@octokit/rest` | 只有窄的三类 GitHub 调用；不增加依赖、Node runtime 假设或可泛化的 GitHub 管理面。 |
| Production credential | repo-scoped fine-grained PAT | GitHub App from day one | 单仓单作者阶段的 JWT/private-key 生命周期成本高；保留明确升级路径但不并行维护两套认证。 |
| Browser execution | Node 24 GitHub Actions/local runner | Cloudflare Worker / Pages Function | Puppeteer 与现有 anti-detection 依赖 Node/浏览器进程，Worker 应保持控制面。 |
| Cross-run queue | D1 | BullMQ + Redis, Temporal, Trigger.dev | 需要常驻或付费基础设施，超出单用户、近免费和现有 Cloudflare/D1 约束。 |
| Cloudflare primitives | 现有 D1 + API | Durable Objects / Cloudflare Queues | 本阶段没有高吞吐 producer/consumer 或长连接协调需求；会增加状态双写与运维面。 |
| Structured logs | D1 bounded rows + GitHub console | R2 长期 debug dump / SaaS logging | v1.1 已限制 R2 到必要资产与短期诊断；D1 能满足后台查询，GitHub 保留原始执行日志。 |
| Cancellation | HMAC callback + cooperative `AbortController` + Actions cancel | 仅调用 Actions cancel | 仅靠远端取消会遗漏 runner 已启动的 HTTP/browser 子任务，也会让 D1 过早显示终态。 |

## Installation

v1.3 不新增生产 runtime 包；先复用锁定版本并用 migration 和共享类型落地契约。

```bash
# 建立/检查 D1 schema 与共享契约
pnpm --filter @starye/db generate
pnpm --filter @starye/db type-check
pnpm --filter @starye/api-types build

# 验证 Worker、dashboard 和 runner 使用同一 contract
pnpm --filter api type-check
pnpm --filter dashboard type-check
pnpm --filter @starye/crawler type-check
```

配置项只由秘密管理系统提供：Worker `STARYE_GITHUB_ACTIONS_TOKEN`、`TASK_RUNNER_CALLBACK_SECRET`；GitHub Environment `TASK_RUNNER_CALLBACK_SECRET` 及既有 Cloudflare/R2 secrets。所有 token、nonce 和签名值都必须被日志 redactor 排除。

## Version Policy

- 以当前 `pnpm-lock.yaml` 的解析版本为验收基线；package.json 中已有的 caret 不构成在 v1.3 中顺手升级依赖的授权。
- 新增逻辑优先使用平台 API 与已安装包；只有测试证明缺失能力时才提出新增依赖并锁定精确版本。
- GitHub REST 请求显式带 `Accept: application/vnd.github+json` 与固定 API version header；把 dispatch/cancel/status 响应做契约测试，避免 GitHub API 行为变更静默影响状态机。
- Actions workflow 继续锁定当前 `actions/checkout@v6`、`pnpm/action-setup@v4`、`actions/setup-node@v6.3.0`、Node 24 与 pnpm 10.33.0，且必须保留 `target-profile` prepare/cleanup 步骤。

## Sources

- Repository evidence (HIGH): [`.planning/PROJECT.md`](../PROJECT.md), [`apps/api/src/routes/admin/crawlers/index.ts`](../../apps/api/src/routes/admin/crawlers/index.ts), [`apps/dashboard/src/views/Crawlers.vue`](../../apps/dashboard/src/views/Crawlers.vue), [`daily-manga-crawl.yml`](../../.github/workflows/daily-manga-crawl.yml), [`daily-movie-crawl.yml`](../../.github/workflows/daily-movie-crawl.yml), [`packages/crawler/package.json`](../../packages/crawler/package.json).
- GitHub REST: [Create a workflow dispatch event](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) and [Cancel a workflow run](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run) (MEDIUM; official documentation and current OpenAPI reviewed through research fallback).
- GitHub Actions: [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) (MEDIUM; official source reviewed).
- Cloudflare: [D1Database Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [Worker Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/), [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) (MEDIUM; official source reviewed).
