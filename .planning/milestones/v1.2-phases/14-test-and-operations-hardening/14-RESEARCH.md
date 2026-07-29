# Phase 14: Test and Operations Hardening - Research

**Researched:** 2026-07-21
**Domain:** selected-target static contracts, Pages build artifacts, operations documentation, and requirement evidence verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

[VERIFIED: .planning/phases/14-test-and-operations-hardening/14-CONTEXT.md]

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

### Deferred Ideas (OUT OF SCOPE)
- Complete the fresh local runtime release, provider-backed D1/API/admin tuple and selected-production Dashboard/viewer proof through Phase 13's verifier-driven gap path; Phase 14 records their current evidence but does not execute or relabel them.
- Cloudflare resource/DNS provisioning, IaC, multi-target schedule matrices, cross-account traffic migration and automated destructive recovery belong to future milestones.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Active source/tests no longer depend on unqualified `starye.org` literals except default-target fixtures. | 固定字面量 tracked-file 审计、逐项 allowlist、redirect 物化和 Vitest 合同。 [VERIFIED: codebase grep] |
| TEST-06 | RUNBOOK documents account/domain switching, required secrets, deploy, smoke, rollback, and recovery. | target-first 命令序列、profile required-secret metadata 矩阵和 checkpoint 分流。 [VERIFIED: RUNBOOK.md; packages/config/src/deployment-target/target-profiles.ts] |
| TEST-07 | Final verification checklist maps every v1.2 requirement to command output or artifact evidence. | 30 行 JSON/Markdown 矩阵、只读 validator 和上游 verifier 状态比对。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/11-deployment-target-foundation/11-VERIFICATION.md; .planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 使用中文完成分析、验证与交付；phase 修改遵循 GSD 工作流。 [VERIFIED: AGENTS.md]
- 本地浏览器证据的 canonical 入口始终是 `http://localhost:8080/...`，直连应用端口只能用于诊断。 [VERIFIED: AGENTS.md]
- `RUNBOOK.md` 是稳定运维 owner，当前 phase 证据与状态留在 `.planning/*`；不得复制出第二份 owner。 [VERIFIED: AGENTS.md; docs/documentation-ownership.md]
- 保留脏工作树和 Phase 13 evidence；不得回滚、覆盖、暂存或清理无关文件。 [VERIFIED: AGENTS.md]
- 后续实现若修改函数、类或方法，必须先做 GitNexus impact analysis；若为 HIGH/CRITICAL 先告警；提交前运行 GitNexus detect-changes。 [VERIFIED: AGENTS.md]
- 本 phase 不涉及 crawler strategy、D1 schema、Hono route 或 UI component 的实现；若计划扩展到这些边界，须先遵循对应项目 skill 的 fixture-first、migration、typed-RPC 或 UI 规则。 [VERIFIED: .agents/skills/starye-crawler-strategy/SKILL.md; .agents/skills/starye-db-migration/SKILL.md; .agents/skills/starye-hono-rpc/SKILL.md; .agents/skills/starye-ui-components/SKILL.md]

## Summary

Phase 14 应只增加静态、可重复且 fail-closed 的合同：一个以固定字符串而非正则匹配的 tracked-source literal audit、一个由 selected `TargetProfile` 临时物化到 Pages 最终 `dist/_redirects` 的构建步骤，以及一个只读取本地 verifier/report/artifact 的 evidence matrix validator。现有 `runTargetDeploy()` 已把 resolver、local preflight、materialization 和 Pages build/deploy 串成一条闭合流程；`runPagesBuild()` 是插入 redirect finalization 的唯一合适 seam。 [VERIFIED: scripts/target-deploy.ts; scripts/target-profile.ts; GitNexus]

当前固定字面量扫描得到 91 个 active source/config/test occurrences：28 个非测试面和 63 个测试面。`target-profiles.ts` 的显式 default profile 与 `preflight.ts` 的 fail-closed legacy alias set 是可保留的窄边界；五个 tracked `_redirects`、`apps/api/.dev.vars.example`、auth typecheck env、Gateway 注释，以及目前散落的测试 URL/email fixture 都必须被派生、集中为命名 fixture 或移除。使用普通正则 `starye.org` 会同时命中合法的 `starye-org` target id，审计必须使用 fixed-literal comparison。 [VERIFIED: codebase grep]

最终矩阵不能接受 `REQUIREMENTS.md` 的已勾选 traceability 作为 runtime 结论。Phase 11/12 的 source-contract requirements 可引用其 `passed` verifier；Phase 13 的当前 canonical verifier 是 `gaps_found`，其中 DATA-01 至 DATA-06 为 `BLOCKED`、DATA-07 与 TEST-05 为 `PARTIAL`。这些行必须原样留在矩阵，且绝不声称 selected-production proof 已通过。 [VERIFIED: .planning/phases/11-deployment-target-foundation/11-VERIFICATION.md; .planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

**Primary recommendation:** 在 `@starye/config` 的 deployment-target 层新增纯 renderer/validator，并让 `materializeTargetDeployConfig()` 生成临时 redirect config、`runPagesBuild()` 在成功构建后将其原子写入闭合的 `apps/<surface>/dist/_redirects`；用一个无远程副作用的 matrix CLI 作为 Phase 14 final gate。 [VERIFIED: packages/config/src/deployment-target/deploy-config.ts; scripts/target-profile.ts; .github/workflows/deploy-auth.yml; .github/workflows/deploy-blog.yml; .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-movie.yml; .github/workflows/deploy-comic.yml]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `starye.org` literal 分类与拒绝 | Repository static validation | CI test runner | 只扫描 Git-tracked active inputs，测试应在远端 mutation 之前失败。 [VERIFIED: 14-CONTEXT.md; codebase grep] |
| Pages redirect 生成 | Build/materialization | CDN/Pages static serving | selected profile 先生成临时 input，build 后输出 `dist/_redirects`，Pages 只消费最终 artifact。 [VERIFIED: scripts/target-deploy.ts; scripts/target-profile.ts; CITED: https://developers.cloudflare.com/pages/configuration/redirects/] |
| target identity、资源与 secret metadata | Config package | Local/CI preflight | `TargetProfile` 是唯一 non-secret identity source；RUNBOOK 只能引用它。 [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| target-first RUNBOOK | Operations documentation | Workflow/operator UI | 稳定命令与分流写入 RUNBOOK，run/evidence 状态不写进它。 [VERIFIED: RUNBOOK.md; docs/documentation-ownership.md; 14-CONTEXT.md] |
| 30 项 evidence matrix | Repository-local verifier | `.planning` phase/milestone evidence | validator 读取 report、测试源和 artifact paths，不运行 credentialed/provider commands。 [VERIFIED: 14-CONTEXT.md; scripts/verify-data-chain-smoke.ts] |

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| TypeScript / Node.js | Node `v24.0.1` | typed renderer、audit、matrix CLI | `scripts/` 和 deployment-target 已以 TypeScript/Node ESM 实现，避免引入第二套 runtime。 [VERIFIED: environment probe; scripts/target-profile.ts] |
| `@starye/config` workspace package | `0.0.0` | TargetProfile、deploy materialization、pure validators | 已拥有 resolver、preflight、Pages build env 与 target tests。 [VERIFIED: packages/config/package.json; packages/config/src/deployment-target/] |
| Vitest | `4.1.4` | source-contract 与 file-artifact tests | 当前 deployment-target contract suite 的既有 test runner。 [VERIFIED: environment probe; packages/config/package.json] |
| Git CLI | `2.39.2.windows.1` | enumerate only tracked audit inputs | D-03 的范围就是 Git-tracked active inputs；`git ls-files -z` 比全盘 glob 更准确。 [VERIFIED: environment probe; 14-CONTEXT.md] |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| pnpm | `10.33.0` | run workspace test and static verifier commands | 所有 Phase 14 validation commands。 [VERIFIED: environment probe; package.json] |
| `target-profile` CLI | repository script | explicit target validation、local projection、preflight、prepared mutation handoff | RUNBOOK 选择 target 与预检，workflow 在 CI scope 使用它。 [VERIFIED: package.json; scripts/target-profile.ts] |
| `target-deploy` CLI | repository script | target-aware local deploy and Pages build materialization | 仅在 operator 已完成 local preflight 且要执行选中 target 的 local deploy 时。 [VERIFIED: package.json; scripts/target-deploy.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| typed renderer plus temporary artifact | 每个 app tracked `public/_redirects` 写默认域 | 会违反 D-02/TEST-01，并把 selected target 重新分散到五份源文件。 [VERIFIED: 14-CONTEXT.md; codebase grep] |
| `git ls-files` fixed-literal audit | 全盘 `rg` 或 baseline ratchet | 会误扫文档、ignored env、build output，或容忍首次绿灯前的旧域债务，违反 D-03/D-04。 [VERIFIED: 14-CONTEXT.md] |
| JSON source matrix plus rendered Markdown | 仅手写 Markdown checklist | 无法可靠验证 30 项集合、重复 ID、状态或 artifact path。 [VERIFIED: 14-CONTEXT.md] |

**Installation:** 不安装外部 package。 [VERIFIED: packages/config/package.json; 14-CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
tracked TargetProfile + pages redirect template
                 |
                 v
materializeTargetDeployConfig()
  | temporary Pages build env + temporary redirect config
  v
runPagesBuild(surface, generated inputs)
  | fresh allowlisted child env -> existing app build
  v
closed output mapping -> apps/<surface>/dist/_redirects -> existing Pages deploy command

git ls-files (active source/config/test only)
  -> fixed-literal scanner -> exact allowlist -> Vitest gate for TEST-01

11/12/13 canonical verifier reports + Phase 14 tests/RUNBOOK/artifacts
  -> requirement-evidence matrix JSON -> static matrix validator -> rendered matrix Markdown
                                                       |
                                                       v
                                     Phase 14 verifier; no provider command is invoked
```

`_redirects` belongs in a project static asset directory or build output directory; Pages parses it instead of serving it, and static rules must precede dynamic rules. The current rules are static, so rendering them into the final `dist` directory preserves the platform contract. [CITED: https://developers.cloudflare.com/pages/configuration/redirects/]

### Recommended Project Structure

```text
packages/config/src/deployment-target/
├── pages-redirects.ts                 # typed source-origin/path/fallback rendering + strict parser
├── legacy-domain-audit.ts              # tracked fixed-literal scanner and exact allowance model
└── __tests__/
    ├── pages-redirects.test.ts
    ├── legacy-domain-audit.test.ts
    └── requirement-evidence-matrix.test.ts
scripts/
└── verify-v12-evidence-matrix.ts       # read-only CLI that invokes the pure matrix validator
apps/<pages-app>/deploy/
└── _redirects.template                 # no canonical domain; only typed placeholders/source/path/fallback
.planning/phases/14-test-and-operations-hardening/
├── 14-EVIDENCE-MATRIX.json             # canonical machine-readable 30-row evidence source
└── 14-EVIDENCE-MATRIX.md               # generated review/archive rendering
```

The exact filenames remain planner discretion, but the ownership separation above is required: non-secret target logic in `@starye/config`, stable procedures in `RUNBOOK.md`, and execution/evidence state in the Phase 14 directory. [VERIFIED: 14-CONTEXT.md; docs/documentation-ownership.md]

### Pattern 1: Profile To Final Redirect Artifact

**What:** Extend the existing typed Pages materialization result with a temporary, selected-target redirect input. The renderer receives only the resolved profile, a closed `TargetPagesSurface`, and the surface template; it writes the final redirect after the app build succeeds. [VERIFIED: packages/config/src/deployment-target/deploy-config.ts; scripts/target-profile.ts]

**When to use:** Every `dashboard|auth|blog|movie|comic` `run-pages-build` path, including local `target-deploy` and CI `prepare-mutation` workflows. [VERIFIED: scripts/target-deploy.ts; packages/config/src/deployment-target/__tests__/workflow-contract.test.ts]

**Required implementation details:**

- Add a typed direct Pages origin to the existing per-surface profile data when the current project name cannot derive it exactly; this remains a non-secret target attribute and avoids a second editable source. [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; apps/auth/public/_redirects; apps/blog/public/_redirects]
- Move the five tracked redirect sources to templates with placeholders such as `{{PAGES_DIRECT_ORIGIN}}` and `{{CANONICAL_GATEWAY_ORIGIN}}`; retain auth's root-login rule, each app path, and each SPA fallback. No template may contain `starye.org`. [VERIFIED: apps/auth/public/_redirects; apps/blog/public/_redirects; apps/dashboard/public/_redirects; apps/movie-app/public/_redirects; apps/comic-app/public/_redirects]
- `materializeTargetDeployConfig()` creates and later deletes the temporary redirect config beside the existing generated Pages build env; `runPagesBuild()` accepts both generated paths, parses them fail-closed, runs its existing type-build/app-build sequence, then atomically writes the closed surface's `dist/_redirects`. [VERIFIED: packages/config/src/deployment-target/deploy-config.ts; scripts/target-profile.ts]
- Extend `MaterializedPagesBuild`, CLI argument parsing, `runTargetDeploy()` argv expectations, all five workflow prepare/build/cleanup sections, and the workflow contract test together. The existing workflow paths are `apps/auth/dist`, `apps/blog/dist`, `apps/dashboard/dist`, `apps/movie-app/dist`, and `apps/comic-app/dist`. [VERIFIED: .github/workflows/deploy-auth.yml; .github/workflows/deploy-blog.yml; .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-movie.yml; .github/workflows/deploy-comic.yml]

```typescript
// Source pattern: packages/config/src/deployment-target/deploy-config.ts
const redirects = renderPagesRedirects({
  profile: resolution.profile,
  surface,
  template: await readFile(templatePath, 'utf8'),
})
assertNoUnresolvedRedirectPlaceholder(redirects)
await writeFile(path.join(outputDirectoryFor(surface), '_redirects'), redirects, 'utf8')
```

The snippet is a target shape, not a new unverified API. Preserve `assertChildPath()`-style containment, the existing temporary cleanup lifecycle, and the clean allowlisted child environment. [VERIFIED: packages/config/src/deployment-target/deploy-config.ts; scripts/target-profile.ts]

### Pattern 2: Strict Tracked Literal Audit

**What:** A pure audit accepts injected `trackedPaths` and `readFile` dependencies for tests; its CLI adapter obtains `git ls-files -z`, filters active source/config/test paths, and performs `content.includes('starye.org')`. Each retained occurrence must match an exact file-plus-fragment allowance with a reason. [VERIFIED: 14-CONTEXT.md; codebase grep]

**When to use:** CI/static validation for TEST-01 and local pre-commit verification, never as a source rewrite tool. [VERIFIED: AGENTS.md; 14-CONTEXT.md]

**Rules:**

- Exclude Markdown/docs, `.planning`, ignored local env, generated directories, and untracked evidence before reading content. [VERIFIED: 14-CONTEXT.md]
- Allow only the explicit default `TargetProfile`, `legacyTargetAliasValues` fail-closed rule, and clearly named dedicated fixture source. Do not allow a directory, broad `*.test.ts` glob, a baseline count, or an unreasoned line range. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/preflight.ts; packages/config/src/deployment-target/target-profiles.ts]
- Report every unexpected `path:line:fragment` deterministically and return nonzero; first green requires no unclassified hit. [VERIFIED: 14-CONTEXT.md]

### Pattern 3: Read-Only Requirement Evidence Matrix

**What:** Store structured rows in `14-EVIDENCE-MATRIX.json`; render Markdown from that source. The validator reads `REQUIREMENTS.md`, Phase 11/12/13 canonical verifier reports, test source paths, RUNBOOK, and local Phase 14 artifacts. It validates references only and never invokes a deployment, crawler, smoke, rollback, D1, R2, or Cloudflare command. [VERIFIED: 14-CONTEXT.md; .planning/REQUIREMENTS.md; scripts/verify-data-chain-smoke.ts]

**Required row fields:** `id`, `sourcePhase`, `status`, `evidence[]`, `limitations`, and, for `partial|blocked|deferred`, `checkpointOrMissingArtifact`, `recoveryPrerequisite`, `nextOperatorCommand`. Each evidence record carries `kind`, repo-relative `path`, stable `anchor`, and an optional recorded command/result string. [VERIFIED: 14-CONTEXT.md]

**Validator contract:**

1. Parse exactly the 30 v1.2 IDs from `REQUIREMENTS.md`; reject missing, extra, duplicate, malformed, or unordered matrix IDs. [VERIFIED: .planning/REQUIREMENTS.md; 14-CONTEXT.md]
2. Validate each repo-relative evidence path stays below repository root and exists; reject absolute paths, traversal, missing files, and remote URLs used as artifact paths. [VERIFIED: 14-CONTEXT.md]
3. Expand canonical verifier requirement groups where required (for example Phase 12's `ENV-03..ENV-06`) and compare the matrix status to the report rather than to traceability checkboxes. [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md; .planning/REQUIREMENTS.md]
4. Require Phase 13 DATA/TEST-05 rows to retain the current canonical `BLOCKED`/`PARTIAL` statuses until a newer canonical Phase 13 verifier changes them. A `checkpoint` or `pending` artifact is not a terminal pass. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; scripts/verify-data-chain-smoke.ts]
5. Permit `pending` only while building the Phase 14 artifact; the final mode must reject it and require TEST-01, TEST-06, and TEST-07 to be `verified`. [VERIFIED: 14-CONTEXT.md]

### Pattern 4: Target-First RUNBOOK Stages

**What:** Add one ordered, target-first operations section to `RUNBOOK.md`, then link existing D1/R2/observability troubleshooting sections instead of duplicating them. [VERIFIED: RUNBOOK.md; docs/documentation-ownership.md]

**Ordered stable procedure:**

1. **Select and inspect:** `pnpm target-profile -- validate --target <target-id>`; record only the selected id and printed non-secret identity. [VERIFIED: package.json; scripts/target-profile.ts]
2. **Local projection and preflight:** run the existing `project-local --write|--check`, then `preflight --scope local --command <closed-command>` with the selected profile's local Wrangler identity. A failed preflight stops before local deploy. [VERIFIED: scripts/target-profile.ts; packages/config/src/deployment-target/preflight.ts]
3. **Deploy / migration / crawl:** local Pages/Worker deployment uses `pnpm target-deploy -- --target <target-id> --app <app> [--surface <surface>]`; remote operations use the existing workflow's explicit `target` input and its `prepare-mutation --scope ci` gate. The RUNBOOK must say that credentialed workflow execution is an operator action, not a static test. [VERIFIED: scripts/target-deploy.ts; .github/workflows/rollback.yml; packages/config/src/deployment-target/__tests__/workflow-contract.test.ts]
4. **Smoke:** run root `smoke:data-chain` and `smoke:data-chain:verify` only with explicit `--mode`, `--target`, and `--run-id`; local browser proof uses the Gateway canonical URL. `checkpoint` stops, preserves the pair, and routes to the recovery stage; only terminal `passed` completes that run. [VERIFIED: package.json; scripts/data-chain-smoke.ts; scripts/verify-data-chain-smoke.ts; AGENTS.md]
5. **Rollback / recovery:** stop subsequent mutation, preserve run/evidence, classify local/target/provider checkpoint, rerun selected-target preflight, then use target-aware Worker rollback, manual Pages rollback, or documented D1 restore as appropriate. Begin a new verification run after recovery. [VERIFIED: .github/workflows/rollback.yml; RUNBOOK.md; 14-CONTEXT.md]

## Source Audit Classification

| Current location | Fixed-literal occurrences | Classification | Phase 14 action |
|------------------|---------------------------|----------------|-----------------|
| `packages/config/src/deployment-target/target-profiles.ts` | 10 | explicit default TargetProfile | Retain with exact allowlist entries and test reason `default-target-profile`; all redirect values must flow from this profile. [VERIFIED: codebase grep; packages/config/src/deployment-target/target-profiles.ts] |
| `packages/config/src/deployment-target/preflight.ts` | 3 | legacy alias deny-list | Retain as exact allowlisted `legacy-target-alias` strings because they fail closed; keep negative coverage. [VERIFIED: codebase grep; packages/config/src/deployment-target/preflight.ts] |
| five `apps/*/public/_redirects` files | 11 | active static redirect source | Replace with canonical-domain-free templates and selected-target final materialization. [VERIFIED: codebase grep; apps/auth/public/_redirects; apps/blog/public/_redirects; apps/dashboard/public/_redirects; apps/movie-app/public/_redirects; apps/comic-app/public/_redirects] |
| `apps/api/.dev.vars.example` | 1 | active configuration example | Remove the default R2 public URL literal; use a documented placeholder or generated selected projection, never another target source. [VERIFIED: codebase grep; apps/api/.dev.vars.example] |
| `apps/auth/typecheck.pages-build.env` | 2 | unnamed typecheck build fixture | Move to a named fixture boundary or create it from the typed Pages env serializer; do not leave an active default-domain env file. [VERIFIED: codebase grep; apps/auth/typecheck.pages-build.env; packages/config/src/deployment-target/deploy-config.ts] |
| `apps/gateway/src/index.ts` | 1 | stale comment only | Replace with target-neutral wording; it has no runtime behavior to preserve. [VERIFIED: codebase grep; apps/gateway/src/index.ts] |
| blog/dashboard E2E email fixtures | 3 | unrelated test identity fixture | Use an `.test` email domain rather than allowlisting production-domain mailboxes. [VERIFIED: codebase grep; apps/blog/e2e/session.spec.ts; apps/dashboard/e2e/auth-crosspath.spec.ts] |
| Gateway routing/cache tests | 35 | default target URL fixture spread across tests | Centralize request/origin construction behind one explicitly named default-target test helper, then remove raw URL strings from individual tests. [VERIFIED: codebase grep; apps/gateway/src/__tests__/cache-consistency.e2e.test.ts; apps/gateway/src/__tests__/cache-middleware.test.ts; apps/gateway/src/__tests__/dashboard-guard.test.ts; apps/gateway/src/__tests__/routing.test.ts] |
| deployment-target tests | 25 | profile, projection, preflight, deploy, and remote smoke fixtures | Derive URLs from `resolveTargetProfile('starye-org')` where behavior is not testing a raw literal; retain only dedicated schema/default-profile/legacy-alias fixtures in the exact allowlist. [VERIFIED: codebase grep; packages/config/src/deployment-target/__tests__/] |

The audit should initially assert all 91 current active occurrences are classified, then fail until the migration leaves only the three allowed categories. It must not codify 91 as a lasting baseline or ratchet. [VERIFIED: codebase grep; 14-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| target identity | another env file, per-app config, or RUNBOOK domain table | `trackedTargetProfiles` and resolver | A second target source violates D-01/D-05 and drifts from preflight/workflow identity. [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; 14-CONTEXT.md] |
| Pages deploy boundary | ad-hoc `wrangler pages deploy` wrapper with a literal URL | existing `materializeTargetDeployConfig()` -> `runPagesBuild()` -> workflow contract | Existing flow already removes temporary inputs and passes only approved target output. [VERIFIED: scripts/target-deploy.ts; scripts/target-profile.ts; packages/config/src/deployment-target/__tests__/workflow-contract.test.ts] |
| evidence pass promotion | custom status inference from checkbox state | canonical verifier report parsing and `verify-data-chain-smoke` semantics | Checkboxes are traceability only; checkpoint/pending are explicitly non-success. [VERIFIED: 14-CONTEXT.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; scripts/verify-data-chain-smoke.ts] |
| recovery automation | one-click cross-provider restore | existing target-aware Worker rollback, manual Pages rollback, D1 recovery procedure | Pages rollback is intentionally fail-closed/manual and D-08 limits recovery to an operator checklist. [VERIFIED: .github/workflows/rollback.yml; RUNBOOK.md; 14-CONTEXT.md] |

**Key insight:** Phase 14 is a proof-and-boundary phase. Reusing the existing resolver/materializer/verifier seams is safer than turning static documentation or tests into a hidden deployment controller. [VERIFIED: 14-CONTEXT.md; scripts/target-deploy.ts; scripts/verify-data-chain-smoke.ts]

## Common Pitfalls

### Pitfall 1: Regex Audit Matches `starye-org`

**What goes wrong:** A regex pattern `starye.org` treats `.` as any character and reports legal `starye-org` target ids as domains. [VERIFIED: codebase grep]

**How to avoid:** Use a fixed literal `starye.org` comparison after `git ls-files -z`, and test hyphenated target ids as non-matches. [VERIFIED: codebase grep; 14-CONTEXT.md]

### Pitfall 2: Redirect Is Rendered Into Tracked `public/`

**What goes wrong:** A selected build mutates source, leaves the worktree dirty, races concurrent builds, and can deploy a stale target on a later build. [VERIFIED: scripts/target-profile.ts; packages/config/src/deployment-target/deploy-config.ts]

**How to avoid:** Keep tracked templates target-neutral; use run-scoped materialization and write only the current build output after the application build succeeds. [VERIFIED: 14-CONTEXT.md; scripts/target-profile.ts]

### Pitfall 3: Matrix Treats Contract Coverage As Provider Proof

**What goes wrong:** DATA/TEST rows become `verified` just because a unit test, a plan, or a requirement checkbox exists. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; .planning/REQUIREMENTS.md]

**How to avoid:** Compare matrix status to the canonical verifier; preserve Phase 13 `BLOCKED` and `PARTIAL` rows plus their recovery data. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; 14-CONTEXT.md]

### Pitfall 4: RUNBOOK Becomes Another Target/Secret Store

**What goes wrong:** Static prose duplicates target URLs, resource names, or secret values and falls out of sync with the profile. [VERIFIED: RUNBOOK.md; packages/config/src/deployment-target/target-profiles.ts]

**How to avoid:** Show placeholders and commands, and generate the secret name/consumer/local-file/CI-environment table from required-secret metadata without values. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/target-profiles.ts]

### Pitfall 5: `checkpoint` Is Documented As a Completed Smoke

**What goes wrong:** Operator proceeds into mutation or records a success while the evidence remains a non-success state. [VERIFIED: scripts/verify-data-chain-smoke.ts; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

**How to avoid:** RUNBOOK branches immediately at `checkpoint`, preserves the pair, and requires a new run after recovery. [VERIFIED: 14-CONTEXT.md; scripts/verify-data-chain-smoke.ts]

## Code Examples

### Fixed-Literal Audit Boundary

```typescript
// Source pattern: D-01 through D-04; do not use /starye.org/ here.
const legacyDomain = 'starye.org'
const unexpected = trackedActiveFiles.flatMap(file =>
  file.content.includes(legacyDomain) && !isExactAllowedOccurrence(file)
    ? [file.path]
    : [],
)

if (unexpected.length > 0)
  throw new Error(`Unclassified legacy domain occurrences: ${unexpected.join(', ')}`)
```

The production implementation should inject file enumeration/reading in tests and reserve process execution for a thin CLI adapter. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/__tests__/target-deploy.test.ts]

### Matrix Final Gate

```typescript
// Source pattern: Phase 13 verifier preserves a non-success exit for checkpoint evidence.
const result = validateEvidenceMatrix(matrix, {
  requirementIds: readV12RequirementIds(requirementsText),
  canonicalReports,
  repositoryRoot,
  final: true,
})

if (!result.ok)
  throw new Error(result.issues.join('\n'))
```

`final: true` must require all 30 rows, no unresolvable local paths, and verified TEST-01/TEST-06/TEST-07; it must not run any of the referenced commands. [VERIFIED: 14-CONTEXT.md; scripts/verify-data-chain-smoke.ts]

## 30-Row Requirement-To-Evidence Matrix Design

The following is the required initial status ledger. `verified` for Phase 11/12 means their canonical source-contract verifier passed; it does not turn their separately documented credentialed/provider caveat into remote execution proof. Phase 13 statuses are the current canonical verifier values. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-VERIFICATION.md; .planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

| ID | Source phase | Current matrix status | Required canonical evidence pointer |
|----|--------------|-----------------------|-------------------------------------|
| PROF-01 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` profile CLI/schema result. [VERIFIED: 11-VERIFICATION.md] |
| PROF-02 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` preflight result. [VERIFIED: 11-VERIFICATION.md] |
| PROF-03 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` fail-closed result. [VERIFIED: 11-VERIFICATION.md] |
| PROF-04 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` local/CI boundary result. [VERIFIED: 11-VERIFICATION.md] |
| ENV-01 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` projection result. [VERIFIED: 11-VERIFICATION.md] |
| ENV-02 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` local preflight result. [VERIFIED: 11-VERIFICATION.md] |
| ENV-03 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` grouped ENV-03..06 result. [VERIFIED: 12-VERIFICATION.md] |
| ENV-04 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` grouped ENV-03..06 result. [VERIFIED: 12-VERIFICATION.md] |
| ENV-05 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` grouped ENV-03..06 result. [VERIFIED: 12-VERIFICATION.md] |
| ENV-06 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` grouped ENV-03..06 result. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-01 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` workflow projection result. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-02 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` workflow projection result. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-03 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` workflow target-resolution result. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-04 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` DB registry contract; retain provider caveat. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-05 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` crawler registry contract; retain provider caveat. [VERIFIED: 12-VERIFICATION.md] |
| DEPL-06 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` rollback workflow contract. [VERIFIED: 12-VERIFICATION.md] |
| DATA-01 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; preserve 13-25/13-17 recovery prerequisite. [VERIFIED: 13-VERIFICATION.md] |
| DATA-02 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; no fresh local readiness run. [VERIFIED: 13-VERIFICATION.md] |
| DATA-03 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; no fresh fixture run. [VERIFIED: 13-VERIFICATION.md] |
| DATA-04 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; selected provider tuple missing. [VERIFIED: 13-VERIFICATION.md] |
| DATA-05 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; Dashboard receipt missing. [VERIFIED: 13-VERIFICATION.md] |
| DATA-06 | 13 | blocked | `13-VERIFICATION.md#requirements-coverage`; canonical viewer receipt missing. [VERIFIED: 13-VERIFICATION.md] |
| DATA-07 | 13 | partial | `13-VERIFICATION.md#requirements-coverage`; contracts exist but fresh artifact pair missing. [VERIFIED: 13-VERIFICATION.md] |
| TEST-01 | 14 | pending -> verified at final gate | literal audit source, test result, and generated redirect artifact. [VERIFIED: 14-CONTEXT.md] |
| TEST-02 | 11 | verified | `11-VERIFICATION.md#requirements-coverage` 58-test config suite. [VERIFIED: 11-VERIFICATION.md] |
| TEST-03 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` public runtime contract. [VERIFIED: 12-VERIFICATION.md] |
| TEST-04 | 12 | verified | `12-VERIFICATION.md#requirement-coverage` fake-executor/workflow contracts. [VERIFIED: 12-VERIFICATION.md] |
| TEST-05 | 13 | partial | `13-VERIFICATION.md#requirements-coverage`; regression passed but fresh live local/production output absent. [VERIFIED: 13-VERIFICATION.md] |
| TEST-06 | 14 | pending -> verified at final gate | target-first RUNBOOK structure/metadata test and stable manual commands. [VERIFIED: 14-CONTEXT.md; RUNBOOK.md] |
| TEST-07 | 14 | pending -> verified at final gate | matrix JSON, rendered Markdown, and static final validator output. [VERIFIED: 14-CONTEXT.md] |

For the eight Phase 13 `blocked|partial` rows, matrix records must contain the exact current checkpoint/missing-artifact description and `$gsd-plan-phase 13 --gaps` as the recovery route from the canonical verifier, not a Phase 14 remote command. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

## Validation Plan

`workflow.nyquist_validation` is explicitly `false`, so this is the phase-specific validation map rather than a Nyquist Validation Architecture section. [VERIFIED: .planning/config.json]

| Requirement | Test / verification | Command shape | Expected gate |
|-------------|---------------------|---------------|---------------|
| TEST-01 | fixed-literal audit unit tests plus all-five-surface renderer/materializer tests | `pnpm --filter @starye/config exec vitest run <literal-audit> <pages-redirects> <target-deploy>` | No unclassified tracked active literal; every selected target result writes a correct `dist/_redirects` without mutating tracked source. [VERIFIED: packages/config/package.json; scripts/target-profile.ts; 14-CONTEXT.md] |
| TEST-06 | RUNBOOK structure/command-reference test plus manual prose review | `pnpm --filter @starye/config exec vitest run <runbook-contract>` | target selection, secret metadata reference, projection/preflight, deploy/migrate/crawl, smoke branches, rollback/recovery present; no secret value or duplicate target table. [VERIFIED: RUNBOOK.md; packages/config/src/deployment-target/target-profiles.ts; 14-CONTEXT.md] |
| TEST-07 | pure matrix schema/report-reconciliation tests plus CLI final mode | `pnpm --filter @starye/config exec vitest run <matrix-tests>` then `pnpm --filter @starye/crawler exec node --import tsx ../../scripts/verify-v12-evidence-matrix.ts --final` | exactly 30 unique IDs, existing local evidence refs, canonical status reconciliation, and no pending Phase 14 rows. [VERIFIED: packages/config/package.json; scripts/verify-data-chain-smoke.ts; 14-CONTEXT.md] |
| Cross-cutting | config compilation | `pnpm --filter @starye/config exec tsc --noEmit` | typed deployment-target additions compile. [VERIFIED: packages/config/package.json] |
| Commit scope | GitNexus review | `gitnexus_detect_changes()` before commit | only expected source/test/doc/evidence symbols and flows; HIGH/CRITICAL impact must have been surfaced before affected symbol edits. [VERIFIED: AGENTS.md] |

No validation above executes Cloudflare, D1, R2, crawler, deploy, rollback, or selected-production smoke. Such operations remain operator-controlled Phase 13/operations work. [VERIFIED: 14-CONTEXT.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no direct implementation | RUNBOOK may name consumers but never records a credential value or auth proof. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/target-profiles.ts] |
| V3 Session Management | no direct implementation | Matrix only references existing evidence; no session handling is introduced. [VERIFIED: 14-CONTEXT.md] |
| V4 Access Control | yes, operations boundary | explicit target + fail-closed preflight remain the authorization boundary before remote mutations. [VERIFIED: packages/config/src/deployment-target/preflight.ts; 14-CONTEXT.md] |
| V5 Input Validation | yes | strict target/surface enums, fixed literal audit, safe repo-relative path validation, and matrix schema validation. [VERIFIED: scripts/target-profile.ts; scripts/data-chain-smoke.ts; 14-CONTEXT.md] |
| V6 Cryptography | no | do not introduce custom cryptography; secrets remain external metadata/value boundaries. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/target-profiles.ts] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| matrix path traversal or arbitrary file reference | Tampering / Information disclosure | resolve only repository-relative paths, reject absolute/traversal paths, and require existence before rendering. [VERIFIED: 14-CONTEXT.md; scripts/data-chain-smoke.ts] |
| forged `verified` state from a checkbox or stale plan | Tampering | reconcile with canonical verifier requirement rows; fail closed on status mismatch. [VERIFIED: 14-CONTEXT.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md] |
| secret value copied into RUNBOOK or evidence | Information disclosure | profile provides names/consumers only; validators record paths/anchors and command descriptions, never process output. [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; 14-CONTEXT.md] |
| arbitrary domain or surface injected into redirect build | Tampering | closed `TargetPagesSurface`, selected profile renderer, generated config parser, and no caller-provided domain argv. [VERIFIED: scripts/target-deploy.ts; scripts/target-profile.ts; 14-CONTEXT.md] |

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| tracked Pages `public/_redirects` directly embeds the default canonical domain | selected profile must materialize final build output from target-neutral template | prevents a selected target build from retaining a default-domain redirect. [VERIFIED: apps/auth/public/_redirects; apps/blog/public/_redirects; apps/dashboard/public/_redirects; apps/movie-app/public/_redirects; apps/comic-app/public/_redirects; 14-CONTEXT.md] |
| human-written requirement checklist / traceability checkbox | canonical-report-backed, path-validated 30-row matrix | preserves honest partial/blocked state and can be mechanically checked. [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; 14-CONTEXT.md] |
| RUNBOOK lists default production surfaces and secrets directly | target-first procedure references profile metadata and explicit target commands | removes duplicated target facts while retaining stable operator steps. [VERIFIED: RUNBOOK.md; packages/config/src/deployment-target/target-profiles.ts; 14-CONTEXT.md] |

## Assumptions Log

All material technical claims were verified from the current repository, the configured environment, or the cited Cloudflare Pages documentation. No unverified package, compliance, provider-state, or performance assumption is used for planning. [VERIFIED: codebase grep; environment probe; CITED: https://developers.cloudflare.com/pages/configuration/redirects/]

## Open Questions

1. **Phase 13 report freshness versus later state notes**
   - What we know: the Phase 13 canonical verifier is `gaps_found` and marks DATA-01..06 blocked, DATA-07/TEST-05 partial; `STATE.md` also contains later local-run narration. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; .planning/STATE.md]
   - What's unclear: whether a newer canonical Phase 13 verifier will change any local requirement row before Phase 14 finalization. [VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md; .planning/STATE.md]
   - Recommendation: initialize the matrix from `13-VERIFICATION.md`; a newer Phase 13 verifier must be parsed and explicitly reconciled before any Phase 13 row changes. Never infer selected-production success. [VERIFIED: 14-CONTEXT.md; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

2. **Direct Pages origin ownership**
   - What we know: current redirect source hosts are not uniformly derivable from the Pages project name, notably Blog's `starye-blog.pages.dev` versus project `blog-pages`. [VERIFIED: apps/blog/public/_redirects; packages/config/src/deployment-target/target-profiles.ts]
   - What's unclear: whether a future selected target may change these direct Pages hosts independently of project names. [ASSUMED]
   - Recommendation: model the direct origin as a typed non-secret per-surface profile attribute and render the final redirect from it, rather than guessing a hostname or retaining five default literals. [VERIFIED: 14-CONTEXT.md; packages/config/src/deployment-target/target-profiles.ts]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | renderer/audit/matrix CLI | yes | `v24.0.1` | none required. [VERIFIED: environment probe] |
| pnpm | workspace tests and scripts | yes | `10.33.0` | none required. [VERIFIED: environment probe] |
| Git | tracked-file literal scope | yes | `2.39.2.windows.1` | no fallback; D-03 requires Git-tracked inputs. [VERIFIED: environment probe; 14-CONTEXT.md] |
| Cloudflare credentials/provider | only deferred operator deploy/smoke/rollback stages | intentionally not probed | — | static validation must not invoke remote commands. [VERIFIED: 14-CONTEXT.md] |

**Missing dependencies with no fallback:** none for Phase 14's static implementation and validation. [VERIFIED: environment probe; 14-CONTEXT.md]

## Sources

### Primary (HIGH confidence)

- Repository code and tests: `packages/config/src/deployment-target/`, `scripts/target-profile.ts`, `scripts/target-deploy.ts`, `scripts/data-chain-smoke.ts`, `scripts/verify-data-chain-smoke.ts`, workflow files, existing redirect sources, and `RUNBOOK.md`. [VERIFIED: codebase grep]
- Phase contracts and canonical state: `14-CONTEXT.md`, `11-CONTEXT.md`, `12-CONTEXT.md`, `11-VERIFICATION.md`, `12-VERIFICATION.md`, `13-VERIFICATION.md`, `REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md`. [VERIFIED: .planning/]
- GitNexus execution-flow context for `runTargetDeploy`, `runPagesBuild`, and `inspectDataChainSmokeVerification`. [VERIFIED: GitNexus]

### Secondary (MEDIUM confidence)

- Cloudflare Pages Redirects documentation: https://developers.cloudflare.com/pages/configuration/redirects/ — `_redirects` input/output placement and static-rule ordering. [CITED: https://developers.cloudflare.com/pages/configuration/redirects/]

### Tertiary (LOW confidence)

- None. [VERIFIED: research plan provider availability]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - current manifests and local version probes. [VERIFIED: packages/config/package.json; environment probe]
- Architecture: HIGH - current deployment/materialization code, workflows, and GitNexus call graph. [VERIFIED: scripts/target-deploy.ts; scripts/target-profile.ts; GitNexus]
- Pitfalls: HIGH - current fixed-literal inventory and canonical Phase 13 verifier demonstrate the failure modes directly. [VERIFIED: codebase grep; .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 for repository-local contracts; refresh the Cloudflare Pages citation and Phase 13 canonical status before planning if either changes. [CITED: https://developers.cloudflare.com/pages/configuration/redirects/; VERIFIED: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md]
