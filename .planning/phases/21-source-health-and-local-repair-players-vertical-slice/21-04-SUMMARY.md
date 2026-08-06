---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 04
subsystem: api-routes
tags: [repair-players, admin-route, signed-callback, replay, redaction, d1]
requires:
  - phase: 21-03
    provides: operation-aware repair snapshot, receipt validator, lifecycle CAS and retry guards
provides:
  - authenticated repair-players admin command and bounded task projection
  - signed source-observation callback with operation/revision/attempt/replay guards
  - local integration fixtures aligned with 0029/0030 source-health schema
affects: [21-05-local-repair-adapter, 21-06-dashboard-movie-detail, 21-07-local-gateway-proof]
tech-stack:
  added: []
  patterns: [current-disposition reread, signed bounded observation callback, persisted replay outcome]
key-files:
  created:
    - .planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-04-SUMMARY.md
  modified:
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
    - apps/api/src/routes/internal/crawler-runs/index.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts
key-decisions:
  - "Admin repair input remains limited to confirmed movieId, current no_source/source_failed reason, and fixed restore_playable_sources intent; operation and execution details remain server-owned."
  - "Source observation callbacks reuse runner HMAC verification and persist only bounded outcome/readback projections; raw source URLs and signed material do not enter response DTOs."
  - "Internal integration fixtures apply the canonical 0029 and 0030 migrations so ordinary provider callback regressions exercise the same operation-aware schema as the repository."
requirements-completed: [SRC-02, REP-01]
coverage:
  - id: D1
    description: "Authenticated admin repair command rereads current movie disposition and creates a fixed single-movie repair task."
    requirement: REP-01
    verification:
      - kind: unit
        ref: "src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed source observation callback validates identity, operation, source revision, attempt, sequence and replay before persistence, then returns bounded authoritative readback/receipt candidate."
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts"
        status: pass
      - kind: integration
        ref: "src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts"
        status: pass
    human_judgment: false
duration: 31m
completed: 2026-08-06
status: complete
---

# Phase 21 Plan 04: Admin Repair Command And Signed Callback Summary

**Authenticated fixed repair command plus signed, operation-aware source-observation callback.**

## Performance

- **Duration:** approximately 31 minutes, including route fixture repair
- **Tasks:** 2 completed
- **Files modified:** 5 implementation/test files plus this summary

## Accomplishments

- Added `POST /api/admin/crawler-tasks/repair-players`, guarded by session and movie resource permission, with current disposition reread, explicit confirmation, fixed target intent, server-owned operation snapshot, and bounded task/run response.
- Added signed `/:runId/source-observation` callback. It validates HMAC envelope identity, timestamp, operation, bound run snapshot, attempt, sequence and source revision, persists bounded replay outcomes, and calls the authoritative source observation service.
- Returned callback projections contain only operation, movie identity, source revision, observed time, bounded health/readiness and source summary; raw source URL, page, exception, command, workflow, secret and signature fields are excluded.
- Updated the existing provider callback integration fixture to apply migrations 0029 and 0030, preventing the operation-aware repository from running against a pre-21 schema.

## Task Commits

1. **Task 1 RED: admin repair route regressions** - `481f505`
2. **Task 1 GREEN: repair players admin route** - `9885598`

The internal callback work was completed in the working tree after the executor returned during a test-isolation cleanup; the route/test changes and this summary are committed together by the main thread.

## Main-Thread Fixes

- Narrowed ordinary/repair snapshot unions in both routes so API type-check and build pass without assuming `operation`, `movieId`, `reason`, or `sourceRevision` exist on ordinary snapshots.
- Reset the source observation mock before each route test, added the required `operation: repair_players` fixture field, and parsed the Response body once for redaction assertions.
- Added 0029/0030 migration readback to `production-events.integration.test.ts`; its 3 integration tests now pass.

## Verification

- `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` - 3 files, 32/32 passed.
- `pnpm --filter api type-check` - passed.
- `pnpm --filter api build` - passed.
- `git diff --check` - passed.
- GitNexus detect-changes reported the expected shared `createCrawlerRunsRoutes` callback blast radius as high before commit; no unrelated source module was changed. User-pre-existing `AGENTS.md` and `CLAUDE.md` remain unstaged.

## Scope Boundary

This plan provides the API route boundary only. Local adapter/envelope execution belongs to 21-05, Dashboard and MovieDetail UX belongs to 21-06, and canonical Gateway vertical proof remains in 21-07. No provider or production/playback proof is claimed here.

## Self-Check: PASSED

- Admin and internal route tests cover confirmation, current disposition, signed identity, operation/revision mismatch, stale sequence, exact replay, conflicting replay and bounded redaction.
- Existing provider callback integration remains green against the current 21-02 schema.
