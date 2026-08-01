# Phase 19: Dashboard Operations and End-to-End Proof - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

完善既有 Dashboard crawler 管理入口，使管理员按视频/漫画资源权限创建任务、浏览完整任务与 attempt 历史、查看自动刷新的详情和分页安全日志，并在确认后执行协作取消或新 attempt 重试。成功 run 通过 API 已验证的 receipt 直接进入既有电影/漫画内容编辑器，完成真实入库内容的可回退增删改，不创建第二套编辑器。

本阶段同时把 GitHub App/Environment 凭据 metadata、90 天明细日志留存、失联、取消、重试、部分入库和回滚流程稳定写回 canonical `RUNBOOK.md`，并产出分离的本地与生产 evidence。本地对 movie/manga 两个模板都通过 Gateway 完成任务、receipt 与 CRUD 证据；生产对一个模板记录一条 credentialed provider-backed 精确 tuple。

本阶段不增加任意命令/URL/workflow/secret 输入，不在 Worker 内运行 Puppeteer，不编辑 schedule，不增加实时流式日志、通知、额外模板、自动重试或第二套内容 CRUD。

</domain>

<decisions>
## Implementation Decisions

### 任务历史、详情与刷新

- **D-01:** Dashboard 按视频和漫画模板分组展示完整 task 历史，不再只显示每个模板的最新 task；每个 task 保留全部 attempt 历史。
- **D-02:** 点击 task 后在同一页面打开详情面板，显示 attempt 切换、状态、failure code、receipt、provider 摘要和分页日志；不新增独立详情路由或抽屉。
- **D-03:** task 列表、当前详情和当前日志在页面可见时每 5 秒刷新；页面隐藏时暂停，恢复可见后立即刷新，并始终保留手动刷新。
- **D-04:** task 历史按更新时间倒序，以稳定游标和“加载更多”逐步读取；日志继续沿用最新 50 条加 sequence 游标加载更早安全日志，不增加实时流式传输。

### 权限、取消、重试与 provider 信息

- **D-05:** 无权限模板在 Dashboard 完全隐藏；有权限模板才显示列表、创建、取消、重试和 receipt 操作。API 继续按 template 的 movie/comic resource 做最终会话与 403 校验。
- **D-06:** 取消请求成功后立即显示 `cancel_requested` 的“等待 runner 确认”状态，保留当前 attempt 与日志，并禁用取消/重试等冲突操作；Dashboard 不提前伪造 `cancelled` 终态。
- **D-07:** 重试确认必须展示原终态、failure code 或取消原因和 attempt 编号，明确说明会创建新的 attempt 且历史不覆盖；确认成功后切换到新 attempt。
- **D-08:** 生产 task 详情显示脱敏 provider 状态、`GITHUB_RUN_ID`、provider attempt、commit SHA 和 provider run URL；不显示 secret、认证头或原始 callback payload。

### Receipt 与既有内容 CRUD 交接

- **D-09:** 只有 `succeeded` 且 receipt 已通过 API 校验的 run 才显示内容管理链接；链接按 `primaryContentId` 直接进入既有 Movies/Comics 管理路由并自动打开现有编辑器。
- **D-10:** receipt handoff 额外携带受控的 task ID、run ID 和 attempt 来源参数，用于返回 task 详情与 evidence 关联；编辑器只使用 `primaryContentId` 加载内容，URL 不携带原始 receipt JSON。
- **D-11:** TEST-01 对本次真实 receipt 内容执行模板化、可回退的增删改：电影更新元数据并新增/删除一个播放源；漫画更新元数据并新增/删除一个章节或等价受控子项；最后恢复原始元数据和清理验收子项。
- **D-12:** receipt 目标在当前资源权限下才可交接；403/404 或 lookup 失败时显示受控错误，保留返回 task 详情入口，不退回无关列表、不自动重试到无限等待。

### Evidence、凭据与 RUNBOOK

- **D-13:** 每次验收生成固定 tuple 的 JSON 与 Markdown evidence，至少包含 mode、target、template、workflow、repository/ref/Environment、D1 run/attempt、provider run/attempt/SHA/URL（生产）、callback event IDs/nonces、validated receipt、Gateway URL、CRUD mutation/readback/restore 结果、命令与时间戳。
- **D-14:** 本地与生产 evidence 使用独立 run tuple 和清晰标签；本地 fixture/contract 结果不得写成 credentialed provider production success。
- **D-15:** GitHub App 与 `starye-org` Environment 的 RUNBOOK 只记录 secret 名称、消费者、权限、Environment、preflight 和轮换步骤。secret 值留在受管 secret store；evidence 只记录存在性与脱敏 metadata。
- **D-16:** 延续 Phase 16 留存契约：task、attempt、终态、failure code 和 receipt 摘要长期保留，明细安全日志保留 90 天；RUNBOOK 必须给出清理、核验和失联排查步骤。
- **D-17:** 失联、取消、失败或部分入库后先冻结新 mutation 并保留 tuple、日志和 receipt；按 provider、API/D1、workflow、内容层分类处理。部署或配置回滚后以新 attempt 重跑；已入库内容不自动删除，必要修正走既有 CRUD。
- **D-18:** 生产 sign-off 记录一个模板的一条真实 provider-backed 成功 tuple；本地则对 movie 和 manga 两个模板都完成 Gateway、validated receipt 和可回退 CRUD 证据。

### the agent's Discretion

- task 列表/详情的组件拆分、每页数量、游标 DTO、provider 摘要字段布局、受控来源 query 参数名称、具体可回退元数据字段、漫画等价受控子项、evidence 文件名和测试工具由研究与规划决定。
- 上述实现必须复用现有 Hono/Valibot/D1、Vue 资源权限、ConfirmDialog、Movies/Comics 编辑器、Gateway 和 Phase 16-18 状态机/provider/receipt 契约。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase contract

- `.planning/PROJECT.md` — v1.3 核心价值、固定模板、Worker/Actions 执行边界和本地 Gateway 约束。
- `.planning/REQUIREMENTS.md` — DASH-01、DASH-02、DASH-03、OPS-02、TEST-01 的逐条验收要求和 future/out-of-scope 边界。
- `.planning/ROADMAP.md` — Phase 19 目标、成功标准和 Phase 16-18 前置关系。
- `.planning/phases/16-task-domain-foundation/16-CONTEXT.md` — task/attempt 状态机、权限、日志容量/脱敏/90 天留存、取消竞态和 receipt 契约。
- `.planning/phases/17-local-runner-vertical-slice/17-CONTEXT.md` — 本地双模板、5 秒可见性轮询、游标日志、协作取消和可回退 receipt CRUD 前置决定。
- `.planning/phases/18-github-actions-production-orchestration/18-CONTEXT.md` — provider snapshot、Actions 关联、补偿、取消、重试和三重成功判定契约。
- `.planning/phases/18-github-actions-production-orchestration/COVERAGE.md` — Phase 18 本地 contract evidence 与 Phase 19 credentialed provider tuple handoff。
- `.planning/phases/18-github-actions-production-orchestration/18-06-SUMMARY.md` — 已验证 integration fixtures、真实 provider proof 的剩余配置和 sign-off 边界。

### Dashboard and API integration

- `apps/dashboard/src/views/Crawlers.vue` — 当前最新 task 卡、页面内详情、5 秒轮询、取消/重试确认、分页日志和 receipt 跳转的扩展起点。
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` — 当前固定模板、资源权限、轮询、取消/重试、receipt 与日志组件契约。
- `apps/dashboard/src/lib/api.ts` — crawler task DTO 和 create/list/detail/log/cancel/retry 客户端边界。
- `apps/dashboard/src/composables/useResourceGuard.ts` — movie/comic 资源权限和模板可见性规则。
- `apps/dashboard/src/views/Movies.vue` — 电影 receipt query、现有编辑器、播放源增删改和内容管理入口。
- `apps/dashboard/src/views/Comics.vue` — 漫画 receipt query、现有编辑器、章节管理和内容管理入口。
- `apps/api/src/routes/admin/crawler-tasks/index.ts` — 管理员任务 create/list/detail/log/cancel/retry、provider dispatch 和模板权限边界。
- `apps/api/src/domain/crawler-tasks/repository.ts` — task/run/provider/log/receipt 的 D1 真相、CAS 与历史保留边界。
- `apps/api/src/domain/crawler-tasks/types.ts` — task、run、provider snapshot 和 receipt 类型契约。
- `apps/api/src/domain/crawler-tasks/template-registry.ts` — movie/manga 固定模板及其权限资源映射。

### Provider, evidence, and operations

- `.github/workflows/daily-movie-crawl.yml` — 固定 movie 生产 workflow 和 target/Environment 执行入口。
- `.github/workflows/daily-manga-crawl.yml` — 固定 manga 生产 workflow 和 target/Environment 执行入口。
- `scripts/local-task-runner.e2e.ts` — 本地 task 创建、runner 执行、取消和 receipt 纵向验收资产。
- `scripts/data-chain-surface-observation.ts` — Gateway surface 观察和 evidence pair 模式。
- `packages/config/src/deployment-target/data-chain-evidence.ts` — run-bound browser observation 与 receipt integrity 的既有 evidence schema/校验模式。
- `RUNBOOK.md` — GitHub 凭据、日志留存、失联、取消、重试和回滚的 canonical 长期 owner。
- `docs/documentation-ownership.md` — `.planning` 执行真相到 `RUNBOOK.md` 稳定规则的 owner/write-back 边界。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `Crawlers.vue` 已有固定模板 CTA、选中 run、页面内详情、5 秒可见性轮询、ConfirmDialog、最新 50 条安全日志和 receipt 跳转，可扩展为完整历史而不重写页面入口。
- `admin/crawler-tasks` 已有 create/list/detail/log/cancel/retry 路由、template permission、provider dispatch/cancel 和安全 receipt projection；Phase 19 主要补齐完整列表游标、provider/read-model 字段和 Dashboard 消费。
- `Movies.vue` 与 `Comics.vue` 已能读取 `?receipt=`、按 ID 重查内容并自动打开现有编辑器；它们也是可回退元数据与子资源 CRUD 的既有承载面。
- `useResourceGuard`、服务端 `canAccessCrawler` 与 `template-registry` 已形成前后端一致的 movie/comic 权限链。
- `local-task-runner.e2e.ts`、`data-chain-surface-observation.ts` 和 `data-chain-evidence.ts` 提供 run-bound Gateway/evidence 形状，可复用为 TEST-01 证据基础。

### Established Patterns

- Dashboard 使用 Vue 3、组合式状态、`@starye/ui` ConfirmDialog/反馈组件和相对 `/api` Gateway 请求；本地 canonical URL 始终是 `http://localhost:8080`。
- API 使用 Hono、Valibot、Drizzle/D1 和条件状态迁移；D1 是 task/run/provider/receipt 的唯一控制面真相。
- 日志只读取已脱敏的结构化安全字段，使用 sequence cursor 向旧记录分页；页面隐藏时停止轮询，不增加 SSE/WebSocket。
- provider、签名终态和 API validated receipt 三重一致才是生产成功；dispatch 接受、Actions 成功或本地 fixture 单独存在都不是 provider-backed sign-off。

### Integration Points

- `Crawlers.vue` 从每模板 `limit: 1` 扩展为分组完整 task 游标列表，并在当前详情中切换 task/attempt、provider 摘要和安全日志。
- API list/detail read model 需要提供稳定 task cursor、attempt/provider 摘要和 Dashboard 所需的脱敏字段，同时保持资源权限和 closed template boundary。
- Movies/Comics receipt handoff 增加受控来源参数与返回 task 入口，但继续调用现有 `getMovie`/`getComic` 和编辑器。
- Phase 19 evidence 将本地双模板 Gateway 运行与一条 production provider tuple 分别写入 phase artifact；稳定操作步骤在 closeout 写回 `RUNBOOK.md`。

</code_context>

<specifics>
## Specific Ideas

- 运维界面保留紧凑、可扫描的分组列表和页面内详情，不引入新的营销式或卡片嵌套页面结构。
- 本地 movie/manga 都必须实际经过 task -> runner -> validated receipt -> 既有 CRUD；生产只要求一个模板的一条 credentialed exact tuple。
- 电影 CRUD proof 使用元数据更新加播放源新增/删除；漫画使用元数据更新加章节或等价受控子项新增/删除，并恢复/清理验收修改。
- evidence 必须能把 UI 观察、D1 application run、provider run、签名 callback 和最终 receipt/CRUD 读回串成同一 tuple。

</specifics>

<deferred>
## Deferred Ideas

- 实时流式日志、通知策略、后台 schedule 编辑、额外 crawler 模板、多任务并发和自动业务重试继续属于未来需求。
- 第二个模板的 credentialed production provider tuple 可作为后续强化证据；Phase 19 sign-off 只锁定一条真实 production tuple。
- 独立 receipt 详情页和第二套电影/漫画编辑器保持排除。

</deferred>

---

*Phase: 19-Dashboard Operations and End-to-End Proof*
*Context gathered: 2026-08-01*
