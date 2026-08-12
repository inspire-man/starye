---
phase: 26-video-source-and-magnet-availability
plan: 26-09
subsystem: crawler-video-runner-wiring
tags: [runner, video-availability, aria2, local, production]
status: complete

requires:
  - phase: 26-03
    provides: magnet availability adapter
  - phase: 26-04
    provides: direct video availability adapter
provides:
  - shared server-owned direct and magnet adapter construction
  - real local and claimed production runner selection and observation paths
  - cross-kind rejection and provider-unconfigured bounded behavior
affects: [26-07, 26-08, 26-10]

tech-stack:
  added: []
  patterns:
    - selection-only registry with explicit entrypoint construction
    - server-owned Aria2 JSON-RPC configuration
    - availability observation as a revision-bound runner terminal path

key-files:
  created:
    - packages/crawler/src/task-runner/video-runner-wiring.ts
    - packages/crawler/src/task-runner/__tests__/runner-wiring.test.ts
  modified:
    - scripts/local-task-runner.ts
    - scripts/local-task-runner.e2e.ts
    - packages/crawler/scripts/target-crawl-mutation.ts
    - packages/crawler/src/task-runner/local-runner.ts
    - packages/crawler/src/task-runner/magnet-availability-adapter.ts
    - packages/crawler/src/task-runner/__tests__/production-adapter.test.ts

key-decisions:
  - "Local and production entrypoints construct both Phase 26 adapters explicitly; the template registry remains selection-only."
  - "Provider endpoint, auth and source lists come only from ignored local config or prepared production environment."
  - "Direct and magnet results persist bounded availability observations before the runner emits a revision-bound content receipt."

requirements-completed: [VID-02, VID-03, VID-04]

metrics:
  tasks: 2
  files: 8
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 2
---

# Phase 26 Plan 09: Real Runner Video Adapter Wiring Summary

Both shipped runner entrypoints now construct direct and magnet availability adapters from server-owned configuration after claim/binding validation, while preserving movie, manga, repair and local-proof behavior.

## Commits

| Commit | Description |
|--------|-------------|
| `82cad1a` | Add failing real runner wiring tests |
| `07fb12f` | Wire local and production video availability runners |

## Verification

- six focused runner/adapter test files - 35/35 passed
- `pnpm --filter @starye/crawler type-check` - passed
- target-file ESLint - passed
- `git diff --check` - passed
- GitNexus staged detect-changes - HIGH aggregate across 11 expected local/production flows; pre-edit symbol impacts were LOW for production entrypoints/config and MEDIUM for `LocalTaskRunner`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the actual availability terminal path**
- **Found during:** Task 1 runner trace
- **Issue:** Both real runners treated empty-content availability results as `receipt_missing`, so merely adding adapters to the registry could not persist observations.
- **Fix:** Added bounded observation handling followed by the immutable candidate content receipt, preserving legacy receipt-plus-observation behavior.
- **Commit:** `07fb12f`

**2. [Rule 2 - Missing Critical] Centralized server-owned provider construction**
- **Found during:** Task 2 production wiring
- **Issue:** No runner-owned Aria2 client factory existed for the completed magnet adapter.
- **Fix:** Added a bounded JSON-RPC provider factory shared by local and production entrypoints, with missing configuration represented as provider-unconfigured facts.
- **Commit:** `07fb12f`

## Known Stubs

Actual configured provider and Gateway acceptance remains the blocking human checkpoint in Plan 26-08; this plan proves construction and execution with injected fixtures, not live provider availability.

## Self-Check: PASSED

- All declared plan artifacts exist.
- Both commits exist in git history.
- Local and production focused validation passed.
