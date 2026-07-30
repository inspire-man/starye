# Phase 17: Local Runner Vertical Slice - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

交付由后台发起的本地 crawler 纵向切片：受控视频、漫画任务由常驻本地 Node runner 领取并执行既有 crawler，向 API 回写签名的生命周期事件、脱敏日志和可验证 receipt。操作者经 Gateway `http://localhost:8080` 在既有 Crawler 页面创建任务、观察状态与分页日志、取消或重试，并从成功 receipt 进入既有内容管理完成一次可回退编辑验证。

本阶段不让 Worker/Pages 执行 Node/Puppeteer，不 dispatch 或编排 GitHub Actions，不实现 provider 补偿、生产取消或完整 Dashboard 历史/筛选体验；这些分别属于 Phase 18 和 Phase 19。任务始终只能使用服务端封闭的视频、漫画模板，后台不接收任意命令、URL、workflow、环境变量或密钥。

</domain>

<decisions>
## Implementation Decisions

### 本地 runner 运行方式

- **D-01:** 本地 runner 是常驻 Node 进程，轮询 API 并 claim 由后台创建的任务；它只执行 API 分配的 run ID 和 registry 固定的视频/漫画模板。
- **D-02:** 一台本机同一时刻全局只运行一个 crawler 任务，避免 Puppeteer、网络和入库资源竞争。
- **D-03:** runner 离线时新任务保持 `queued`，runner 恢复后自动领取；离线本身不自动使任务失败。
- **D-04:** 视频和漫画两个固定模板都必须完成实际本地纵向执行验收。

### 入库 receipt 与内容交接

- **D-05:** runner 回传的内容标识只是候选；API 必须重新查询并核验内容存在、模板匹配和入库摘要后才可将 run 标记为成功。
- **D-06:** 成功 receipt 保存一个经验证的主内容标识，以及新增、更新汇总；该主标识是跳转既有内容管理的稳定目标。
- **D-07:** crawler 正常退出但没有可核验入库内容时，run 必须以 `receipt_missing` 失败；空 receipt 不得被视为成功或部分成功。
- **D-08:** receipt 验收从既有内容管理跳转后，执行一次可回退编辑并读回确认，再恢复原值；不为本阶段销毁验收数据。

### 取消与可重复验收

- **D-09:** runner 只在心跳与安全检查点发现 `cancel_requested` 后停止后续抓取，并用签名事件确认 `cancelled`；不强杀 crawler 子进程。
- **D-10:** Dashboard 取消操作必须二次确认，提交后显示“已请求取消，等待 runner 确认”，准确保留 `cancel_requested`。
- **D-11:** 取消前已实际入库的内容和审计摘要保留，但该 run 的终态仍为 `cancelled`，不产生成功 receipt。
- **D-12:** 用可控本地 crawler 步骤稳定验证取消协作；真实视频、漫画 crawl 另作实际纵向验收，避免将来源站时序作为取消测试的唯一依据。

### 最小 Dashboard 操作入口

- **D-13:** 在既有 `Crawlers.vue` 扩展最小任务面板，提供视频、漫画固定模板创建按钮，展示模板、最新 run 状态、取消、重试和 receipt 内容跳转；完整历史、筛选和细化运维体验留在 Phase 19。
- **D-14:** 页面可见时每 5 秒轮询状态与日志；创建、取消、重试成功后立即刷新。
- **D-15:** 默认显示最新 50 条结构化、已脱敏日志，并以游标“加载更多”分页；不使用实时流式推送。

### the agent's Discretion

- runner CLI 名称、轮询退避、API 路径、事件码、可控 crawler 的具体实现、测试 fixture 和已有 crawler 的薄适配器由实现决定。
- 这些实现必须遵守 Phase 16 已锁定的 HMAC、nonce、sequence、lease、状态机、日志容量与受控模板契约，并保持本地 canonical URL 为 Gateway `http://localhost:8080`。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract

- `.planning/PROJECT.md` — v1.3 的目标、Worker 与 GitHub Actions 的执行边界，以及本地 Gateway 约束。
- `.planning/REQUIREMENTS.md` — LOCAL-01、LOCAL-02、LOCAL-03 与 DATA-01 的逐条验收要求和 v1.3 排除项。
- `.planning/ROADMAP.md` — Phase 17 的成功标准，以及与 Phase 18、19 的职责边界。
- `.planning/research/SUMMARY.md` — D1 为控制面真相、本地 Node runner 为数据面执行器、receipt 才能证明成功的结论。

### Prior task-domain contract

- `.planning/phases/16-task-domain-foundation/16-CONTEXT.md` — 任务模板、lease、状态机、取消竞态、回调 HMAC、日志脱敏与 receipt 的已锁定前置决定。
- `packages/db/src/schema.ts` — Phase 16 task/run/log/lease/event/receipt 数据模型的扩展起点。
- `apps/api/src/domain/crawler-tasks/types.ts` — 任务与 run 的共享 DTO、状态与 receipt 类型。
- `apps/api/src/domain/crawler-tasks/state-machine.ts` — 合法状态迁移、重试和终态不可逆约束。
- `apps/api/src/domain/crawler-tasks/repository.ts` — claim、transition、日志与 retry 的 D1 持久化边界。

### Runner and API integration

- `apps/api/src/routes/admin/crawler-tasks/index.ts` — 已有管理员任务创建、查询、取消和重试的授权边界。
- `apps/api/src/routes/internal/crawler-runs/index.ts` — runner 签名事件、心跳、日志与终态 receipt 的现有回调边界。
- `packages/crawler/src/utils/api-client.ts` — 广泛复用的内容同步 transport；本阶段须以薄适配器观测其入库结果，避免改变通用语义。
- `scripts/local-dev.ts` — 现有本地服务监督器与 Gateway/API/Dashboard 启动形态；runner 要与其并存而不让 Worker 拉起 Node 子进程。

### Dashboard and acceptance evidence

- `apps/dashboard/src/views/Crawlers.vue` — 最小任务面板的既有 crawler 管理入口。
- `scripts/data-chain-smoke.ts` — 既有 run-bound receipt 生成和数据链路证据模式，仅作验收设计参考。
- `scripts/data-chain-surface-observation.ts` — Gateway surface 观察模式；本地浏览器验收仅经 `http://localhost:8080`。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/api/src/routes/admin/crawler-tasks/index.ts`：已有管理员授权、任务命令和 run-scoped 查询边界，可为 Dashboard 面板提供受控 API。
- `apps/api/src/routes/internal/crawler-runs/index.ts`：已有 `heartbeat`、`progress`、`log`、`succeeded`、`failed`、`cancelled` 事件映射和 HMAC callback 边界。
- `apps/api/src/domain/crawler-tasks/repository.ts`：已有 claim/lease、状态条件更新、重试与日志持久化基础，runner 必须调用这些契约而非写新状态机。
- `packages/crawler/src/utils/api-client.ts`：现有 crawler 入库 transport 可直接由实际 crawler 保持使用，runner 只包裹执行与 receipt 采集。
- `apps/dashboard/src/views/Crawlers.vue`：已有后台 crawler 管理与权限入口，适合追加最小本地任务面板。
- `scripts/local-dev.ts`：现有 API、Gateway、Dashboard 的本地服务监督与端口约定；可作为本地 runner 启动协作的参考。

### Established Patterns

- API 采用 Hono、Valibot、Drizzle/D1 与集中错误处理；任务查询、事件与 receipt 验证延续既有 route/domain 分层。
- D1 保存任务控制面事实；runner 进程退出、dispatch 接受或 crawler 内部输出都不足以直接宣布成功。
- Gateway 是本地浏览器验收唯一入口，Dashboard/API 的可观测性不以 `5173` 或 `8787` 直连作为 canonical URL。
- 现有本地服务以独立进程协作，Cloudflare Worker 不持有或启动 Node/Puppeteer。

### Integration Points

- 新常驻 runner 对接管理员创建的 task/run、内部 runner callback、固定 movie/manga crawler entry 和既有 ApiClient 同步。
- receipt 核验对接已有 video/comic 内容查询和既有 Dashboard CRUD 路由；成功后由主内容标识跳转。
- `Crawlers.vue` 追加固定模板创建、最新 run、轮询、取消/重试、分页日志和 receipt 跳转；完整任务运维交给 Phase 19。

</code_context>

<specifics>
## Specific Ideas

- 真实视频和漫画 crawler 都要运行，但取消测试使用可控步骤，以便稳定验证 `cancel_requested -> cancelled` 协作。
- 单机 runner 容量优先稳定而不是并发；离线积压以 `queued` 可见，而不是伪造失败。
- success 必须以经过 API 重查的内容 receipt 为依据；实际 CRUD 验收使用可恢复编辑，保留数据和可审计证据。

</specifics>

<deferred>
## Deferred Ideas

- GitHub Actions workflow dispatch、provider run 关联、取消/补偿、最小权限令牌与生产重试：Phase 18。
- Dashboard 全量历史、筛选、详情体验、实时流式日志、统一运维 RUNBOOK 与生产/本地端到端收口：Phase 19。
- 多任务并发、实时流式日志、可配置通知、定时策略编辑、额外模板和自动重试：未来需求。

</deferred>

---

*Phase: 17-Local Runner Vertical Slice*
*Context gathered: 2026-07-30*
