---
phase: 26-video-source-and-magnet-availability
plan: 26-02
subsystem: api-control-plane-crawler-runner
tags: [video-availability, operation-registry, signed-runner, exact-keys, revisions]
status: complete

requires:
  - phase: 26-01
    provides: closed video finding reasons, probe policy, and revision-bound actions
provides:
  - server-owned check/recheck/repair video operation snapshots
  - exact signed runner transport bound to tuple, movie/source revision, and policy
  - direct/magnet observation variant isolation
affects: [26-03, 26-04, 26-05, 26-09]

tech-stack:
  added: []
  patterns:
    - exact-key immutable server snapshots
    - signed candidate binding before adapter execution
    - source-kind isolation at observation submission

key-files:
  created: []
  modified:
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - apps/api/src/domain/crawler-tasks/operation-registry.ts
    - apps/api/src/domain/crawler-tasks/__tests__/operation-registry.test.ts
    - packages/crawler/src/task-runner/runner-client.ts
    - packages/crawler/src/task-runner/__tests__/runner-client.test.ts

key-decisions:
  - "Preserve existing crawl and repair_players behavior while adding exact check/recheck/repair video snapshots through the same registry."
  - "Reject video candidates whose content, target, revision, policy, or direct/magnet variant differs from the signed server snapshot."

requirements-completed: [VID-04, VID-05]

metrics:
  tasks: 2
  files: 6
  completed: 2026-08-13
actuals:
  tokens: 23687
  tasks: 2
  commits: 4
---

# Phase 26 Plan 02: Signed Video Operation Boundary Summary

The existing crawler control plane now carries exact revision-bound video operations and signed direct/magnet observations without exposing provider configuration to callers.

## Commits

| Commit | Description |
|--------|-------------|
| `e5067fc` | Add failing video operation registry tests |
| `d687d9f` | Register revision-bound video operations |
| `435b2c3` | Add failing signed video transport tests |
| `2046e9a` | Carry signed video observations |

## Verification

- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/operation-registry.test.ts` - 12/12 passed
- `pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/runner-client.test.ts` - 8/8 passed
- `pnpm --filter @starye/crawler type-check` - passed
- `pnpm --filter api type-check` - passed
- focused ESLint and `git diff --check` - passed
- GitNexus detect-changes - HIGH as expected for RunnerClient and operation snapshot paths; affected poll, signed post, availability observation, scheduleRegister, retryRun, supersedeTask, and existing repair flows are covered by the focused regression suites

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected runner-client binary-expression formatting**
- **Found during:** Task 2 commit hook
- **Issue:** Repository ESLint rejected one continuation indentation in the exact-key snapshot predicate.
- **Fix:** Applied repository formatting and normalized the predicate continuation indentation without changing behavior.
- **Files modified:** `packages/crawler/src/task-runner/runner-client.ts`
- **Commit:** `2046e9a`

## Known Stubs

None.

## Self-Check: PASSED

- All six declared files exist.
- All four task commits exist in git history.
- Operation registry and signed runner focused tests plus both package type-checks passed.
