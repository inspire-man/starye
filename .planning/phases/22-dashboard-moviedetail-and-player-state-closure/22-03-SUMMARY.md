---
phase: 22-dashboard-moviedetail-and-player-state-closure
plan: 03
subsystem: api-dashboard
tags: [crawler-tasks, repair_players, readback, polling, vue, hono]

# Dependency graph
requires:
  - phase: 21-source-health-and-local-repair-players-vertical-slice
    provides: source readiness, repair_players task/readback, bounded logs and receipts
provides:
  - bounded server-owned movie id/title/code identity for repair task responses
  - visible-page repair polling, latest-task/run focus, and preserved attempt history
  - terminal repair same-movie navigation and bounded reason/readback presentation
affects: [phase-23-provider-repair-and-reconciliation, phase-24-dashboard-viewer-playback-proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - server-owned bounded DTO projection for repair task movie identity
    - one visibility-aware five-second polling lifecycle with unmount cleanup
    - latest repair focus layered on top of preserved task/run/log/receipt history

key-files:
  created: []
  modified:
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts

key-decisions:
  - "Use the server-owned movie code from the bounded repair DTO to build the existing /movie/:code route; the client never accepts a caller-supplied URL."
  - "Focus the task/run returned by repairPlayers after a fresh detail read, while retaining older same-movie tasks, attempts, logs, receipts, and source observations."
  - "Keep provider dispatch, reconciliation, production repair, and actual playback evidence outside this plan's boundary."

patterns-established:
  - "Repair readback: POST and GET detail share the same { id, title, code } movie identity and bounded projections."
  - "Polling lifecycle: start only while the page is visible, stop on hidden/unmount, and refresh on visibility restore."

requirements-completed: [PLAY-01]

coverage:
  - id: D1
    description: "Repair POST/GET detail returns the same bounded movie identity and preserves historical runs/receipts while filtering runner fields."
    requirement: PLAY-01
    verification:
      - kind: integration
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts#returns the same bounded movie identity for repair detail and preserves history"
        status: pass
    human_judgment: false
  - id: D2
    description: "Crawlers polls task details only while visible, cleans up timers on unmount, and focuses the latest repair task/run."
    requirement: PLAY-01
    verification:
      - kind: unit
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts#polls only while visible and clears on unmount"
        status: pass
      - kind: unit
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts#requires confirmation before posting the fixed repair command and refreshes the task readback"
        status: pass
    human_judgment: false
  - id: D3
    description: "Terminal repair states expose the server-owned same-movie link, bounded reason/next action, source revision, and safe history projection."
    requirement: PLAY-01
    verification:
      - kind: unit
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts#renders a same-movie link and bounded next action for repair terminal state"
        status: pass
      - kind: unit
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts#renders bounded source health rows and excludes raw runner fields and inactive actions"
        status: pass
    human_judgment: false
  - id: D4
    description: "Authenticated Gateway/browser verification of the visible Dashboard flow and navigation to MovieDetail."
    verification:
      - kind: manual_procedural
        ref: "http://localhost:8080/dashboard/crawlers?movieId=movie-sun-064&reason=no_source"
        status: unknown
    human_judgment: true
    rationale: "This executor ran focused mocked route/UI tests and type checks only; no authenticated browser session or production playback proof was claimed."

# Metrics
duration: unmeasured-continuation
completed: 2026-08-07
status: complete
---

# Phase 22 Plan 03: Dashboard Repair Readback And Same-Movie Return Summary

**Bounded repair movie identity, visible task readback polling, latest repair focus, and terminal same-movie navigation for the Crawlers panel.**

## Performance

- **Duration:** unmeasured continuation; task commits completed at 12:09:58 and 12:24:43 +08:00
- **Started:** 2026-08-07 (continuation start was not captured)
- **Completed:** 2026-08-07
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended the repair task API projection and Dashboard types with the server-owned movie `code`, while keeping id/title, source revision, bounded reason/action, runs, receipts, and safe history intact.
- Added visible-page five-second polling with hidden-page and unmount cleanup, fresh detail readback, and focus on the exact task/run returned by `repairPlayers`.
- Added terminal repair `/movie/:code` links plus bounded reason, source revision, next action, and readback UI; ordinary `repairing` states retain refresh behavior without exposing an inappropriate management link.

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展 repair task 的 bounded movie identity contract** - `2836c4b` (`feat`)
2. **Task 2: 完成 Dashboard visible polling、最新 repair 聚焦和终态回流** - `ebb6f08` (`feat`)

No shared `STATE.md`, `ROADMAP.md`, or `REQUIREMENTS.md` metadata was changed; the main executor owns those files.

## Files Created/Modified

- `apps/api/src/routes/admin/crawler-tasks/index.ts` - Projects `movie.code` from the server-owned lookup into repair POST/GET detail responses.
- `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - Covers matching POST/GET identity, historical runs/receipts, and runner-field filtering.
- `apps/dashboard/src/lib/api.ts` - Adds the bounded movie code to repair/task DTO types.
- `apps/dashboard/src/views/Crawlers.vue` - Implements lifecycle-safe polling, returned-task focus, history-preserving readback, and terminal same-movie links.
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` - Covers polling visibility, focus, terminal links, bounded readback, and safe projections.

## Decisions Made

- The API remains the only source of movie identity for the repair link; `encodeURIComponent` is applied to the server-owned code and the existing `/movie/:code` route is reused.
- The new repair detail is read back after creation and inserted at the front of the movie task list, without replacing prior tasks or attempt history.
- Provider dispatch/reconciliation and fresh production Dashboard-to-Viewer playback proof remain Phase 23/24 concerns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept ordinary `repairing` readback out of management-link actions**
- **Found during:** Task 2 (Dashboard visible polling and terminal return)
- **Issue:** The mixed readiness/action rendering path could present an ordinary crawler management action while the source disposition was still `repairing`.
- **Fix:** Separated repair-player actions from ordinary readiness actions and retained the ordinary `repairing` path as refresh-only; terminal repair links are limited to succeeded/failed/cancelled.
- **Files modified:** `apps/dashboard/src/views/Crawlers.vue`
- **Verification:** `Crawlers.test.ts` passed 14/14, including readiness/action and terminal-link coverage.
- **Committed in:** `ebb6f08`

**2. [Rule 3 - Blocking verification] Used the workspace's actual package filters**
- **Found during:** Task 1/2 verification
- **Issue:** The plan's `@starye/api` and `@starye/dashboard` filters do not exist in this checkout; package names are `api` and `dashboard`.
- **Fix:** Ran the same focused commands with `pnpm --filter api ...` and `pnpm --filter dashboard ...`; no package was installed or changed.
- **Verification:** API route tests, Dashboard Crawlers tests, API type-check, and Dashboard `vue-tsc -b` all passed.
- **Committed in:** No source commit; verification command correction only.

**Total deviations:** 2 auto-fixed (1 bug, 1 verification command correction)
**Impact on plan:** No scope expansion or dependency change; both adjustments preserved the plan's bounded DTO and UI lifecycle boundaries.

## Verification

- `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` — **17/17 passed**.
- `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` — **14/14 passed**.
- `pnpm --filter api type-check` — **passed**.
- `pnpm --filter dashboard exec vue-tsc -b` — **passed**.
- `git diff --check 2836c4b^ 2836c4b -- apps/api/src/routes/admin/crawler-tasks/index.ts apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts apps/dashboard/src/lib/api.ts` — **passed**.
- `git diff --check ebb6f08^ ebb6f08 -- apps/dashboard/src/views/Crawlers.vue apps/dashboard/src/views/__test__/Crawlers.test.ts` — **passed**.

GitNexus guardrails were satisfied before the code commits. The indexed graph was up to date. Task 1 staged detection reported 3 files, 7 expected symbols, 0 processes, low risk. Task 2 staged detection reported the expected 2 files, 8 symbols, and 9 flows; the pre-authorized HIGH blast radius was retained for `loadTaskPanel` (5 direct callers, 4 flows) and `selectRun` (4 direct callers, 4 flows). No HIGH/CRITICAL finding was introduced beyond that controlled plan scope.

These are local focused tests and type checks, with mocked UI/API fixtures where applicable. They are not production evidence and are not a browser or authenticated Gateway control-plane proof. The manual Gateway/browser item remains explicitly marked `unknown` in coverage D4.

## Stub Scan

No new placeholder or disconnected data source was introduced. Existing empty reactive collections/null selection values in `Crawlers.vue` are loading and no-selection initialization, and are populated by the existing API readback path.

## Threat Surface

The touched surfaces are the plan's declared T-22-09 (bounded repair DTO disclosure), T-22-10 (server-owned same-movie link), T-22-11 (visible polling lifecycle), and T-22-12 (history preservation). No additional endpoint, auth path, file-access pattern, schema change, or unplanned trust boundary was added.

## Issues Encountered

- The plan's scoped package filters differed from the actual workspace package names; verification used the existing `api` and `dashboard` package names without modifying dependencies.
- GitNexus reindex completed successfully with non-fatal scope extraction warnings for the changed `Crawlers.test.ts` and the unrelated existing `Actors.test.ts`; no HIGH/CRITICAL risk was reported.
- No authentication gate occurred. No package installation was needed.

## User Setup Required

None - no external service configuration was required for these source-level changes.

## Next Phase Readiness

The Dashboard/API contract is ready for Phase 23 provider dispatch and reconciliation work. A fresh authenticated Gateway/browser flow and actual playback evidence remain separate Phase 24 evidence and are not claimed by this summary.

---
*Phase: 22-dashboard-moviedetail-and-player-state-closure*
*Plan: 03*
*Completed: 2026-08-07*

## Self-Check: PASSED

- SUMMARY file exists at the declared phase path.
- Task commits `2836c4b` and `ebb6f08` exist in git history.
- Staged content contains only this plan's SUMMARY file; external `AGENTS.md`, `CLAUDE.md`, and `.planning/agent-history.json` remain unstaged.
