---
phase: 26-video-source-and-magnet-availability
plan: 26-06
subsystem: video-availability-ui-projections
tags: [dashboard, movie-detail, hono-rpc, availability, revision-binding]
status: complete

requires:
  - phase: 26-05
    provides: admin four-layer availability and command boundary
  - phase: 26-10
    provides: typed public movie availability readback
provides:
  - Dashboard task-result four-layer current/history rows
  - cast-free typed public movie detail client
  - MovieDetail four-layer current/history rows and reason-specific actions
  - typed admin video availability command wrapper
affects: [26-08]

tech-stack:
  added: []
  patterns:
    - fixed unframed metadata/direct/magnet/playback rows
    - authoritative current with old revision history only
    - AppType response structural compatibility at the client boundary

key-files:
  modified:
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts
    - apps/movie-app/src/types.ts
    - apps/movie-app/src/lib/api-client.ts
    - apps/movie-app/src/lib/__tests__/api-client.test.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
    - apps/movie-app/src/views/Player.vue
    - apps/movie-app/src/composables/useDownloadList.ts

key-decisions:
  - "Both surfaces render four fixed rows from their authoritative API response; old revisions appear only beneath the matching layer as history."
  - "Provider failures show configuration guidance, source failures show repair guidance, and stale/uncertain findings show recheck guidance."
  - "The public Hono RPC success body is structurally compatible with MovieDetail and is returned without a broad double cast."
  - "Dashboard exposes the strict video command DTO but does not invent a missing movieRevision from sourceRevision."

requirements-completed: [VID-01, VID-05]

metrics:
  tasks: 2
  files: 10
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 5
---

# Phase 26 Plan 06: Dashboard and MovieDetail Video Availability Summary

Dashboard task detail and public MovieDetail now present the same four independent availability layers, reason-specific guidance, bounded current/history facts and revision identity while retaining their distinct typed API chains.

## Commits

| Commit | Description |
|--------|-------------|
| `443bc6f` | Add failing Dashboard video layer tests |
| `4a23dee` | Render Dashboard video availability layers |
| `80f59dd` | Add failing public movie projection tests |
| `26a9eca` | Render typed MovieDetail availability projection |
| `e403bd2` | Expose typed video availability commands |

## Verification

- Dashboard focused tests - 22/22 passed
- Dashboard `vue-tsc --noEmit` - passed
- movie-app focused API/MovieDetail tests - 22/22 passed
- movie-app full suite - 20 files, 212/212 passed
- Player security regression - 19/19 passed
- `pnpm --filter @starye/api-types run build` - passed
- `pnpm --filter @starye/movie-app exec vue-tsc -b` - passed
- target-file ESLint and `git diff --check` - passed
- GitNexus Dashboard changes - LOW with no affected flows; MovieDetail aggregate - HIGH due shared Movie/MovieDetail imports and seven Player flows, reviewed against the full movie-app suite

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the public detail double cast**
- **Found during:** Task 2 RED/type-check
- **Issue:** `getMovieDetail` converted the AppType response using `as unknown as MovieDetail`, masking nullable and summary-shape drift.
- **Fix:** Aligned local UI types with the real public DTO, normalized nullable/date fields at their consumers, and returned `data.data` directly.
- **Commit:** `26a9eca`

**2. [Rule 2 - Missing Critical] Added the typed admin video command boundary**
- **Found during:** final must-have audit
- **Issue:** Dashboard could read four layers but had no typed wrapper for the existing revision-bound command endpoint.
- **Fix:** Added the strict allowlisted command DTO and `/admin/crawler-tasks/video-availability` wrapper without provider controls.
- **Commit:** `e403bd2`

**3. [Rule 3 - Blocking] Replaced the nonexistent movie-app type-check script**
- **Found during:** plan verification
- **Issue:** `@starye/movie-app` defines no `type-check` script.
- **Fix:** Used the package's actual compiler command, `pnpm --filter @starye/movie-app exec vue-tsc -b`.

## Known Stubs

The surfaces and clients are verified with fixtures and local suites. Authenticated canonical Gateway/provider live acceptance remains Plan 26-08.

## Self-Check: PASSED

- All declared plan artifacts exist.
- All five commits exist in git history.
- Focused, full-suite, type, lint and diff validation passed.
