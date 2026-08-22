---
phase: 25-task-operations-and-availability-contract
plan: 25-04
subsystem: dashboard-api-evidence
tags: [crawler-tasks, dashboard, availability, d1-readback, gateway, redaction]

# Dependency graph
requires:
  - phase: 25-02
    provides: task lifecycle routes, immutable task/run snapshots, bounded mutation actions, and audit readback
  - phase: 25-03
    provides: append-first availability observations, CAS current projection, signed runner outcomes, and authoritative D1 persistence
provides:
  - typed Dashboard task lifecycle, availability, history, audit, and bounded action contracts
  - a single Crawlers task detail surface with independent lifecycle, execution, provider, receipt, availability, history, and audit sections
  - canonical Gateway 8080 proof orchestration with deterministic fixture coverage and fail-closed live-session checkpointing
  - admin task-detail readback of bounded availability current/history from D1 and stored runner outcomes
affects: [phase-26-video-availability, phase-27-comic-chapter-completeness, phase-28-chapter-image-availability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - typed Dashboard wrappers submit only server-allowlisted lifecycle metadata and mutation fields
    - task detail revalidates persisted availability observations before exposing bounded DTOs
    - canonical Gateway proof accepts injected fixture tests while keeping missing authentication as checkpoint

key-files:
  created:
    - scripts/phase25-task-operations-fixture.ts
    - scripts/phase25-dashboard-gateway-proof.ts
    - scripts/phase25-dashboard-gateway-proof.test.ts
  modified:
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts

key-decisions:
  - "Keep Crawlers.vue as the only task-operations surface and render lifecycle, execution, provider, receipt, availability, observation history, and audit as separate facts."
  - "Add availability readback at the admin task-detail boundary without changing the 25-03 schema or CAS writer; current and observation rows are revalidated through the closed availability contract, while stored crawler outcome records supply duplicate/conflict/stale/late labels."
  - "Treat the unauthenticated real Gateway proof as a checkpoint; injected proof tests are structural evidence and do not promote a production result."
  - "Do not commit the mixed dirty worktree; GitNexus all-scope detection reported critical risk because unrelated prior phase and user files are present."

patterns-established:
  - "Availability task detail is bounded to one current projection and at most 50 history entries; invalid or sensitive persisted rows are omitted rather than serialized."
  - "After every Dashboard mutation, reload authoritative detail and preserve visible-only polling and bounded historical outcomes."

requirements-completed: [TASK-02, TASK-03, TASK-06]

coverage:
  - id: D1
    description: "Typed Dashboard task DTOs and allowlisted metadata/archive/supersede/cancel/retry wrappers drive the existing task operations surface."
    requirement: TASK-02
    verification:
      - kind: automated_ui
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts (21 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter dashboard type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin task detail returns independently bounded availability current/history and preserves redacted D1 facts."
    requirement: TASK-03
    verification:
      - kind: unit
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts (27 tests; availability readback case included)"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false
  - id: D3
    description: "Availability repository and signed runner boundary remain green while Dashboard consumes current/history/audit projections."
    requirement: TASK-06
    verification:
      - kind: integration
        ref: "availability repository and route focused suite (3 files, 14 tests)"
        status: pass
      - kind: other
        ref: "pnpm check:services"
        status: pass
    human_judgment: false
  - id: D4
    description: "A fresh tuple can be proven through the authenticated canonical Gateway Dashboard flow, including cache refresh and historical retention."
    requirement: TASK-06
    verification:
      - kind: unit
        ref: "scripts/phase25-dashboard-gateway-proof.test.ts (5 tests)"
        status: pass
      - kind: other
        ref: "pnpm tsx scripts/phase25-dashboard-gateway-proof.ts --gateway-origin http://localhost:8080"
        status: unknown
    human_judgment: true
    rationale: "The live proof reached the canonical 8080 boundary but stopped at the expected checkpoint because this session has no authenticated CDP URL or browser profile; the proof must be rerun with a real Dashboard session before phase closure."

# Metrics
duration: ~62 min
completed: 2026-08-11
status: checkpoint
---

# Phase 25 Plan 25-04 Summary

**Dashboard task operations now expose bounded lifecycle and availability facts from authoritative detail readback, with a canonical Gateway proof that fails closed without an authenticated session.**

## Performance

- **Duration:** ~62 min based on the Phase 25-03 handoff and verification timestamps
- **Started:** 2026-08-11T01:58:03+08:00
- **Completed:** 2026-08-11T03:00:10+08:00
- **Tasks:** 3 planned tasks plus one required readback correction
- **Files modified:** 8 Phase 25-04 files; unrelated dirty files were preserved

## Accomplishments

- Added typed Dashboard lifecycle, availability, audit, history, and mutation wrappers without exposing workflow, URL, command, secret, signed material, or raw provider payloads.
- Extended the existing `Crawlers.vue` task detail focal surface with independent lifecycle/execution/provider/receipt/availability/history/audit sections and regression coverage for polling, mutations, repair preservation, SQL aliases, and redaction.
- Added fresh bounded fixture/proof helpers and deterministic Gateway proof tests; all automated checks pass and the live proof correctly remains a checkpoint without an authenticated browser session.
- Closed the discovered API projection gap by reading current availability, bounded observations, and stored runner outcomes in the admin task-detail response.

## Task Commits

No task commits were created. The phase plan and current worktree intentionally remain uncommitted so unrelated user and prior-phase changes are not bundled.

## Files Created/Modified

- `apps/dashboard/src/lib/api.ts` - typed task lifecycle, availability, audit, and bounded action contracts.
- `apps/dashboard/src/views/Crawlers.vue` - single task operations/detail surface with independent fact sections.
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` - Dashboard lifecycle, availability, history, polling, action, and redaction regressions.
- `apps/api/src/routes/admin/crawler-tasks/index.ts` - bounded availability current/history readback and the existing task projection boundary.
- `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - D1-shaped availability projection and sensitive-row rejection coverage.
- `scripts/phase25-task-operations-fixture.ts` - fresh bounded tuple and redaction helpers.
- `scripts/phase25-dashboard-gateway-proof.ts` - canonical Gateway orchestration and cache-refresh checks.
- `scripts/phase25-dashboard-gateway-proof.test.ts` - deterministic proof, action, history, and checkpoint tests.

## Decisions Made

- Availability readback is additive at the admin detail boundary and reuses the 25-03 contract; no second writer, scheduler, cache, or migration was introduced.
- Duplicate/conflict/stale/late labels are shown only when represented by stored runner outcomes or bounded observation facts; the route does not infer success from task/provider status.
- The real proof output remains checkpointed because authentication prerequisites were absent; no synthetic production success was recorded.

## Deviations from Plan

### Required Readback Correction

**1. Admin detail did not project 25-03 availability facts**
- **Found during:** Task 3 Gateway readback review
- **Issue:** `CrawlerTaskDetail` was typed as optional availability and the admin route returned only lifecycle, runs, retry, and playback evidence, so the real Dashboard could display an empty availability block.
- **Fix:** Added bounded current/observation/runner-outcome reads to the admin detail projection, revalidated observations with the closed contract, capped history at 50, and dropped invalid/sensitive rows.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts`
- **Verification:** API route suite 27/27 and API type-check passed.

**Total deviations:** 1 required implementation correction; 1 live-environment checkpoint
**Impact on plan:** The correction closes the intended 25-03 to Dashboard readback link without changing persistence ownership or phase 26-28 scope.

## Issues Encountered

- The first new route test used camelCase fixture fields and was corrected to the actual D1 snake_case row shape; the route suite then passed 27/27.
- GitNexus `detect_changes(all)` reported `critical` for the full mixed worktree (90 changed symbols, 23 affected processes, 12 tracked files), including unrelated existing changes; no commit was attempted.
- The live Gateway proof exited with the expected checkpoint reason: an authenticated CDP URL or browser profile is required.

## User Setup Required

An authenticated browser session is required only for the remaining live proof checkpoint. Use a browser profile or CDP URL with access to `http://localhost:8080/dashboard/crawlers`, then rerun the canonical proof command.

## Next Phase Readiness

The Dashboard/API contract and automated gates are ready for Phase 26 planning. Phase 25 remains at the human Gateway proof checkpoint until a fresh authenticated tuple is observed and reviewed; no Phase 26 detector or repair implementation was introduced.

---
*Phase: 25-task-operations-and-availability-contract*
*Plan: 25-04*
*Completed: 2026-08-11 (automated closure; live Gateway checkpoint pending)*
