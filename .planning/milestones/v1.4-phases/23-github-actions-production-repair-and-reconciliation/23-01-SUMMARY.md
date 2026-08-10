---
phase: 23-github-actions-production-repair-and-reconciliation
plan: 01
subsystem: api
tags: [github-actions, provider-contract, workflow-dispatch, reconciliation]

# Dependency graph
requires:
  - phase: 21-source-health-and-local-repair-players-vertical-slice
    provides: operation-aware movie repair snapshot, receipt boundary, and bounded retry contracts
  - phase: 22-dashboard-moviedetail-and-player-state-closure
    provides: task detail and source-state projections consumed by the production repair path
provides:
  - server-owned movie repair provider snapshot and exact four-field dispatch envelope
  - bounded GitHub Actions dispatch, cancel, and fixed-workflow readback validation
  - allowlisted provider projection and Phase 23 capability/source audit
affects: [23-02, 23-03, 23-04, 23-05, production-repair]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - closed provider registry derives repository, workflow, ref, target, and environment
    - provider acceptance and workflow observation remain separate from repair success
    - transport retry classification is bounded and deterministic failures stay terminal

key-files:
  created:
    - .planning/phases/23-github-actions-production-repair-and-reconciliation/23-01-SUMMARY.md
  modified:
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/provider-association.ts
    - apps/api/src/domain/crawler-tasks/__tests__/provider-association.test.ts
    - apps/api/src/lib/github-app/github-actions-client.ts
    - apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts
    - .planning/phases/23-github-actions-production-repair-and-reconciliation/COVERAGE.md

key-decisions:
  - "Bind provider snapshots to the closed registry target, crawler entrypoint, workflow, repository, ref, and environment before dispatch."
  - "Validate workflow readback against the snapshot workflow and accept only positive numeric provider run IDs."
  - "Keep provider acceptance, provider observation, receipt validation, and repair success as independent fact layers."
  - "Introduce no package or credential setup changes; the existing GitHub App installation-token boundary remains the REST boundary."

patterns-established:
  - "Dispatch projection: serialize only run_id, attempt, template, and target plus the fixed ref."
  - "Provider summary projection: allowlist metadata and rebuild the run link from the fixed repository and numeric run ID."

requirements-completed: [REP-02, REP-03]

coverage:
  - id: D1
    description: "Movie-only provider snapshot, exact dispatch input contract, and redacted provider association projection"
    requirement: REP-03
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/provider-association.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fixed GitHub Actions dispatch, cancellation, workflow-run readback, and separated provider facts"
    requirement: REP-02
    verification:
      - kind: unit
        ref: "apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bounded retry classification and deterministic snapshot, authorization, malformed-response, and run-ID failures"
    requirement: REP-02
    verification:
      - kind: unit
        ref: "pnpm --filter api exec vitest run src/lib/github-app/__tests__/github-actions-client.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 23 capability matrix and four-source planning audit with explicit Phase 24 and v2 opt-outs"
    verification:
      - kind: other
        ref: "rg -n 'INTEGRATE|OPT-OUT|REP-02|REP-03|D-01|D-17|Phase 24' .planning/phases/23-github-actions-production-repair-and-reconciliation/COVERAGE.md"
        status: pass
    human_judgment: false

# Metrics
duration: 23 min
completed: 2026-08-07
status: complete
---

# Phase 23 Plan 01: GitHub Actions Production Repair And Reconciliation Summary

**Server-owned movie repair contracts with fixed GitHub Actions dispatch, bounded provider readback, and redacted workflow evidence**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-07T11:58:02Z
- **Completed:** 2026-08-07T12:20:37Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added typed movie repair/provider contracts with exact dispatch bindings and allowlisted provider summaries.
- Hardened the existing GitHub Actions client against forged bindings, mismatched workflow readback, and non-positive provider run IDs while preserving bounded retry behavior.
- Finalized the Phase 23 capability matrix and source audit with focused verification evidence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define movie repair provider and dispatch contracts** - `8b98eca` (RED), `3fd4c71` (GREEN)
2. **Task 2: Bound GitHub Actions dispatch and workflow-run observations** - `291a75b` (RED), `84da5a8` (GREEN)
3. **Task 3: Finalize the Phase 23 capability and source audit** - `a31ed0e` (docs)

## Verification

- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/provider-association.test.ts` - 7/7 passed.
- `pnpm --filter api exec vitest run src/lib/github-app/__tests__/github-actions-client.test.ts` - 8/8 passed.
- `pnpm --filter api type-check` - passed.
- `COVERAGE.md` path and required `INTEGRATE`, `OPT-OUT`, `REP-02`, `REP-03`, `D-01`, `D-17`, and `Phase 24` rows verified.
- No package manifest or lockfile changed; no credential setup was introduced.

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/types.ts` - Phase 23 task, attempt, lease, reconciliation, receipt, and provider read model types.
- `apps/api/src/domain/crawler-tasks/provider-association.ts` - closed provider registry, dispatch builder, and fixed-link projection.
- `apps/api/src/domain/crawler-tasks/__tests__/provider-association.test.ts` - provider contract and projection regressions.
- `apps/api/src/lib/github-app/github-actions-client.ts` - fixed binding validation, bounded provider requests, and workflow readback parsing.
- `apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts` - dispatch, retry, readback, and deterministic failure regressions.
- `.planning/phases/23-github-actions-production-repair-and-reconciliation/COVERAGE.md` - capability matrix, source audit, and plan verification evidence.

## Decisions Made

- Provider identity remains server-owned and is derived from the closed registry.
- Provider acceptance and provider observation remain independent from receipt validation and repair success.
- Phase 23 stays movie-only and reuses the existing movie workflow; broader repair types remain a v2 boundary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first RED commit invocation was rejected by commitlint because PowerShell passed literal `\\n` text in the commit body. The same staged changes were committed with separate message arguments and the normal hooks passed.
- The existing user modifications in `AGENTS.md`, `CLAUDE.md`, and `.planning/STATE.md` were preserved and excluded from task commits.
- The legacy STATE layout needed canonical `state.begin-phase` initialization before `state.advance-plan` could parse the plan position; the handler retained accumulated context and enabled the normal tracking updates.

## User Setup Required

None - no external service configuration or credential setup is required for this plan.

## Self-Check: PASSED

- All key files declared in the summary exist on disk.
- All five Task 1, Task 2, and Task 3 commits are present in git history.
- `git diff --check` passed for the closeout state.

## Next Phase Readiness

- 23-02 can consume the fixed provider snapshot and dispatch envelope for shared movie workflow adapter selection.
- 23-03 can consume bounded provider failure codes and workflow observations for reconciliation and task-level retry.
- Phase 24 playback evidence remains separate and is not represented as production repair success here.

---
*Phase: 23-github-actions-production-repair-and-reconciliation*
*Plan: 01*
*Completed: 2026-08-07*
