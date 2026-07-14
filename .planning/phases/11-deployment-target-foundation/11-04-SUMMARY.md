---
phase: 11-deployment-target-foundation
plan: "04"
subsystem: infra
tags: [deployment-target, env, preflight, cli, vitest]
requires:
  - phase: 11-02
    provides: Four-file local env projection and target-managed ownership model
  - phase: 11-03
    provides: Fail-closed target preflight and argv-only live resource checks
provides:
  - Line-exact, unique target-managed env markers that preserve operator content
  - CLI preflight validation of all four local projection consumers, including secret-key presence
  - Target/resource-identifying, non-secret live-check diagnostics
affects: [phase-12-cloudflare-config-switching, phase-13-full-chain-data-smoke, phase-14-test-and-operations-hardening]
tech-stack:
  added: []
  patterns:
    - Marker-like text is inert unless it occupies exactly one complete marker line.
    - Preflight reads every locked local consumer under --env-root before allowing a local command.
    - Live-check errors use selected profile metadata only and never executor output.
key-files:
  created: []
  modified:
    - packages/config/src/deployment-target/env-file-block.ts
    - packages/config/src/deployment-target/projection-plan.ts
    - packages/config/src/deployment-target/preflight.ts
    - packages/config/src/deployment-target/live-checks.ts
    - scripts/target-profile.ts
    - packages/config/src/deployment-target/__tests__/env-file-block.test.ts
    - packages/config/src/deployment-target/__tests__/preflight.test.ts
    - packages/config/src/deployment-target/__tests__/live-checks.test.ts
key-decisions:
  - "Only exactly one ordered pair of full marker lines authorizes managed-block replacement; all ambiguous topology fails before cleanup."
  - "CLI preflight validates all four selected local projection files and reports only non-secret file, key, and expected identity metadata."
  - "Read-only resource failures name target and configured D1/R2/KV identity without exposing executor output."
patterns-established:
  - "CLI projection tests create isolated roots with runtime-loaded Node filesystem helpers, keeping the config package type boundary unchanged."
requirements-completed: [PROF-02, PROF-03, ENV-02, TEST-02]
coverage:
  - id: D1
    description: Marker updates reject ambiguous topology before changing operator-managed local env content.
    requirement: TEST-02
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/env-file-block.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local CLI preflight verifies exactly four consumer files and blocks missing files, malformed markers, wrong managed values, and missing secret keys without revealing values.
    requirement: ENV-02
    verification:
      - kind: integration
        ref: packages/config/src/deployment-target/__tests__/preflight.test.ts and self-contained --env-root CLI fixture
        status: pass
    human_judgment: false
  - id: D3
    description: Read-only live resource failures identify the selected target and resource while redacting executor output.
    requirement: PROF-03
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/live-checks.test.ts
        status: pass
    human_judgment: false
duration: 27min
completed: 2026-07-14
status: complete
---

# Phase 11 Plan 04: Deployment Target Validation Gaps Summary

**Managed env updates now reject ambiguous marker text, preflight proves the complete selected local projection, and live-check errors identify only non-secret target resources.**

## Performance

- **Duration:** 27 min
- **Completed:** 2026-07-14T23:53:07+08:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Replaced substring marker detection with line-aware unique-pair validation before any stale-key cleanup.
- Wired `target-profile preflight` to all four locked local env consumers under `--env-root` (or repository root), including required user-managed secret-key presence.
- Added selected target and configured D1/R2/KV identities to live-check failures without including executor output or credential material.

## Task Commits

1. **Task 1: Make target-managed block recognition line-exact, unique, and fail closed** - `e671b84` (fix)
2. **Task 2: Feed complete four-file projection validation into explicit-scope CLI preflight** - `3e61ac1` (fix), `f480f25` (test)
3. **Task 3: Identify failing live resources without exposing credentials** - `1f4b6ee` (fix)

## Files Created/Modified

- `packages/config/src/deployment-target/env-file-block.ts` - line-aware marker parser and malformed-topology gate.
- `packages/config/src/deployment-target/projection-plan.ts` - typed missing-file and malformed-marker projection issues.
- `packages/config/src/deployment-target/preflight.ts` - non-secret projection diagnostics.
- `packages/config/src/deployment-target/live-checks.ts` - target/resource-specific read-check failures.
- `scripts/target-profile.ts` - complete local projection evidence collection for preflight.
- `packages/config/src/deployment-target/__tests__/*.test.ts` - marker, CLI fixture, and redaction regressions.

## Decisions Made

- A marker substring in an operator comment or secret is inert; only an exact whole line is a marker.
- Missing or malformed projection files are typed blocking preflight evidence, never silently treated as empty successful input.
- Diagnostics may name selected target/resource identifiers but never read-check output or secret values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Keep config test compilation inside its package type boundary**
- **Found during:** Task 2 verification.
- **Issue:** The plan-required Node filesystem imports in a config-package test failed its TypeScript compilation because Node types are not part of that package's test boundary.
- **Fix:** Loaded the Node test helpers at runtime while retaining `mkdtemp`, `mkdir`, and `writeFile` fixture coverage.
- **Files modified:** `packages/config/src/deployment-target/__tests__/preflight.test.ts`
- **Verification:** Focused test and `pnpm --filter @starye/config exec tsc --noEmit` pass.
- **Committed in:** `f480f25`

---

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** No dependency, runtime consumer, remote mutation, or workflow scope was added.

## Issues Encountered

- The plan's PowerShell malformed-marker fixture used `Add-Content` against content without a trailing newline, producing a marker substring appended to a secret rather than an actual marker line. The corrected fixture explicitly appends a newline first; this preserves D-08's required substring safety.

## User Setup Required

None - no remote command ran with credentials and no external service configuration changed.

## Next Phase Readiness

- Phase 11 gap requirements are covered by automated unit/integration checks and a self-contained CLI fixture.
- Phase verification can now re-check the original D-08, D-09/D-10/ENV-02, and live-check audit-identity blockers before Phase 12 begins.

## Self-Check: PASSED

---
*Phase: 11-deployment-target-foundation*
*Completed: 2026-07-14*
