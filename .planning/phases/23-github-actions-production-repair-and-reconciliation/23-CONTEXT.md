# Phase 23: GitHub Actions Production Repair And Reconciliation - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段把 Phase 21 已验证的本地 `repair_players` 控制面接入生产 GitHub Actions provider。用户应能从 `no_source` 或 `source_failed` 的 movie 发起同一内容身份的受控生产修复，并在 provider 波动、自动 retry、lease 过期和迟到 callback 下看到可追溯的 task/run/attempt/lease/provider/receipt/reconciliation 历史。

本阶段只覆盖 movie 的 `repair_players`。生产浏览器执行继续位于 GitHub Actions；Dashboard 只提交 server-owned movie identity、bounded reason 和固定 target intent。repair success 必须以同一 movie identity、source revision、observedAt、source summary 的 authoritative readback 与 validated repair receipt 为准。Phase 24 单独负责 fresh production tuple、Viewer evidence 和实际 `playing`/`currentTime` 播放证明。

</domain>

<decisions>
## Implementation Decisions

### 生产 Provider 调度与修复范围
- **D-01:** Phase 23 只实现 movie 的 `repair_players`，不扩展漫画或其他内容类型；更广泛 repair template 保留在 v2。
- **D-02:** 生产修复复用现有 movie GitHub Actions workflow，通过 server-owned `operation` 分流；不新增独立 repair workflow。
- **D-03:** workflow dispatch 只传 `run_id`、`attempt`、`template`、`target` 等运行绑定字段。`operation`、`movieId`、`sourceRevision`、`reason` 和 `targetIntent` 以 server-owned task snapshot 为唯一事实，不在 workflow inputs 中复制。
- **D-04:** 普通 movie crawl 与显式 `repair_players` adapter 共享现有 workflow job，在 claim 后按 task snapshot 选择 adapter；target profile、lease、签名 callback 和 provider association 生命周期保持同一控制面边界。
- **D-05:** repair snapshot 的 operation、movie identity 或 source revision 契约校验失败时进入 bounded contract failure；当前 attempt 结束并保留 provider/runner 历史，执行路径保持 fail closed，不回退普通 movie crawl。

### Provider 失败与重试策略
- **D-06:** 仅 transient provider/transport failure、timeout、provider run lost 或 lease 过期触发一次自动 retry；snapshot、authorization 和 receipt contract 等确定性错误进入当前 attempt 终态。人工重试创建新 task，并在创建前重新读取当前 source disposition。
- **D-07:** 自动 retry 归属于同一 repair task，但创建新的 application run/attempt、新 lease 和 provider association。旧 run 的日志、receipt、provider facts 和 source observation 全部保留；GitHub `providerRunAttempt` 独立记录 provider 自身重试序号。
- **D-08:** dispatch transient failure 可立即创建一次新 attempt；run timeout、lease 过期或 provider lost 先等待 reconciliation window 结束，再决定 retry，为迟到 callback 留出归属窗口并避免并行 provider 执行。
- **D-09:** `retry` 是 task-level 派生状态。旧 run 保持 `failed` 等底层状态，新 run 进入 `queued`/`dispatching` 等已有状态；task 聚合显示 retry 和当前 attempt，不新增 run-level `retry` 枚举。

### 迟到回调与 Reconciliation 规则
- **D-10:** 旧 attempt 的 callback、provider observation 和 receipt 校验结果在签名、runId、attempt、sequence、eventId、nonce 与 source revision 校验通过后，作为旧 run 的 append-only 历史保留。CAS 拒绝其改变当前 task 状态或 current source projection；UI 标记 bounded `late`/`ignored` outcome。
- **D-11:** 多个 attempt 都产生有效 repair receipt 时，当前 application attempt 取得 current source projection 的写入权。旧 attempt 的有效 receipt 和 source observation 仍保留为 late/stale 历史。
- **D-12:** provider `completed/success` 只代表 provider observation。reconciliation window 结束时，若匹配的 repair receipt 缺失、身份不匹配或 authoritative readback 校验失败，当前 attempt 进入 bounded receipt failure，不升级为 repair `succeeded`，也不因 receipt contract failure 自动 retry。
- **D-13:** 完全相同的 signed event 重放保持幂等接受；同一 `eventId` 的 body 冲突、sequence 乱序和其他 stale 事件记录 bounded rejection，并返回稳定的 `duplicate`/`stale`/`conflict` outcome。当前 task/source 只接受有效的最新 application attempt/sequence。

### Dashboard 历史与状态分层
- **D-14:** repair task detail 以当前 attempt 为 focal point，顶部展示同一 movie identity、task-level retry/当前状态和 current source projection；旧 attempts 以可展开历史保留。
- **D-15:** 旧 attempt 展示 bounded attempt summary，并可展开受控日志/事实：attempt、run 状态、provider status/conclusion、lease 结果、receipt 校验结果、source revision 和 late/stale outcome。raw URL、命令、secret、签名材料和原始 runner JSON 不进入 Dashboard projection。
- **D-16:** active repair 期间锁定同一 movie 的重复修复入口并聚焦当前 task。只有当前 task 进入 terminal 且 source disposition 仍为 repairable 时，才允许人工创建新 task；创建前重新读取当前 disposition。
- **D-17:** Dashboard 展示 allowlisted provider summary 与 run link，包括 provider、repository、workflow、ref、environment、provider run ID、provider attempt、status/conclusion、lease 和 reconciliation 结果。provider dispatch accepted/running/completed、repair success、receipt validated/failed 和 current source state 作为独立事实层呈现。

### the agent's Discretion
- bounded reason、contract failure、late/stale/conflict 和 receipt failure 的具体 allowlist、字段命名与中文文案，只要保持 server-owned、可脱敏和可追溯。
- reconciliation window 的具体时长、poll cadence、CAS SQL 形状、provider retryable code 分类和 lease recovery 内部实现，只要遵循 D-06 至 D-13。
- workflow job 内的 shell/TypeScript 编排、repair adapter 复用方式、task 聚合 DTO 的内部拆分和 Dashboard 组件布局，只要保持同一 task identity、operation-aware adapter 和状态分层。
- focused integration tests、fixture 和验证脚本的组织方式，只要覆盖 provider dispatch、attempt retry、late callback、receipt boundary、source revision CAS、Dashboard history 和 canonical Gateway 路径。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §Phase 23 — 阶段目标、REP-02/REP-03 和三项成功标准；同时确认 Phase 24 的 fresh production playback boundary。
- `.planning/REQUIREMENTS.md` §Repair Operations / §Production Evidence / Traceability — REP-02、REP-03 的状态、幂等、retry、同一 content identity 与 receipt 要求。
- `.planning/PROJECT.md` §Current Milestone / Current State / Out of Scope — GitHub Actions 生产执行边界、受控模板、单用户和后续 phase 范围。
- `.planning/STATE.md` — 当前 Phase 23 planning position 和 session tracking。

### Prior phase contracts
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-CONTEXT.md` — local `repair_players` 输入、operation-aware adapter、source observation、receipt、source revision CAS、retry 和 stale-event 基线。
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-VERIFICATION.md` — local Gateway vertical proof 与 production/provider/playback 尚未宣称的边界。
- `.planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-CONTEXT.md` — Dashboard task focal point、5 秒 polling、same-movie handoff、current source projection 和 Phase 23 边界。
- `.planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-VERIFICATION.md` — Phase 22 状态/UI 验证结果和后续 production reconciliation 入口。
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-03-SUMMARY.md` — readiness、receipt、content identity 和 browser playback proof 分层基线。
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-VERIFICATION.md` — metadata/source/playback proof 的独立语义与验证边界。

### Current control-plane implementation
- `apps/api/src/domain/crawler-tasks/types.ts` — task/run/provider status types、repair snapshot、provider association summary 和 receipt contracts。
- `apps/api/src/domain/crawler-tasks/provider-association.ts` — immutable provider registry、snapshot 和 dispatch input builder。
- `apps/api/src/domain/crawler-tasks/repository.ts` — task/run/attempt/lease lifecycle、provider association、runner event processing、retry、receipt/CAS 和 append-only facts。
- `apps/api/src/domain/crawler-tasks/reconciliation.ts` — provider polling、reconciliation window、provider observation、failure/expire boundary。
- `apps/api/src/routes/admin/crawler-tasks/index.ts` — Dashboard task creation/read model、server-owned repair dispatch and provider projection。
- `apps/api/src/routes/internal/crawler-runs/index.ts` — signed runner callback validation、provider-started、dispatch validation、repair source observation and receipt projection。
- `packages/crawler/src/task-runner/repair-adapter.ts` — explicit local repair adapter contract to carry into the production runner path。
- `packages/crawler/src/task-runner/template-adapters.ts` — operation/template registry and explicit adapter selection pattern。
- `packages/crawler/src/task-runner/actions-event-client.ts` — signed GitHub Actions callback client and provider lifecycle event envelope。
- `packages/crawler/src/task-runner/runner-client.ts` — poll/claim/lease/heartbeat/terminal callback and repair observation client。
- `packages/crawler/scripts/target-crawl-mutation.ts` — production callback command boundaries and target-profile binding.
- `.github/workflows/daily-movie-crawl.yml` — fixed workflow inputs, target resolution, GitHub environment and callback secret boundary。

### Focused verification patterns
- `apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts` — provider association、cancellation、retry、provider loss 和 late callback integration patterns。
- `apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` — signed event、provider-started、receipt/source observation、duplicate and stale event contracts。
- `apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts` — GitHub App dispatch/readback and bounded provider failure mapping。
- `packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts` — workflow source contract、dispatch binding 和 signed event sequence tests。
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` — task detail、repair action、polling、bounded provider/source projection and same-movie navigation pattern。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCrawlerTaskRepository` already owns task/run/attempt/lease state transitions, provider association, runner event idempotency, repair receipt validation and source revision CAS; Phase 23 should extend these boundaries rather than create a second control plane。
- `createProviderSnapshot`、`createProviderDispatchInput` and the closed provider registry already enforce fixed repository/ref/environment/target/workflow identity for GitHub Actions。
- `createCrawlerTaskReconciliationService` already polls provider runs through a reconciliation window and separates provider observation from signed receipt success。
- The explicit `repair_players` snapshot and `repair-adapter` provide the operation-aware execution seam; the production workflow can reuse the existing job while selecting this adapter after claim。
- `actions-event-client.ts` and `runner-client.ts` already provide signed lifecycle events, provider-started validation, heartbeat, terminal callback and source observation envelopes。
- `Crawlers.vue` and its typed API client already expose task/run detail, readiness, repair actions and visible-page polling; the new work is a provider/attempt/reconciliation projection extension。

### Established Patterns
- D1 task/run/attempt/lease/receipt/target-profile facts are the control-plane source of truth; runner output is input to validated callbacks, never a business success proof by itself。
- Production execution remains in GitHub Actions with fixed target profile, GitHub environment and secret-owned callback configuration; Dashboard never edits URL, command, workflow or secret fields。
- Signed callbacks bind `runId`, application attempt, provider run identity, sequence, event identity and bounded request age; duplicate events are replay-safe and stale events are CAS-gated。
- Source observations are append-only and source revisions advance through server-owned CAS/readback. Metadata persisted, source readiness, provider success, repair success, validated receipt and browser playback proof remain separate facts。
- Local verification uses `http://localhost:8080` Gateway as the canonical path; direct frontend/API ports are not production or canonical proof.

### Integration Points
- Admin repair dispatch creates/loads the server-owned task snapshot, claims the run, creates provider association and calls GitHub Actions with the fixed movie workflow。
- The shared workflow resolves the fixed target, claims/validates the run through signed callbacks and selects ordinary movie or repair adapter from the task snapshot。
- Provider polling and callback routes feed repository reconciliation; retry creates a new run/attempt under the same task while old facts remain queryable。
- Source observation/readback and repair receipt projection return to admin/public bounded DTOs; current attempt and current source revision are the only write-authoritative view。
- Dashboard task detail links provider run summary, lease/attempt/reconciliation facts and the same movie content identity without exposing raw runner/provider material。

</code_context>

<specifics>
## Specific Ideas

- 沿用 `SUN-064`/zero-player 场景验证 production repair 的 `no_source -> repairing/retry -> ready` 回流，但 production proof 必须使用独立 fresh tuple，不复用 Phase 13 carrier。
- 页面应让用户一眼区分 provider 已受理/运行/完成、repair 是否真正成功、receipt 是否 validated，以及当前 source revision 是否已回读；任何单一成功徽章都不代表完整播放成功。
- 当前 application attempt 优先取得 source projection 权威写入权；旧 attempt 的 late/stale receipt、provider observation 和 bounded rejection 仍可在历史中追溯。
- Phase 24 继续单独证明 Dashboard -> Viewer -> `canplay`/`playing`/`currentTime`，Phase 23 只证明生产 repair/reconciliation 闭环。

</specifics>

<deferred>
## Deferred Ideas

- Fresh production Dashboard -> Viewer -> actual playback proof、脱敏 playback evidence 和 `canplay`/`playing`/`waiting`/`stalled`/`error`/`currentTime` 证据属于 Phase 24。
- 漫画、actor、publisher 和其他内容类型的通用 repair template 属于 v2 requirements。
- 高频、全库、无限自动重抓和时间序列 source health 平台属于 v2 requirements。
- Dashboard 任意 URL、命令、workflow、secret 或定时策略编辑保持在当前 milestone 的 out-of-scope 边界之外。

讨论未产生额外 scope-creep idea；以上延期项来自既有 roadmap/requirements 边界。
</deferred>

---

*Phase: 23-github-actions-production-repair-and-reconciliation*
*Context gathered: 2026-08-07*
