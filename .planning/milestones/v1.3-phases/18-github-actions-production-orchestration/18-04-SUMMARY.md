---
phase: 18-github-actions-production-orchestration
plan: 04
subsystem: api
tags: [crawler-tasks, d1-cas, github-actions, reconciliation, admin-routes, vitest]
requires:
  - phase: 18-02
    provides: GitHub App installation-token exchange and fixed Actions client
  - phase: 18-03
    provides: signed schedule/provider callbacks and schedule-bucket persistence
provides:
  - provider-aware crawler state-machine decisions and D1 CAS observation gates
  - bounded provider reconciliation and scheduled cleanup composition
  - admin create/cancel/retry dispatch wiring with redacted provider projections
affects: [18-05, 18-06, phase-19-dashboard-operations]
tech-stack:
  added: []
  patterns: [provider evidence as CAS facts, bounded reconciliation window, dispatch-only process state]
key-files:
  created:
    - apps/api/src/domain/crawler-tasks/reconciliation.ts
    - apps/api/src/domain/crawler-tasks/__tests__/reconciliation.test.ts
  modified:
    - apps/api/src/domain/crawler-tasks/state-machine.ts
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/index.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
key-decisions:
  - "Provider success remains pending until the bound provider run, signed terminal event, and validated receipt agree."
  - "Reconciliation polls only the provider_run_id already bound in D1 and never scans latest or unrelated workflow runs."
  - "Admin dispatch/cancel/retry uses the server-owned snapshot; provider HTTP acknowledgements are projected as process facts only."
patterns-established:
  - "Provider mismatch writes a redacted audit fact and receives a finite reconciliation window before provider_lost."
  - "Scheduled cleanup and reconciliation share one waitUntil promise while the legacy cleanup handler remains backwards-compatible."
requirements-completed: [PROD-01, PROD-03]
coverage:
  - id: D1
    description: "Provider CAS, schedule idempotency, retry attempt chain, and receipt gate."
    requirement: PROD-01
    verification:
      - kind: unit
        ref: "pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bounded reconciliation, provider mismatch/lost handling, and scheduled poll composition."
    requirement: PROD-03
    verification:
      - kind: unit
        ref: "src/domain/crawler-tasks/__tests__/reconciliation.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Permissioned admin create/cancel/retry wiring with fixed provider snapshot and redacted provider output."
    requirement: PROD-03
    verification:
      - kind: integration
        ref: "pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
    human_judgment: false
---

# Phase 18 Plan 04 Summary

**D1 now owns provider lifecycle evidence: fixed Actions dispatch stays process-level, reconciliation is bounded, and admin cancellation/retry preserves attempt history.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-01T02:26:59+08:00
- **Completed:** 2026-08-01T02:45:00+08:00
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Extended the crawler state machine and repository with provider association lookup, CAS observations, mismatch audit/window, provider-lost closure, schedule idempotency coverage, and a three-way receipt gate.
- Added injected reconciliation polling that observes only bound GitHub workflow runs, applies finite timeout/5xx handling, immediately closes identity/permission errors, and composes with scheduled log cleanup.
- Wired admin create/cancel/retry through server-owned provider snapshots, keeping `dispatching`/`cancel_requested` as process states and returning only safe provider projections.

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展 repository/state-machine 的 provider CAS 与幂等** - `7ce36f2`
2. **Task 2: 实现 provider reconciliation 与 scheduled poll** - `5791407`
3. **Task 3: 串接管理员创建、取消、重试和权限边界** - `95eadd4`

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/repository.ts` - provider association CAS, observation, terminal compensation, retry binding, and receipt gate.
- `apps/api/src/domain/crawler-tasks/state-machine.ts` / `types.ts` - scheduler provider failure/cancel/lost transitions and failure codes.
- `apps/api/src/domain/crawler-tasks/reconciliation.ts` - bounded polling service with injected clock/client/repository.
- `apps/api/src/index.ts` - one scheduled `waitUntil` composition for cleanup plus reconciliation.
- `apps/api/src/routes/admin/crawler-tasks/index.ts` - fixed-snapshot dispatch, cancel provider call, and retry dispatch projection.
- `apps/api/src/domain/crawler-tasks/__tests__/*` and `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - CAS, reconciliation, route, redaction, and retry coverage.

## Decisions Made

- Provider status and dispatch acknowledgements remain auditable evidence; only a matching signed receipt can transition to success.
- Reconciliation does not perform automatic business retry. Expired windows become `provider_lost`, leaving a new administrator-confirmed attempt as the recovery path.
- Optional GitHub App bindings keep local/test environments fail-closed without changing the existing cleanup handler contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Capability] Added immediate provider-failure repository compensation.**

- **Found during:** Task 2 (provider reconciliation)
- **Issue:** Reconciliation needed a repository CAS entry point for non-retryable identity/permission/template failures, but only expiry compensation existed.
- **Fix:** Added `failProviderReconciliation` and its redacted audit/terminal transition path.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`
- **Verification:** Reconciliation tests and API type-check pass.
- **Committed in:** `5791407`

**2. [Rule 1 - Compatibility] Kept the existing cleanup handler one-promise contract.**

- **Found during:** Task 2 scheduled handler verification
- **Issue:** Existing tests and callers expect `createCrawlerTaskLogCleanupHandler` to resolve the cleanup result directly.
- **Fix:** Added a new combined scheduled handler while retaining the legacy cleanup-only helper behavior.
- **Files modified:** `apps/api/src/index.ts`
- **Verification:** `src/__tests__/crawler-task-log-cleanup.test.ts` and API type-check pass.
- **Committed in:** `5791407`

---

**Total deviations:** 2 auto-fixed (1 missing capability, 1 compatibility correction). **Impact:** Both changes stay within the planned provider lifecycle boundary and preserve existing local runner behavior.

## Issues Encountered

- GitNexus pre-change impact reports were LOW for all modified symbols; staged detect-changes was LOW for Tasks 2/3. Task 1 detect-changes reported HIGH because the repository/state-machine change touches the shared dispatch/heartbeat/runner-event flows; no unrelated files were staged and the existing dirty worktree was preserved.
- The worktree already contained unrelated edits and large Phase 13 evidence trees. They remain unstaged and unchanged.

## Verification

- PASS `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__` (6 files, 32 tests)
- PASS `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` (9 tests)
- PASS `pnpm --filter api type-check`

## Self-Check: PASSED

- All three task commits exist in `git log`.
- Required reconciliation and route artifacts exist on disk.
- Plan-level crawler-domain, admin-route, and API type-check commands pass.
- No unrelated dirty files were staged by the three task commits.

## User Setup Required

None for local verification. Production dispatch still requires the existing GitHub App bindings and callback secrets in the target Environment; credentialed provider proof remains a later production handoff.

## Next Phase Readiness

- 18-05 can consume provider association snapshots, reconciliation facts, and cancellation state from the same D1 CAS boundary while adding the production crawler adapters.
- 18-06 can reuse the injected reconciliation/client seams for the stubbed vertical integration fixture.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-08-01*
