# Phase 16: Task Domain Foundation - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

建立受控视频、漫画 crawler 的 D1 任务领域契约：逻辑任务、不可变 attempt、结构化日志、状态迁移、模板级 lease、管理员命令/查询接口，以及可信 runner-event 回调。任务控制面是本地 Node runner 与 GitHub Actions 的共同事实源。

本阶段不执行 Node/Puppeteer crawler、不 dispatch GitHub Actions、不交付完整 Dashboard 任务界面或 RUNBOOK 运维流程；这些分别属于 Phase 17、18、19。既有视频/漫画内容 CRUD 只作为后续 receipt 交接目标，不在本阶段复制或重写。

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract

- `.planning/PROJECT.md` — v1.3 的核心价值、生产仍由 GitHub Actions 执行，以及受控模板与禁用任意输入的项目边界。
- `.planning/REQUIREMENTS.md` — CTRL-01..CTRL-05 与 OPS-01 的逐条验收要求；Phase 16 的功能边界。
- `.planning/ROADMAP.md` — Phase 16 成功标准及与 Phase 17–19 的职责分界。

### Research

- `.planning/research/SUMMARY.md` — D1 为业务真相、Actions 为执行器、receipt 才能证明成功的里程碑总论。
- `.planning/research/ARCHITECTURE.md` — 任务/attempt/日志模型与控制面边界的研究依据。
- `.planning/research/STACK.md` — D1、Workers fetch、Actions 与 HMAC 的技术约束。
- `.planning/research/FEATURES.md` — MVP 任务体验与明确延期项。
- `.planning/research/PITFALLS.md` — 幂等、取消、回调、日志和 receipt 的风险清单。

### Current integration points

- `packages/db/src/schema.ts` — 当前 Drizzle schema 与 D1 migration 的扩展起点。
- `apps/api/src/routes/admin/crawlers/index.ts` — 现有 crawler 管理路由；目前只有统计/恢复类能力，任务控制面应在此边界扩展或明确拆分。
- `apps/api/src/middleware/service-auth.ts` — 既有服务鉴权模式；runner-event 必须新增独立 HMAC 边界而非复用同步密钥。
- `packages/crawler/src/utils/api-client.ts` — 既有同步 transport，调用面较广；任务回调应作为独立适配器，避免改变通用内容同步语义。
- `apps/dashboard/src/views/Crawlers.vue` — 现有 crawler 统计/恢复界面和管理员资源权限接点；完整任务 UI 属于 Phase 19。
- `.github/workflows/daily-movie-crawl.yml` — 固定电影执行入口与 target-profile 前置条件。
- `.github/workflows/daily-manga-crawl.yml` — 固定漫画执行入口；其中遗留 `target_url` 不得成为任务 registry 的可控输入。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/db/src/schema.ts` 与 `packages/db/drizzle/`：D1/Drizzle schema 和 migration 是任务、attempt、日志、nonce/event receipt 表的既有持久化路径。
- `apps/api/src/routes/admin/crawlers/index.ts`：已经使用管理员资源权限保护 crawler 统计与恢复，适合承接管理员命令和查询端。
- `apps/api/src/middleware/service-auth.ts`：现有 crawler 内容同步鉴权应保持原用途；可信 runner events 需要独立验证器。
- `packages/crawler/src/utils/api-client.ts`：现有内容入库 transport 可继续被实际 crawler 使用；新任务领域不改变其通用行为。

### Established Patterns

- API Worker 使用 Hono 路由、Valibot 校验、Drizzle/D1 和集中错误处理；任务命令、查询和 runner event 应遵循这些边界。
- Gateway 是本地验收的唯一入口，后续本地任务可观测性使用 `http://localhost:8080`。
- GitHub Actions 先验证 `target-profile`、再运行封闭 crawler entry；生产 template registry 只能映射这些固定入口。

### Integration Points

- 新任务领域连接现有管理员 crawler 路由、Drizzle schema/migration、API 环境 secret 类型，以及现有 video/manga crawler entry。
- Dashboard 后续读取任务列表/详情/分页日志并复用现有 crawler 资源权限；receipt 后续跳转既有内容 CRUD。
- Phase 18 让 Actions input 使用 API 分配的 run ID，并使 scheduled/manual Actions 同一控制面注册和 claim lease。

</code_context>

<specifics>
## Specific Ideas

- 生产数据面继续在 GitHub Actions 的 Node/Puppeteer 环境执行；Cloudflare Worker 不运行 crawler。
- D1 记录的是控制面真相；dispatch 受理、进程启动或退出码均不足以宣布成功。
- 有效 receipt 与实际入库内容必须一致，才可进入成功；竞态、重放和乱序都要留下可审计记录。

</specifics>

<deferred>
## Deferred Ideas

- 本地 runner 的实际执行、心跳、取消协作与 receipt 验收：Phase 17。
- GitHub fine-grained PAT、workflow dispatch/cancel、provider 补偿和 schedule 注册：Phase 18。
- Dashboard 任务列表/详情/自动刷新/分页日志、内容 CRUD 跳转、密钥轮换和日志清理 RUNBOOK：Phase 19。
- 实时流式日志、通知、后台定时策略编辑、额外模板和任何自动重试：未来需求，未纳入 v1.3 Phase 16。

</deferred>

---

*Phase: 16-Task Domain Foundation*
*Context gathered: 2026-07-30*
