---
phase: 25-task-operations-and-availability-contract
plan: 25-03
subsystem: api-database-testing
tags: [crawler-runs, availability, observation, cas, d1, gateway-cache, hmac]

requires:
  - phase: 25-01
    provides: closed availability observation/current contracts, bounded evidence validation, and D1 tables
  - phase: 25-02
    provides: task lifecycle repository and server-owned task/run/attempt/provider binding
provides:
  - append-first D1 availability observation persistence with current projection CAS
  - signed internal crawler-run availability observation command with replay and freshness guards
  - authoritative observation/current readback, failure atomicity, cache ordering, and bounded evidence tests
affects: [25-04, phase-26-video-availability, phase-27-comic-chapter-completeness, phase-28-chapter-image-availability]

tech-stack:
  added: []
  patterns:
    - append-only availability history followed by expected tuple/revision/policy/projection CAS
    - authoritative D1 readback before invoking the existing Gateway cache invalidation hook
    - signed runner callbacks use closed schemas, bounded evidence, event replay records, and stable HTTP outcomes

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/availability-repository.ts
    - apps/api/src/domain/crawler-tasks/__tests__/availability-fixtures.ts
    - apps/api/src/domain/crawler-tasks/__tests__/availability-repository.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/availability-repository.integration.test.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/availability.route.test.ts
  modified:
    - apps/api/src/routes/internal/crawler-runs/index.ts
    - apps/api/src/schemas/crawler-run-events.ts

key-decisions:
  - "Bind every persisted observation to the authoritative task/run/attempt/provider/receipt tuple and the task snapshot target, source revision, and policy version before promotion."
  - "Treat append/current write or authoritative readback failure as rejected; a committed observation may remain history while the current projection is compensated rather than reported as accepted."
  - "Invalidate the existing movie Gateway cache only after accepted current readback; no second availability cache source is introduced."

patterns-established:
  - "Availability outcomes are discriminated as accepted, duplicate, stale, late, conflict, or rejected, with current never overwritten by older facts."
  - "Availability evidence is validated and bounded before D1 persistence; signed URLs, cookies, secrets, raw provider responses, media, and unbounded values are excluded."

requirements-completed: [TASK-04, TASK-05]

coverage:
  - id: D1
    description: "Availability repository appends bounded observations, applies tuple/revision/policy/projection CAS, retains stale/late history, and returns authoritative D1 readback."
    requirement: TASK-04
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-repository.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-repository.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed internal crawler-run availability observation route enforces HMAC, freshness, path identity, replay, closed schema, and stable HTTP result mapping."
    requirement: TASK-05
    verification:
      - kind: unit
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/availability.route.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Append/current failure atomicity and readback compensation keep current unchanged when durable promotion or authoritative readback fails."
    requirement: TASK-04
    verification:
      - kind: integration
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-repository.integration.test.ts#D1 failure and readback compensation cases"
        status: pass
      - kind: other
        ref: "pnpm check:services"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bounded evidence fixtures and route assertions prove sensitive or unbounded evidence is rejected before persistence and cache invalidation follows readback."
    requirement: TASK-05
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-repository.test.ts#bounded evidence rejection"
        status: pass
      - kind: unit
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/availability.route.test.ts#readback before cache invalidation"
        status: pass
    human_judgment: false

duration: ~50 min
completed: 2026-08-11
status: complete
---

# Phase 25 Plan 25-03 Summary

**Bounded availability persistence and signed crawler-run observation callbacks with append-first D1 history, CAS current projection, and authoritative readback**

## Performance

- **Duration:** ~50 min based on the implementation handoff and artifact timestamps
- **Started:** 2026-08-11T01:35:22+08:00 (first implementation artifact timestamp)
- **Completed:** 2026-08-11T01:56:19+08:00 (tracking handoff)
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Added `createAvailabilityRepository` with server-owned tuple binding, append-only observation history, current projection CAS, deterministic duplicate/conflict/stale/late/rejected outcomes, and authoritative D1 readback.
- Added the signed `POST /:runId/availability-observation` boundary with HMAC/key rotation, timestamp/path/replay checks, closed schema validation, bounded evidence rejection, and stable 200/404/409 responses.
- Added dedicated repository, local D1 integration, fixture, and route coverage for replay, stale/late no-overwrite, append failure atomicity, readback compensation, cache ordering, and sensitive-data exclusion.

## Task Commits

No task commits were created. The plan explicitly leaves the implementation uncommitted; all planned files remain available in the working tree for the next plan, while unrelated user changes remain untouched.

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/availability-repository.ts` - D1 append/current CAS adapter and authoritative readback.
- `apps/api/src/domain/crawler-tasks/__tests__/availability-fixtures.ts` - bounded local D1 task/run/provider fixtures.
- `apps/api/src/domain/crawler-tasks/__tests__/availability-repository.test.ts` - repository contract and evidence-boundary unit coverage.
- `apps/api/src/domain/crawler-tasks/__tests__/availability-repository.integration.test.ts` - native D1 persistence, CAS, failure, and compensation coverage.
- `apps/api/src/routes/internal/crawler-runs/index.ts` - signed availability observation route wiring.
- `apps/api/src/routes/internal/crawler-runs/__tests__/availability.route.test.ts` - signed route, replay, HTTP mapping, and cache-order coverage.
- `apps/api/src/schemas/crawler-run-events.ts` - closed availability observation event schema.

## Decisions Made

- Kept availability persistence on the existing crawler task/run/attempt/provider/receipt control plane; no second scheduler or cache source was introduced.
- Made accepted state conditional on authoritative D1 current and observation readback, with compensation for a missing current readback.
- Kept stale, late, conflict, and rejected observations as bounded history without allowing them to replace current.

## Deviations from Plan

None - plan scope and ownership boundaries were followed. The implementation was intentionally left uncommitted per the plan's verification note.

## Issues Encountered

- The pre-existing worktree contains unrelated user changes in `AGENTS.md`, `CLAUDE.md`, the admin crawler-task route, the Phase 24 production proof script, and `.planning/tmp/`; these were preserved and excluded from this summary's file scope.
- The previous phase handoff had implementation complete but tracking artifacts missing; this summary and the state/roadmap updates close that bookkeeping gap.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 25-04 can consume the stable authoritative availability readback for Dashboard task detail, history/audit projection, and Gateway baseline acceptance.
- Existing crawler-runs callback coverage remains green; no 25-02 test owner files were changed.
- Before any future commit, run scoped GitNexus change detection because the worktree still includes unrelated user changes.

---
*Phase: 25-task-operations-and-availability-contract*
*Plan: 25-03*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Focused 25-03 coverage: 14/14 tests passed.
- Existing crawler-runs route/integration regression: 18/18 tests passed.
- `pnpm --filter api type-check` passed.
- `pnpm --filter @starye/db type-check` passed.
- `pnpm check:services` passed with Gateway `http://localhost:8080` healthy.
- `git diff --check` passed.
- `C:\Users\11407\.codex\hooks\gsd-check-update.cmd` passed.
