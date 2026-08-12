---
phase: 26-video-source-and-magnet-availability
plan: 26-10
subsystem: public-movie-availability-readback
tags: [public-api, availability, authoritative-readback, schema, revision-binding]
status: complete

requires:
  - phase: 26-05
    provides: authoritative availability repository current and history
provides:
  - public movie detail four-layer availability projection
  - shared movie detail handler for identifier and code routes
  - bounded playback tuple for Player evidence submission
affects: [26-06, 26-07, 26-08]

tech-stack:
  added: []
  patterns:
    - shared service and handler for public and authenticated detail routes
    - same-revision current with bounded old-revision history
    - strict allowlist response schema

key-files:
  modified:
    - apps/api/src/routes/movies/services/movie.service.ts
    - apps/api/src/routes/movies/handlers/movies.handler.ts
    - apps/api/src/routes/public/movies/index.ts
    - apps/api/src/schemas/movie.ts
    - apps/api/src/routes/public/movies/__tests__/readiness.test.ts

key-decisions:
  - "GET /api/public/movies/:code delegates to the shared getMovieDetail chain instead of rebuilding readiness from movie rows."
  - "Metadata persistence requires explicit revision-bound receipt evidence; movie.updatedAt is not authoritative proof."
  - "The public playback layer exposes only the server-owned task/run/attempt/provider tuple and never raw evidence, URLs, auth or provider configuration."

requirements-completed: [VID-01, VID-04, VID-05]

metrics:
  tasks: 2
  files: 5
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 2
---

# Phase 26 Plan 10: Public Authoritative Movie Availability Summary

The public movie detail endpoint now returns metadata, direct, magnet and playback as independent authoritative layers, with current restricted to the active source revision and older determinate facts retained only in bounded history.

## Commits

| Commit | Description |
|--------|-------------|
| `ad4f8c5` | Add failing authoritative movie readback tests |
| `152da81` | Expose authoritative movie availability |

## Verification

- focused public and movie handler API tests - 16/16 passed
- `pnpm --filter api type-check` - passed
- `pnpm --filter @starye/api-types run build` - passed
- target-file ESLint - passed
- `git diff --check` - passed
- GitNexus detect-changes - LOW with no affected execution flows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate public detail construction**
- **Found during:** Task 2 route trace
- **Issue:** The public route bypassed the authoritative movie service and maintained a separate readiness projection.
- **Fix:** Registered the shared handler and taught it to accept either `identifier` or `code` parameters while preserving R18 checks.
- **Commit:** `152da81`

**2. [Rule 1 - Bug] Stopped inferring metadata persistence from movie timestamps**
- **Found during:** Task 1 authoritative readback tests
- **Issue:** `movie.updatedAt` could synthesize persisted metadata without revision-bound receipt evidence.
- **Fix:** Read explicit versioned receipt metadata and otherwise return `persisted: false`.
- **Commit:** `152da81`

## Known Stubs

This plan proves typed API readback with focused fixtures. Gateway/provider live acceptance remains Plan 26-08.

## Self-Check: PASSED

- All declared plan artifacts exist.
- Both commits exist in git history.
- Focused API tests, type-check, api-types build, lint and diff validation passed.
