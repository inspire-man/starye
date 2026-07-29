---
phase: 14-test-and-operations-hardening
plan: "03"
subsystem: infra
tags: [github-actions, cloudflare-pages, target-profile, vitest]
requires:
  - phase: 14-test-and-operations-hardening
    provides: Run-scoped Pages redirect inputs and a prepared output path from Plan 14-02.
provides:
  - All five Pages deployment workflows pass and clean their prepared redirect input path.
  - Inventory-wide static coverage for Pages-only redirect handoff.
affects: [Phase 14 operations hardening, Pages deployment workflows]
tech-stack:
  added: []
  patterns:
    - "Pages builds consume only steps.prepare.outputs paths, including pages_redirect_input_path."
    - "Run-scoped redirect inputs are removed by always-run workflow cleanup."
key-files:
  created: []
  modified:
    - .github/workflows/deploy-auth.yml
    - .github/workflows/deploy-blog.yml
    - .github/workflows/deploy-dashboard.yml
    - .github/workflows/deploy-movie.yml
    - .github/workflows/deploy-comic.yml
    - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
key-decisions:
  - "Every Pages workflow passes pages_redirect_input_path directly from its single prepare step and removes it under if: always()."
  - "The workflow inventory test rejects redirect-input usage outside Pages workflows while retaining existing resolver and public-environment boundaries."
patterns-established:
  - "CI Pages handoff: run-pages-build receives pages_build_env_path plus pages_redirect_input_path from steps.prepare.outputs."
requirements-completed: [TEST-01]
coverage:
  - id: D1
    description: Five Pages GitHub Actions workflows consume and clean selected-target redirect inputs under static contract coverage.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/workflow-contract.test.ts
        status: pass
    human_judgment: false
duration: 9m
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 03: Pages Redirect Input Workflow Handoff Summary

**All five Pages deployment workflows now build from and clean the selected-target redirect input produced by their single CI preparation step.**

## Performance

- **Duration:** 9m
- **Started:** 2026-07-21T03:18:55Z
- **Completed:** 2026-07-21T03:27:42Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Auth and Blog Pages builds pass `steps.prepare.outputs.pages_redirect_input_path` to `run-pages-build` and remove it under `if: always()`.
- Dashboard, Movie, and Comic apply the same selected-target handoff without changing their surface selectors, project outputs, or public environment boundary.
- The inventory contract independently requires all five Pages workflows to hand off and clean redirect inputs, while Worker, prepared-entry, and rollback workflows remain excluded.

## Task Commits

1. **Task 1: Pass prepared redirect input through Auth and Blog deployments** - `77ecb76` (feat)
2. **Task 2: Pass prepared redirect input through Dashboard, Movie, and Comic deployments** - `7c75018` (feat)
3. **Task 3: Enforce the all-five-workflow redirect handoff contract** - `c6f483a` (test)

## Files Created/Modified

- `.github/workflows/deploy-auth.yml` - passes and cleans the prepared Auth redirect input.
- `.github/workflows/deploy-blog.yml` - passes and cleans the prepared Blog redirect input.
- `.github/workflows/deploy-dashboard.yml` - passes and cleans the prepared Dashboard redirect input.
- `.github/workflows/deploy-movie.yml` - passes and cleans the prepared Movie redirect input.
- `.github/workflows/deploy-comic.yml` - passes and cleans the prepared Comic redirect input.
- `packages/config/src/deployment-target/__tests__/workflow-contract.test.ts` - proves the complete Pages-only handoff inventory.

## Decisions Made

- Prepared redirect input paths are treated as run-scoped build artifacts: every Pages workflow passes the exact output from `steps.prepare` and includes it in its always-run cleanup.
- The new assertion checks the closed inventory and exact build handoff, leaving the existing resolver, secret, public-variable, and single-prepare contracts intact.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first Task 1 commit body encoded newline escapes as a single overlong line and was rejected by commitlint. The same scoped content was immediately committed with compliant body lines.

## User Setup Required

None - no provider, credential, deploy, migration, crawl, smoke, or network operation was run.

## Next Phase Readiness

The selected-target redirect artifact is now consistently handed from CI preparation into all Pages builds, with static inventory coverage preventing a fallback to tracked redirect sources or inline default domains.

---
*Phase: 14-test-and-operations-hardening*
*Completed: 2026-07-21*

## Self-Check: PASSED

- Found the summary and all six planned workflow/test files.
- Found Task 1, Task 2, and Task 3 commits in Git history.
