---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 06
subsystem: ui
tags: [dashboard, movie-detail, source-health, repair-players, polling, bounded-dto]

# Dependency graph
requires:
  - phase: 21-04
    provides: authenticated repair-players admin route and bounded task projection
  - phase: 21-05
    provides: operation-aware local runner and repair receipt/readback projection
provides:
  - typed Dashboard repair command, task union, repair receipt and source-health rows
  - confirmation-gated Dashboard repair action with visible bounded task polling
  - MovieDetail informational source-health projection and same-identity Dashboard handoff
affects: [21-07-local-gateway-proof, phase-22-player-state-closure]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed bounded receipt union, fixed-intent confirmation, visible-only task polling, informational cross-app handoff]

key-files:
  created:
    - .planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-06-SUMMARY.md
  modified:
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts

key-decisions:
  - "Dashboard uses the existing repair task detail/readback as the source-health focal surface; the client never selects target, workflow, adapter, URL, command or secret fields."
  - "Repair confirmation posts only confirmed=true, canonical movieId, bounded current reason and the literal restore_playable_sources intent."
  - "MovieDetail derives a bounded informational source summary from its existing movie identity/player projection and navigates to Dashboard without an admin mutation call."

patterns-established:
  - "Repair receipts are narrowed by operation before rendering sourceSummary, while ordinary crawler receipts keep their existing management contract."
  - "Raw runner/source/request/exception/signature sentinels are asserted absent from the rendered Dashboard and MovieDetail surfaces."

requirements-completed: [SRC-02, REP-01]

coverage:
  - id: D1
    description: "Dashboard exposes direct/magnet/TorrServer bounded source health, fixed repair confirmation payload, and task/readback next action."
    requirement: SRC-02
    verification:
      - kind: automated_ui
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts (12 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter dashboard type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "MovieDetail keeps source health/readiness informational and hands the same movie identity to Dashboard for repair."
    requirement: REP-01
    verification:
      - kind: automated_ui
        ref: "apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts (7 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/movie-app exec vue-tsc -b"
        status: pass
    human_judgment: false

# Metrics
duration: 32m
completed: 2026-08-06
status: complete
---

# Phase 21 Plan 06: Dashboard Source Health And MovieDetail Handoff Summary

**Typed Dashboard `repair_players` confirmation/readback UI and bounded MovieDetail source-health handoff.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-06T18:58:26+08:00
- **Completed:** 2026-08-06T19:30:33+08:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Dashboard API types now distinguish ordinary crawler receipts from repair receipts and expose typed source-health rows, fixed repair command input, task next actions and bounded readback fields.
- Crawlers provides a confirmation-gated repair entry for `no_source`/`source_failed`, sends the literal `restore_playable_sources` intent, refreshes the task panel after acceptance, and renders source type, health, observed time, reason and eligibility without raw runner data.
- MovieDetail renders informational per-source health/readiness while preserving separate playback proof semantics; repairable states navigate to Dashboard with the same canonical movie identity and bounded reason.

## Task Commits

Each task was committed atomically with TDD RED/GREEN gates:

1. **Task 1: Dashboard typed repair/source health/confirmation/polling UI** - `43dd020` (RED) -> `f97535b` (GREEN)
2. **Task 2: MovieDetail informational handoff** - `1af36c3` (RED) -> `7e6764f` (GREEN)

## Files Created/Modified

- `apps/dashboard/src/lib/api.ts` - typed repair command, repair task/receipt union and bounded source-health DTOs.
- `apps/dashboard/src/views/Crawlers.vue` - confirmation flow, source-health rows, bounded failure handling and existing visible-only polling integration.
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` - exact payload, confirmation, polling/readback, health/eligibility and raw sentinel regressions.
- `apps/movie-app/src/views/MovieDetail.vue` - bounded source-health summary and Dashboard handoff without mutation ownership.
- `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` - source health, same-identity navigation and DOM redaction regressions.

## Decisions Made

- Kept the Dashboard repair/readback surface alongside the existing crawler task detail, matching the plan's add-alongside decision.
- Used server-owned repair task title when present and canonical movie identity as the fallback confirmation label because ordinary historical task readback only carries the content identity.
- Kept source health and browser playback proof as separate labels; `ready` or a persisted receipt is not rendered as actual playback proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed the ordinary/repair receipt union for TypeScript**

- **Found during:** Task 1 GREEN verification
- **Issue:** Directly reading `operation` from the ordinary crawler receipt branch caused `vue-tsc` TS2339 after adding the repair receipt union.
- **Fix:** Added an explicit `'operation' in receipt` guard before repair receipt narrowing and retained ordinary receipt access through the existing contract.
- **Files modified:** `apps/dashboard/src/views/Crawlers.vue`
- **Verification:** Dashboard focused tests 12/12 and `pnpm --filter dashboard type-check` passed.
- **Committed in:** `f97535b`

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** Required type narrowing stayed within the planned Dashboard files and did not expand the API or mutation boundary.

## Issues Encountered

- The first GitNexus detect-changes invocation omitted the repository selector in a multi-repository registry and failed before analysis; subsequent pre-commit checks used `-r starye` and completed. The first successful Dashboard GREEN analysis reported 3 expected files, 33 symbols, 8 existing task/readiness flows and HIGH risk; MovieDetail GREEN analysis reported 1 file, 14 symbols, no affected flows and LOW risk.
- The repository lint-staged hook ran its normal temporary backup/restore cycle during each commit; it left only the user's pre-existing `AGENTS.md` and `CLAUDE.md` dirty.

## Known Stubs

None in implementation files. `RAW_*_SENTINEL` values are test-only redaction fixtures.

## Threat Surface Scan

No new endpoint, authentication path, file access pattern or schema trust boundary was introduced. The Dashboard calls the existing authenticated repair route with a fixed typed intent, and MovieDetail performs navigation only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 21-06 is ready for 21-07 Gateway/local proof: the Dashboard can create a fixed repair task, display bounded task/source readback and refresh while visible.
- Browser/Gateway proof, real local runner observation and actual playback proof remain verification boundaries for 21-07 and later phases; this plan proves focused UI contracts and app type-checks only.

---
*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Plan: 21-06*
*Completed: 2026-08-06*

## Self-Check: PASSED

- Summary file exists at the planned phase path.
- Task commits `43dd020`, `f97535b`, `1af36c3` and `7e6764f` exist in git history.
- All five planned implementation/test files are present; no task commit deleted tracked files.
- Dashboard/MovieDetail focused tests, app type-checks and `git diff --check` passed.
