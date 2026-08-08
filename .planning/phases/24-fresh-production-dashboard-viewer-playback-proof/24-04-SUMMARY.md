---
phase: 24-fresh-production-dashboard-viewer-playback-proof
plan: 04
subsystem: viewer-playback
tags: [movie-app, MovieDetail, Player, xgplayer, playback-evidence, source-selection]

# Dependency graph
requires:
  - phase: 24-fresh-production-dashboard-viewer-playback-proof
    provides: Dashboard current-attempt playback evidence projection and same-movie trace contract
  - phase: 23-github-actions-production-repair-and-reconciliation
    provides: server-owned content identity, source revision, repair readback, and provider tuple facts
provides:
  - evidence-aware direct-first MovieDetail source handoff with controlled fallback metadata
  - visible Play and allowlisted media-event timeline with bounded currentTime progress gate
  - bounded source retry/fallback UI and sensitive-field regression coverage
affects: [24-05-production-proof]

# Tech tracking
tech-stack:
  added: [lucide-vue-next]
  patterns: [server-owned same-movie playback context, visible user-gesture playback gate, allowlisted bounded media observations]

key-files:
  created: []
  modified:
    - apps/movie-app/package.json
    - pnpm-lock.yaml
    - apps/movie-app/src/utils/playbackSources.ts
    - apps/movie-app/src/utils/__tests__/playbackSources.test.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
    - apps/movie-app/src/views/Player.vue
    - apps/movie-app/src/views/__tests__/Player.security.test.ts

key-decisions:
  - "MovieDetail selects the first eligible direct source and carries only server-owned content ID, source revision, source type, and bounded tuple references into the Player route; raw source URLs stay out of the route context."
  - "Player playback verification requires a visible user Play action, canplay, playing, two currentTime samples, delta >= 1 second, and no terminal media error; source readiness and receipt facts remain independent."
  - "Ordinary playback remains read-only with no evidence endpoint write or telemetry path; evidence is projected through bounded UI-observable state for the next canonical Gateway proof."

patterns-established:
  - "Render observed and not-observed rows for the allowlisted canplay, playing, waiting, stalled, and error event set with bounded relative timestamps and source attempts."
  - "Retry the current source at most twice, then move to the next eligible source or controlled fallback and stop with a stable failure/checkpoint state when candidates are exhausted."

requirements-completed: [EVID-01, EVID-02]

# Coverage metadata
coverage:
  - id: VIEW-01
    description: "MovieDetail uses direct-first eligibility, controlled fallback, and a same-movie Player route carrying content ID, source revision, source type, and bounded tuple context."
    requirement: EVID-01
    verification:
      - kind: unit
        ref: "apps/movie-app/src/utils/__tests__/playbackSources.test.ts and apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/movie-app exec vue-tsc -b"
        status: pass
    human_judgment: false
  - id: PLAY-01
    description: "Player exposes visible keyboard-focusable Play, collects allowlisted media events, and gates playback verification on one-second currentTime progress without terminal error."
    requirement: EVID-02
    verification:
      - kind: unit
        ref: "apps/movie-app/src/views/__tests__/Player.security.test.ts (visible Play, event timeline, progress, terminal error, retry cap, fallback, and redaction cases)"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/movie-app exec vitest run (20 files, 207 tests)"
        status: pass
    human_judgment: true
    rationale: "The tests verify the bounded state contract, but real media progression through the authenticated canonical Gateway still requires the Phase 24-05 fresh production browser proof."
  - id: PLAY-02
    description: "Player retry/fallback and ordinary-playback redaction boundaries remain bounded and do not submit playback telemetry."
    requirement: EVID-02
    verification:
      - kind: unit
        ref: "apps/movie-app/src/views/__tests__/Player.security.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
      - kind: other
        ref: "git diff --check"
        status: pass
    human_judgment: false

# Metrics
duration: unmeasured-continuation
completed: 2026-08-08
status: complete
---

# Phase 24 Plan 04: Viewer Playback Evidence Summary

**MovieDetail now hands off a server-owned same-movie playback context, and Player exposes a visible, event-driven, progress-gated playback state without treating source readiness as actual playback.**

## Performance

- **Duration:** Unmeasured continuation from the prior Plan 04 execution session
- **Started:** Prior executor session on 2026-08-08
- **Completed:** 2026-08-08
- **Tasks:** 2 completed
- **Files modified:** 8

## Accomplishments

- Added direct-first eligible source selection, controlled magnet/TorrServer fallback, and bounded route context carrying content identity, source revision, source type, and tuple references.
- Updated MovieDetail source cards and Player links to preserve the same server-owned movie context while excluding raw media URLs and keeping playback readiness separate from actual playback verification.
- Added a visible keyboard-focusable Play action, allowlisted event timeline, currentTime before/after/delta progress gate, terminal-error handling, reduced-motion/live-region states, and bounded retry/fallback behavior.
- Added focused security and DOM-contract regressions covering visible interaction, event observations, progress threshold, retry cap, fallback, stale context, and sensitive-field exclusion.

## Task Commits

Each task was committed atomically:

1. **Task 1: 固化 evidence-aware source handoff** - `91c7375` (feat)
2. **Task 2: 实现 visible Play event collector 与 bounded progress UI** - `fb15dbb` (feat)

**Plan metadata:** `8513d5f` (docs: complete viewer playback plan)

## Verification

- pnpm --filter @starye/movie-app exec vitest run src/utils/__tests__/playbackSources.test.ts src/views/__tests__/MovieDetail.dom-contract.test.ts src/views/__tests__/Player.security.test.ts -> PASS, 3 files / 45 tests.
- pnpm --filter @starye/movie-app exec vitest run -> PASS, 20 files / 207 tests. The suite logs non-fatal connection-refused diagnostics for the intentionally absent local services on ports 8090 and 19999, while exiting successfully.
- pnpm --filter @starye/movie-app exec vue-tsc -b -> PASS.
- pnpm --filter api type-check -> PASS.
- git diff --check -> PASS.
- GitNexus `detect_changes(scope=all)` completed with `HIGH` file-scope risk because Player lifecycle/retry changes touch 9 playback flows and the worktree also contains the user's existing `AGENTS.md`/`CLAUDE.md` edits; the affected flows remain within the intended Movie App playback chain.
- Canonical authenticated Gateway browser proof remains intentionally pending for Plan 05; local tests do not claim real production media playback.

## Deviations from Plan

### Auto-fixed Issues

**1. Lockfile importer churn cleanup**
- **Found during:** Plan closeout
- **Issue:** Installing `lucide-vue-next` rewrote unrelated peer-resolution importer entries in `apps/auth` and `apps/blog`.
- **Fix:** Restored those unrelated importer resolutions and retained only the `apps/movie-app` Lucide importer entry.
- **Files modified:** `pnpm-lock.yaml`
- **Verification:** `git diff --check` and the Movie App full test/type-check suite passed.
- **Committed in:** `fb15dbb` (part of Task 2 commit)

---

**Total deviations:** 1 cleanup deviation
**Impact on plan:** No scope expansion; the lockfile now records only the dependency required by the Player UI.

## Issues Encountered

- No blocking implementation issues. The full Vitest run prints expected connection-refused diagnostics for unavailable local mock services on ports 8090 and 19999 but returns exit code 0.

## User Setup Required

None - no external service configuration was added by Plan 04.

## Next Phase Readiness

- Plan 05 can use the canonical Gateway `http://localhost:8080` to run the artifact-first fresh production tuple through Dashboard -> MovieDetail -> Player.
- The implementation exposes the required UI facts, but actual production playback remains a human/browser checkpoint and must be proven with a fresh authenticated tuple; no historical Phase 13 carrier or local mocked state should be counted.

## Self-Check: PASSED

- [x] Both production task commits exist and contain only the intended Movie App files.
- [x] Summary is committed before shared STATE/ROADMAP tracking updates.
- [x] Focused and full Movie App tests, Movie App type-check, API type-check, and diff checks pass.
- [x] User-existing `AGENTS.md` and `CLAUDE.md` edits remain unstaged and untouched.

---
*Phase: 24-fresh-production-dashboard-viewer-playback-proof*
*Completed: 2026-08-08*
