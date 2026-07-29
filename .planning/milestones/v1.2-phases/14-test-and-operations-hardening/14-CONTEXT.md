# Phase 14: Test and Operations Hardening - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

将 v1.2 的 target switching 和 full-chain 合同收口为可重复的静态测试、target-first RUNBOOK 操作步骤，以及完整且诚实的 requirement-to-evidence 矩阵。该 phase 处理 `TEST-01`、`TEST-06`、`TEST-07`，并保持之前 phase 的 selected-target、Gateway-first、fail-closed 和 evidence ownership 边界。

**In scope（本 phase 收口）：**

- 清理 active source、config 和 test 中未分类的 `starye.org` 字面量，只保留窄且命名明确的 default-target / legacy-alias fixture。
- 将 Pages 直链到 canonical domain 的 `_redirects` 变为从 selected target 受控生成的最终构建输入，并用自动门禁防止旧域名重新进入 active path。
- 把 `RUNBOOK.md` 组织为 target-first 的切换、预检、本地投影、deploy/migration/crawl、smoke、rollback/recovery 操作手册，不复制 secret 值或第二份 target 配置。
- 产出一个覆盖全部 30 个 v1.2 requirements 的、可自动完整性校验的最终矩阵，逐项连接 canonical verifier、命令、测试或 artifact，并忠实保留 verified、partial、blocked、deferred 状态。

**Out of scope（本 phase 明确不做）：**

- 伪造、补写或改判 Phase 13 的 local/selected-production data-chain 成功；当前 `13-VERIFICATION.md` 的 `gaps_found`、blocked 和 partial 状态必须原样继承。
- 执行 credentialed Cloudflare/D1/R2/crawler/rollback 命令、写入真实 secrets，或以静态合同替代 provider-side proof。
- 新建 Cloudflare 资源、DNS/IaC、跨账户流量切换、全量 crawler corpus 或自动化一键恢复。

</domain>

<decisions>
## Implementation Decisions

### Old-Domain Audit And Target-Derived Redirects
- **D-01:** `starye.org` 的长期治理采用严格允许清单和自动门禁。只有显式 default `TargetProfile`、legacy-target-alias fail-closed 规则和命名明确的 test fixture 可以保留；任何其他 active source/config/test 命中均必须参数化、迁移到该 fixture 边界或移除。
- **D-02:** auth、blog、dashboard、movie、comic 的最终 Pages `_redirects` 必须在构建/部署前从 selected target 生成 canonical domain。保留各 app 的 pages.dev 来源、path 和 SPA fallback 模板；受跟踪源模板不得固化默认域名。
- **D-03:** 自动审计只扫描受 Git 跟踪的 active source、配置和测试。文档、`.planning` 历史工件、构建输出、被忽略的本地 env/临时 Wrangler projection 不属于该门禁；其准确性分别由 RUNBOOK 和 evidence validation 负责。
- **D-04:** Phase 14 首次绿灯即要求零个未分类命中，不采用 baseline-ratchet 或仅报告模式。allowlist 必须足够窄并能由测试解释每个保留项。

### Target-First Operations Manual
- **D-05:** `RUNBOOK.md` 采用 target-first 主线：选择 explicit `TargetProfile`，执行 preflight，再依序完成本地 projection、deploy/migration/crawl、smoke、rollback/recovery。每个远程步骤都以 selected target 的资源和 canonical URL 为输入。
- **D-06:** required secrets 的唯一事实来源是 profile metadata。RUNBOOK 仅提供 secret name、consumer、存放位置与 validation/preflight entry 的矩阵，绝不复制每个 target 的资源值或任何 secret 值。
- **D-07:** RUNBOOK 中的 smoke 必须以阶段化命令和结果分流表达。`checkpoint` 立即停在当前阶段、保留 evidence 并给出恢复入口；只有 terminal `passed` 可以把该次运行记录为完成。
- **D-08:** 恢复采用有界人工清单：先停止后续 mutation、保存 run/evidence、按 local/target/provider 分类 checkpoint，再在 selected-target preflight 后执行 Worker rollback、Pages 手工回退或 D1 恢复；恢复后必须使用新的验证运行。

### Final Requirement-To-Evidence Matrix
- **D-09:** 矩阵的真相源是每个 phase 的 canonical verifier、实际 command/test 结果和 artifact，而非 `REQUIREMENTS.md` 的 traceability checkbox。它必须如实保留 upstream 的 verified、partial、blocked、deferred 结论，不能将回归合同升级为 production proof。
- **D-10:** 最终矩阵必须完整列出全部 30 个 v1.2 requirement；自动校验 requirement 集合、重复行和本地 artifact path，保证每项都有 status、source phase 和命令/test/artifact 指向。
- **D-11:** credentialed/provider 证据缺失时，矩阵必须显式标为 `blocked` 或 `deferred`，并包含 checkpoint/缺失工件、恢复前置条件和下一条操作者命令。矩阵验证描述和引用，不执行远程命令。
- **D-12:** 30 项矩阵及其执行验证属于 Phase 14 evidence artifact，随后随 milestone evidence archive；`RUNBOOK.md` 只保存稳定操作清单和命令，不承担当前执行状态或历史 evidence 的 canonical owner。

### the agent's Discretion
- literal audit、allowlist、redirect template/materialization 和 30 项矩阵的具体文件格式、脚本位置及 Vitest/CLI 验证组织可沿用现有 workspace patterns，只要不放宽 D-01 至 D-12。
- planner 可在 Phase 14 内拆分 source/test、RUNBOOK 和 evidence-matrix 计划，但必须让 `TEST-01`、`TEST-06`、`TEST-07` 各自有可执行验证，并让最终矩阵在 Phase 14 verifier 之前可被完整性检查。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope, Requirements And Documentation Ownership
- `.planning/PROJECT.md` — v1.2 的 full-chain 目标、Gateway-first、single-operator 和 free-tier-first 约束。
- `.planning/ROADMAP.md` — Phase 14 goal、`TEST-01`/`TEST-06`/`TEST-07` 和 success criteria。
- `.planning/REQUIREMENTS.md` — 全部 30 个 v1.2 requirement 及其 phase mapping；checkbox 是 traceability metadata，不是 runtime proof。
- `.planning/STATE.md` — 当前 milestone 与 Phase 13/14 的 execution truth。
- `docs/documentation-ownership.md` — RUNBOOK 是稳定操作 owner，phase/milestone evidence 留在 `.planning` 的 canonical owner 边界。
- `RUNBOOK.md` — 需要被 target-first procedure 更新的现有 deploy、rollback、D1 safety、smoke 和 recovery 手册。

### Locked Target And Operations Contracts
- `.planning/phases/11-deployment-target-foundation/11-CONTEXT.md` — explicit profile、local/CI identity split、managed projection 和 fail-closed 原始决策。
- `.planning/phases/12-cloudflare-config-switching/12-CONTEXT.md` — target-aware runtime/workflow、public allowlist 和 remote preflight 决策。
- `.planning/phases/11-deployment-target-foundation/11-VERIFICATION.md` — Phase 11 source-level verification、external provider evidence boundary和 verification command。
- `.planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md` — Phase 12 selected-target contract coverage及其 intentionally deferred provider behavior。
- `packages/config/src/deployment-target/target-profiles.ts` — tracked target、canonical URL、resource、required-secret metadata 和 GitHub Environment 的唯一 source。
- `packages/config/src/deployment-target/preflight.ts` — local/ci/remote scope、blocking issue code 和 live resource-check 语义。
- `scripts/target-profile.ts` — target validation、projection、preflight、Pages build 和 prepared-entry CLI entry。
- `scripts/target-deploy.ts` — target-aware deployment materialization 和 Pages build integration。
- `.github/workflows/rollback.yml` — Worker target-aware rollback 与 Pages manual rollback 的 fail-closed boundary。

### Data-Chain Evidence Truth
- `.planning/phases/13-full-chain-data-smoke/13-CONTEXT.md` — one-item smoke、canonical Gateway、remote evidence and fail-closed decisions。
- `.planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md` — canonical current status (`gaps_found`)、DATA/TEST-05 blocked/partial evidence及其 exact recovery prerequisites。
- `packages/config/src/deployment-target/data-chain-evidence.ts` — passed/failed/checkpoint evidence contract and non-secret receipt constraints。
- `scripts/data-chain-smoke.ts` — local/remote smoke sequencing and checkpoint persistence entry。
- `scripts/verify-data-chain-smoke.ts` — persisted evidence verification and terminal outcome semantics。

### Literal And Redirect Consumers
- `apps/auth/public/_redirects`, `apps/blog/public/_redirects`, `apps/dashboard/public/_redirects`, `apps/movie-app/public/_redirects`, `apps/comic-app/public/_redirects` — current Pages direct-link redirect templates that must become target-derived.
- `apps/api/.dev.vars.example` and `apps/auth/typecheck.pages-build.env` — active configuration/example surfaces to classify or derive correctly.
- `apps/gateway/src/index.ts` — active gateway source containing an old-domain reference that must be classified or removed.
- `packages/config/src/deployment-target/__tests__/` and `apps/gateway/src/__tests__/` — existing named default-target and legacy-alias fixtures that the new audit must preserve narrowly.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trackedTargetProfiles` plus `TargetProfile.requiredSecrets` already expose the selected target's canonical URLs, resources, consumer metadata and CI Environment without storing secret values.
- `runTargetPreflight()` and `scripts/target-profile.ts` already provide explicit target validation, local/CI/remote boundaries, non-secret issue codes and live-check gates for RUNBOOK commands.
- `scripts/target-deploy.ts` and the existing `run-pages-build` command form a target-aware build materialization seam suitable for generated Pages redirect artifacts.
- `data-chain-evidence.ts` and `verify-data-chain-smoke.ts` supply established `passed`/`failed`/`checkpoint` semantics and prevent non-success evidence from becoming terminal proof.

### Established Patterns
- Browser-facing local proof uses `http://localhost:8080/...`; direct app ports are diagnostic only and never canonical evidence.
- Source contracts are explicit-target and fail-closed; local Wrangler profile identity and CI credential/environment identity stay separate.
- Stable operating rules belong in `RUNBOOK.md`, while phase execution evidence and verification reports remain under `.planning/phases/` and later `.planning/milestones/`.
- Existing Vitest contract suites use fixture profiles and fake executors to validate target behavior without real Cloudflare credentials.

### Integration Points
- A literal audit needs to enumerate tracked active source/config/test inputs, own a narrow fixture allowlist and integrate with the existing config/test command surface.
- Each Pages app's redirect template must connect to the selected-target build/materialization flow without changing its path or SPA fallback behavior.
- RUNBOOK prose must reference profile/preflight and evidence commands without becoming a second target configuration source.
- The final matrix must parse or reference the Phase 11-13 verification reports plus new Phase 14 results, then validate all requirement IDs and local evidence paths before the Phase 14 verifier consumes it.

</code_context>

<specifics>
## Specific Ideas

- Treat every unclassified default-domain occurrence as a test failure from the first Phase 14 green run; do not grandfather baseline debt.
- Keep an operator-facing RUNBOOK concise and executable, while preserving current execution truth, external evidence and recovery handoff in Phase 14 artifacts.
- A `checkpoint` is useful evidence of a stopped, fail-closed run, never a substitute for a selected-production success claim.

</specifics>

<deferred>
## Deferred Ideas

- Complete the fresh local runtime release, provider-backed D1/API/admin tuple and selected-production Dashboard/viewer proof through Phase 13's verifier-driven gap path; Phase 14 records their current evidence but does not execute or relabel them.
- Cloudflare resource/DNS provisioning, IaC, multi-target schedule matrices, cross-account traffic migration and automated destructive recovery belong to future milestones.

</deferred>

---

*Phase: 14-test-and-operations-hardening*
*Context gathered: 2026-07-20*
