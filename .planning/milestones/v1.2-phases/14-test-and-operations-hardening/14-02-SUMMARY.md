---
phase: 14-test-and-operations-hardening
plan: "02"
subsystem: deployment-target
tags: [pages, redirects, target-profile, vitest, local-build]
requires:
  - phase: 14-test-and-operations-hardening
    provides: Profile-owned Pages direct origins and strict pure redirect rendering from Plan 14-01.
provides:
  - Run-scoped, profile-validated Pages redirect inputs with cleanup ownership.
  - Prepared Pages handoffs that serialize only a validated redirect-input path.
  - Closed local Pages build output mapping with atomic final redirect writes after successful builds.
affects: [14-03-pages-workflows, target-deploy, target-profile, deployment-target]
tech-stack:
  added: []
  patterns:
    - Pages redirect inputs use fixed runId and surface-derived filenames below a declared run directory.
    - Local Pages output uses a closed surface-to-dist mapping and a temporary-file rename after both builds succeed.
key-files:
  created: []
  modified:
    - packages/config/src/deployment-target/deploy-config.ts
    - packages/config/src/deployment-target/pages-redirects.ts
    - packages/config/src/deployment-target/mutation-entry.ts
    - scripts/target-profile.ts
    - scripts/target-deploy.ts
    - packages/config/src/deployment-target/__tests__/deploy-config.test.ts
    - packages/config/src/deployment-target/__tests__/mutation-entry.test.ts
    - packages/config/src/deployment-target/__tests__/target-deploy.test.ts
key-decisions:
  - "Only a resolved TargetProfile can render or validate a materialized redirect input; callers cannot supply redirect origins."
  - "Prepared Pages JSON and GitHub output expose one fixed run-directory redirect path and never serialize secret values."
  - "The local CLI derives its allowed run directory from the repository, then writes only the selected surface's dist/_redirects via temporary-file rename."
patterns-established:
  - "Build failures clear the selected surface's final redirect output, while materialization and preparation failures invoke cleanup."
requirements-completed: [TEST-01]
coverage:
  - id: D1
    description: Selected target redirects materialize below the run directory, validate against the strict profile renderer, and clean up with generated deploy inputs.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "packages/config/src/deployment-target/__tests__/deploy-config.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: Prepared Pages handoff accepts only the fixed run-contained redirect input and keeps secrets out of JSON and GitHub output.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "packages/config/src/deployment-target/__tests__/mutation-entry.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Local Pages builds reparse generated redirects and write the final artifact only after API types and app builds both pass.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "packages/config/src/deployment-target/__tests__/target-deploy.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/config type-check"
        status: pass
    human_judgment: false
duration: 23m 9s
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 02: Pages Redirect Materialization Summary

**Selected-target Pages redirects now move through validated run-scoped inputs and become a closed dist artifact only after successful local builds.**

## Performance

- **Duration:** 23m 9s
- **Started:** 2026-07-21T02:46:30Z
- **Completed:** 2026-07-21T03:10:44Z
- **Tasks:** 3/3
- **Files modified:** 13

## Accomplishments

- Materialized a strict Profile-owned redirect input next to the generated Pages build env, with exact fixed filename validation and cleanup ownership.
- Propagated the contained input through prepared Pages JSON and GitHub output while rejecting fake materializers that return an outside path.
- Added a dedicated local build argument, re-parsed the selected target input, and atomically wrote each closed Pages surface's `dist/_redirects` only after API types and app builds passed.
- Removed all five tracked `public/_redirects` sources from Auth, Blog, Dashboard, Movie, and Comic.

## Task Commits

1. **Task 1: Materialize and clean a contained redirect input**
   - `6f76681` `test(14-02): add failing redirect input contract`
   - `5f77fe4` `feat(14-02): materialize contained Pages redirects`
2. **Task 2: Carry redirect input through prepared CI materialization**
   - `f370fb6` `test(14-02): add failing prepared redirect handoff tests`
   - `f8daac0` `feat(14-02): pass validated Pages redirect inputs`
3. **Task 3: Atomically place redirects after successful local Pages builds**
   - `4d91204` `test(14-02): add failing Pages redirect build tests`
   - `a1278fa` `feat(14-02): atomically write Pages redirects after builds`

## Files Created/Modified

- `packages/config/src/deployment-target/deploy-config.ts` - Adds redirect-input materialization, exact run-directory validation, and failure cleanup.
- `packages/config/src/deployment-target/pages-redirects.ts` - Re-parses generated redirect content against the selected target profile.
- `packages/config/src/deployment-target/mutation-entry.ts` - Validates and serializes prepared Pages redirect paths without secrets.
- `scripts/target-profile.ts` - Accepts the closed redirect CLI argument, revalidates it, and writes a final surface artifact only after successful builds.
- `scripts/target-deploy.ts` - Passes profile-owned redirect input as a dedicated local build argument inside the existing finally cleanup path.
- `packages/config/src/deployment-target/__tests__/deploy-config.test.ts` - Covers contained input, strict parsing, unknown surfaces, and cleanup.
- `packages/config/src/deployment-target/__tests__/mutation-entry.test.ts` - Covers prepared JSON/output propagation, outside-path rejection, secrecy, and cleanup ownership.
- `packages/config/src/deployment-target/__tests__/target-deploy.test.ts` - Covers build argv, successful final placement, both failure outcomes, child-env secrecy, and path validation.
- `apps/{auth,blog,dashboard,movie-app,comic-app}/public/_redirects` - Removed tracked default-domain redirect sources.

## Decisions Made

- Redirect text is accepted only when it exactly matches the strict renderer result for the selected target profile and Pages surface.
- `run-pages-build` has no caller-provided output directory; the production CLI always derives its allowed run directory and final dist path from the repository-owned closed mappings.
- The final redirect is cleared on either prerequisite build failure, preventing a stale deployed artifact from remaining after an unsuccessful run.

## TDD Evidence

- RED commits: `6f76681`, `f370fb6`, and `4d91204` each recorded a focused failing contract before source implementation.
- GREEN commits: `5f77fe4`, `f8daac0`, and `a1278fa` satisfy the corresponding contracts.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/deploy-config.test.ts src/deployment-target/__tests__/pages-redirects.test.ts src/deployment-target/__tests__/mutation-entry.test.ts src/deployment-target/__tests__/target-deploy.test.ts` - passed, 31/31 tests.
- `pnpm --filter @starye/config type-check` - passed.
- `git diff --check` - passed.
- `npx gitnexus detect-changes --repo starye --scope all` - run before every task commit; final critical classification was limited to the disclosed local Pages build and target deploy flow changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Cleanup lifecycle] Clean up transient generated inputs after materialization or prepared-output failure.**
- **Found during:** Task 1 and Task 2.
- **Issue:** The prior materializer and preparation flow removed returned inputs only through caller cleanup, so a thrown write/validation error could leave transient generated files behind.
- **Fix:** Wrapped materialization and prepared-output construction in cleanup-owning error paths.
- **Files modified:** `packages/config/src/deployment-target/deploy-config.ts`, `packages/config/src/deployment-target/mutation-entry.ts`.
- **Verification:** Focused deploy-config and mutation-entry tests pass, including fake outside-path rejection and cleanup assertions.
- **Committed in:** `5f77fe4`, `f8daac0`.

**2. [Rule 1 - Test fixture] Corrected the fake Pages ownership response and parsed prepared JSON before asserting Windows paths.**
- **Found during:** Task 2 RED/GREEN validation.
- **Issue:** The generic fake executor returned the `pages project list` command token instead of the selected project, and a raw JSON assertion did not account for Windows backslash escaping.
- **Fix:** Returned the selected Dashboard project from the Pages fake and asserted the parsed JSON field.
- **Files modified:** `packages/config/src/deployment-target/__tests__/mutation-entry.test.ts`.
- **Verification:** The focused mutation-entry suite passes with path containment and secrecy checks.
- **Committed in:** `f370fb6`, `f8daac0`.

**Total deviations:** 2 auto-fixed (1 Rule 2 lifecycle correction, 1 Rule 1 test correction).
**Impact on plan:** Both changes directly enforce the planned cleanup and offline validation guarantees; no remote execution or scope expansion occurred.

## Issues Encountered

- The first Task 1 GREEN commit message encoded PowerShell newline escapes as one overlong body line. A retry with separate commit body paragraphs produced the same scoped commit content.
- GitNexus classified the final script flow change as critical. Its affected symbols were limited to the three Task 3 entrypoints already disclosed before implementation; 31 focused tests and config type-check passed.

## Known Stubs

None. The placeholder syntax found in `pages-redirects.ts` is the validated renderer grammar, not a runtime stub.

## User Setup Required

None - no provider, credential, deploy, migrate, crawl, smoke, browser, or network operation was run.

## Next Phase Readiness

Plan 14-03 can consume the prepared `pages_redirect_input_path` contract for the five Pages workflow handoffs. All tracked redirect source files are gone; final artifacts are generated solely from the selected target profile.

---
*Phase: 14-test-and-operations-hardening*
*Completed: 2026-07-21*

## Self-Check: PASSED

- Found the summary and all six key implementation files.
- Found all six Task 1-3 TDD commits in Git history.
- Confirmed all five tracked `public/_redirects` sources are removed.
