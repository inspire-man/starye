# Technology Stack

**Project:** Starye v1.4 - 播放可用性与生产自愈闭环
**Domain:** 个人内容中台的播放源校验、播放器恢复、受控 crawler repair 与生产浏览器验收
**Researched:** 2026-08-05
**Overall confidence:** MEDIUM

## Decision Summary

v1.4 的最小可交付栈是当前仓库已经运行的 Vue 3.5 + xgplayer 3.0.24、原生 HTMLMediaElement 事件、Hono + Cloudflare Workers + D1 + Drizzle、Node 24 + Puppeteer GitHub Actions runner，以及 Playwright Test 1.59.1。播放校验、错误恢复、repair dispatch 与 Dashboard -> Viewer 证明都由现有运行时覆盖，生产 runtime 依赖保持零新增。

播放源校验分为三层：Node runner 做有界的 HTTP/Range probe，D1 保存规范化的 health 状态，浏览器用 playing 与 currentTime 前进完成实际播放证明。HTTP 2xx 或 canplay 只代表中间层的就绪信号；fresh production run 的验收终点是 Viewer 中实际发生播放进度。

API Worker 负责鉴权、状态机、D1 投影、固定模板 dispatch 和回调验签。GitHub Actions 继续承载 Puppeteer、来源抓取和 repair；Dashboard 只提交 allowlisted 的内容 ID、模板和 target。Movie App 继续由 xgplayer 管理播放实例、重试、回退和错误呈现。各层通过现有 @starye/api-types、crawler task/run/attempt/receipt 契约连接。

最小 schema 变化是给电影和播放源增加当前 health 投影字段，保持现有 player 行作为来源身份与排序事实；repair 历史复用已经存在的 D1 crawler_task、crawler_run、attempt、log、lease 和 HMAC callback。players.isActive 继续表达用户上报后的运营状态，source probe 状态使用独立字段，避免语义混用。

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | v1.4 decision |
|------------|---------|---------|---------------|
| Turborepo + pnpm workspace | Turbo ^2.9.6; pnpm 10.33.0 | 同仓构建 API、Dashboard、Movie App、crawler 和共享契约 | 沿用现有 monorepo。API、Vue、runner 与 migration 共享同一版本基线。 |
| TypeScript | ^6.0.2 | health 状态、repair 输入、receipt、播放事件和 E2E evidence 的闭合类型 | 在 @starye/api-types 增加判别联合和 DTO；保持 API、Dashboard、runner 共用。 |
| Cloudflare Workers + Hono | Workers types ^4.20260417.1; Hono ^4.12.14 | API 控制面、鉴权、状态投影、GitHub Actions dispatch/callback | Worker 承载短请求和状态写入；Puppeteer 与长时来源工作落在 Actions。 |
| Vue + Vue Router | Vue ^3.5.32; Vue Router ^5.0.4 | MovieDetail.vue、Player.vue 的播放状态和恢复交互 | 复用现有响应式状态与路由；把 no-source、probe、retry、fallback、error 作为显式视图状态。 |
| Nuxt | ^4.4.2 | 现有 Nuxt surfaces 和统一仓库工具链 | v1.4 的 Viewer 主链位于 Movie App；Nuxt 依赖保持当前 workspace 基线。 |
| xgplayer | ^3.0.24 | HTML5 播放器实例、事件、销毁和重建 | 保持现有播放器。用 canplay、playing、waiting、error 连接状态机，使用 destroy() 后重建实例完成 bounded retry。 |
| Valibot + @starye/api-types | Valibot ^1.3.1; workspace package | repair 输入、health 状态、receipt 和 API projection 的运行时/编译期契约 | 只接受闭合的 template、target、movie ID 和 attempt 关联字段；固定 workflow 由 registry 持有。 |

### Playback Validation

| Capability | Existing API | v1.4 use | Dependency |
|------------|---------------|-----------|------------|
| Readiness signal | HTMLMediaElement.canplay; readyState | 显示“可开始尝试”，启动短时缓冲窗口 | Browser built-in |
| Actual playback signal | playing; currentTime delta | Viewer 验收的成功条件 | Browser built-in + Playwright |
| Stall signal | waiting; bounded timer | 进入 buffering/source-degraded，触发有限重试 | Browser built-in + existing Player.vue timer |
| Failure signal | error; networkState; play() Promise rejection | 分类 source-invalid、network、xgplayer、torrserver | Browser built-in + xgplayer |
| Source restart | HTMLMediaElement.load() and xgplayer instance lifecycle | 同源重试、切换下一来源、销毁后重建 | Browser built-in + xgplayer destroy() |
| Server-side probe | Node global fetch; AbortSignal.timeout() | Actions 中的 HEAD 或 byte-range GET 有界探测 | Node 24 built-in |

canplay 的含义是浏览器拥有开始播放所需的数据，playing 的含义是播放已经开始；两者在证据中分别承担 readiness 和 actual playback 角色。playing 事件后采集两个时间点的 currentTime，可把“事件触发”提升为“进度确实前进”的可验证证据。

Server-side probe 采用小响应策略：优先 HEAD，源站拒绝 HEAD 时使用 Range: bytes=0-0 的 GET；每次请求绑定 AbortSignal.timeout()，限定重定向、状态码、Content-Type 和响应大小，记录规范化的 probeStatus、httpStatus、contentType、errorCode 与 checkedAt。probe 是来源筛选信号，浏览器播放仍是最终验收信号。

磁力链接进入 download-only 或 torrserver-pending 分支。MovieDetail.vue 继续使用现有 Aria2/TorrServer 交互，直接把 magnet 当作 HTML5 可播放 URL 会造成错误分类。

### Database

| Technology | Version | Purpose | v1.4 decision |
|------------|---------|---------|---------------|
| Cloudflare D1 | Existing Worker binding | 播放源身份、movie aggregate、health projection、repair task/run receipt | 沿用唯一业务事实源；把 Viewer 需要的状态从 D1/API 投影出来。 |
| Drizzle ORM | 0.45.2 | movies、players、crawler tables 的 schema 和查询 | 沿用 @starye/db。migration 扩展 current health 字段与索引。 |
| drizzle-kit | ^0.31.10 | migration generation and application | 沿用 packages/db 的 generate 与 target-remote-entry --entry d1-migrate 路径。 |
| D1 prepared statements | Cloudflare D1 Worker API | 所有 health、task、run、receipt 写入 | 使用 prepare().bind()，输入字段进入显式 allowlist。 |
| D1 batch() | Cloudflare D1 Worker API | 状态转换、probe 结果、receipt 和末条日志的成组写入 | 让一次 repair 结果的关联写入按既有 repository 边界完成。 |

#### Minimal schema extension

现有 movie 已有 crawlStatus、totalPlayers、crawledPlayers，现有 player 已有 sourceUrl、quality、sortOrder、reportCount、isActive。推荐增加以下 current projection 字段，repair 历史继续使用 crawler run：

| Entity | Fields | Meaning |
|--------|--------|---------|
| movie | playbackStatus、playbackCheckedAt、playbackLastErrorCode、playbackRepairTaskId | 让 players=0 具有可查询的 no_source/source_repairable/repair_running/repair_exhausted 状态。 |
| player | healthStatus、lastCheckedAt、lastProbeStatus、lastProbeHttpStatus、lastProbeErrorCode、lastProbeRunId | 区分来源探测与用户上报；保留 isActive 的运营语义。 |
| crawler_run.receipt_summary_json | sourceSummary、playerCount、healthCounts | 把 repair 的来源结果挂到现有 receipt，支持 Dashboard 和 fresh run 证据关联。 |

推荐的闭合状态值：

~~~text
movie.playbackStatus:
  no_source | source_unverified | source_ready | source_degraded
  source_repairable | repair_queued | repair_running | repair_failed
  repair_exhausted | playback_verified

player.healthStatus:
  unprobed | probe_ok | probe_http_error | probe_timeout
  probe_invalid_media | browser_failed | download_only | disabled
~~~

这些字段只表示当前投影；每次 repair 的完整历史仍由 task_id、run_id、attempt、sequence、receipt 和 provider_run_url 关联。状态更新使用 Drizzle repository 和 D1 batch()，避免 route 层直接散落 SQL。

### Infrastructure

| Technology | Version | Purpose | v1.4 decision |
|------------|---------|---------|---------------|
| GitHub Actions | Existing workflows with workflow_dispatch | production crawler and player repair execution | 复用固定 workflow、target-profile、prepare-mutation、run-prepared-entry；每次 repair 产生 fresh run_id。 |
| Node.js | Actions node-version: 24 | Puppeteer、source probe、receipt builder、callback client | 使用 Node 24 内建 fetch 和 AbortSignal.timeout()，保持 runner 与现有 workflow 一致。 |
| Puppeteer | puppeteer-core ^24.41.0; puppeteer ^24.41.0; puppeteer-extra ^3.3.6 | crawler source extraction and repair | 继续由 GitHub-hosted runner 执行；Actions 是浏览器执行边界。 |
| tsx | 4.21.0 | local/Actions TypeScript entrypoints | 复用 target-remote-entry.ts 和 task runner CLI，显式传入 target、entry、task/run identifiers。 |
| GitHub REST via native fetch | GitHub API 2022-11-28 headers | dispatch、run lookup、cancel、reconcile | 现有窄 client 已覆盖控制面；请求只引用 registry-owned workflow/ref/template 和保存的 provider run ID。 |
| GitHub Environment secrets | Existing starye-org | Cloudflare、R2、crawler、callback credentials | 沿用现有 secret projection 和 HMAC callback key rotation。 |

### E2E Evidence

| Technology | Version | Purpose | v1.4 decision |
|------------|---------|---------|---------------|
| Playwright Test | @playwright/test ^1.59.1 | fresh production run 的 Dashboard -> Viewer -> playback proof | 复用现有 projects、assertions、trace/video/screenshot；加入成功路径的结构化 evidence JSON 和关键截图。 |
| Gateway | Local canonical URL http://localhost:8080 | 本地统一入口、cookie/auth、Dashboard 与 Viewer 的同源路径 | 本地验证和本地 evidence 使用 Gateway；app 的 5173 仅作为 dev server implementation detail。 |
| Production target profile | Existing tracked target | selected production deployment and evidence metadata | fresh run 绑定目标 profile、task/run/attempt 和 receipt；历史 Phase 13 carrier 保持冻结。 |

Playwright 的 baseURL 和 webServer 适合本地启动，生产验收使用选定 target URL。成功 proof 至少记录：

~~~text
task_id
run_id
attempt
template
target
receipt.primaryContentId
receipt.playerCount
viewerPath
sourceState
readyState
playingObservedAt
currentTimeBefore
currentTimeAfter
evidencePaths
~~~

视频源 URL、token、cookie 和签名 material 进入 redaction；evidence 只保留可审计的 IDs、状态、时间和 artifact path。

## Integration Boundaries

| Surface | Owns | Reads/Writes | v1.4 contract |
|---------|------|--------------|---------------|
| API Worker + Hono | auth, validation, status transitions, projections, dispatch, callback verification | D1, GitHub REST | Dashboard 只提交 movieId/code、闭合 template、target profile 和可选 repair reason。 |
| D1 + Drizzle repository | current playback health, task/run/attempt/log/lease, receipt summary | prepared statements and batch() | source health 是查询事实；crawler run 是 repair history；两者用 run IDs 关联。 |
| Crawler registry | fixed movie/crawler/repair templates | validated target and entry | template、workflow、ref、command、environment 均由 registry 决定，输入只包含 allowlisted content identifiers。 |
| GitHub Actions runner | Puppeteer enrichment, source probe, sync, receipt, HMAC events | Node 24, R2/API, selected target secrets | 生产浏览器执行保持在 Actions；每次 attempt 发送 started/heartbeat/log/completed/failed 事件。 |
| Movie App + xgplayer | user-facing source selection, bounded retry, fallback, playback state | public movie API and browser media element | MovieDetail 呈现 no-source/repair/error 状态；Player 以 playing + currentTime 完成 success。 |
| Playwright | browser assertions and evidence | Gateway/production target, trace/video/screenshot | 只接受 fresh task/run/attempt 的 receipt，沿 Dashboard -> Viewer -> actual playback 顺序验收。 |
| Gateway | routing and same-origin local proof | app/API Workers | 本地 canonical proof 入口固定为 http://localhost:8080/...。 |

### Repair control flow

~~~text
Dashboard repair action
  -> API validates closed template + movie identifier + target profile
  -> D1 creates crawler_task / crawler_run / lease
  -> fixed GitHub workflow_dispatch
  -> Actions target-profile + controlled entry + Puppeteer/source probe
  -> API sync + D1 health projection + signed receipt callback
  -> Dashboard refreshes task and movie playback projection
  -> fresh Playwright proof: Dashboard -> Viewer -> playing/currentTime
~~~

workflow_dispatch 的 HTTP response 表示 dispatch 受理；running、succeeded 和 failed 使用 provider run association、signed callback、receipt 与状态查询共同判定。run_id、attempt 和 github_run_id 的对应关系写入 D1，晚到事件按照既有 state machine 与 sequence 规则处理。

## Execution Recommendations

### 1. Source probe

1. runner 从 D1 receipt 或固定 repair input 读取来源身份，API 负责 ID 校验和 target 选择。
2. Node 24 使用 fetch + AbortSignal.timeout() 发出 bounded HEAD 或 byte-range GET。
3. probe 记录规范化状态，响应体保持最小；D1 通过 prepared statement 写入 current projection。
4. Browser proof 再用 xgplayer/native media events 确认 canplay、playing 和 currentTime progress。

Probe 输入来自数据库的既有 sourceUrl；修复模板从受控 crawler 输出生成来源。Dashboard 的任意 URL 进入验证错误状态，来源范围由模板和 target profile 固定。

### 2. Player recovery

保留 Player.vue 当前的 canplay、playing、waiting、error、10 秒 waiting timeout、同源重试、销毁重建、Aria2 fallback 与 TorrServer origin 校验。v1.4 将这些回调统一投影为有限状态机：

~~~text
source_unverified
  -> loading
  -> canplay
  -> playing
  -> buffering
  -> retrying
  -> fallback
  -> source_failed
~~~

同源重试、下一来源和 TorrServer/Aria2 fallback 各自拥有有限次数和可观察的 attempt label。retry 到达上限后，UI 返回详情页并提供 repair 状态入口；用户仍能看到原始来源的 health/error code。

### 3. SUN-064 / players=0

sync.service.ts 当前过滤空 sourceUrl、按影片去重后删除再批量插入；v1.4 先为 players=0 写入明确 aggregate status，再由固定 movie-player-repair 模板补抓并生成 receipt。totalPlayers 继续作为计数投影，playbackStatus 负责可用性语义。

Repair 成功的 acceptance contract：

~~~text
receipt.templateKey === "movie-player-repair"
receipt.primaryContentId === movie.code
receipt.playerCount >= 1
receipt.healthCounts.probe_ok + receipt.healthCounts.download_only >= 1
current_run.status === "succeeded"
~~~

实际播放 acceptance 继续由 Viewer 的 playing 与进度前进完成；receipt 中的 playerCount 只证明数据链结果。

### 4. Fresh production proof

fresh run 先在 Dashboard 触发或确认 repair task，再读取 receipt 和 source health projection，打开 Viewer，选择排序后的可播放来源，等待 playing，采集 currentTime 前后值和截图。成功与失败都生成 task/run/attempt 绑定的 JSON evidence；失败证据额外保留 Playwright trace、video 或 screenshot。

历史 Phase 13 carrier 作为冻结上下文；v1.4 的 production claim 只引用本 milestone 新生成的 task/run/attempt、receipt 和 browser artifact。

## Alternatives Considered

| Category | v1.4 choice | Alternative | Current boundary / upgrade trigger |
|----------|-------------|-------------|-------------------------------------|
| Player engine | Existing xgplayer 3.0.24 + native media APIs | HLS.js, Shaka Player | 当前来源契约以 direct URL、magnet、TorrServer 为主；出现统一 HLS/DRM manifest 契约时再引入专用 engine。 |
| HTTP probe | Node 24 global fetch | got / undici direct dependency | got 继续服务 crawler extraction；health probe 需要的 timeout、range、redirect 和 status policy 由 built-in API 覆盖。 |
| GitHub client | Existing narrow native Worker fetch client | @octokit/rest | v1.4 只需要 dispatch、run lookup、cancel、reconcile；跨仓库 GitHub administration 需求出现时再评估 Octokit。 |
| Queue/orchestration | D1 task/run/attempt/lease + Actions | Cloudflare Queues, Durable Objects, BullMQ, Temporal | 当前是单作者、低并发、近免费运维面；达到高吞吐 producer/consumer 或长时协调需求时再升级。 |
| Media platform | Existing direct source + TorrServer/Aria2 fallback | Cloudflare Stream | 当前验收关注外部来源可用性和 repair receipt；统一转码、托管和 DRM 需求出现时再做独立成本与迁移评估。 |
| Browser proof | Existing Playwright Test | Cypress or a second browser framework | 当前 Movie App、Dashboard 已有 Playwright 配置和 artifacts；跨框架会分散 Gateway、auth、evidence contract。 |
| Long-term health history | D1 bounded current projection + crawler receipts | R2 debug dump or logging SaaS | 当前保留结构化状态、错误码、run IDs 和有限 artifacts；高频时间序列需求出现时再引入专用 telemetry storage。 |

## Installation and Verification

v1.4 生产 runtime 依赖维持现有 lockfile。实现阶段优先使用现有包，播放器、HTTP client、queue 或 orchestration package 均沿用当前组合。

~~~bash
# workspace baseline
pnpm install --frozen-lockfile

# schema and shared contracts
pnpm --filter @starye/db generate
pnpm --filter @starye/db type-check
pnpm --filter @starye/api-types build

# control plane and runner
pnpm --filter api type-check
pnpm --filter @starye/crawler type-check
pnpm --filter @starye/crawler test:unit

# player and browser contracts
pnpm --filter @starye/movie-app type-check
pnpm --filter @starye/movie-app test:run
pnpm --filter @starye/movie-app test:e2e
pnpm --filter dashboard test:e2e
~~~

migration 的远端执行继续经过 target-remote-entry 和选定 target profile。Playwright 本地运行经过 Gateway http://localhost:8080，生产 proof 使用新鲜 target profile 和新鲜 run IDs。

## Version Policy

- pnpm-lock.yaml 是 v1.4 的解析版本基线；package manifest 中的 caret 范围按当前锁定结果验收。
- 现有 xgplayer ^3.0.24、Vue ^3.5.32、Hono ^4.12.14、Drizzle 0.45.2、Wrangler ^4.90.0、Playwright ^1.59.1、Puppeteer ^24.41.0 和 Node 24 workflow pin 进入计划验收矩阵。
- migration、API contract、Dashboard projection、Movie App state machine 和 evidence schema 一起做 type-check/test；版本升级作为独立决策。
- GitHub Actions dispatch 请求使用 Accept: application/vnd.github+json 与 X-GitHub-Api-Version: 2022-11-28，并把 workflow、ref、target、template 固定在 registry/target profile。
- source URL、cookie、token、HMAC secret、provider credentials 和 signed session material 进入 secret/env 或 redaction policy；D1 receipt 只保留可审计的 ID、状态、数量和错误码。

## Dependency Order for Roadmap

1. **Schema and shared contract:** health statuses、probe result、repair receipt 和 evidence fields 先进入 @starye/db 与 @starye/api-types。
2. **API projection and repair control:** API route、D1 repository、closed template registry、lease、HMAC callback 和 Actions dispatch 依赖第 1 步。
3. **Crawler repair and probe:** Node 24 runner、Puppeteer enrichment、bounded probe、sync fix、receipt 依赖第 2 步。
4. **Movie playback states:** MovieDetail、Player、retry/fallback/error UI 消费第 1 步的 projection，并以第 3 步的来源结果做联调。
5. **Fresh production evidence:** Playwright Dashboard -> Viewer -> actual playback proof 依赖第 2 至第 4 步以及新鲜 production run。

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Current repository stack | HIGH | 当前 package.json、源码、workflow、Playwright config 和 required_reading 直接核对。 |
| Browser media semantics | MEDIUM | MDN 官方 API 文档和现有 Player.vue 事件链交叉核对；研究 seam classifier 返回 MEDIUM。 |
| xgplayer capability | MEDIUM | xgplayer 官方 repository/README/source definitions 与当前 3.0.24 使用方式核对。 |
| Cloudflare D1/Workers | MEDIUM | Cloudflare 官方 Workers Fetch、D1 Worker API、prepared statements、batch 文档核对。 |
| GitHub Actions control | MEDIUM | GitHub 官方 workflow dispatch、workflow runs、cancel、workflow syntax 文档核对；现有 workflow contract 作为仓库事实。 |
| Playwright evidence | MEDIUM | Playwright 官方 webServer、baseURL、assertions、trace/video 文档与现有 configs 核对。 |
| Node probe | MEDIUM | Node 24 官方 global fetch、AbortSignal.timeout() 文档与 Actions runtime pin 核对。 |

## Sources

### Repository evidence (HIGH)

- [.planning/PROJECT.md](../PROJECT.md)
- [.planning/STATE.md](../STATE.md)
- [.planning/milestones/v1.3-REQUIREMENTS.md](../milestones/v1.3-REQUIREMENTS.md)
- [.planning/milestones/v1.3-ROADMAP.md](../milestones/v1.3-ROADMAP.md)
- [packages/db/src/schema.ts](../../packages/db/src/schema.ts)
- [apps/api/src/routes/movies/services/sync.service.ts](../../apps/api/src/routes/movies/services/sync.service.ts)
- [apps/movie-app/src/views/Player.vue](../../apps/movie-app/src/views/Player.vue)
- [apps/movie-app/src/views/MovieDetail.vue](../../apps/movie-app/src/views/MovieDetail.vue)
- [packages/crawler/src/task-runner/runner-client.ts](../../packages/crawler/src/task-runner/runner-client.ts)
- [packages/crawler/src/task-runner/template-adapters.ts](../../packages/crawler/src/task-runner/template-adapters.ts)
- [scripts/target-remote-entry.ts](../../scripts/target-remote-entry.ts)
- [apps/dashboard/playwright.config.ts](../../apps/dashboard/playwright.config.ts)
- [apps/movie-app/playwright.config.ts](../../apps/movie-app/playwright.config.ts)
- [daily-movie-crawl.yml](../../.github/workflows/daily-movie-crawl.yml)

### Official sources (MEDIUM)

- [MDN HTMLMediaElement events](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
- [MDN canplay event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event), [playing](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event), [waiting](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event), [error](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error_event)
- [MDN HTMLMediaElement.readyState](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState), [load()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load), [play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
- [xgplayer official repository](https://github.com/bytedance/xgplayer), [official README](https://raw.githubusercontent.com/bytedance/xgplayer/main/README.md)
- [Cloudflare Workers Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [GitHub REST workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [workflow run](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run), [cancel workflow run](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Playwright webServer](https://playwright.dev/docs/test-webserver), [configuration](https://playwright.dev/docs/test-configuration), [assertions](https://playwright.dev/docs/test-assertions), [trace viewer](https://playwright.dev/docs/trace-viewer), [videos](https://playwright.dev/docs/videos)
- [Node.js globals: fetch](https://nodejs.org/api/globals.html#fetch), [AbortSignal.timeout()](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay)

The research plan used the context7 provider keys for these six official questions. Context7 MCP was unavailable in this runtime, so the official documentation URLs and repository behavior were used for the digest; the classifier returned MEDIUM for the stored entries.
