---
phase: 16-task-domain-foundation
plan: 01
subsystem: database
tags: [d1, drizzle, crawler-tasks, cas, lease, retention]

requires: []
provides:
  - D1 crawler task/run/lease/event/transition/log schema and add-only migration
  - Closed movie/manga task lifecycle with optimistic CAS transitions
  - Transactional D1 repository for attempts, leases, event receipts, bounded logs, and expiry cleanup
affects: [phase-17-local-runner, phase-18-github-actions-orchestration, phase-19-task-dashboard]

tech-stack:
  added: []
  patterns: [D1 batch-backed lease claim, version-and-sequence CAS, immutable retry attempts, bounded run-log retention]

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - apps/api/src/domain/crawler-tasks/state-machine.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - packages/db/drizzle/0027_crawler_task_domain_foundation.sql
  modified:
    - packages/db/src/schema.ts

key-decisions:
  - "Only the server-owned movie/manga registry supplies snapshots and permission resources; callers have no executable crawler inputs."
  - "The template-key lease is the final concurrency authority and is claimed in the same D1 batch as task/run creation."
  - "Accepted run changes use current status, state version, and event sequence CAS; late events retain a bounded audit record without replacing run state."
  - "Only failed or cancelled attempts are retryable; successful receipts retain their terminal history."

patterns-established:
  - "Use parameter-bound D1 prepared statements and batch writes for task-domain mutations."
  - "Persist terminal receipt/failure facts on crawler_run while detailed logs expire after 90 days."

requirements-completed: [CTRL-02, CTRL-03, CTRL-04, CTRL-05]

coverage:
  - id: D1
    description: Closed movie/manga lifecycle, immutable snapshots, and terminal-state transition rules
    requirement: CTRL-02
    verification:
      - kind: unit
        ref: apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Add-only D1 crawler task domain migration with six related tables and indexes
    requirement: CTRL-03
    verification:
      - kind: integration
        ref: "wrangler d1 migrations apply starye-db --local --config .target-wrangler.local-dev-49324-comic.toml"
        status: pass
      - kind: integration
        ref: "wrangler d1 execute starye-db --local schema probe"
        status: pass
    human_judgment: false
  - id: D3
    description: Transactional task repository covering lease collisions, CAS, retries, receipt races, log limits, and cleanup
    requirement: CTRL-04
    verification:
      - kind: unit
        ref: apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
        status: pass
      - kind: other
        ref: pnpm --filter api type-check
        status: pass
    human_judgment: false
  - id: D4
    description: Four-KiB and 500-row detailed-log limits with 90-day expiry cleanup that preserves terminal facts
    requirement: CTRL-05
    verification:
      - kind: unit
        ref: apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts#caps safe messages and only purges detail logs
        status: pass
    human_judgment: false

duration: 1h 10m
completed: 2026-07-30
status: complete
---

# Phase 16 Plan 01: Task Domain Foundation Summary

**D1-backed crawler task control plane with a closed lifecycle, one-template leases, immutable retry history, and bounded audit-safe run logs.**

## Performance

- **Duration:** 1h 10m
- **Started:** 2026-07-30T13:45:00+08:00
- **Completed:** 2026-07-30T14:55:00+08:00
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Added the server-owned `movie`/`manga` template registry and a pure, exhaustive run state machine.
- Added six D1 task-domain tables, relations, uniqueness/index constraints, and add-only `0027` migration.
- Added a D1 repository for atomic lease claims, CAS lifecycle writes, retries, runner event receipts, capped structured logs, and log expiry cleanup.
- Proved all lifecycle and repository behavior with 9 focused tests; locally applied and queried the D1 migration.

## Task Commits

1. **Task 1: Define the closed task, template, and transition contracts** - `0604087` (test), `fb9ce1a` (feat)
2. **Task 2: Add the protected D1 task-domain schema and migration** - `eb24752` (feat)
3. **Task 3: Implement transactional repository, lease, and retention primitives** - `d401945` (feat)

## Files Created/Modified

- `packages/db/src/schema.ts` - crawler task-domain Drizzle tables, indexes, and relations.
- `packages/db/drizzle/0027_crawler_task_domain_foundation.sql` - add-only six-table D1 migration.
- `apps/api/src/domain/crawler-tasks/state-machine.ts` - closed lifecycle decisions and stale-event behavior.
- `apps/api/src/domain/crawler-tasks/repository.ts` - D1 task/run/lease/CAS/log/cleanup owner.
- `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` - real in-memory SQLite repository integration coverage.

## Decisions Made

- The durable D1 repository is the only owner of task attempts, leases, transitions, callbacks, and detailed-log retention; no crawler is dispatched from this phase.
- Successful receipts beat a prior cancel request but remain terminal and non-retryable; retries create a separate immutable attempt only after `failed` or `cancelled`.
- The local target-profile Wrangler config is the canonical local D1 command input, not the minimal base `apps/api/wrangler.toml`.

## Deviations from Plan

### Auto-fixed Issues

**1. Existing Drizzle metadata baseline cannot generate non-interactively**
- **Found during:** Task 2 migration verification.
- **Issue:** `packages/db/drizzle/meta/_journal.json` stops at `0025` while existing add-only `0026` and `0027` SQL files are outside the Drizzle metadata chain, so `drizzle-kit generate` reaches a historical rename prompt without a TTY.
- **Fix:** Kept the generated add-only `0027` SQL unchanged and validated it by local D1 apply plus schema probe; no broad metadata regeneration was introduced.
- **Files modified:** None beyond planned migration/schema files.
- **Verification:** Local Wrangler applied 18 migration statements and queried all six `crawler_*` tables.
- **Committed in:** `eb24752` (Task 2)

---

**Total deviations:** 1 auto-fixed (historical tooling metadata constraint)
**Impact on plan:** The shipped migration is locally applied and verified. A future metadata reconciliation should be scoped separately to avoid bundling pre-existing schema history into this task-domain change.

## Issues Encountered

- `apps/api/wrangler.toml` has no D1 binding or migration directory. Local validation succeeded using the generated target-profile config with the explicit D1 binding and migration path.

## User Setup Required

None - no remote migration, crawler execution, or new secret was performed in this plan.

## Next Phase Readiness

- Phase 16 Plans 02 and 03 can call the shared repository to implement session-only task commands and independent signed runner events.
- Phase 17/18 can become task-domain callers without duplicating state, lease, or log retention logic.

---
*Phase: 16-task-domain-foundation*
*Completed: 2026-07-30*
