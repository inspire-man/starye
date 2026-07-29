---
phase: 13-full-chain-data-smoke
plan: "76"
subsystem: data-chain-observation
tags: [vue, vitest, root-iab, dom-contract, tuple-validation]
requires:
  - phase: 13-73
    provides: Frozen root-IAB local checkpoint and exact tuple observation boundary.
provides:
  - Dashboard and Viewer code elements expose their own non-secret code/id tuple.
  - Root-IAB observation input carries a closed repository-owned pair of DOM attribute names.
affects: [phase-13-verification, root-iab-observation]
tech-stack:
  added: []
  patterns: [same-element DOM tuple, repository-owned observer descriptor, exact returned tuple equality]
key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-76-SUMMARY.md
  modified:
    - apps/dashboard/src/views/Movies.vue
    - apps/dashboard/src/views/__test__/Movies.test.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
    - scripts/data-chain-surface-observation.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
key-decisions:
  - "Use data-phase13-item-code and data-phase13-item-id together on each existing code element so the tuple cannot be assembled from separate rows or fields."
  - "Keep tuple attribute names repository-owned and readonly in RootIabSurfaceObservationInput; callers continue to supply no selector or identity claim."
patterns-established:
  - "Root-IAB DOM metadata is passed through a closed descriptor while captureSurface retains exact code/id equality and Dashboard-before-Viewer ordering."
requirements-completed: [DATA-05, DATA-06, DATA-07, TEST-05]
coverage:
  - id: D1
    description: Dashboard code cells expose their own code/id tuple and reject cross-row combinations.
    requirement: DATA-05
    verification:
      - kind: integration
        ref: apps/dashboard/src/views/__test__/Movies.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Viewer detail code marker exposes its loaded code/id tuple without manufacturing a marker in loading or error states.
    requirement: DATA-06
    verification:
      - kind: integration
        ref: apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Local and selected-target root-IAB calls receive the closed tuple descriptor while exact mismatch stays checkpointed.
    requirement: DATA-07
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
        status: pass
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-29
status: complete
---

# Phase 13 Plan 76: Dashboard/Viewer Tuple Contract Summary

**Dashboard and Viewer code markers now publish the same non-secret code/id tuple, and root-IAB receives fixed repository-owned names for reading it.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-29T13:55:00+08:00
- **Completed:** 2026-07-29T14:08:36+08:00
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added `data-phase13-item-code` beside the existing item ID on the Dashboard `cell-code` and Viewer detail code elements.
- Added `ROOT_IAB_SURFACE_TUPLE_ATTRIBUTES` and a readonly descriptor to every `RootIabSurfaceObservationInput` produced by `captureSurface`.
- Covered same-element tuple binding, cross-pair rejection, loading/error marker absence, local/remote descriptor delivery, and existing checkpoint behavior.

## GitNexus Impact Analysis

The index was refreshed before source analysis because it was seven commits stale.

| Symbol | Direct callers | Affected flows | Risk |
| --- | --- | --- | --- |
| `RootIabSurfaceObservationInput` | 0 | 0 | LOW |
| `captureSurface` | `observeDataChainSurfaces` | `observeDataChainSurfaces` | LOW |

`captureSurface` has one direct caller and reaches `runDataChainSurfaceObservationCli` transitively. No HIGH or CRITICAL result was returned, so source implementation proceeded. Pre-commit `gitnexus_detect_changes` reported only the intended test scope for Task 1 and the two DOM elements plus `RootIabSurfaceObservationInput`, `RootIabSurfaceObserver`, and `captureSurface` for Task 2; both reports were LOW with no affected execution flow.

## Validation

- RED: Dashboard test failed on the absent code attribute; Viewer test failed on the absent code attribute; local and remote config tests failed on the absent descriptor.
- `pnpm --filter dashboard test --run src/views/__test__/Movies.test.ts` passed: 10 tests.
- `pnpm --filter @starye/movie-app test --run src/views/__tests__/MovieDetail.dom-contract.test.ts` passed: 2 tests.
- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts` passed: 37 tests.
- `pnpm --filter dashboard type-check` passed.
- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` passed.
- `pnpm --filter @starye/config type-check` passed.
- `git diff --check` passed for both task commits.

No Browser, root-IAB observation, preflight, handoff, provider, remote, run-id, frozen-carrier, or execution-evidence command was run.

## Task Commits

1. **Task 1: Write failing exact-tuple contracts for both real surfaces and the observer input** - `8b162c6` (`test`)
2. **Task 2: Render the scoped tuple and pass its closed descriptor to root-IAB observation** - `933fb09` (`feat`)

## Files Created/Modified

- `apps/dashboard/src/views/Movies.vue` - Emits code and item ID on the existing code cell.
- `apps/movie-app/src/views/MovieDetail.vue` - Emits code and item ID on the existing detail code marker.
- `scripts/data-chain-surface-observation.ts` - Defines and supplies the closed root-IAB tuple attribute descriptor.
- `apps/dashboard/src/views/__test__/Movies.test.ts` - Verifies same-element and non-cross-pair Dashboard tuples.
- `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` - Verifies Viewer tuple and non-manufactured loading/error state behavior.
- `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts` - Verifies local root-IAB descriptor delivery and exact-match checkpoint retention.
- `packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts` - Verifies selected-target root-IAB descriptor delivery.

## Decisions Made

- Attribute names are held by a single readonly repository constant, rather than supplied by root-IAB callers.
- Both values live on the visible code-rendering element, preserving the existing code-only route while preventing detached-field correlation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first Task 1 commit wrapper timed out during the repository hook, but immediate read-only inspection confirmed commit `8b162c6` had completed with the four expected test files and an empty index.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The root-IAB contract has a deterministic real-surface tuple source while preserving exact equality and first-checkpoint behavior.
- Terminal observation remains separately gated; this plan intentionally produced no carrier, evidence mutation, or remote execution.

## Self-Check: PASSED

- All seven planned source/test files and this Summary exist on disk.
- Task commits `8b162c6` and `933fb09` are present in git history.
