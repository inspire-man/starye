---
phase: 12-cloudflare-config-switching
plan: "01"
subsystem: infra
tags: [cloudflare, deployment-target, wrangler, vitest, github-actions]
requires:
  - phase: 11-deployment-target-foundation
    provides: Explicit TargetProfile resolution, local projection validation, and initial preflight gates.
provides:
  - Typed public, deploy, and workflow projections with target-neutral Wrangler templates.
  - Run-scoped deploy materialization and fail-closed local/CI/remote mutation gates.
  - Read-only Worker, Pages, D1, R2, and KV ownership checks using injected argv executors.
affects: [12-02-runtime-consumers, 12-03-workflows, 12-04-direct-entry-audit]
tech-stack:
  added: []
  patterns: [typed target projection, run-scoped config materialization, argv-only resource checks, closed mutation registry]
key-files:
  created:
    - packages/config/src/deployment-target/deploy-config.ts
    - packages/config/src/deployment-target/mutation-entry.ts
    - scripts/target-deploy.ts
    - scripts/target-remote-entry.ts
  modified:
    - packages/config/src/deployment-target/preflight.ts
    - packages/config/src/deployment-target/live-checks.ts
    - scripts/target-profile.ts
key-decisions:
  - "Pages project identity remains deploy-only and is selected from a closed TargetPagesSurface vocabulary."
  - "CI and remote preflight never reads operator-owned local projection files; local deploy performs its own profile/read-only gate."
  - "Remote mutation children receive a fresh allowlisted environment and closed registry entry rather than caller argv or ambient target identity."
patterns-established:
  - "All deployable Cloudflare identity is derived from TargetResolution and materialized into run-scoped files."
  - "Read-only resource checks use injected argv executors and redact provider output from errors."
requirements-completed: [ENV-03, ENV-04, ENV-05, DEPL-01, DEPL-02, TEST-04]
coverage:
  - id: D1
    description: Typed browser/deploy/workflow target projections and public allowlists.
    requirement: ENV-03
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config test --run src/deployment-target
        status: pass
    human_judgment: false
  - id: D2
    description: Run-scoped Worker/Pages materialization and closed local deploy path.
    requirement: DEPL-01
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/deploy-config.test.ts
        status: pass
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/target-deploy.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Scope-aware CI/remote preflight and closed remote mutation preparation.
    requirement: TEST-04
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/preflight.test.ts
        status: pass
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/live-checks.test.ts
        status: pass
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/mutation-entry.test.ts
        status: pass
    human_judgment: false
duration: 2h 10m
completed: 2026-07-15
status: complete
---

# Phase 12 Plan 01: Cloudflare Config Switching Summary

**Selected TargetProfile now drives typed public/deploy/workflow projections, run-scoped Wrangler inputs, and fail-closed local, CI, and remote mutation gates without Cloudflare remote execution.**

## Performance

- **Duration:** 2h 10m
- **Tasks:** 3 completed
- **Files modified:** 27
- **Verification:** 75 deployment-target tests, `tsc --noEmit`, and `pnpm target-profile validate --target starye-org` all pass.

## Accomplishments

- Reconciled Blog Pages identity to `blog-pages`; exported public/deploy/workflow projections with strict Vite/Nuxt allowlists.
- Replaced singleton Worker/Pages identities with target-neutral templates and same-directory run-scoped generated configs.
- Added scope-aware preflight, argv-only Worker/Pages/D1/R2/KV read checks, CI output preparation, and a closed remote-entry registry.

## Task Commits

1. **Task 1: Strict projections** - `676147e` (`feat(config): add target projections`, pre-existing at executor start)
2. **Task 2: Deploy config materialization** - `a530ddd` (`feat(12-01): materialize selected deploy config`)
3. **Task 3: CI/remote mutation gate** - `9f70503` (`feat(12-01): gate remote target mutations`)

## Decisions Made

- Browser contracts contain only public target identity, gateway/API bases, and app paths; Pages/Worker origins and resources remain deploy-only.
- Pages deploy input is selected only by closed surface vocabulary, never caller project/build values.
- CI/remote does not inspect local `.dev.vars` or `.env`; local deploy separately requires selected Wrangler profile plus readonly ownership checks.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Verification path] Corrected test commands to include `__tests__`.**
- **Found during:** Task 1
- **Issue:** Plan commands named files below `src/deployment-target/`, while Vitest files live below `src/deployment-target/__tests__/`; the original command returned no tests with exit code 0.
- **Fix:** Used the exact `__tests__` paths for all task and plan verification.
- **Verification:** Focused and full deployment-target suites ran real tests.

2. **[Rule 1 - Windows assertion] Preserved the user deploy-config test while making its path assertion platform-safe.**
- **Found during:** Task 2
- **Issue:** The pre-existing Windows test embedded an absolute path in a regular expression, so a correct backslash path could not match.
- **Fix:** Retained every behavior assertion and checked dirname/basename explicitly; also added the Node type reference required by package `tsc`.
- **Files modified:** `packages/config/src/deployment-target/__tests__/deploy-config.test.ts`
- **Verification:** Deploy config tests pass on Windows.
- **Committed in:** `a530ddd`

3. **[Rule 2 - Scope boundary] Prevented CI/remote preflight from reading local operator files.**
- **Found during:** Task 3
- **Issue:** CLI preflight collected local projection issues regardless of scope, so an empty CI checkout could never satisfy the intended credentialed gate.
- **Fix:** Local projection validation now runs only for `scope=local`; a regression fixture proves CI empty roots do not report missing local files.
- **Files modified:** `scripts/target-profile.ts`, `packages/config/src/deployment-target/__tests__/preflight.test.ts`
- **Verification:** Focused preflight tests pass.
- **Committed in:** `9f70503`

4. **[Rule 3 - Metadata compatibility] Repaired stale Phase 12 STATE fields after the SDK advance handler could not parse them.**
- **Found during:** Plan closeout
- **Issue:** `state.advance-plan` requires a numeric current-plan field, while the canonical file still said `Plan: Not started` despite an executable four-plan Phase 12.
- **Fix:** Used successful SDK roadmap/requirements/progress handlers, then synchronized only the stale STATE current-plan, progress, and session fields.
- **Verification:** ROADMAP shows `12 | 1/4 | In Progress`; REQUIREMENTS marks this plan's six IDs complete.

**Total deviations:** 4 auto-fixed. **Impact:** All corrections preserve the closed target contract and remain within Plan 12-01.

## Issues Encountered

- Task 1 was already committed as `676147e` before this executor began. Its RED baseline therefore passed unexpectedly; the commit was preserved and treated as the pre-existing Task 1 production commit rather than being rewritten.
- `deploy-config.test.ts` was a pre-existing user WIP. Its assertions were fully preserved and it was included only with the complete Task 2 implementation in `a530ddd`.

## User Setup Required

None - this plan uses fake executors and fixtures only. No Cloudflare credentials or remote changes were used.

## Next Phase Readiness

- Plan 12-02 can adopt the typed public/runtime projection in API, Gateway, Vite, and Nuxt consumers.
- Plans 12-03 and 12-04 can consume the fixed CI preparation and remote-entry seams without introducing a parallel target source.

## Self-Check: PASSED

- Task commits `676147e`, `a530ddd`, and `9f70503` exist.
- All key modules and focused tests exist on disk.
- No uncommitted implementation file remains; only the three protected user files are dirty.

---
*Phase: 12-cloudflare-config-switching*
*Completed: 2026-07-15*
