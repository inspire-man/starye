---
phase: 16-task-domain-foundation
plan: 02
subsystem: api
tags: [hono, valibot, session-auth, crawler-tasks]

requires:
  - phase: 16-task-domain-foundation
    provides: D1 task/run repository, closed template registry, and transition rules
provides:
  - Strict session-only crawler task command and query routes
  - Resource-scoped movie/manga administration under /api/admin/crawler-tasks
  - AppType route reachability regression for the mounted task router
affects: [phase-19-task-dashboard, phase-18-github-actions-orchestration]

tech-stack:
  added: []
  patterns: [strict Valibot DTOs, Better Auth session lookup, registry-resolved resource authorization]

key-files:
  created:
    - apps/api/src/schemas/crawler-tasks.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
  modified:
    - apps/api/src/routes/admin/main/index.ts
    - apps/api/src/__tests__/app-type.test.ts

key-decisions:
  - "Task routes resolve permission resources from the server-owned movie/manga registry and never accept executable fields."
  - "Better Auth session headers are the only authorization source; legacy service-token crawler routes remain separate."
  - "Task query responses use fixed parameterized D1 projections and expose only safe task/run/log fields."

requirements-completed: [CTRL-01, CTRL-04]

coverage:
  - id: D1
    description: Session-only create with strict movie/manga template selection and registry authorization
    requirement: CTRL-01
    verification:
      - kind: unit
        ref: apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts#accepts only a registry template and resolves access from the session role
        status: pass
    human_judgment: false
  - id: D2
    description: Rejection of executable/secret-shaped input and service-token-only requests
    requirement: CTRL-01
    verification:
      - kind: unit
        ref: apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts#rejects executable and secret-shaped create fields before reaching the task command
        status: pass
      - kind: unit
        ref: apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts#requires a session and rejects a service token or wrong template resource role
        status: pass
    human_judgment: false
  - id: D3
    description: Mounted task router with task query, detail, logs, cancel, and confirmed retry paths
    requirement: CTRL-04
    verification:
      - kind: other
        ref: pnpm --filter api type-check
        status: pass
    human_judgment: true
    rationale: Route-level mutation and query behavior beyond create/auth is repository-backed and requires the downstream integration test suite.
  - id: D4
    description: Existing admin composition and AppType reachability preserve legacy crawler routing
    verification:
      - kind: unit
        ref: apps/api/src/__tests__/app-type.test.ts#将 crawler task router 保持在既有 admin 组合和 AppType 路径中
        status: pass
    human_judgment: false

duration: 14m
completed: 2026-07-30
status: complete
---

# Phase 16 Plan 02: Session Task API Summary

**Session-only crawler task administration with strict Valibot inputs, registry-scoped permissions, safe projections, cancellation/retry commands, and AppType reachability.**

## Performance

- **Duration:** 14m
- **Started:** 2026-07-30T15:30:00+08:00
- **Completed:** 2026-07-30T15:44:00+08:00
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added strict create, retry, identifier, bounded list, and bounded log cursor schemas.
- Added session-only `/api/admin/crawler-tasks` handlers for create/list/detail/logs/cancel/retry with server-owned template authorization.
- Mounted the isolated router beneath `/api/admin` while retaining the legacy `/crawlers` service-token router unchanged.
- Added focused authorization/input rejection coverage and an AppType composition regression.

## Task Commits

1. **Task 1: Build strict session command/query schemas and task router** - `22735b6` (feat)
2. **Task 2: Mount the isolated task router and preserve API type reachability** - `76106c5` (feat)

## Files Created/Modified

- `apps/api/src/schemas/crawler-tasks.ts` - strict Valibot request/query contracts.
- `apps/api/src/routes/admin/crawler-tasks/index.ts` - session and resource-scoped task routes.
- `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - focused auth and input boundary tests.
- `apps/api/src/routes/admin/main/index.ts` - `/crawler-tasks` mount beside legacy `/crawlers`.
- `apps/api/src/__tests__/app-type.test.ts` - route composition reachability regression.

## Decisions Made

- The server registry remains the only source of template permission and fixed entry metadata.
- Session lookup is performed from Better Auth request headers; no service token or crawler secret enters the new route.
- Query SQL is fixed and parameter-bound, and response projections exclude snapshots, command inputs, and secret fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repository query surface was narrower than the route contract**
- **Found during:** Task 1
- **Issue:** The existing Plan 16-01 repository exports create, transition, retry, and log primitives but no list/detail/log read methods.
- **Fix:** Added fixed, parameterized D1 read projections inside the route while retaining repository ownership for create, cancel, and retry mutations; no repository or Plan 16-03 file was changed.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`
- **Verification:** API type-check and focused route tests pass.
- **Committed in:** `22735b6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Session and mutation boundaries remain closed; the read projection should move into the shared repository when its query API is expanded.

## Issues Encountered

- Focused tests cover create/auth/input boundaries and AppType reachability; downstream repository-backed cancel/retry and detail/log integration remain a human-judgment coverage item.

## User Setup Required

None - no external service configuration or secret was added.

## Next Phase Readiness

- Dashboard and runner plans can use the mounted task-domain endpoint family without the legacy service token.
- Repository read methods should be centralized before broad production query usage.

---
*Phase: 16-task-domain-foundation*
*Completed: 2026-07-30*

## Self-Check: PASSED

- Required API schema, route, test, mount, and Summary files exist.
- Task commits `22735b6` and `76106c5` are present in the current branch history.
