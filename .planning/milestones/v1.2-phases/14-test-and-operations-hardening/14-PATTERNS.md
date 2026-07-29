# Phase 14: Test and Operations Hardening - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 30 file paths/groups
**Analogs found:** 27 / 30 (three new validators have only role-match analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/config/src/deployment-target/target-profile.schema.ts` | model/config | transform | same file: typed Valibot profile schema | exact |
| `packages/config/src/deployment-target/target-profiles.ts` | config/model | transform | same file: `trackedTargetProfiles` | exact |
| `packages/config/src/deployment-target/pages-redirects.ts` | utility | transform/file-I/O | `deploy-config.ts` | role-match |
| `packages/config/src/deployment-target/legacy-domain-audit.ts` | utility | batch/file-I/O | `preflight.ts` | role-match |
| `packages/config/src/deployment-target/requirement-evidence-matrix.ts` | utility | batch/transform | `data-chain-evidence.ts` | role-match |
| `packages/config/src/deployment-target/deploy-config.ts` | service/config | file-I/O | same file: materializer and cleanup lifecycle | exact |
| `packages/config/src/deployment-target/index.ts` | config/barrel | transform | same file: ordered deployment-target re-exports | exact |
| `scripts/target-profile.ts` | CLI/controller | request-response/file-I/O | same file: `runPagesBuild()` | exact |
| `scripts/target-deploy.ts` | CLI/controller | request-response/file-I/O | same file: `runTargetDeploy()` | exact |
| `scripts/verify-v12-evidence-matrix.ts` | CLI/controller | batch/file-I/O | `scripts/verify-data-chain-smoke.ts` | role-match |
| `apps/{auth,blog,dashboard,movie-app,comic-app}/deploy/_redirects.template` | config/template | transform | five current `public/_redirects` files | data-match |
| `apps/{auth,blog,dashboard,movie-app,comic-app}/public/_redirects` | config/source removal | file-I/O | current files; migrate to templates | exact |
| `.github/workflows/deploy-{auth,blog,dashboard,movie,comic}.yml` | config/workflow | event-driven | `workflow-contract.test.ts` Pages assertions | exact |
| `packages/config/src/deployment-target/__tests__/pages-redirects.test.ts` | test | transform/file-I/O | `deploy-config.test.ts` | role-match |
| `packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts` | test | batch/file-I/O | `preflight.test.ts` and `deploy-config.test.ts` | role-match |
| `packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts` | test | batch/transform | `verify-data-chain-smoke.test.ts` | role-match |
| `packages/config/src/deployment-target/__tests__/deploy-config.test.ts` | test | file-I/O | same file: temporary fixture + cleanup assertions | exact |
| `packages/config/src/deployment-target/__tests__/target-deploy.test.ts` | test | request-response/file-I/O | same file: fake executor assertions | exact |
| `packages/config/src/deployment-target/__tests__/workflow-contract.test.ts` | test | event-driven | same file: full workflow inventory loop | exact |
| `packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts` | test | transform | same file: full profile shape assertions | exact |
| `apps/api/.dev.vars.example` | config | transform | `buildLocalEnvProjectionPlan()` consumers | partial |
| `apps/auth/typecheck.pages-build.env` | config/test fixture | file-I/O | generated `pages-build-env.*.env` materializer | role-match |
| `apps/gateway/src/index.ts` | component/route | request-response | same file: target-neutral local detection comment | exact |
| `apps/{blog,dashboard}/e2e/{session,auth-crosspath}.spec.ts` | test | request-response | current mock-session fixtures | exact |
| `apps/gateway/src/__tests__/{cache-consistency.e2e,cache-middleware,dashboard-guard,routing}.test.ts` plus named default-target helper | test/utility | request-response | current `new Request()` fixtures | exact |
| `RUNBOOK.md` | documentation/config | operational procedure | same file: owner, deploy, smoke, rollback sections | exact |
| `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json` | evidence/model | batch/transform | Phase 13 JSON plus `data-chain-evidence.ts` | data-match |
| `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md` | evidence/report | transform | `renderDataChainEvidenceMarkdown()` | exact |

## Pattern Assignments

### Target Profile, Pages Redirect Renderer, And Materialization

**Apply to:** `target-profile.schema.ts`, `target-profiles.ts`, new `pages-redirects.ts`, `deploy-config.ts`, `index.ts`, `target-profile.ts`, `target-deploy.ts`, five templates, five source removals, five Pages workflows, and their config/CLI/workflow tests.

**Primary analog:** `packages/config/src/deployment-target/deploy-config.ts`

**Typed model pattern** (`target-profile.schema.ts:77-80`, `119-155`): extend the existing strict per-surface Pages object, then update the profile validator and its complete-shape test in the same plan. The new direct Pages origin is non-secret selected-target metadata, not an app-local value or a RUNBOOK table.

```typescript
const targetPageSchema = v.strictObject({
  project: requiredText('Pages project'),
  canonicalUrl: canonicalUrl('Pages canonical URL'),
})

pages: v.strictObject({
  dashboard: targetPageSchema,
  auth: targetPageSchema,
  blog: targetPageSchema,
  movie: targetPageSchema,
  comic: targetPageSchema,
})
```

**Profile-data pattern** (`target-profiles.ts:54-75`, `94-130`): add the selected-target field beside `project` and `canonicalUrl`; preserve `requiredSecrets` as metadata only. The source currently demonstrates both the per-surface Page record and the secret name/consumer/local-file/CI-environment boundary.

```typescript
pages: {
  dashboard: {
    project: 'starye-dashboard',
    canonicalUrl: 'https://starye-dashboard-5fz.pages.dev',
  },
  // auth, blog, movie, comic use the same closed surface map
},
requiredSecrets: [{
  name: 'CLOUDFLARE_API_TOKEN',
  required: true,
  consumers: ['ci'],
  localFiles: [],
  ciEnvironment: 'starye-org',
}],
```

**Containment and temporary-file lifecycle** (`deploy-config.ts:113-121`, `293-335`): write all generated build inputs only below a declared run directory, collect every created path, and make cleanup a returned lifecycle operation. Add a temporary redirect-template/rendered-input path to `MaterializedPagesBuild`, not a tracked `public/` write.

```typescript
function assertChildPath(directory: string, filename: string): string {
  const root = path.resolve(directory)
  const candidate = path.resolve(root, filename)
  if (path.dirname(candidate) !== root)
    throw new Error('Generated deploy config path must remain in its declared directory.')
  return candidate
}

const buildEnvPath = assertChildPath(runDirectory, `pages-build-env.${request.runId}.${surface}.env`)
await writeFile(buildEnvPath, serializePagesBuildEnv(environment, surface), 'utf8')
cleanupPaths.push(buildEnvPath)
pages = { surface, project: selected.project, buildEnvPath }
```

**Renderer pattern** (new `pages-redirects.ts`, closest `deploy-config.ts:252-287`): use a closed `TargetPagesSurface`, strict line/parser validation, and a renderer that accepts only resolved profile data plus a target-neutral template. Reject unknown/missing placeholders, unresolved `{{...}}`, unsupported origins, unsafe newlines, and surface/template mismatches. Do not build a caller-supplied domain argv or permit untyped paths.

**Build seam** (`scripts/target-profile.ts:248-269`): reparse generated inputs and build with a fresh allowlisted child environment. Extend this signature/CLI to receive the generated redirect input and write `dist/_redirects` only after both the API-types build and app build succeed. The final write must be atomic and must target the closed surface output directory.

```typescript
export async function runPagesBuild(surface: TargetPagesSurface, pagesBuildEnvPath: string, execute: PagesBuildExecutor = spawnPagesBuild): Promise<void> {
  const parsed = await parsePagesBuildEnv(pagesBuildEnvPath, surface)
  const environment = { ...pickRuntimeEnvironment(), ...parsed, STARYE_PAGES_BUILD_ENV_PATH: pagesBuildEnvPath }
  if (execute('pnpm', ['--filter', '@starye/api-types', 'build'], environment) !== 0)
    throw new Error(`Shared API types build failed for ${surface}.`)
  if (execute('pnpm', pagesBuildArgs(surface), environment) !== 0)
    throw new Error(`Pages build failed for ${surface}.`)
}
```

**Local deploy integration** (`scripts/target-deploy.ts:139-197`): retain explicit-target resolution, local live preflight, fixed deployment argv, and `finally` cleanup. Only append the generated redirect argument/path to the existing closed Pages build handoff.

```typescript
const preflight = runTargetPreflight({
  target: options.target, scope: 'local', command: 'deploy',
  wranglerProfile: resolution.profile.local.wranglerProfile,
  projectionIssues, environment: deploymentEnvironment, live: true,
  ...(options.surface ? { pagesSurface: options.surface } : {}),
})
if (!preflight.ok)
  throw new Error(`Target preflight failed: ${preflight.issues.map(issue => `${issue.code}: ${issue.message}`).join(' ')}`)

try {
  // worker or selected Pages build/deploy argv
}
finally {
  await materialized.cleanup()
}
```

**CI workflow contract** (`workflow-contract.test.ts:86-116`): make one inventory-driven assertion cover all five deploy workflows. Each workflow must still call `prepare-mutation --scope ci`, pass only `steps.prepare.outputs.*`, avoid `VITE_`/`NUXT_PUBLIC_` values outside the preparation block, and clean generated paths with `if: always()`.

```typescript
for (const workflow of workflows.filter(item => item.kind === 'pages')) {
  const source = await workflowText(workflow.file)
  expect(source).toContain(`--command pages-deploy --surface ${surface}`)
  expect(source).toContain(`pnpm target-profile run-pages-build --surface ${surface} --pages-build-env-path "${githubExpression('steps.prepare.outputs.pages_build_env_path')}"`)
  expect(source).toContain(`--project-name "${githubExpression('steps.prepare.outputs.pages_project')}"`)
  expect(source).not.toMatch(/\bVITE_|\bNUXT_PUBLIC_/)
}
```

**Template migration:** preserve exact routing semantics from the current sources: auth root-login redirect, direct Pages source origin, canonical Gateway destination path, and SPA fallback. The current app-specific patterns are in `apps/auth/public/_redirects:1-7`, `apps/blog/public/_redirects:1-4`, `apps/dashboard/public/_redirects:1-6`, `apps/movie-app/public/_redirects:1-5`, and `apps/comic-app/public/_redirects:1-5`. Templates contain typed placeholders only; `public/_redirects` is removed so tracked source never embeds the default canonical domain.

**Test pattern** (`deploy-config.test.ts:18-37`, `39-73`; `target-deploy.test.ts:173-235`): create temp directories, use a resolved fixture profile and fake executor, assert the generated contents and path containment, assert no secret enters the child environment, then assert cleanup. Add all-five-surface renderer/materializer coverage plus malformed placeholder, unsafe path, unresolved placeholder, wrong surface, and build-failure-no-output cases.

### Fixed-Literal Audit And Source Migration

**Apply to:** new `legacy-domain-audit.ts` and test, `apps/api/.dev.vars.example`, `apps/auth/typecheck.pages-build.env`, `apps/gateway/src/index.ts`, the blog/dashboard E2E email fixtures, and Gateway/config deployment-target test fixtures.

**Closest analog:** `packages/config/src/deployment-target/preflight.ts`

**Fail-closed allowlist pattern** (`preflight.ts:86-157`, `307-320`): model exact retained values with a named collection, produce deterministic structured issues, and return `ok` only when no issue remains. The audit's allowlist must key on exact path plus exact fragment/category and a reason. It must never permit a directory, broad test glob, baseline count, or broad regex.

```typescript
const legacyTargetAliasValues = new Set(['default', 'prod', 'production', /* exact legacy aliases */])

if (selectedTarget && legacyTargetAliasValues.has(selectedTarget.toLowerCase())) {
  addIssue(issues, 'legacy-target-alias', `Legacy target alias is not allowed: ${selectedTarget}. Pass an explicit tracked target id.`)
}

export function runTargetPreflight(options: PreflightOptions): TargetPreflightResult {
  const issues: PreflightIssue[] = []
  const target = resolveSelectedTarget(options.target, issues)
  // validate all inputs, then return { target, issues, ok: issues.length === 0 }
}
```

**Audit adapter:** keep `legacy-domain-audit.ts` pure by injecting `trackedPaths` and file reads. A thin script/test adapter can obtain tracked paths through `git ls-files -z`, filter to active source/config/test extensions, and compare with `content.includes('starye.org')`. This fixed-string comparison is mandatory because `/starye.org/` matches legal `starye-org` IDs. Exclude docs, `.planning`, ignored env files, generated outputs, and untracked Phase 13 evidence before any file is read.

**Source migration ownership:**

- `apps/api/.dev.vars.example`: replace `R2_PUBLIC_URL` default origin with a non-target placeholder or generated-profile instruction; do not invent another configuration owner.
- `apps/auth/typecheck.pages-build.env`: remove the unnamed tracked default fixture; make typecheck use the generated/serialized Pages env or a named dedicated fixture covered by the exact allowlist.
- `apps/gateway/src/index.ts:96-100`: change the stale old-domain comment to target-neutral wording only; preserve local hostname logic.
- `apps/blog/e2e/session.spec.ts:104-115` and `apps/dashboard/e2e/auth-crosspath.spec.ts:52-56`: use `.test` mock mailboxes, not production-domain identity fixture exceptions.
- Gateway/cache/routing/guard tests: centralize default target request/origin construction behind an explicitly named test helper; retain raw literals only in that helper if the audit marks its exact lines as dedicated fixtures. For target tests, derive profile URLs through `resolveTargetProfile('starye-org')` unless asserting the default profile's literal schema itself.

**Test style:** copy `target-deploy.test.ts:41-64` for disposable roots and `deploy-config.test.ts:75-107` for hostile-input rejection. Test deterministic `path:line:fragment` output; validate an allowed `starye-org` ID is not a hit; assert all three legal categories are explained; and make any unclassified tracked occurrence fail the first green run (no ratchet).

### Target-First RUNBOOK

**Apply to:** `RUNBOOK.md` and new RUNBOOK contract test (recommended under `packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts` only if it owns matrix validation; otherwise add a focused `runbook-contract.test.ts`).

**Analog:** `RUNBOOK.md:5-9`, `57-95`, `99-163`

**Ownership pattern:** retain the front-matter distinction between stable operational rules and phase evidence. Do not copy the 30-row matrix, historical run state, target resource values, or secret values into RUNBOOK.

```markdown
- `RUNBOOK.md` is the long-lived operations and storage-policy canonical owner.
- New rules during an active phase first land in `.planning/*`; write back here only after they are stable.
```

**Procedure pattern:** replace the default-production surface table with one ordered selected-target flow: explicit `target-profile validate`, local projection/preflight, operator-triggered deploy/migration/crawl, explicit mode/target/run-id smoke with Gateway URL for local browser proof, then bounded rollback/recovery. Link the existing D1 safety and manual Pages rollback sections rather than duplicating their rules.

**Terminal-state rule:** mirror `scripts/verify-data-chain-smoke.ts:74-105`: only resolved `passed` has `exitCode: 0`, `outcome: 'terminal_passed'`, and `provesExternalChain: true`; checkpoint/pending/failed stop and preserve evidence. RUNBOOK must give the Phase 13 verifier-driven recovery route for Phase 13 evidence, not a Phase 14 remote command.

### Final Requirement-To-Evidence Matrix

**Apply to:** new `requirement-evidence-matrix.ts`, `verify-v12-evidence-matrix.ts`, `requirement-evidence-matrix.test.ts`, `14-EVIDENCE-MATRIX.json`, and generated `14-EVIDENCE-MATRIX.md`.

**Primary analog:** `scripts/verify-data-chain-smoke.ts`

**JSON-source/rendered-report pattern** (`verify-data-chain-smoke.ts:52-71`): parse JSON once, validate it, generate Markdown from the same typed structure, and reject a non-identical checked-in/report rendering. The matrix is the machine-readable canonical Phase 14 evidence source; Markdown is a derived review/archive view.

```typescript
const json = await read(paths.json)
const markdown = await read(paths.markdown)
if (!json || !markdown)
  throw new Error('Data-chain evidence pair is missing.')
const evidence: unknown = JSON.parse(json)
validateDataChainEvidenceForExitCode(evidence)
if (markdown !== renderDataChainEvidenceMarkdown(evidence))
  throw new Error('Data-chain evidence Markdown does not match JSON.')
```

**Terminal reconciliation pattern** (`verify-data-chain-smoke.ts:74-105`; `data-chain-evidence.ts:475-476`, `895-897`): return all validation issues rather than silently normalize records; final mode rejects nonterminal Phase 14 rows. It validates references and status reconciliation only, never invokes deployment, crawler, smoke, rollback, D1, R2, or Cloudflare commands.

```typescript
const issues = validateEvidenceMatrix(matrix, {
  requirementIds: readV12RequirementIds(requirementsText),
  canonicalReports,
  repositoryRoot,
  final: true,
})
if (issues.length > 0)
  throw new Error(`Invalid v1.2 evidence matrix: ${issues.join(' ')}`)
```

**Required contract:** each row has `id`, `sourcePhase`, `status`, `evidence[]`, and `limitations`; `partial|blocked|deferred` additionally carry `checkpointOrMissingArtifact`, `recoveryPrerequisite`, and `nextOperatorCommand`. Resolve each evidence `path` below repository root, reject absolute/traversal/missing/remote artifact paths, and validate anchors. Parse the 30 IDs from `.planning/REQUIREMENTS.md:6-51,115-117`, reject missing/extra/duplicate/out-of-order IDs, and reconcile phase groups against canonical reports.

**Truth source:** use `11-VERIFICATION.md:82-92` and `12-VERIFICATION.md:45-52` for Phase 11/12 source-contract results. Preserve `13-VERIFICATION.md:116-129` verbatim: `DATA-01` through `DATA-06` remain `BLOCKED`; `DATA-07` and `TEST-05` remain `PARTIAL`; `REQUIREMENTS.md` checkboxes are traceability metadata, not runtime proof. The eight Phase 13 rows must identify their exact checkpoint/missing artifact and the canonical Phase 13 gaps route, without scheduling a remote command in this phase.

**CLI shape:** copy the import, dependency-injection, JSON log, `main()` guard, and nonzero error path from `scripts/verify-data-chain-smoke.ts:112-142`. The new CLI accepts a final/read-only mode, produces deterministic report validation output, and has no process-spawn or credential handling.

## Shared Patterns

### Explicit Target And Fail-Closed Preflight
**Source:** `scripts/target-deploy.ts:139-173`, `packages/config/src/deployment-target/preflight.ts:307-320`

Apply to all build/deploy materialization changes: resolve the selected target first, collect projection issues, use a closed command/surface, and abort before a fake or real executor when preflight is not `ok`. Phase 14 static tests and validators do not execute this remote-capable flow.

### Generated-Input Containment And Cleanup
**Source:** `packages/config/src/deployment-target/deploy-config.ts:113-121,293-335`

All temporary Pages redirect inputs must stay under the declared run directory; all paths join the existing cleanup collection; output goes only to the closed app `dist/_redirects` after a successful build. Never write tracked templates or `public/` during materialization.

### Strict Test Fixtures
**Source:** `packages/config/src/deployment-target/__tests__/deploy-config.test.ts:18-37,39-73` and `target-deploy.test.ts:75-139`

Use `mkdtemp`, `afterEach` cleanup, resolved `starye-org` profile data, and fake executors. Assertions cover exact argv/environment/path/output behavior and assert absent secrets; tests never require Cloudflare credentials or a remote command.

### Evidence Status Integrity
**Source:** `scripts/verify-data-chain-smoke.ts:83-105`, `.planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md:116-129`

Only a terminal persisted pass is success. `checkpoint`, `pending`, `failed`, missing artifact, or stale verifier state remains non-success. A Phase 14 matrix records and validates that state; it does not upgrade it.

### Documentation Ownership And Canonical Gateway
**Source:** `docs/documentation-ownership.md:12-16,33-40`; `AGENTS.md:4-5`

Stable operations procedures belong in RUNBOOK. Current proof, output pairs, and final matrix remain in the Phase 14 directory. Any local browser command/reference uses `http://localhost:8080/...`, never a direct app port as canonical evidence.

## No Exact Analog Found

| File | Role | Data Flow | Planner Direction |
|---|---|---|---|
| `packages/config/src/deployment-target/legacy-domain-audit.ts` | utility | batch/file-I/O | No existing Git-tracked fixed-literal audit. Copy preflight's exact allowlist/issue model, but use injected file enumeration and fixed string comparison. |
| `packages/config/src/deployment-target/requirement-evidence-matrix.ts` | utility | batch/transform | No 30-requirement/report reconciler exists. Copy data-chain evidence validation/render discipline, then add source-report parsing and repo-relative path checks. |
| `scripts/verify-v12-evidence-matrix.ts` | CLI | batch/file-I/O | No read-only final matrix CLI exists. Copy `verify-data-chain-smoke.ts` imports, dependency injection, CLI guard, and error propagation; omit every runner/spawn path. |

## Metadata

**Analog search scope:** `packages/config/src/deployment-target/`, `scripts/`, `apps/*/public/`, `apps/gateway/src/__tests__/`, `.github/workflows/`, `RUNBOOK.md`, `.planning/`, and `docs/documentation-ownership.md`
**Files scanned:** 29 source, test, workflow, documentation, and verifier files
**Pattern extraction date:** 2026-07-21
