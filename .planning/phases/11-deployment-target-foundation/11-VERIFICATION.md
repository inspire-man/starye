---
phase: 11-deployment-target-foundation
verified: 2026-07-14T14:33:12Z
status: gaps_found
score: 14/16 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "D-08: Switching a profile updates only target-managed keys and preserves all operator secrets and non-target values byte-for-byte."
    status: failed
    reason: "Marker detection accepts marker substrings and duplicate complete blocks, so project-local --write can replace text that was never a managed block."
    artifacts:
      - path: "packages/config/src/deployment-target/env-file-block.ts"
        issue: "indexOf-based marker boundaries are neither line-exact nor unique."
    missing:
      - "Fail closed unless exactly one standalone start marker and one standalone end marker occur in order."
      - "Regression tests for marker text in a comment, duplicate blocks, and nested markers."
  - truth: "D-09/D-10 and ENV-02: CLI preflight validates profile, local projection, and command input together before a local command continues."
    status: failed
    reason: "scripts/target-profile.ts never builds a projection plan or reads the four LocalEnvTargetFile paths before calling runTargetPreflight, so projectionIssues is always omitted."
    artifacts:
      - path: "scripts/target-profile.ts"
        issue: "runPreflight passes flags and process.env only; missing or stale .dev.vars/.env values cannot block it."
    missing:
      - "Read and validate the selected projection in CLI preflight through an explicit env root or scope-specific projection evidence."
      - "CLI integration tests proving missing file, stale target marker, wrong managed value, and missing user-managed secret key fail closed."
behavior_unverified_items:
  - truth: "Credentialed remote D1/R2/KV read-only checks succeed against the selected Cloudflare account."
    test: "Run target-profile preflight with a credentialed CI/remote environment and --live for each high-risk command."
    expected: "Only argv-form d1 info, r2 bucket info, and kv namespace list checks run; all selected resource identities are confirmed without a mutation."
    why_human: "The implementation and injected-executor tests are present, but no Cloudflare credentials were authorized for this verification."
---

# Phase 11: Deployment Target Foundation Verification Report

**Phase Goal:** Establish a single non-secret target profile model and local env normalization contract before changing deploy/runtime behavior.

**Verified:** 2026-07-14T14:33:12Z

**Status:** gaps_found

**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | D-01: One explicit profile represents one deployable target; no overlay/default composition is accepted. | VERIFIED | `target-resolver.ts` trims and requires an explicit id, then resolves only the tracked map; alias/default cases are covered in `target-resolver.test.ts` and `preflight.test.ts`. |
| 2 | D-02: Profile records stable account, domain, Worker, Pages, D1, R2, KV, route, and URL identities. | VERIFIED | Strict Valibot object schema and the parsed `starye-org` fixture cover these fields in `target-profile.schema.ts` and its tests. |
| 3 | D-03: All eight canonical URL surfaces are explicit. | VERIFIED | `targetUrlSurfaceValues` is an eight-item literal union and the fixture test asserts exact URL keys, with no root-domain inference path. |
| 4 | D-04: Required-secret metadata is non-secret. | VERIFIED | `requiredSecretMetadataSchema` is strict; the test rejects a `value` field. The tracked profile contains metadata names/consumers only. |
| 5 | D-05: Projection writes final local consumer files directly. | VERIFIED | `runProjectLocal()` reads/writes paths under the selected env root; an isolated `project-local --write` run projected all four target files. |
| 6 | D-06: Projection coverage is exactly API, gateway, root, and crawler env files. | VERIFIED | `localEnvTargetFiles` is exactly `apps/api/.dev.vars`, `apps/gateway/.dev.vars`, `.env.local`, and `packages/crawler/.env`; focused test asserts the same list. |
| 7 | D-07: Generator keys and operator-managed secrets have separate ownership. | VERIFIED | Projection excludes secret values and `validateProjectedEnv()` represents missing secrets by key name only; focused tests cover both properties. |
| 8 | D-08: Marker update preserves all non-managed content byte-for-byte. | FAILED (BLOCKER) | Reproduced: a normal comment containing the start-marker substring before `BETTER_AUTH_SECRET` caused `applyTargetManagedEnvBlock()` to delete that secret. A duplicate complete block is also accepted. |
| 9 | D-09: Preflight has no warning-only continuation for inconsistent target evidence. | FAILED (BLOCKER) | `runTargetPreflight()` supports blocking projection issues, but the shipped CLI never supplies any. Therefore inconsistent local projection evidence is silently absent from the gate. |
| 10 | D-10: Preflight checks profile, projection, and command input together. | FAILED (BLOCKER) | `scripts/target-profile.ts:227-241` neither creates `buildLocalEnvProjectionPlan()` nor reads files nor passes `projectionIssues`; local preflight returned success without a projection check. |
| 11 | D-11: Legacy aliases/defaults are rejected. | VERIFIED | `legacyTargetAliasValues` and resolver errors block `default`, `prod`, `production`, and old domains; unit tests cover the failures. |
| 12 | D-12: High-risk remote commands require credentialed live read checks. | VERIFIED | `preflight.ts` blocks missing credential keys, account mismatch, absent `--live`, and absent executor; `live-checks.ts` builds argv-only D1/R2/KV reads. A no-credential remote CLI run failed as required. |
| 13 | D-13: Local Wrangler identity is distinct from CI token/account-secret identity. | VERIFIED | Local scope requires `--wrangler-profile` and rejects `CLOUDFLARE_API_TOKEN`; CI/remote scope requires the mapped environment. CLI help documents the boundary. |
| 14 | D-14: Profile maps local Wrangler identity explicitly. | VERIFIED | Tracked profile and parser test assert `local.wranglerProfile === "starye-org"`; local mismatch is a blocking preflight issue. |
| 15 | D-15: Profile maps CI environment explicitly. | VERIFIED | Tracked profile and parser test assert `ci.githubEnvironment === "starye-org"`; CI/remote mismatch is blocking. |
| 16 | D-16: Commands require an explicit selected target. | VERIFIED | CLI parser requires `--target`; resolver rejects empty/whitespace target ids; projection accepts a `TargetResolution`, not a default id. |

**Score:** 14/16 truths verified; 1 remote provider behavior remains present but behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/config/src/deployment-target/target-profile.schema.ts` | Strict non-secret TargetProfile parser | VERIFIED | Substantive strict Valibot schema, parsed through resolver and exercised by tests. |
| `packages/config/src/deployment-target/target-profiles.ts` | Current `starye-org` fixture | VERIFIED | Complete typed identity data and no secret-value fields. |
| `packages/config/src/deployment-target/target-resolver.ts` | Explicit fail-closed target resolver | VERIFIED | Imported by projection, preflight, and CLI. |
| `packages/config/src/deployment-target/projection-plan.ts` | Four-file local env projection and validation | VERIFIED | Builds deterministic entries from `TargetResolution`; direct CLI write/check flow was exercised in a temporary directory. |
| `packages/config/src/deployment-target/env-file-block.ts` | Safe marker-aware update | FAILED (BLOCKER) | Its `indexOf()` boundary logic is substantive but unsafe for malformed/ambiguous marker input. |
| `packages/config/src/deployment-target/preflight.ts` | Fail-closed combined preflight | PARTIAL (BLOCKER) | It consumes supplied projection issues correctly, but the CLI does not wire the projection producer to this input. |
| `scripts/target-profile.ts` | Operator-accessible validation/projection/preflight CLI | PARTIAL (BLOCKER) | `validate` and `project-local` execute; `preflight` omits local projection evidence. |
| `packages/config/src/deployment-target/live-checks.ts` | Read-only remote D1/R2/KV checks | VERIFIED | Uses injected argv arrays and has unit coverage; credentialed provider execution was not authorized. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `TargetResolution` | `LocalEnvProjectionPlan` | `buildLocalEnvProjectionPlan(resolution)` | VERIFIED | `runProjectLocal()` resolves target then builds the plan. |
| `LocalEnvProjectionPlan` | marker-aware writer | `applyTargetManagedEnvBlock()` | PARTIAL (BLOCKER) | Wired through `project-local --write`, but malformed marker input can corrupt operator-owned text. |
| local env contents | projection validation | `validateProjectedEnv()` | PARTIAL (BLOCKER) | Wired only to `project-local --check`, which filters out missing-secret issues; not wired to `preflight`. |
| CLI preflight inputs | `runTargetPreflight()` | flags and `process.env` | VERIFIED | Scope, command, identity, credential, and live-executor inputs are forwarded. |
| remote high-risk preflight | Wrangler checks | injected argv executor | VERIFIED | `spawnSync('pnpm', ['exec', 'wrangler', ...argv], { shell: false })`; no deploy/mutation argv exists. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 11 test suite | `pnpm --filter @starye/config test --run` | 7 files, 43 tests passed | VERIFIED |
| Config compilation | `pnpm --filter @starye/config exec tsc --noEmit` | Passed | VERIFIED |
| Tracked profile CLI | `pnpm run target-profile -- validate --target starye-org` | Passed; reports target and non-secret resource identifiers | VERIFIED |
| Isolated local projection | `project-local --write` then `--check` with a temporary `--env-root` | All four files projected and target-managed check passed | VERIFIED |
| Credential boundary | Remote deploy preflight with Cloudflare credential variables cleared | Failed with `missing-remote-credentials` as required | VERIFIED |
| CR-01 repro | In-memory env content with marker substring in a comment | Operator secret was silently removed | FAILED (BLOCKER) |
| CR-01 duplicate repro | In-memory env content with two complete marker blocks | Operation accepted duplicate blocks | FAILED (BLOCKER) |
| CR-02 repro | `preflight --scope local --command validate --wrangler-profile starye-org` | Passed without reading/proving any projection file | FAILED (BLOCKER) |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| PROF-01 | VERIFIED | Strict typed profile plus complete parsed `starye-org` fixture. |
| PROF-02 | FAILED (BLOCKER) | Command-accessible preflight exists, but it does not include projected local target evidence. |
| PROF-03 | FAILED (BLOCKER) | Schema/identity/resource errors fail closed, but stale/missing local projection and local required-secret completeness do not block the shipped preflight path. |
| PROF-04 | VERIFIED | Local Wrangler profile and CI token/account/environment boundaries are modeled and tested. |
| ENV-01 | FAILED (BLOCKER) | Projection targets the four final files, but its write path does not safely preserve operator-managed contents under malformed marker input. |
| ENV-02 | FAILED (BLOCKER) | The CLI `--check` filters out missing user-managed secret issues and `preflight` performs no projection validation. |
| TEST-02 | PARTIAL (WARNING) | 43 tests pass, but no regression covers CR-01 or CLI projection-to-preflight wiring. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/config/src/deployment-target/env-file-block.ts` | 107-132 | `indexOf()` marker substring boundaries and no duplicate-marker rejection | BLOCKER | `project-local --write` can delete operator-managed secret/non-target content. |
| `scripts/target-profile.ts` | 227-241 | Preflight omits projection construction, file reads, and `projectionIssues` | BLOCKER | Correct profile/flags can mask stale or absent local target projection. |
| `packages/config/src/deployment-target/live-checks.ts` | 60-78 | Error strings omit target id and expected resource identity | WARNING | Matches review WR-01: remote audit logs are less actionable, though secrets are not exposed. |

### Review Reproduction

- **CR-01 confirmed:** Both the marker-substring secret-deletion and duplicate-block acceptance reproductions succeeded independently of the review report.
- **CR-02 confirmed:** `runPreflight()` calls `runTargetPreflight()` with only flags/process environment. The local CLI command succeeded without reading any of the four `LocalEnvTargetFile` paths.
- **WR-01 confirmed:** Live-check failure messages name only the resource kind, not `resolution.id` or the expected D1/R2/KV identity.

## Gaps Summary

Phase 11 does not meet its fail-closed local normalization goal yet. The two blockers are linked: the only write-capable projection path can corrupt operator-managed content under ambiguous markers, and the preflight command does not consume projection evidence at all. Existing unit coverage proves intended helper behavior, but not these adversarial boundary cases or the real CLI data flow.

Run the focused gap-closure workflow before Phase 12:

```text
$gsd-plan-phase 11 --gaps
```

The closure plan must make marker parsing line-exact and unique, wire projection validation into CLI preflight with scope-aware file evidence, preserve secret values, and add the missing regression/integration tests. It should also include target/resource identity in non-secret live-check failures.

---

_Verified: 2026-07-14T14:33:12Z_
_Verifier: gsd-verifier_
