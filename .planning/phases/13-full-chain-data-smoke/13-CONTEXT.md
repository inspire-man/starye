# Phase 13: Full Chain Data Smoke - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

证明 selected target 可通过受控的 local-first 和 production smoke 跑通一条真实、可重复的数据链：受限 crawler 或 fixture 写入一个已知条目，随后在 D1/API、Dashboard 管理态和经由 Gateway/canonical domain 的前台查看中证明同一条目存在。所有远程执行都必须在显式 target、资源归属和凭据检查通过后才可开始，并输出不含密钥的证据。

**In scope（本 phase 收口）：**

- `http://localhost:8080/...` 下的 local Gateway/API/auth/dashboard/content smoke，以及 local D1 schema/minimal-data 就绪检查。
- 以 deterministic、namespaced 的 smoke item 身份执行受限 crawler 或 fixture ingest，并记录 resulting item identity。
- 在 selected target 上执行 production data-chain smoke，证明同一 item 可由 D1/API、Dashboard 和 canonical Gateway public viewer 读取或管理。
- 为 local 与 production 生成可重复、non-secret 的 run/target/item evidence artifact，并让 smoke scripts 产生稳定输出。

**Out of scope（本 phase 明确不做）：**

- 全量 crawler corpus、无边界 bulk ingest 或为 smoke 新增常态数据运营能力。
- 旧 `starye.org` 字面量清理、RUNBOOK 最终切换/恢复文档与 v1.2 最终 requirement-to-evidence matrix，属于 Phase 14。
- 伪造 production 成功、绕过 target preflight、把 credential/endpoint/raw prepared context 写进计划或证据。

</domain>

<decisions>
## Implementation Decisions

### Smoke Item And Ingest Boundary
- **D-01:** 本轮 crawler 验收使用固定、闭合、deterministic 的 **10 条** non-R18 smoke fixture 集合；每条都携带可审计的 namespace/target/run 语义且只有一个 player。集合中的 primary item 仍是 local/production evidence 与 Dashboard→Viewer 的唯一 correlation tuple；其余 9 条仅作为 D1/API 入库数量审计的 supporting records。不得依赖人工随机选择现有内容，也不得扩大为真实完整 crawler corpus。
- **D-02:** 写入只允许受限 crawler 或 fixture adapter；禁止用完整 crawler corpus 作为 release gate。planner 可根据当前受控 entry 和可用凭据选择 fixture 或 targeted crawler，但必须保持最小数据量、可重跑和明确 target。

### Local-First Execution Order
- **D-03:** production 尝试前必须先验证 local D1 schema 与 minimal data，再经 `http://localhost:8080/...` 执行 local API、auth/dashboard 和 content route smoke；3000/3001/3002/3003/5173 等直连端口只能作为实现诊断，不得充当 canonical evidence URL。
- **D-04:** local 与 production 都验证同一 smoke item：D1/API 可查、Dashboard 可管理或校验、public viewer 可通过 Gateway/canonical domain 读取。production browser/public evidence 只能使用 selected target 的 canonical domain。

### Remote Checkpoint And Evidence
- **D-05:** 所有 production 或 provider-side data-chain 命令必须显式选择 target，并先通过 target preflight、credential-key presence、account/resource ownership 和 read-only live checks；任一凭据或 provider access 缺失时 fail closed，记录 checkpoint evidence，绝不模拟或声称 production 成功。
- **D-06:** 每次 smoke 产生 repeatable local/production evidence artifact，至少包含 non-secret target ID、run ID/timestamp、fixture/item identity、验证 surface、URL/path 和 pass/fail/checkpoint 状态；禁止写入 secrets、tokens、完整 remote endpoints 或 raw prepared context。
- **D-07:** 真实 provider/data-chain execution 与其结果证据属于 Phase 13；Phase 14 才负责 source literal cleanup、RUNBOOK 稳定化和最终全量 evidence mapping，避免把真实链路缩减为仅文档或静态 contract。

### the agent's Discretion
- 证据文件的具体 JSON/Markdown schema、artifact 目录、fixture payload 的非敏感字段和自动化测试组织可沿用仓库现有 patterns；它们必须实现上述 identity、顺序、fail-closed 和 Gateway/canonical-domain contract。
- 在不放宽 selected-target 或凭据边界的前提下，planner 可将 local/prod preflight、ingest、D1/API/admin/viewer checks 拆分为独立计划与波次。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope And Locked Preconditions
- `.planning/PROJECT.md` — v1.2 full-chain objective、free-tier-first 和 Gateway-first 约束。
- `.planning/ROADMAP.md` — Phase 13 goal、requirements 与 success criteria。
- `.planning/REQUIREMENTS.md` — `DATA-01..DATA-07` 与 `TEST-05` 的可验收来源。
- `.planning/STATE.md` — active milestone/phase truth。
- `.planning/phases/12-cloudflare-config-switching/12-CONTEXT.md` — selected target、public Gateway contract、CI/remote preflight 与 prepared-entry decisions。
- `.planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md` — Phase 12 intentionally deferred behavior that Phase 13 must prove with authorized credentials.

### Target And Remote Operation Boundaries
- `packages/config/src/deployment-target/target-profile.schema.ts` — non-secret target/resource/canonical URL contract.
- `packages/config/src/deployment-target/target-resolver.ts` — explicit target resolution and legacy/default rejection.
- `packages/config/src/deployment-target/preflight.ts` — local/remote/smoke preflight scope, required credentials and read-only live checks.
- `packages/config/src/deployment-target/mutation-entry.ts` — closed registry of prepared DB/crawler entries and fixed command context.
- `scripts/target-profile.ts` — import-safe selected-target CLI entry for validation, preflight and prepared execution.
- `RUNBOOK.md` — current deploy, migration safety, crawler and Gateway evidence operations; Phase 14 is its stable-update owner.

### Data And Viewer Integration
- `packages/db/MIGRATION.md` — local schema/minimal-data and post-apply smoke expectations.
- `packages/crawler/src/utils/api-client.ts` — crawler-to-API sync boundary.
- `apps/api/src/routes/movies/handlers/sync.handler.ts` — ingest-side API/database integration.
- `apps/dashboard/src/lib/hono-rpc-client.ts` — Dashboard requests remain Gateway-relative.
- `apps/movie-app/src/lib/api-client.ts` — public movie viewer data contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runTargetPreflight()` and `scripts/target-profile.ts`: selected-target validation, local/CI/remote boundaries and optional read-only live checks already exist.
- Closed mutation entry registry plus `run-prepared-entry`: gives crawler/DB operations a fixed command surface instead of ambient target identity.
- `packages/db/MIGRATION.md`: defines local schema/minimal data and follow-up API smoke as the established data readiness sequence.

### Established Patterns
- Browser-facing local evidence is always under `http://localhost:8080/...`; Dashboard RPC is Gateway-relative and public apps use the canonical gateway/API contract.
- Crawler sync reaches the API through its service-auth boundary, then the movie sync handler performs typed upsert work into D1.
- Phase 12 source contracts deliberately stop before credentialed remote actions; a missing provider capability is evidence of a fail-closed checkpoint, not a successful smoke.

### Integration Points
- Target profile/preflight and prepared entry scripts connect local and remote command execution to a fixed selected target.
- The ingest item traverses crawler/fixture -> API movie sync -> D1 -> Dashboard -> movie public viewer, with Gateway as canonical browser entry.
- Phase artifacts under `.planning/phases/13-full-chain-data-smoke/` are the evidence owner until Phase 14 consolidates stable operating documentation.

</code_context>

<specifics>
## Specific Ideas

- All gray areas were selected under the user's prior authorization; every decision above applies the recommended conservative/fail-closed option.
- Keep the smoke narrow but real: one deterministic target-scoped item, one selected target, one end-to-end proof path, and evidence that can be re-run without exposing credentials.

</specifics>

<deferred>
## Deferred Ideas

- Phase 14: old-domain/source-literal cleanup, final RUNBOOK switching and recovery procedures, and full v1.2 requirement-to-evidence mapping.
- Future milestone: broader crawler corpus validation or multi-target scheduling/rollout automation.

</deferred>

---

*Phase: 13-full-chain-data-smoke*
*Context gathered: 2026-07-16*
