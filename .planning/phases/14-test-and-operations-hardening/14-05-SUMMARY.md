---
phase: 14-test-and-operations-hardening
plan: "05"
subsystem: testing
tags: [vitest, deployment-target, gateway, legacy-domain-audit, target-profile]
requires:
  - phase: 14-04
    provides: Strict tracked-file legacy-domain audit and exact allowance contract
provides:
  - Resolved default-target fixtures for deployment-target and Gateway test inputs
  - Profile-derived ordinary URL assertions with only exact schema and legacy-alias exceptions
  - First zero-unclassified tracked active legacy-domain audit result
affects: [TEST-01, Phase 14 final verification, Gateway regression tests]
tech-stack:
  added: []
  patterns:
    - Ordinary test request and origin values resolve from the explicit starye-org profile.
    - Raw legacy-domain test values remain only for named schema metadata or fail-closed alias coverage.
key-files:
  created:
    - packages/config/src/deployment-target/__tests__/default-target.fixture.ts
    - apps/gateway/src/__tests__/default-target.fixture.ts
  modified:
    - packages/config/src/deployment-target/legacy-domain-audit.ts
    - packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts
    - apps/gateway/src/__tests__/cache-middleware.test.ts
    - apps/gateway/src/__tests__/routing.test.ts
key-decisions:
  - "Resolved profile data is the single ordinary default-target fixture source for config and Gateway tests."
  - "Schema metadata and fail-closed legacy aliases retain only path-and-fragment-bound audit allowances."
  - "Gateway test helpers import the config resolver as test-only source because gateway has no config package dependency."
requirements-completed: [TEST-01]
coverage:
  - id: D1
    description: Deployment-target ordinary URL inputs resolve through the named default target fixture.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run deployment-target fixture suites
        status: pass
    human_judgment: false
  - id: D2
    description: Gateway cache, routing, and dashboard guard tests construct default target requests through one helper.
    requirement: TEST-01
    verification:
      - kind: unit
        ref: pnpm --filter gateway test -- Gateway fixture suites
        status: pass
    human_judgment: false
  - id: D3
    description: Tracked active legacy-domain literals are completely classified by exact allowances.
    requirement: TEST-01
    verification:
      - kind: other
        ref: pnpm check:legacy-domain
        status: pass
    human_judgment: false
duration: 16m 25s
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 05: Default Target Test Fixture Consolidation Summary

**Resolved `starye-org` profile fixtures now supply ordinary config and Gateway test URLs, leaving only 26 exact, explained legacy-domain audit allowances.**

## Performance

- **Duration:** 16m 25s
- **Started:** 2026-07-21T04:22:12Z
- **Completed:** 2026-07-21T04:38:36Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Added a deployment-target fixture that resolves `starye-org`, and migrated ordinary config test URL/origin assertions to it.
- Kept only named schema metadata and negative legacy-alias literals in the strict audit; normal env and projection inputs are profile-derived.
- Added a Gateway request/origin fixture for cache, routing, and dashboard guard suites, then removed all four Gateway test allowlist groups.
- Reached the first full green tracked-file audit with zero unclassified active occurrences.

## Task Commits

1. **Task 1: Centralize ordinary deployment-target test URLs** - `4e126b3` (test RED), `8e320d6` (feat GREEN)
2. **Task 2: Preserve explicit schema, resolver, projection, and alias test cases** - `4c236bb` (test RED), `1c57806` (feat GREEN)
3. **Task 3: Centralize Gateway default-target request fixtures and close TEST-01** - `6e66707` (test RED), `49bcb16` (feat GREEN)

## Files Created/Modified

- `packages/config/src/deployment-target/__tests__/default-target.fixture.ts` - Resolved config-test profile and URL fixture.
- `apps/gateway/src/__tests__/default-target.fixture.ts` - Resolved Gateway request and upstream-origin fixture.
- `packages/config/src/deployment-target/legacy-domain-audit.ts` - Removes no-longer-needed config and Gateway literal allowances.
- `packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts` - Locks ordinary env/projection inputs out of the allowance set.
- Deployment-target and Gateway test suites - Preserve existing contracts using profile-derived test inputs.

## Decisions Made

- Used explicit `resolveTargetProfile('starye-org')` fixtures for ordinary test data rather than duplicate literal URL constants.
- Retained raw values only where the test proves exact schema metadata or a legacy alias fails closed; each remaining raw fragment is path-bound and explained.
- Kept the Gateway helper test-only and source-imported, avoiding an unplanned runtime dependency change to `apps/gateway/package.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Passed the selected profile into public runtime Pages materialization**
- **Found during:** Task 1 GREEN verification
- **Issue:** `materializeGeneratedEnv()` omitted the profile required by the existing fail-closed Pages materializer, causing three public-runtime contracts to fail.
- **Fix:** Passed `resolution.profile` from the already resolved test target.
- **Files modified:** `packages/config/src/deployment-target/__tests__/public-runtime-consumers.test.ts`
- **Verification:** Four Task 1 config suites passed (35 tests).
- **Committed in:** `8e320d6`

**2. [Rule 1 - Bug] Moved the audit exact-fixture unit assertion to an extant named schema fixture**
- **Found during:** Task 2 RED verification
- **Issue:** The test still expected the Task 1 remote-smoke allowance after that ordinary input was migrated to resolved profile data.
- **Fix:** Kept the exact-path audit assertion against the retained named schema metadata fixture.
- **Files modified:** `packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts`
- **Verification:** The RED suite then failed only for the intended ordinary allowance gate; final audit suite passed.
- **Committed in:** `4c236bb`

**3. [Rule 3 - Blocking] Used the gateway package script without duplicating its run flag**
- **Found during:** Task 3 RED verification
- **Issue:** The Plan command appended `--run` to `gateway`'s `vitest --run` script, which Vitest rejects as a duplicated boolean option.
- **Fix:** Ran the equivalent targeted command through the live package script without a second `--run`.
- **Files modified:** None
- **Verification:** All four Gateway suites passed (67 tests).

**4. [Rule 1 - Tracking] Reconciled the stale STATE plan counter to completed summaries**
- **Found during:** Final GSD state update
- **Issue:** `state.advance-plan` consumed a stale working-tree counter and set Current Position to `2 of 7` despite six Phase 14 summaries on disk.
- **Fix:** Used the GSD state patch handler to restore `Plan: 6 of 7`, matching ROADMAP and the actual summary count.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE and ROADMAP both report six completed Phase 14 plans.

**Total deviations:** 3 Rule 1 fixes and 1 Rule 3 command correction.

## Issues Encountered

- GitNexus marked production resolver, preflight, projection, and schema symbols HIGH/CRITICAL. The approved implementation did not modify them; final change detection remained LOW and test-only.

## Known Stubs

- `apps/gateway/src/__tests__/cache-middleware.test.ts:151` - Existing `.todo` wording documents a Phase 2 Nyquist traceability convention. It is unrelated to default-target fixtures and does not block TEST-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-01 is backed by strict tracked-file scanning with no baseline exception.
- Later Phase 14 verification can use `pnpm check:legacy-domain` as a deterministic local/CI gate.

## Self-Check: PASSED

- Confirmed the Summary, both default-target fixtures, and legacy-domain audit module exist on disk.
- Confirmed all three TDD RED/GREEN commit pairs exist in Git history.
