---
phase: 22-dashboard-moviedetail-and-player-state-closure
plan: 02
subsystem: movie-app
tags: [movie-app, MovieDetail, readiness, playbackSources, TorrServer, Aria2, Vitest]

# Dependency graph
requires:
  - phase: 22-dashboard-moviedetail-and-player-state-closure
    plan: 01
    provides: eligibility-aware playback source classification, grouping, direct selection and bounded Player routes
provides:
  - four-state MovieDetail readiness action projection with bounded reason/revision/observation details
  - eligibility-first source card groups with direct Player and controlled magnet actions
  - DOM contract coverage for mixed source order, action boundaries, repairing pause and raw-field redaction
affects: [phase-23-provider-repair-and-reconciliation, phase-24-dashboard-viewer-playback-proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - reuse the shared playbackSources eligibility/type/group policy before rendering actions
    - keep source health and readiness reason projections separate from playback proof
    - route direct playback through the existing movie code plus player id contract

key-files:
  created:
    - .planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-02-SUMMARY.md
  modified:
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts

key-decisions:
  - "Use groupPlaybackSources and selectDirectPlaybackSource from Wave 1; rating, quality and latest sorting stay within their eligibility/type groups."
  - "Ready direct sources route to /movie/:code/play?player=:id; eligible magnets expose only the existing TorrServer, Aria2, copy and QR actions."
  - "Inactive, blank and explicit TorrServer/ineligible rows remain informational, while repairing keeps health/readback details and removes the playback source area."
  - "Shared STATE, ROADMAP and REQUIREMENTS metadata remains owned by the parent executor in the shared main worktree."

requirements-completed: [PLAY-01, PLAY-03]
---

# Phase 22 Plan 02: MovieDetail Readiness and Source Actions Summary

**Eligibility-aware MovieDetail readiness actions with direct Player routing and bounded magnet/ineligible source cards.**

## Performance

- **Duration:** unmeasured; task commits completed 2026-08-07 12:59-13:03 + final verification
- **Completed:** 2026-08-07
- **Tasks:** 2 completed
- **Files modified:** 2 implementation/test files

## Accomplishments

- Projected `ready`, `no_source`, `source_failed` and `repairing` with state-specific actions, bounded reason codes, source revision and observation time.
- Reused the Wave 1 policy for direct, magnet and ineligible grouping; default order remains eligible direct, eligible magnet, then inactive/ineligible while score sorting stays within groups.
- Routed the first eligible direct through the existing Player route with the movie code and player id query; kept magnet operations on existing TorrServer/Aria2/copy/QR handlers.
- Removed playback and transfer controls from inactive, blank, explicit TorrServer and other ineligible cards; repairing retains source health/readback summary and an enabled refresh action without a playback source area.
- Added mixed-source DOM fixtures covering four readiness states, server order, score ordering, action boundaries, repairing pause, bounded reason projection and raw-field redaction.

## Task Commits

1. **Task 1: 闭合 MovieDetail readiness-specific actions** - `0eb3942` (feat)
2. **Task 2: 覆盖来源排序、类型动作和 repairing 入口回归** - `69041d2` (test)

## Decisions Made

- The first eligible direct is selected from the original server-owned player order, independently of score or quality fields.
- A direct source gets a controlled Player route rather than a raw URL anchor; a magnet source does not enter browser direct playback.
- The bounded readiness reason renders as `reasonCode · label`, so source disposition and source health retain both machine-readable and user-readable context.
- Local DOM and type checks establish UI contract behavior only. They do not prove actual browser media playback, provider execution or production readiness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned the MovieDetail TorrServer fixture with the Wave 1 policy**

- **Found during:** Task 1 focused DOM contract test
- **Issue:** The fixture used only `sourceName: 'TorrServer'`, while the shared classifier intentionally trusts the server-owned `source: 'TorrServer'` marker.
- **Fix:** Added the explicit source marker to the fixture so the regression exercises the real policy.
- **Files modified:** `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts`
- **Commit:** `0eb3942`

**2. [Rule 2 - Missing critical functionality] Rendered bounded readiness reason codes**

- **Found during:** Task 2 four-state reason assertions
- **Issue:** `sourceReasonLabel` rendered only the localized label, leaving the bounded DTO reason code absent from the readiness DOM.
- **Fix:** Rendered `reasonCode · label`, matching the existing source-health bounded projection and preserving raw-field redaction.
- **Files modified:** `apps/movie-app/src/views/MovieDetail.vue`
- **Commit:** `69041d2`

### Execution Notes

- The first Task 1 commit attempt was rejected by commitlint because PowerShell passed literal `\\n` text in the commit body. The commit was retried with separate message paragraphs; no source scope changed.

## Auth Gates

None.

## Known Stubs

None introduced. The scan found no placeholder/TODO data source in the plan changes; existing download-list mocks remain test infrastructure only.

## Threat Surface Review

No new endpoint, authentication path, file access pattern or schema boundary was introduced. The existing route and Aria2/TorrServer composable boundaries were tightened so only policy-approved sources expose actions, and raw source/receipt/request/signature sentinels are excluded from the rendered DOM.

## Verification

- `pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts` - 7/7 passed during Task 1.
- `pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts src/utils/__tests__/playbackSources.test.ts` - 2 files, 27/27 passed after Task 2 and final verification.
- `pnpm --filter @starye/movie-app exec vue-tsc -b` - passed.
- `git diff --check` - passed for the worktree and both plan commits.
- Staged `npx gitnexus detect-changes --repo starye --scope staged` - Task 1: 2 files, 18 symbols, LOW; Task 2: 2 files, 1 indexed symbol, LOW. Both staged scopes contained only the two declared code/test files.
- No canonical Gateway or browser playback run was claimed in this plan. The verification is local DOM contract/type evidence and remains separate from Phase 24 fresh production playback proof.

## Self-Check: PASSED

- Summary file exists at the declared phase path.
- Task commits `0eb3942` and `69041d2` exist in git history.
- `git diff --check` passed.

---
*Phase: 22-dashboard-moviedetail-and-player-state-closure*
*Plan: 02*
*Completed: 2026-08-07*
