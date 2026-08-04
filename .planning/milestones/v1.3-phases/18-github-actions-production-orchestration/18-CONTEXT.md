# Phase 18: GitHub Actions Production Orchestration - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

让生产 API 以最小权限编排现有电影、漫画 GitHub Actions workflow，并把应用 `run_id` 与 provider `GITHUB_RUN_ID` 可靠关联。生产 workflow 使用 API 分配的 run、固定 target-profile/Environment 和签名 runner 事件回写启动、进度、日志、终态与 receipt；控制面补偿 provider 状态、支持协作取消和管理员确认后的重试，且 schedule 与手动 workflow run 都先进入 D1 控制面。

本阶段聚焦生产编排与 provider 生命周期，沿用 Phase 16/17 的受控模板、D1 状态机、独立 HMAC、receipt 校验和取消竞态契约。Worker 继续承担控制面，Node/Puppeteer crawler 继续运行在 GitHub Actions。Dashboard 全量运维体验、RUNBOOK 收口和本地/生产完整验收归 Phase 19。

</domain>

<decisions>
## Implementation Decisions

### Provider 凭据与 dispatch 边界

- **D-01:** 生产 API 使用 GitHub App installation token 调用 provider；token 按操作即时 mint，仅存在于当前请求生命周期，令牌值不进入 D1、日志或 receipt。
- **D-02:** workflow 发现采用服务端封闭 registry：`movie` 固定映射 `.github/workflows/daily-movie-crawl.yml`，`manga` 固定映射 `.github/workflows/daily-manga-crawl.yml`；仓库、`main` ref、`starye-org` target 和 GitHub Environment 由服务端确定。
- **D-03:** dispatch payload 显式携带 `run_id`、`attempt`、`template`、`target`；workflow 首步将四项与 API 记录逐项校验后再进入 crawler。

### 手动与 schedule 注册

- **D-04:** 手动任务由 API 先创建 D1 run，再 dispatch 固定 workflow；GitHub `schedule` 保留为生产定时入口，workflow 首步向 API 注册并取得 `run_id`。
- **D-05:** schedule 使用 `template + target + workflow + scheduled_at` 组成固定时间桶唯一键；重复注册返回已有控制面 run，避免同一时间桶形成第二个执行事实。
- **D-06:** schedule 注册复用独立 runner-event HMAC 体系，新增 `schedule_register` 事件语义，并绑定 workflow、repository、ref、Environment、template、target 与时间桶。
- **D-07:** 注册请求对网络超时和 5xx 做有限退避重试；身份、模板、target、时间桶等校验异常立即停止，重试窗口耗尽后在 crawler 启动前 fail-closed。

### Provider run 关联与状态补偿

- **D-08:** 注册成功后 workflow 首步发送签名 `provider_started`，携带 `GITHUB_RUN_ID`、`GITHUB_RUN_ATTEMPT`、workflow、ref、sha、Environment、template 和 target；API 只接受与 dispatch 快照精确一致的 provider 绑定。
- **D-09:** 采用混合观察：签名事件承载启动、进度、日志、终态和 receipt；API 以固定间隔查询 GitHub，在回调缺失、状态停滞或终态不一致时写入补偿事件。
- **D-10:** provider 标识不一致时写入 `provider_mismatch` 审计事件并进入有限 reconciliation window；窗口结束仍不匹配则当前 attempt 失败，后续重试使用新 attempt。
- **D-11:** 生产成功需要三重一致：GitHub provider 状态成功、签名终态事件绑定同一应用 run/attempt/provider ID、receipt 经 API 内容核验。dispatch 受理、workflow 退出码或单独的 GitHub 成功状态都不足以形成成功 receipt。

### 生产取消、重试与失联恢复

- **D-12:** 取消遵循协作语义：API 先将 run 置为 `cancel_requested`，再调用 GitHub cancel；workflow 在心跳或安全检查点读取取消状态，停止后续 crawler 并签名回写 `cancelled`。provider 接受 cancel 作为过程证据，签名终态事件负责落最终状态。
- **D-13:** 每次管理员确认后的生产重试创建递增的新 D1 attempt 和新的 GitHub workflow run；GitHub rerun 仅作为 provider 基础设施补偿手段，保持业务 attempt 语义稳定。
- **D-14:** reconciliation 在固定失联窗口后记录 `provider_lost` 并结束当前 attempt；自动重试保持关闭，管理员确认后以新 attempt 继续。
- **D-15:** 取消与成功竞态沿用既有契约：已核验的成功 receipt 在取消生效前到达时成功优先并记录“取消未生效”；其余情况保持 `cancelled` 或失败且不生成成功 receipt。已经写入的内容与审计摘要保留，后续重试使用新 attempt。

### the agent's Discretion

- GitHub App metadata 字段、installation token 的具体 mint 实现、provider REST client 封装、API route 名称、D1 migration 编号、事件码细节、轮询/退避的具体时间值、reconciliation window 的默认阈值和测试 fixture 由实现与研究决定。
- 以上实现仍需遵守 Phase 16/17 的 template registry、lease、sequence、nonce、HMAC、日志脱敏、receipt 和 Gateway/local boundary 契约。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase contract

- `.planning/PROJECT.md` — v1.3 目标、生产 crawler 运行边界、target-profile 与受控输入约束。
- `.planning/REQUIREMENTS.md` — PROD-01、PROD-02、PROD-03、OPS-01 与未来 Phase 19 的边界。
- `.planning/ROADMAP.md` — Phase 18 目标、成功标准及 schedule/手动执行要求。

### Prior task and local-runner contracts

- `.planning/phases/16-task-domain-foundation/16-CONTEXT.md` — task/run 状态机、lease、取消竞态、独立 runner-event HMAC、幂等事件与 receipt 约束。
- `.planning/phases/17-local-runner-vertical-slice/17-CONTEXT.md` — 本地 runner 的 poll/claim、取消检查点、validated receipt 和 Dashboard 最小操作边界。
- `.planning/research/SUMMARY.md` — D1 控制面、Actions 数据面和 receipt 成功门槛的里程碑研究结论。
- `.planning/research/ARCHITECTURE.md` — task/attempt/log/lease 与 provider 执行器的架构依据。
- `.planning/research/STACK.md` — GitHub Actions、Cloudflare Worker、Node crawler 与 HMAC 的技术约束。
- `.planning/research/PITFALLS.md` — dispatch 幂等、provider 关联、取消、回调、日志和 receipt 风险清单。

### Existing workflows and target boundary

- `.github/workflows/daily-movie-crawl.yml` — 现有电影 schedule、workflow_dispatch、target-profile 解析和固定 crawler entry。
- `.github/workflows/daily-manga-crawl.yml` — 现有漫画 schedule、workflow_dispatch、target-profile 解析和固定 crawler entry；遗留 `target_url` 不进入 Phase 18 受控 dispatch 输入。
- `packages/config/src/deployment-target/target-resolver.ts` — 目标 profile 解析与 CI Environment 映射。
- `packages/config/src/deployment-target/target-profile.schema.ts` — target profile 的结构和校验边界。
- `scripts/target-profile.ts` — CI target 校验、prepared context 和 workflow 侧 CLI 入口。

### API, runner and state integration

- `apps/api/src/routes/admin/crawler-tasks/index.ts` — 管理员创建、取消、重试和 task/run 权限边界。
- `apps/api/src/routes/internal/crawler-runs/index.ts` — runner poll/claim、签名事件验证、HMAC key rotation 与 receipt 事件边界。
- `apps/api/src/domain/crawler-tasks/repository.ts` — D1 task/run/attempt、lease、事件幂等和状态条件更新边界。
- `apps/api/src/domain/crawler-tasks/state-machine.ts` — 合法状态迁移、取消竞态与手动 retry 语义。
- `apps/api/src/domain/crawler-tasks/runner-event-auth.ts` — runner-event 签名、时间窗和 current/previous key 验证。
- `apps/api/src/domain/crawler-tasks/template-registry.ts` — movie/manga 固定模板与权限资源映射。
- `apps/api/src/schemas/crawler-run-events.ts` — runner 事件 envelope 与受控字段校验。
- `packages/crawler/src/task-runner/runner-client.ts` — 已有签名 poll/claim/heartbeat/log/terminal event client，可作为 Actions callback adapter 的模式参考。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/api/src/domain/crawler-tasks/repository.ts`：复用 task/run 创建、条件迁移、事件幂等、日志和 receipt 持久化边界，provider adapter 不另起状态机。
- `apps/api/src/routes/internal/crawler-runs/index.ts` 与 `packages/crawler/src/task-runner/runner-client.ts`：复用独立 HMAC、时间窗、nonce、sequence、safe event 和终态 receipt 模式，扩展 `schedule_register` / `provider_started` 语义。
- `.github/workflows/daily-movie-crawl.yml` 与 `.github/workflows/daily-manga-crawl.yml`：保留现有 target-profile prepare/run-prepared-entry 链路，在入口前增加受控注册与 provider 绑定步骤。
- `scripts/target-profile.ts` 与 `packages/config/src/deployment-target/*`：复用显式 target、GitHub Environment 映射和 prepared context 机制。

### Established Patterns

- D1 是唯一可审计控制面；dispatch、进程退出码、GitHub provider 状态和单独回调都只构成部分证据。
- workflow 输入采用封闭 registry 与显式 snapshot binding；调用方不接触任意命令、来源 URL、workflow、Environment 或 secret 值。
- runner 事件采用独立 HMAC，不复用 `CRAWLER_SECRET`；事件携带 run/attempt/event/nonce/sequence 绑定并受时间窗与幂等约束。
- target-profile 先校验再生成 prepared context；生产 workflow 继续使用 `starye-org` Environment，凭据通过受管 secret 注入。
- 本地浏览器验收保持 Gateway `http://localhost:8080`；本阶段生产 provider proof 通过控制面与 Actions 事件完成，Phase 19 负责全链路证据收口。

### Integration Points

- 新的 GitHub provider adapter 连接管理员 task/run API、GitHub App token mint、workflow dispatch/cancel/run-status REST API 和 D1 provider association 字段/事件。
- 两个 workflow 的 schedule 首步连接 `schedule_register`，手动 dispatch 连接显式 `run_id/attempt/template/target`，随后进入现有 target-profile 和 crawler entry。
- `provider_started`、poll reconciliation、cancel、provider_lost 与 terminal receipt 连接 `crawler_run` 状态机、日志审计和 Phase 19 Dashboard read model。
- Phase 19 的 Dashboard、RUNBOOK 和生产端到端 proof 将消费本阶段的 provider 状态、补偿码、attempt 链和 validated receipt。

</code_context>

<specifics>
## Specific Ideas

- 生产入口保持两个既有固定 workflow；API 不接受 workflow 名称、ref、target_url 或 secret 作为自由输入。
- 手动 dispatch 与 schedule 注册共享同一 D1 控制面和独立 runner-event HMAC，但保留各自的创建顺序：手动先建 run，schedule 首步注册。
- provider mismatch 和 provider_lost 都先留下可审计的补偿事实；成功判定继续以 provider、签名终态和 validated receipt 三重一致为门槛。
- 取消、重试和部分入库遵循 Phase 16/17 已验证的可回退语义，避免自动清理已写入内容或无限自动重试。

</specifics>

<deferred>
## Deferred Ideas

- Dashboard 全量任务历史、筛选、详情、实时流式日志、RUNBOOK 更新和本地/生产完整 CRUD 证据：Phase 19。
- 后台定时策略编辑、通知策略、额外 crawler 模板、多任务并发和无限自动重试：未来需求。
- Provider-backed 生产运行的真实凭据配置和具体 remote evidence 仍需在执行/验收阶段按目标环境另行授权与记录。

</deferred>

---

*Phase: 18-GitHub Actions Production Orchestration*
*Context gathered: 2026-07-31*
