---
phase: 24-fresh-production-dashboard-viewer-playback-proof
plan: 03
subsystem: dashboard
tags: [dashboard, playback-evidence, crawler-tasks, polling, redaction]

# Dependency graph
requires:
  - phase: 24-fresh-production-dashboard-viewer-playback-proof
    provides: authenticated tuple-bound playback evidence endpoint and current/history task projection
  - phase: 23-github-actions-production-repair-and-reconciliation
    provides: server-owned provider, repair receipt, source revision, and current-attempt facts
provides:
  - typed Dashboard playback evidence and current-attempt task detail contracts
  - four-layer Dashboard evidence surface with bounded playback and rejection history
  - visible-page polling that promotes server current attempts while retaining the last valid projection
affects: [24-04-viewer-playback-evidence, 24-05-production-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-owned currentAttempt projection, allowlisted playback fact rendering, visible-page five-second polling]

key-files:
  created: []
  modified:
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts

key-decisions:
  - "Dashboard renders provider, repair/receipt, source, and actual playback as separate facts; playback never becomes an overall success badge."
  - "The server-selected currentAttempt is the focal run; older attempts and playback rejection outcomes remain bounded history."
  - "The same-movie link is derived from server-projected movie code, identity match, and source revision; raw playback URL, token, cookie, and runner payload fields are excluded from rendering."

patterns-established:
  - "Preserve the last valid playback projection when a polling response omits playback evidence during refresh."
  - "Display explicit observed/not-observed media event rows and numeric currentTime progress from the bounded server summary."

requirements-completed: [EVID-01, EVID-03]

coverage:
  - id: DASH-01
    description: "Typed client contract for tuple identity, current attempt, provider/repair/source/playback facts, artifact reference, and bounded history"
    requirement: EVID-03
    verification:
      - kind: other
        ref: "pnpm --filter dashboard exec vue-tsc -b"
        status: pass
    human_judgment: false
  - id: DASH-02
    description: "Current-attempt Dashboard projection with independent fact blocks, same-movie handoff, polling promotion, and redaction boundary"
    requirement: EVID-01
    verification:
      - kind: integration
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts (19 tests: repair confirmation, current attempt, fact blocks, redaction, polling, history, accessibility, and same-movie link)"
        status: pass
      - kind: other
        ref: "git diff --cached --check"
        status: pass
    human_judgment: true
    rationale: "Canonical authenticated Gateway browser review of the dashboard visual order and loading/partial/error surfaces remains required by the plan."

duration: 1h 30m
completed: 2026-08-08
status: complete
---

# Phase 24 Plan 03: Dashboard Current-Attempt Evidence Surface Summary

**Dashboard task detail now traces one server-selected repair attempt through independent provider, repair/receipt, source, and actual playback facts.**

## Performance

- **Duration:** 1h 30m including executor retry and local takeover
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Added typed playback evidence contracts and exposed the existing authenticated task detail wrapper without adding client-controlled target, workflow, repository, ref, environment, URL, command, or secret fields.
- Updated `Crawlers.vue` to focus the server-selected `currentAttempt`, preserve the last valid evidence projection during polling, and keep bounded older attempts and duplicate/conflict/late/stale/ignored outcomes available through history.
- Rendered tuple identity, content ID, source revision, Viewer path, allowlisted media events, currentTime before/after/delta, artifact reference, and separate Provider, Repair/receipt, Source, and Actual playback blocks; raw playback and runner fields remain excluded.
- Added regression coverage for fresh repair confirmation, current-attempt promotion, polling, independent blocks, history, canonical same-movie navigation, accessibility semantics, and sensitive-field redaction.

## Task Commits

1. **Task 1: 扩展 Dashboard typed evidence client contract** - `757fff5` (feat)
2. **Task 2: 实现 current-attempt evidence detail 与 UI-SPEC 状态覆盖** - `074f04e` (feat)

## Verification

- `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` -> PASS, 19 tests.
- `pnpm --filter dashboard exec vue-tsc -b` -> PASS.
- `git diff --cached --check` -> PASS.
- GitNexus staged `detect-changes` identified the intended two Dashboard files and nine affected task/polling/repair execution flows; risk was HIGH at file scope, with targeted symbol impact LOW and no new cross-module dependency.
- Canonical Gateway browser review remains pending for the authenticated session and visible UI states; this summary does not claim production proof.

## Deviations from Plan

### Execution recovery

The delegated `gsd-executor` completed and committed Task 1, then exited twice after `429 Too Many Requests` before creating the Task 2 commit or summary. The current session retained the staged Task 2 changes, reran all automated verification, and completed the metadata closeout without re-dispatching the same plan.

**Total deviations:** 1 execution recovery (no scope deviation).
**Impact:** Planned files and behavior remain within the 24-03 boundary; production browser verification remains downstream in Plan 05.

## Known Stubs

- Authenticated Gateway visual verification and the selected production target remain required for Phase 24 Plan 05; local tests are not production playback proof.

## Next Phase Readiness

Plan 04 can now consume the typed Dashboard task detail and same-movie handoff while independently implementing visible Play and media-event progress proof in MovieDetail/Player.

## Self-Check: PASSED

- Summary file created in the phase directory.
- Task 1 commit `757fff5` exists in git history.
- Automated verification passed before Task 2 production commit.
- Unrelated `AGENTS.md` and `CLAUDE.md` modifications remain unstaged and untouched.

---
*Phase: 24-fresh-production-dashboard-viewer-playback-proof*
*Plan: 03*
*Completed: 2026-08-08*
