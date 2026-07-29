---
phase: 13-full-chain-data-smoke
plan: "14"
subsystem: data-chain-smoke
tags: [handoff, fixed-root, fail-closed, atomic-reservation, tsx, pnpm]

requires:
  - phase: 13-13
    provides: Canonical Gateway readiness and the post-13-13 fixed-root runner/verifier contracts
provides:
  - Import-safe target-first data-chain handoff parser and exact fixed-root ownership boundary
  - Persistent atomic per-mode reservation with redacted remote preflight checkpoint handling
  - Direct root Node launchers that preserve runner/verifier 0/1/2 and normalize handoff to 0/1
affects: [13-15, 13-16, 13-17, data-chain-smoke, selected-production-handoff]

tech-stack:
  added: []
  patterns:
    - Dedicated no-path argv parser resolves a canonical tracked target before lazy data-chain loading
    - Frozen internally derived evidence bundle is passed only through logical storage operations
    - Root package scripts use a closed package-local Node/tsx launcher rather than nested pnpm execution

key-files:
  created:
    - scripts/data-chain-handoff.ts
    - scripts/tsconfig.phase13-handoff.json
    - packages/crawler/scripts/data-chain-cli.mjs
    - packages/config/src/deployment-target/__tests__/data-chain-handoff.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts
  modified:
    - package.json

key-decisions:
  - "Handoff accepts only mode, target, and run-id; it rejects every evidence-dir form before target resolution, factory construction, or path work."
  - "The marker is the persistent exclusive ownership point; collisions and checkpoint failures never retry or fabricate readiness."
  - "Root run and verify commands preserve 0/1/2 while handoff deliberately maps every nonzero result to 1."

patterns-established:
  - "Handoff boundary: resolve canonical target first, lazily load data-chain owners second, then derive and freeze the one exact fixed-root bundle."
  - "Root exit tests: test-only child-process import hook intercepts only the three fixed TS module URLs and never configures evidence roots."

requirements-completed: [DATA-07, TEST-05]

coverage:
  - id: D1
    description: Handoff parser/core rejects invalid input before dependencies, freezes an exact path bundle, protects pair/reservation states, and keeps remote preflight checkpoints closed.
    requirement: DATA-07
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-handoff.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Real root pnpm script names preserve raw run/verify statuses and binary handoff status through a test-only process hook.
    requirement: TEST-05
    verification:
      - kind: integration
        ref: packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Handoff, runner, and verifier root imports type-check through the dedicated narrow project without external execution.
    requirement: DATA-07
    verification:
      - kind: other
        ref: pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-handoff.json
        status: pass
    human_judgment: false

duration: 1h 27m
completed: 2026-07-19
status: complete
---

# Phase 13 Plan 14: Fixed-Root Data-Chain Handoff Summary

**A target-first, fixed-root handoff core now reserves each attempt atomically and gives root scripts explicit raw-versus-binary exit semantics.**

## Performance

- **Duration:** 1h 27m
- **Started:** 2026-07-19T10:53:38Z
- **Completed:** 2026-07-19T12:20:19Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Added a dedicated `parseDataChainHandoffArgs` prelude that admits only `--mode`, `--target`, and `--run-id`, and resolves a canonical tracked target before lazy imports, path derivation, dependency construction, or storage access.
- Added one frozen internally-derived fixed-root bundle, logical storage interface, pair-state gate, persistent `wx` mode marker, remote outer-preflight checkpoint path, and pending-only handoff result contract.
- Replaced nested root package execution with a closed crawler-local launcher: runner/verifier preserve 0/1/2, while handoff only returns 0/1.
- Added OS-temp-only regressions for invalid input, exact paths, reservation concurrency/crash re-entry, remote preflight outcomes, and real root script exit propagation through a test-only import hook.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: handoff parser contract** - `c2453c4` (test)
2. **Task 1 GREEN: handoff core, exact path owner, marker, and remote preflight contract** - `73bdd70` (feat)
3. **Task 2 RED: root launcher contract** - `804a034` (test)
4. **Task 2 GREEN: direct closed root launcher and process mapping** - `dbdaabb` (feat)

## Files Created/Modified

- `scripts/data-chain-handoff.ts` - Import-safe parser plus lazy production handoff core, fixed bundle, reservation, checkpoint, and binary CLI.
- `scripts/tsconfig.phase13-handoff.json` - Narrow no-emit project for handoff and fixed root runner/verifier imports.
- `packages/crawler/scripts/data-chain-cli.mjs` - Closed `run|verify|handoff` package-local `tsx` dispatch table.
- `package.json` - Direct Node scripts for `smoke:data-chain`, `smoke:data-chain:verify`, and `smoke:data-chain:handoff`.
- `packages/config/src/deployment-target/__tests__/data-chain-handoff.test.ts` - Temporary-storage parser/core, exact bundle, pair, marker, preflight, and concurrency regression matrix.
- `packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts` - Real root script exit propagation regression through a test-only child-process hook.

## Automated Checks

- PASS: `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-handoff.test.ts src/deployment-target/__tests__/data-chain-cli-process.test.ts src/deployment-target/__tests__/verify-data-chain-smoke.test.ts` (39/39).
- PASS: `pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-handoff.json`.
- PASS: Task-local ESLint on the handoff, launcher, and both new tests.
- PASS: Fixed-owner source anchors for runner, verifier, and resolver; no existing owner was modified.
- PASS: `git diff --check` over all six plan paths.
- PASS: GitNexus Task 1 detected the approved new handoff boundary only (66 new symbols / 6 new handoff flows); Task 2 detected 11 launcher symbols, 0 affected processes, LOW risk.
- NOT RUN: local/remote smoke, live preflight, provider, D1, API, browser, service start/restart, deploy, schema action, migration, or canonical evidence access.

## GitNexus

- Upstream inventory found `resolveTargetProfile` CRITICAL (13 direct callers, 7 flows) and `runTargetPreflight` HIGH (3 direct callers, 4 flows). The root agent explicitly approved consuming them only from the new handoff module; neither existing implementation was edited.
- Task 1 staged detection reported HIGH solely for the declared new handoff parser/core boundary. That exact boundary was explicitly approved before the GREEN commit.
- Task 2 staged detection was LOW with 11 new launcher symbols and no affected process. No runner/verifier/evidence/provider implementation symbol was staged or modified.

## Decisions Made

- Parser and target validation happen before any lazy data-chain/path module load or dependency factory call; invalid input emits the single closed `invalid_target` result.
- Core callers cannot inject target text, evidence roots, or path bundles. It confirms resolution membership and profile agreement, derives paths internally, freezes the bundle, and only exposes logical storage methods.
- `remote.attempt` ownership precedes the one outer preflight. An unmet check writes and verifies a redacted checkpoint pair with no runner invocation; marker persistence blocks re-entry on every non-success path.
- The test-only root-process hook intercepts fixed module URLs only. It does not supply argv, evidence roots, dependencies, provider outputs, or filesystem paths to production code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Commit gate correctness] Corrected Task 1 lint violations before the GREEN commit**
- **Found during:** Task 1 GREEN pre-commit hook.
- **Issue:** The new test had a redundant regex alternative and compact callback statements; the new handoff module had one unused factory parameter.
- **Fix:** Simplified the test regex/callbacks and named the unused parameter with the repository-approved underscore convention.
- **Files modified:** `scripts/data-chain-handoff.ts`, `packages/config/src/deployment-target/__tests__/data-chain-handoff.test.ts`
- **Verification:** Task-local ESLint, 17/17 handoff tests, and narrow root TypeScript check passed.
- **Committed in:** `73bdd70`

**2. [Rule 1 - Test harness correctness] Reworked the root process hook to intercept package-local `tsx/esm/api` deterministically**
- **Found during:** Task 2 process-exit regression.
- **Issue:** The first hook attempted to intercept TypeScript module URLs below the `tsx` resolver, so the closed launcher catch path returned 1 before a fixture function could run.
- **Fix:** The test-only preload now intercepts only `tsx/esm/api`, allowlists the three canonical module URLs, and returns the requested fixed export for the selected entry.
- **Files modified:** `packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts`
- **Verification:** All nine actual root script mappings pass with one controlled fixture invocation each.
- **Committed in:** `dbdaabb`

**3. [Rule 3 - Blocking canonical metadata] Synchronized legacy State fields after SDK state handlers could not parse the old plan marker**
- **Found during:** Plan closeout.
- **Issue:** `state.advance-plan` could not parse the repository's legacy Current Plan layout; metric and decision handlers in this installed SDK also rejected the documented argument shapes, while `state.update-progress` correctly calculated 22/28 and 79% from disk.
- **Fix:** Kept successful SDK progress/session/roadmap updates, then synchronized only the stale 13-14 position, 22/28 count, 79% value, task metric, decision, and stopped-at text to on-disk plan/summary facts.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Summary exists, Roadmap reports 14/20 Phase 13 plans, and State routes from 13-14 to 13-15 through 13-20.

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** All fixes were limited to plan-owned code/test correctness or canonical closeout metadata and preserved the planned no-external-action boundary.

## Issues Encountered

- The repository pre-commit hook creates automatic stash backups while running `lint-staged`. No stash command was issued manually and no user/parallel changes were reverted or committed.
- The broad `@starye/config` type-check continued to report pre-existing/parallel errors in `data-chain-evidence.test.ts` and `data-chain-smoke-local.test.ts`. The plan-owned narrow TypeScript project passed, and the out-of-scope files were untouched.

## Known Stubs

None - all handoff outcomes are closed contracts; no UI/data placeholder is introduced.

## Threat Flags

None - the new filesystem reservation and read-only remote-preflight invocation are the explicit mitigations already specified in the plan threat model. No unplanned trust-boundary surface was introduced.

## User Setup Required

None - no credentials, dashboard configuration, provider command, or live preflight was run.

## Next Phase Readiness

- Later Phase 13 execution plans can call the direct handoff script without confusing runner/verifier code 2 with root package code 1.
- This plan proves contracts only. A future selected-target run still requires the existing gating/evidence workflow and must not reuse historical or checkpoint markers.

## Self-Check: PASSED

- All six plan-owned implementation/test/config files and this Summary exist.
- All four Task 1/Task 2 RED/GREEN commits are present in git history.
- No task commit deleted a tracked file.
