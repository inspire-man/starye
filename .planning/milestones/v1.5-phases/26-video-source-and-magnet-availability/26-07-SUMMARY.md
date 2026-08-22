---
phase: 26-video-source-and-magnet-availability
plan: 26-07
subsystem: movie-player-playback-evidence
tags: [player, playback-evidence, revision-binding, torrserver, security]
status: complete

requires:
  - phase: 26-05
    provides: authoritative playback tuple and evidence endpoint
  - phase: 26-10
    provides: public movie availability tuple readback
provides:
  - revision-bound active Player evidence identity
  - real-consumption evidence submission after explicit play and positive progress
  - duplicate, stale instance and sensitive payload suppression
affects: [26-06, 26-08]

tech-stack:
  added: []
  patterns:
    - immutable media-instance evidence identity
    - server-owned tuple with browser-local bounded observations
    - local duplicate suppression before asynchronous submission

key-files:
  modified:
    - apps/movie-app/src/views/Player.vue
    - apps/movie-app/src/views/__tests__/Player.security.test.ts
    - apps/movie-app/src/lib/api-client.ts
    - apps/movie-app/src/types.ts

key-decisions:
  - "Playback evidence requires explicit Play, canplay, playing, no error and at least one second of positive currentTime progress."
  - "Each player instance captures one session/source/revision/tuple identity; retry, source switch and new detail load invalidate prior handlers synchronously."
  - "TorrServer remains browser-scoped evidence: only the bounded source type is submitted, never stream URL, magnet, credentials or provider configuration."

requirements-completed: [VID-01, VID-03, VID-04]

metrics:
  tasks: 2
  files: 4
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 2
---

# Phase 26 Plan 07: Revision-bound Player Consumption Evidence Summary

Player now promotes playback only after a real current-revision consumption event and submits a bounded evidence request using the authoritative task/run/attempt tuple returned by the movie detail endpoint.

## Commits

| Commit | Description |
|--------|-------------|
| `3387d73` | Add failing playback evidence submission test |
| `412e4e2` | Submit revision-bound playback evidence |

## Verification

- focused Player security tests - 19/19 passed
- `pnpm --filter @starye/movie-app exec vue-tsc -b` - passed
- target-file ESLint - passed
- `git diff --check` - passed
- GitNexus staged detect-changes - HIGH across 10 expected Player flows; `initPlayer` and `updatePlaybackProgress` were HIGH but limited to the Player play/retry/load paths, while `beginPlaybackSession` was LOW

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the typed movie client for the refreshed AppType**
- **Found during:** Task 2 type-check
- **Issue:** The successful public movie detail response no longer exposed an `error` property after Plan 26-10 rebuilt `@starye/api-types`.
- **Fix:** Check HTTP status before parsing the success body at the existing client boundary.
- **Commit:** `412e4e2`

**2. [Rule 2 - Missing Critical] Bound late-event rejection to the media instance**
- **Found during:** Task 1 retry-race review
- **Issue:** Session/source/revision alone could identify both an old and retried player instance using the same server tuple.
- **Fix:** Included the local source attempt in the browser-only identity key and proved old handlers cannot submit after retry.
- **Commit:** `412e4e2`

## Known Stubs

Authenticated Gateway/provider acceptance remains Plan 26-08. This plan validates the Player state machine and bounded request using mocked transport, not live browser or production evidence.

## Self-Check: PASSED

- All declared plan artifacts exist.
- Both commits exist in git history.
- Focused tests, type-check, lint and diff validation passed.
