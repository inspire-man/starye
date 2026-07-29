---
phase: 14-test-and-operations-hardening
plan: "01"
subsystem: deployment-target
tags: [target-profile, pages, redirects, valibot, vitest]
requires:
  - phase: 11-deployment-target-foundation
    provides: Explicit non-secret TargetProfile resolution and validation.
provides:
  - Profile-owned direct Pages origin metadata for all closed Pages surfaces.
  - Pure strict redirect rendering with closed per-surface templates.
affects: [14-02-pages-materialization, target-deploy, target-profile]
tech-stack:
  added: []
  patterns:
    - Closed redirect templates interpolate only resolved TargetProfile metadata.
    - Direct Pages origins are validated as unique HTTPS origins at parse time.
key-files:
  created:
    - packages/config/src/deployment-target/pages-redirects.ts
    - packages/config/src/deployment-target/__tests__/pages-redirects.test.ts
  modified:
    - packages/config/src/deployment-target/target-profile.schema.ts
    - packages/config/src/deployment-target/target-profiles.ts
    - packages/config/src/deployment-target/index.ts
key-decisions:
  - "TargetProfile.pages[*].directOrigin is the sole selected-target source for Pages direct origins."
  - "Renderer templates are closed by surface and render only profile-owned direct and Gateway origins."
patterns-established:
  - "Parse-time profile invariants reject missing, insecure, path-bearing, or cross-surface Pages origins."
  - "Redirect renderer validates template identity and rendered origins before producing text."
requirements-completed: [TEST-01]
coverage:
  - id: D1
    description: "TargetProfile validates explicit direct Pages origins for all five closed surfaces."
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "packages/config/src/deployment-target/__tests__/pages-redirects.test.ts#TargetProfile Pages direct origins"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure renderer preserves all Pages redirect and SPA fallback contracts while rejecting hostile templates."
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "packages/config/src/deployment-target/__tests__/pages-redirects.test.ts#Pages redirect renderer"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/config type-check"
        status: pass
    human_judgment: false
duration: 11m 8s
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 01: Profile-Owned Pages Redirects Summary

**Selected TargetProfile metadata now owns five direct Pages origins, and a strict pure renderer emits their canonical Gateway redirects without accepting caller-supplied hosts.**

## Performance

- **Duration:** 11m 8s
- **Started:** 2026-07-21T09:26:48+08:00
- **Completed:** 2026-07-21T09:37:56+08:00
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Added a non-secret `directOrigin` for dashboard, auth, blog, movie, and comic to the resolved `TargetProfile`, with parse-time HTTPS, origin-shape, canonical-link, and cross-surface checks.
- Added a closed per-surface redirect renderer that uses only validated profile metadata and retains the existing direct-origin routes and SPA fallbacks.
- Added contract tests for every Pages surface plus malformed profile and hostile template inputs, with no deployment, credential, or provider operation.

## Task Commits

1. **Task 1: Define canonical typed Pages origin metadata and its invariant**
   - `c59e0e4` `test(14-01): add failing Pages origin tests`
   - `e7d78cd` `feat(14-01): add profile-owned Pages origins`
2. **Task 2: Add the strict pure Pages redirect renderer**
   - `f1ef807` `test(14-01): add redirect renderer contract`
   - `3bdddb3` `feat(14-01): add strict Pages redirect renderer`

## Files Created/Modified

- `packages/config/src/deployment-target/target-profile.schema.ts` - Validates unique HTTPS direct origins as part of a complete TargetProfile.
- `packages/config/src/deployment-target/target-profiles.ts` - Records all five explicit `starye-org` Pages direct origins, including the non-derivable Blog host.
- `packages/config/src/deployment-target/pages-redirects.ts` - Renders and validates closed redirect templates from profile-owned origins.
- `packages/config/src/deployment-target/index.ts` - Exposes the typed redirect renderer through the deployment-target package boundary.
- `packages/config/src/deployment-target/__tests__/pages-redirects.test.ts` - Covers profile invariants, all redirect contracts, and hostile template rejection.
- `packages/config/src/deployment-target/__tests__/target-projections.test.ts` - Keeps the alternate selected-target fixture complete under the promoted profile contract.

## Decisions Made

- `directOrigin` remains explicit profile data rather than a value derived from a Pages project name; Blog proves the two values are intentionally independent.
- The renderer's only dynamic values are the selected surface's `directOrigin` and the resolved profile's Gateway URL. Static per-surface paths preserve the existing routing contract.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/pages-redirects.test.ts src/deployment-target/__tests__/target-profile.schema.test.ts` - passed, 12/12 tests.
- `pnpm --filter @starye/config type-check` - passed.
- `npx gitnexus detect-changes --repo starye --scope all` - completed before every task commit; no unexpected high-risk deployment-target flow was introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accepted template placeholders were incorrectly treated as unresolved.**
- **Found during:** Task 2
- **Issue:** The strict parser checked for placeholder delimiters without first removing validated tokens, rejecting every normal renderer request.
- **Fix:** Check only delimiter syntax left after known placeholders are removed.
- **Files modified:** `packages/config/src/deployment-target/pages-redirects.ts`
- **Verification:** Redirect renderer contract tests pass for all five surfaces and hostile inputs.
- **Committed in:** `3bdddb3`

**2. [Rule 1 - Type contract] Alternate profile fixture omitted the newly required direct origins.**
- **Found during:** Task 2 type-check
- **Issue:** `target-projections.test.ts` constructs a standalone TargetProfile fixture, so the promoted required field caused the package type-check to fail.
- **Fix:** Added the same explicit non-secret origin metadata to all five alternate Pages fixtures.
- **Files modified:** `packages/config/src/deployment-target/__tests__/target-projections.test.ts`
- **Verification:** `pnpm --filter @starye/config type-check` passes.
- **Committed in:** `3bdddb3`

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs).
**Impact on plan:** Both fixes are direct consequences of the promoted profile invariant and strict renderer; no scope expansion or remote operation occurred.

## Issues Encountered

- GitNexus index refresh logged a pre-existing scope-extraction warning for `apps/dashboard/src/views/__test__/Actors.test.ts`. It is deferred in `deferred-items.md` because it is outside this deployment-target plan.

## User Setup Required

None - no external configuration, provider command, or credential is required.

## Next Phase Readiness

Plan 14-02 can consume `renderPagesRedirects` to create run-scoped generated redirect inputs and atomically materialize build output. This plan intentionally did not modify tracked `public/_redirects` files.

---
*Phase: 14-test-and-operations-hardening*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All six Plan 14-01 implementation/test files, the summary, and the deferred-items record exist.
- All four TDD commits (`c59e0e4`, `e7d78cd`, `f1ef807`, `3bdddb3`) exist in Git history.
