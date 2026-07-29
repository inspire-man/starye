---
phase: 13-full-chain-data-smoke
plan: "15"
subsystem: data-chain-smoke
tags: [gateway, checkpoint, evidence, process-lifecycle, vitest]

requires:
  - phase: 13-13
    provides: Closed canonical Gateway auth outcomes and bounded timeout transport
provides:
  - Four persisted non-secret Gateway auth checkpoint codes
  - Runner machine output bound to validated checkpoint evidence
  - In-memory process proof that a timeout checkpoint exits naturally before the outer timeout
affects: [13-16, 13-17, 13-18, local-smoke, data-chain-verifier]

tech-stack:
  added: []
  patterns:
    - Gateway transport outcomes map exhaustively to an allowlisted persisted vocabulary
    - Child-process proof injects all prerequisites and writes evidence peers only in memory

key-files:
  created:
    - packages/config/src/deployment-target/__tests__/fixtures/data-chain-smoke-auth-timeout-child.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-process.test.ts
  modified:
    - scripts/data-chain-smoke.ts
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts

decisions:
  - Gateway timeout, transport failure, rejected HTTP status, and invalid redirect persist as four exact checkpoint values while gateway_auth_unavailable remains valid.
  - The process child uses an injected 50 ms aborting fetch and an in-memory writer; it never allocates a Phase 13 evidence directory or invokes downstream services.
  - Task 2 and Task 3 commits were gated by fresh GitNexus detect results; approved HIGH expansion was limited to the existing runDataChainSmoke data flow.

metrics:
  duration: 2h 40m
  completed: 2026-07-19
  tasks_completed: 3
  files_changed: 6
status: complete
---

# Phase 13 Plan 15: Closed Gateway Auth Checkpoints Summary

**Gateway auth failure evidence now keeps four bounded non-secret causes through runner output, with a process-level proof that the timeout checkpoint persists entirely in memory and exits raw 2 well before the outer deadline.**

## Accomplishments

- Added `gateway_auth_timeout`, `gateway_auth_fetch_failed`, `gateway_auth_http_status_unaccepted`, and `gateway_auth_redirect_invalid` to the shared persisted checkpoint allowlist without changing old `gateway_auth_unavailable` artifacts.
- Updated only the approved Gateway-auth branch in `runDataChainSmoke` to map closed probe outcomes before fixture, D1, API, browser, or provider work. Runner JSON includes the exact validated checkpoint when one exists.
- Added focused evidence and local-runner regressions for JSON/Markdown parity, old-value compatibility, unknown-value rejection, direct-port rejection, no diagnostic leakage, and zero downstream calls.
- Added a Node/tsx process harness with an injected 50 ms aborting fetch, two in-memory peer writes, one timeout checkpoint, raw exit 2, and a measured 5000 ms natural-exit budget.

## Task Commits

1. **Task 2 RED: Gateway auth checkpoint regressions** - `0777fdc`
2. **Task 2 GREEN: Persist closed Gateway auth checkpoints** - `0e22931`
3. **Task 3: Auth timeout process exit proof** - `6f031aa`

## Verification

- PASS: `pnpm --filter @starye/config exec vitest run ...gateway-readiness ...data-chain-evidence ...data-chain-smoke-local ...verify-data-chain-smoke ...data-chain-smoke-process` - 61/61 tests.
- PASS: `pnpm --filter @starye/config type-check`.
- PASS: `pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-readiness.json`.
- PASS: exact six-path `git diff --check`.
- PASS: process child naturally exited raw 2 in roughly 0.8-1.3 seconds, below its 5000 ms budget, after validating exactly two in-memory peers and one `gateway_auth_timeout` observation.
- NOT RUN: real smoke, evidence-directory write, service operation, browser/provider action, deploy, schema, migration, cleanup, or rollback.

## GitNexus

- Task 1 used a fresh upstream impact for `validateDataChainEvidence`: 2 direct callers and 20 impacted symbols. Root-user approval was recorded for this execution only.
- The post-13-14 reindex reported the same 2 callers and 20 symbols but LOW/2 visible flows, with `appendBrowserObservation` still a direct caller but absent from the process list. Root approval treated this as index visibility drift and retained the exact scoped boundary.
- Task 2 staged detection reported HIGH across nine existing `runDataChainSmoke` flows and four symbols (`dataChainCheckpointValues`, `runDataChainSmoke`, `snapshotResult`, `itemId`). Root approved that exact scope before GREEN commit.
- Task 3 staged detection reported no existing changed symbols or flows; its two new files were committed as the approved process harness only.

## Decisions Made

- Gateway auth failure evidence records only a closed cause, never status, location, headers, body, exception text, or another free-form transport diagnostic.
- `validateDataChainEvidence`, `observeDataChainSurfaces`, and `appendBrowserObservation` bodies remain untouched. The only production flow edit is the approved `runDataChainSmoke` Gateway-auth mapping branch plus its CLI output field.
- The child invokes the direct Node/tsx CLI resolved from the active Node installation, avoiding pnpm's outer exit normalization so the parent can assert the child's raw exit 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test assertion correctness] Kept the required observation status out of diagnostic-leak rejection**
- **Found during:** Task 2 GREEN
- **Issue:** The first evidence test rejected the required `status: checkpoint` field while attempting to reject free-form transport details.
- **Fix:** Asserted the exact allowed observation keys and rejected only error/header/body diagnostics.
- **Files modified:** `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts`
- **Commit:** `0777fdc`

**2. [Rule 3 - Blocking type check] Prevented fixture imports from escaping the config composite project**
- **Found during:** Task 3 verification
- **Issue:** A static import of the root smoke runner made `@starye/config` type-check include root scripts and crawler files outside its `rootDir`.
- **Fix:** Used the established dynamic-import pattern with a local typed module interface; process behavior remains unchanged.
- **Files modified:** `packages/config/src/deployment-target/__tests__/fixtures/data-chain-smoke-auth-timeout-child.ts`
- **Commit:** `6f031aa`

**3. [Rule 3 - Blocking process harness] Preserved the raw child exit code outside pnpm normalization**
- **Found during:** Task 3 process gate
- **Issue:** `pnpm exec tsx` ran the child correctly but normalized its raw exit 2 to the package-manager wrapper's exit 1.
- **Fix:** Spawned the `tsx` CLI resolved from the active Node installation directly through `process.execPath`.
- **Files modified:** `packages/config/src/deployment-target/__tests__/data-chain-smoke-process.test.ts`
- **Commit:** `6f031aa`

**4. [Rule 3 - Blocking canonical metadata] Reconciled the legacy State plan marker after SDK parsing failed**
- **Found during:** Plan closeout
- **Issue:** `state.advance-plan` could not parse the repository's legacy Current Plan format, and the metric handler left the State body behind live plan/summary counts.
- **Fix:** Used successful SDK progress, metric, decision, session, roadmap, and requirement handlers, then synchronized only the stale Phase 13 plan position, activity, and completed-plan body fields to the on-disk facts.
- **Files modified:** `.planning/STATE.md`

**Total deviations:** 4 auto-fixed (1 Rule 1, 3 Rule 3). Production scope stayed within the approved Task 2 branch and evidence allowlist.

## Known Stubs

None. The in-memory map and zero counters are explicit test controls, not runtime evidence placeholders.

## Self-Check: PASSED

- All six plan-owned implementation and test paths exist.
- All Task 2 RED/GREEN and Task 3 commits exist in git history.
