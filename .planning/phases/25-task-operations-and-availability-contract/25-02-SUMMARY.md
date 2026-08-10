---
phase: 25-task-operations-and-availability-contract
plan: 25-02
subsystem: api-operations
tags: [crawler-tasks, lifecycle, hono, audit, idempotency, retry, archive, supersede]

requires:
  - phase: 25-01
    provides: closed operation registry, immutable snapshots, bounded evidence, and availability tuple contracts
provides:
  - task lifecycle repository/state guards independent from crawler run execution state
  - strict admin task list/detail, metadata update, archive, supersede, cancel, retry, and audit routes
  - bounded redacted crawler-task audit projection and callback/replay regression coverage
affects: [25-03, 25-04]

tech-stack:
  added: []
  patterns:
    - lifecycle projection derived from append-only transition facts
    - route-level allowlisted command schemas with server-owned operation snapshots
    - task-scoped bounded audit history separated from run execution facts

key-files:
  created: []
  modified:
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/domain/crawler-tasks/state-machine.ts
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts
    - apps/api/src/middleware/audit-logger.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
    - apps/api/src/schemas/crawler-tasks.ts

key-decisions:
  - "Keep task lifecycle status separate from crawler_run execution status; lifecycle transitions remain explicit facts and are projected for list/detail reads."
  - "Archive is logical and supersede creates a new operation snapshot while old runs, attempts, receipts, observations, and audits remain readable."
  - "Admin mutation schemas accept only allowlisted metadata/operation fields; workflow, URL, command, provider routing, and secrets remain server-owned."

patterns-established:
  - "Lifecycle CAS: archive, cancel, retry, and supersede are guarded by task lifecycle and run state, with deterministic rejection codes."
  - "Audit boundary: crawler-task changes are recursively allowlisted, length-bounded, and sensitive-field redacted before persistence/readback."

requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06]

coverage:
  - id: D1
    description: "Task lifecycle repository and state machine separate active/archived/superseded task state from crawler run execution state."
    requirement: TASK-02
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin crawler-task routes expose bounded list/detail and allowlisted update, archive, supersede, cancel, and retry operations."
    requirement: TASK-03
    verification:
      - kind: unit
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false
  - id: D3
    description: "Task-scoped audit history is bounded and redacted, with mutation outcomes linked to task/run/attempt facts."
    requirement: TASK-06
    verification:
      - kind: unit
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts#allowlisted metadata and bounded task lifecycle audit routes"
        status: pass
    human_judgment: true
    rationale: "The focused route test proves bounded audit routing and allowlisted input; durable D1 audit redaction/readback remains an integration concern for the phase verifier."
  - id: D4
    description: "Cancel, bounded retry, replay/idempotency, and late callback paths return deterministic outcomes without replacing newer task/run facts."
    requirement: TASK-04
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts"
        status: pass
    human_judgment: false

duration: 58 min
completed: 2026-08-11
status: complete
---

# Phase 25 Plan 25-02: Task Operations And Availability Contract Summary

**Task lifecycle CRUD and bounded audit operations with immutable supersede, deterministic cancellation/retry, and callback replay guards**

## Performance

- **Duration:** 58 min
- **Started:** 2026-08-11T00:02:00+08:00
- **Completed:** 2026-08-11T01:03:04+08:00
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added lifecycle status/transition projection and repository CAS guards while keeping task lifecycle independent from `crawler_run` execution status.
- Added strict admin task list/detail and mutation routes for allowlisted metadata updates, logical archive, immutable supersede, queued/running cancel, bounded retry, and task-scoped audit history.
- Wired Phase 25-01 operation snapshots and idempotency results into the existing task/run/attempt/provider boundary without exposing workflow, URL, command, or secret fields to clients.
- Added regression coverage for lifecycle transitions, archive/supersede retention, cancel/retry/replay/late callback behavior, schema rejection, bounded audit route reads, and existing repair flow compatibility.

## Task Commits

1. **Task 1: Add lifecycle repository and state guards** - `268bc5b` (feat)
2. **Task 2: Add strict admin lifecycle routes and audit projection** - `f6db741` (feat)

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/repository.ts` - lifecycle projection, list filtering, archive/supersede/update guards, retry/cancel outcomes, and task audit readback.
- `apps/api/src/domain/crawler-tasks/state-machine.ts` - lifecycle transition and run/task separation guards.
- `apps/api/src/schemas/crawler-tasks.ts` - closed create/update/supersede/list/audit schemas.
- `apps/api/src/routes/admin/crawler-tasks/index.ts` - admin task operations and authoritative detail/audit responses.
- `apps/api/src/middleware/audit-logger.ts` - crawler-task resource support and bounded redaction.
- `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts`, `state-machine.test.ts`, and `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - lifecycle and route regressions.

## Decisions Made

- Lifecycle is a task-level projection and does not reuse or overwrite run execution status.
- Logical archive and supersede preserve all historical child facts; supersede requires a new server-owned operation snapshot.
- Audit payloads are bounded at the write boundary and only expose safe target, reason, outcome, lifecycle, and run metadata.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unused audit row interface before commit.**

- **Found during:** Task 2 (pre-commit lint)
- **Issue:** `TaskAuditRow` was declared but the repository readback uses an inferred row shape, so lint-staged rejected the commit.
- **Fix:** Removed the unused interface without changing runtime behavior.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`
- **Verification:** lint-staged passed; focused API suite remained 4 files/66 tests green.
- **Committed in:** `f6db741`

**Total deviations:** 1 auto-fixed (1 lint-blocking correctness issue)
**Impact on plan:** No behavior or scope change; the fix lets the planned repository implementation pass the project hook.

## Issues Encountered

- The executor stopped after staging the second task without returning its summary; the staged implementation was recovered manually, tested, impact-checked, lint-fixed, and committed.
- The admin task route retains a separate unstaged user SQL alias repair; it was deliberately excluded from `f6db741` and remains in the working tree.

## User Setup Required

None - no external service configuration is required for the lifecycle API implementation.

## Next Phase Readiness

- `25-03` can add signed internal availability observation persistence against the repository/state/operation contracts now present.
- `25-04` can consume the list/detail lifecycle shape and bounded audit/availability sections for the Dashboard surface.
- Canonical local service health is green through Gateway `http://localhost:8080`; no probe implementation was introduced.

---
*Phase: 25-task-operations-and-availability-contract*
*Plan: 25-02*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Focused API Vitest: 4 files, 66 tests passed.
- API type-check passed.
- `pnpm check:services` passed; Gateway `http://localhost:8080` reported healthy.
- GitNexus impact: repository/audit shared symbols were MEDIUM; no HIGH/CRITICAL risk.
- Staged GitNexus detect-changes matched the 5-file lifecycle operation scope; lint-staged passed on commit.
