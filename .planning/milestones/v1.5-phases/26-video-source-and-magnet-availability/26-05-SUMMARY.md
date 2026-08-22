---
phase: 26-video-source-and-magnet-availability
plan: 26-05
subsystem: api-video-availability-readback
tags: [availability, authoritative-readback, metadata, admin-api, revision-binding]
status: complete

requires:
  - phase: 26-03
    provides: bounded magnet observations
  - phase: 26-04
    provides: bounded direct observations
provides:
  - authoritative same-revision current plus bounded history repository readback
  - explicit metadata persistence input instead of timestamp inference
  - closed revision-bound video command and admin four-layer task projection
affects: [26-06, 26-07, 26-10]

tech-stack:
  added: []
  patterns:
    - append-first persistence followed by authoritative current/history readback
    - server-owned reason-to-operation mapping
    - stable four-layer task DTO with legacy current/history compatibility

key-files:
  created:
    - apps/api/src/domain/video-availability/__tests__/repository-readback.test.ts
    - apps/api/src/routes/admin/crawler-tasks/phase26-video-availability.test.ts
  modified:
    - apps/api/src/domain/crawler-tasks/availability-repository.ts
    - apps/api/src/domain/movies/source-contract.ts
    - apps/api/src/schemas/crawler-tasks.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/movies/services/movie.service.ts
    - apps/api/src/routes/public/movies/index.ts
    - apps/api/src/routes/public/movies/__tests__/readiness.test.ts

key-decisions:
  - "Metadata persistence is an explicit authoritative fact; a timestamp or successful task cannot synthesize it."
  - "Admin video commands accept no provider or workflow controls and derive repair/recheck operations from closed server reason rules."
  - "Task detail preserves generic availability current/history while adding stable metadata/direct/magnet/playback layer projections."

requirements-completed: [VID-01, VID-04, VID-05]

metrics:
  tasks: 2
  files: 9
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 4
---

# Phase 26 Plan 05: Authoritative Video Availability Readback Summary

The API now reads bounded same-revision availability current/history, projects metadata from an explicit persisted fact, and exposes closed revision-bound video commands plus four stable admin task layers.

## Commits

| Commit | Description |
|--------|-------------|
| `1dfdc8d` | Add failing authoritative readback tests |
| `2b5ff19` | Add authoritative repository readback and explicit metadata input |
| `b2b15c8` | Add failing video availability command tests |
| `3dcc8b4` | Expose closed commands and four-layer admin task projection |

## Verification

- focused repository, route, operation, source-contract, and public readiness tests - 83/83 passed
- `pnpm --filter api type-check` - passed
- target-file ESLint - passed
- `git diff --check` - passed
- GitNexus compare detect-changes - MEDIUM, limited to expected internal availability repository factory flow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed hardcoded metadata persistence**
- **Found during:** Task 1 RED
- **Issue:** `createServerReadinessProjection` returned persisted metadata for any timestamp-bearing movie/task input.
- **Fix:** Required an explicit metadata fact and updated all direct consumers.
- **Commit:** `2b5ff19`

**2. [Rule 2 - Missing Critical] Preserved server ownership for source kind and command selection**
- **Found during:** Task 2 transport/readback review
- **Issue:** Runner source kind was not persisted and caller-controlled operation selection would weaken the closed registry.
- **Fix:** Classified direct/magnet from the immutable task snapshot and derived repair/recheck operations from a strict reason schema.
- **Commit:** `3dcc8b4`

**3. [Rule 1 - Bug] Read the real nested playback summary contract**
- **Found during:** Task 2 truth audit
- **Issue:** Initial fixture used a non-existent top-level playback status field.
- **Fix:** Typed the read model with `PlaybackEvidenceSummary` and used `summary.playback.status` with legacy absence fallback.
- **Commit:** `3dcc8b4`

## Known Stubs

The public movie-detail four-layer schema/readback remains owned by Plan 26-10; this plan preserves its existing compatibility projection only.

## Self-Check: PASSED

- All declared plan artifacts exist.
- All four commits exist in git history.
- Full focused validation and API type-check passed.
