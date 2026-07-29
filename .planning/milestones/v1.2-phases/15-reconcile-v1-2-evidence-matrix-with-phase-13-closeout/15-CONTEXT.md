# Phase 15: Reconcile v1.2 evidence matrix with Phase 13 closeout - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

将 v1.2 的 30 项 requirement evidence matrix 与 Phase 13 的 canonical verifier、receipt 和 closeout truth 对齐，产出一次受限、可复核的 reconciliation/closeout 结果。这个 phase 的完成只表示“证据已经如实对账”，绝不把仍缺少本地会话或 provider-side 证明的 Phase 13、或整个 v1.2 里程碑标记为完成。

**In scope:**

- 以 Phase 13 verifier/receipt 为真相源，复核全部 30 个 requirement 的状态、来源、工件路径与 matrix CLI 输出，并收口当前 matrix parser/matrix row 仍按旧 `BLOCKED` anchor 解释、而 verifier 已输出 `SATISFIED` / `PARTIAL` / `FAILED/CHECKPOINT` 的跨 phase contract drift。
- 新增 Phase 15 reconciliation/closeout 工件，并从该工件更新派生 evidence matrix；历史 Phase 13 evidence 保持不可改写。
- 采用最多两轮的验证预算：第一轮全量对账；只有出现新的、run 绑定的 Phase 13 terminal artifact 后才允许第二轮重算与最终一致性验证。
- 为未就绪的本地会话/远程证明留下结构化、非敏感且需显式授权的 handoff。

**Out of scope:**

- 在 Phase 15 内启动 credentialed、remote、provider-side 或会话依赖的操作。
- 回写 Phase 13 verifier、receipt、checkpoint，或以手工矩阵编辑取代 canonical verifier。
- 将 `REQUIREMENTS.md` 的 traceability checkbox 作为 runtime proof，或在验证轮数耗尽后自动再规划第三轮。

</domain>

<decisions>
## Implementation Decisions

### Evidence Truth And Representation
- **D-01:** Phase 13 canonical verifier 及同一 target/run/item/surface tuple 的 receipt 是唯一状态真相源；Phase 14 evidence matrix 只能从它派生并解释，`REQUIREMENTS.md` 仅保留 requirement-to-phase traceability。
- **D-02:** 对账结果必须完整保留 `verified`、`partial`、`blocked`、`deferred` 四态；每一个非 `verified` 项都要指向 source artifact，说明缺失证据、恢复前置条件和下一条命令。
- **D-02a:** reconciliation 必须完整解析 Phase 13 的 raw verifier vocabulary；其公开四态映射须显式且可测，不能继续把仅有 `BLOCKED` / `PARTIAL` 的历史 anchor 当作唯一可接受输入。当前 `SATISFIED`、`PARTIAL`、`FAILED/CHECKPOINT` 必须如实进入 matrix 及其 locator/narrative。
- **D-03:** Phase 13 verifier、receipt 和历史 checkpoint 不可改写。Phase 15 以新的 reconciliation/closeout 工件表达当前对账结论，并据此更新派生矩阵。
- **D-04:** `REQUIREMENTS.md` checkbox 不在本 phase 改写；新工件必须明确该 checkbox 不表示 runtime evidence status。

### Bounded Full Validation And Closeout
- **D-05:** 验证预算严格为最多两轮，绝不自动生成第三个 gap/replan 循环。
- **D-06:** 第一轮必须覆盖 30 个 v1.2 requirement 的来源、状态、工件路径和 matrix CLI，并复核 Phase 13 verifier/receipt 的可追溯性；不得执行 credentialed 或 remote 命令，也不得把全量验证缩窄为仅 Phase 13/14 行。
- **D-07:** 第二轮仅在第一轮后出现新的、当前 run 绑定的 Phase 13 terminal artifact（`passed` 或明确 `blocked`）时执行；该轮只重算派生矩阵并进行最终一致性验证。
- **D-08:** 预算耗尽后，Phase 15 以“evidence reconciliation complete”结束；报告可为 `verified` 或明确 `blocked`，但不得升级 Phase 13 或 v1.2 milestone 的完成状态。

### External Proof Handoff
- **D-09:** Phase 15 仅执行本地、只读 evidence reconciliation；本地 Dashboard 会话、远程/credentialed/provider proof 继续属于 Phase 13 的显式 handoff。
- **D-10:** handoff 至少记录当前状态、缺失的 run-id 或 terminal receipt、前置条件、可执行的下一条命令和需操作者显式授权的边界。
- **D-11:** 日后新增会话或远程证据时，必须先经 Phase 13 canonical run 与 verifier；随后新开对账任务更新派生矩阵，不回写本次 Phase 15 closeout。
- **D-12:** 阻塞信息采用结构化、非敏感的原因与恢复条件；不得写入 cookie、token、endpoint 或会话内容。

### Execution Limit
- **D-13:** 下游涉及子代理的验证工作遵循 `.planning/config.json` 已配置的 `workflow.subagent_timeout: 1800000`（30 分钟）；超过此界限应收敛为已记录的验证结果或 handoff，而非无限等待。

### the agent's Discretion
- reconciliation report 的具体 JSON/Markdown 格式、matrix 的再生成方式与静态校验组合可复用现有 evidence-matrix tooling；只要保持 D-01 至 D-13 的证据优先级、两轮预算和无远程操作边界即可。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Truth And Evidence Ownership
- `.planning/PROJECT.md` — v1.2 的 full-chain 目标、Gateway-first 和 free-tier-first 长期约束。
- `.planning/ROADMAP.md` — Phase 13/14 依赖关系、Phase 15 入口和当前 roadmap 状态。
- `.planning/REQUIREMENTS.md` — 30 个 v1.2 requirement 与 requirement-to-phase traceability；checkbox 不是 runtime evidence truth。
- `.planning/STATE.md` — 当前 Phase 13 的 session-gate block、计划计数和 milestone 真实进度。
- `docs/documentation-ownership.md` — `.planning` evidence 与稳定文档的 canonical owner 边界。

### Canonical Phase Evidence
- `.planning/phases/13-full-chain-data-smoke/13-CONTEXT.md` — one-item、Gateway-first、fail-closed 与 remote proof 的锁定边界。
- `.planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md` — Phase 13 的唯一当前验证结论及 DATA/TEST-05 状态。
- `.planning/phases/14-test-and-operations-hardening/14-CONTEXT.md` — matrix 只能保留 upstream verified/partial/blocked/deferred truth 的既有决定。
- `.planning/phases/14-test-and-operations-hardening/14-VERIFICATION.md` — Phase 14 的静态验证范围与 provider-proof exclusion。
- `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json` — 现有 30 行 evidence matrix 的机器可读输入。
- `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md` — 现有 matrix 的人类可读派生展示。
- `.planning/v1.2-MILESTONE-AUDIT.md` — 当前跨 phase integration audit：记录 Phase 13 raw status 与 Phase 14 matrix parser 的已验证 drift。

### Reusable Validation Contracts
- `packages/config/src/deployment-target/requirement-evidence-matrix.ts` — typed requirement-evidence matrix contract 和状态/路径验证规则。
- `scripts/verify-v12-evidence-matrix.ts` — 现有只读 matrix CLI，Phase 15 应在不执行远程操作的前提下复用。
- `scripts/verify-data-chain-smoke.ts` — Phase 13 evidence 的 terminal/checkpoint 语义。
- `packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts` — matrix validator 的回归契约。
- `packages/config/src/deployment-target/__tests__/verify-data-chain-smoke.test.ts` — terminal evidence 与 checkpoint 的回归契约。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/config/src/deployment-target/requirement-evidence-matrix.ts` 与 `scripts/verify-v12-evidence-matrix.ts` 已提供确定性、只读的 30 行 matrix validation seam；当前它们暴露了只接受历史 `BLOCKED` / `PARTIAL` anchor 的 drift，Phase 15 应在不执行远程操作的前提下将它收口。
- `scripts/verify-data-chain-smoke.ts` 已区分 terminal 与 checkpoint evidence，可防止非成功或不匹配的 artifact 被提升为成功。
- `14-EVIDENCE-MATRIX.json` 和其 Markdown 派生文件已保存 requirement、status、source phase 与 artifact locator，可作为 reconciliation 的受控输入，而非重造第二套状态模型。

### Established Patterns
- 静态契约验证不等同于 credentialed/provider-side proof；缺少 live proof 时应保留 `partial` 或 `blocked`，而不是从测试绿灯推导成功。
- 历史运行证据保持 append-only，新的真实运行先由拥有该链路的 Phase 13 verifier 产生；后续 phase 只做派生对账。
- Gateway canonical URL、显式 target 和 non-secret evidence 是本 milestone 的固定边界。

### Integration Points
- Phase 15 reconciliation 应消费 Phase 13 verifier、Phase 14 matrix 和 requirements mapping，并调用现有 matrix CLI；结果写入 Phase 15 工件后再更新派生 matrix。
- 任何未来本地 session 或 remote proof 必须回到 `scripts/data-chain-smoke.ts` / `scripts/verify-data-chain-smoke.ts` 的 Phase 13 路径，不能由 reconciliation bypass。

</code_context>

<specifics>
## Specific Ideas

- “全量验证”固定指全 30 项 evidence 来源、状态、路径和 matrix CLI 的核对，不隐含一次昂贵或未授权的远程重跑。
- 当前首轮的明确验收是 matrix parser、JSON/Markdown row、Phase 13 raw verifier coverage 和 `--final` CLI 互相一致；现状下 `--final` 预期先失败，直到旧 `BLOCKED` anchor 与过时 recovery narrative 被替换为 canonical 结论。
- 第二轮是条件性的一次 final consistency pass，不是再一次 gap-planning 循环。
- 子代理超时固定为 30 分钟，超过时保留已观察的非敏感结果并走 handoff。

</specifics>

<deferred>
## Deferred Ideas

- 取得本地 Dashboard signed-session、分配新的 Phase 13 run-id、执行 provider-backed D1/API/admin/viewer proof：保留在 Phase 13 的显式 handoff，需操作者授权。
- 获得新的 Phase 13 terminal artifact 后的下一次 evidence reconciliation：新开独立任务，不回写本 phase 的 historical closeout。

</deferred>

---

*Phase: 15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout*
*Context gathered: 2026-07-29*
