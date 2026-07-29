---
phase: 13-full-chain-data-smoke
plan: "13"
subsystem: testing
tags: [gateway, readiness, typescript, powershell, vitest, data-chain-smoke]

requires:
  - phase: 13-12
    provides: Immutable local Gateway-auth checkpoint diagnosis and its 300000 ms header-timeout finding
provides:
  - Bounded fixed-origin Gateway HTTP readiness probe with closed machine output
  - Strict local service-readiness parser and bounded default auth observation
  - Narrow root-script TypeScript project for readiness and data-chain owners
affects: [13-14, 13-15, 13-16, local-smoke, gateway-readiness]

tech-stack:
  added: []
  patterns:
    - Fixed canonical Gateway probes return closed non-secret outcomes only
    - Human listener diagnostics are subordinate to one versioned machine record

key-files:
  created:
    - scripts/gateway-readiness.ts
    - scripts/tsconfig.phase13-readiness.json
  modified:
    - scripts/check-services.ps1
    - scripts/data-chain-smoke.ts
    - scripts/target-profile.ts
    - packages/config/src/deployment-target/__tests__/gateway-readiness.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts

key-decisions:
  - "Canonical local readiness is three fixed Gateway HTTP routes, not a LISTENING socket or direct implementation port."
  - "The default Gateway-auth observer reuses the bounded closed probe; only accepted output authorizes downstream fixture work."
  - "The root readiness TypeScript project type-checks its transitive imports, exposing and correcting only minimal blocking type deviations."

patterns-established:
  - "Gateway readiness: fixed origin plus AbortController timeout, response-body cancellation, and closed result schema."
  - "Service trust: one exact starye-local-services-1 record and binary child status before local data-chain work."

requirements-completed: [DATA-01, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Bounded canonical Gateway readiness rejects a no-header listener and validates robots/auth/auth-slash routes.
    requirement: DATA-01
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/gateway-readiness.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local runner fail-closes on a missing, duplicate, malformed, unhealthy, or incompatible service machine record.
    requirement: TEST-05
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Readiness and runner root scripts type-check through the Phase 13 narrow TypeScript project.
    requirement: DATA-07
    verification:
      - kind: other
        ref: pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-readiness.json
        status: pass
    human_judgment: false

duration: 49min
completed: 2026-07-19
status: complete
---

# Phase 13 Plan 13: Canonical Gateway Readiness Summary

**A ten-second fixed-origin Gateway readiness contract now rejects no-header listeners and prevents local smoke from trusting human listener text.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-07-19T09:32:32Z
- **Completed:** 2026-07-19T10:21:12Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added `starye-gateway-readiness-1`: the robots endpoint must be 200, the auth root must canonically redirect to auth slash, and auth slash accepts only canonical 2xx or approved same-origin redirects.
- Bounded every default Gateway request at `GATEWAY_AUTH_TIMEOUT_MS = 10000`, clears its timer, cancels unread bodies, and emits only closed outcome names.
- Replaced listener-only service trust with exactly one `starye-local-services-1` record and an explicit binary child status; malformed or unhealthy output blocks all downstream local smoke calls.
- Added the dedicated root TypeScript project and focused regressions for timeout, redirects, cleanup, parser failures, and zero downstream calls.

## Task Commits

1. **Task 1: Define the bounded canonical Gateway readiness probe** - `32750c5` (test RED), `dda41ea` (feat GREEN)
2. **Task 2: Make check-services and the local runner trust the machine contract** - `d81d248` (test RED), `308b331` (feat GREEN)

## Files Created/Modified

- `scripts/gateway-readiness.ts` - Import-safe fixed-origin Gateway probe and one-line binary CLI.
- `scripts/check-services.ps1` - Listener diagnostics plus the authoritative combined readiness record.
- `scripts/data-chain-smoke.ts` - Strict service-machine parser, bounded closed auth wiring, and root-project type fixes.
- `scripts/tsconfig.phase13-readiness.json` - Explicit no-emit project for readiness and data-chain root scripts.
- `scripts/target-profile.ts` - Removes one unreachable Pages-surface switch case so the required narrow project type-checks.
- `packages/config/src/deployment-target/__tests__/gateway-readiness.test.ts` - No-header, redirects, cleanup, redaction, and CLI regressions.
- `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts` - Strict service machine and default auth integration regressions.

## Automated Checks

- PASS: `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/gateway-readiness.test.ts src/deployment-target/__tests__/data-chain-smoke-local.test.ts` (24/24)
- PASS: `pnpm --filter @starye/config type-check`
- PASS: `pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-readiness.json`
- PASS: `git diff --check` on all plan paths and the approved minimal type fix.
- PASS: static PowerShell parse for `scripts/check-services.ps1`.
- NOT RUN: no service start/restart, smoke run, run allocation, evidence write, browser action, provider call, schema action, or migration.

## GitNexus

- Pre-edit upstream impact was LOW for `GatewayAuthResponse`, `checkServicesDefault`, `observeGatewayAuthDefault`, `validGatewayAuth`, `runDataChainSmoke`, and `DataChainSmokeDependencies`; `validGatewayAuth` had one direct `runDataChainSmoke` caller.
- Task RED/GREEN gates were preceded by fresh `detect_changes` checks. The final Task 2 staged detection mapped the expected six-file readiness/parser/auth/type scope but reported CRITICAL because `runDataChainSmoke`, fixture, and snapshot flows are indexed broadly. The root agent issued the required warning, selected the plan's Rule 3 path, and authorized the minimal type corrections after all focused verification passed.

## Decisions Made

- `check-services` treats listener rows as diagnostics; only a healthy, exactly-shaped combined record may authorize local smoke.
- Default auth no longer returns status/location data. It delegates to the closed canonical probe, and `validGatewayAuth` accepts only `outcome: 'accepted'`.
- The `tavern` Pages switch branch was unreachable under the current `TargetPagesSurface` union. Removing it was the minimal transitive type correction required for the plan's mandatory root-script check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test type correctness] Corrected Node 25 listener typing and auth outcome inference**
- **Found during:** Task 2 verification
- **Issue:** The new readiness test selected the `createServer` options overload, while a successful auth fixture inferred an overly narrow literal outcome.
- **Fix:** Used `RequestListener` explicitly and widened the test-only closed outcome union.
- **Files modified:** `packages/config/src/deployment-target/__tests__/gateway-readiness.test.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts`
- **Verification:** Config type-check and both focused Vitest files pass.
- **Committed in:** `308b331`

**2. [Rule 3 - Blocking type check] Narrowed existing smoke unions and removed an unreachable Pages switch case**
- **Found during:** Task 2 mandatory `scripts/tsconfig.phase13-readiness.json` check.
- **Issue:** The new explicit root project exposed existing remote fixture/snapshot discriminant gaps and a pre-existing `tavern` case incompatible with `TargetPagesSurface`.
- **Fix:** Added operation guards and local item-id narrowing in the plan-owned smoke runner; after read-only blame confirmed the external case predated this plan, removed only that unreachable case. GitNexus impact for `pagesBuildArgs` was LOW (one direct caller, two processes); the root agent warned on the final CRITICAL scope detection and authorized the minimal fix.
- **Files modified:** `scripts/data-chain-smoke.ts`, `scripts/target-profile.ts`
- **Verification:** Narrow root-script type-check, config type-check, 24 focused tests, and static PowerShell parse pass.
- **Committed in:** `308b331`

**3. [Rule 3 - Blocking canonical metadata] Reconciled the stale State body after the SDK progression handler failed**
- **Found during:** Plan closeout
- **Issue:** `state.advance-plan` could not parse the repository's legacy Current Plan marker, leaving the body at Plan 12 despite the SDK's successful 21-plan progress calculation and roadmap update.
- **Fix:** Used successful SDK metric/session/progress/roadmap handlers, then synchronized only the stale Phase 13 position, completed-plan count, progress percent, and next-wave references to the on-disk plan/summary facts.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `13-13-SUMMARY.md` exists, 13 phase summary count is 13, and State now routes to 13-14 through 13-20.

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3)

## Issues Encountered

- The first RED commit message contained a literal `\n`, so commitlint rejected its overlong body line. The staged test remained intact; a compliant multi-paragraph message then committed successfully.

## Known Stubs

None - all empty collections found in the scan are local maps, arrays, or optional dependency defaults rather than rendering or evidence placeholders.

## User Setup Required

None - no external service configuration, credential, or provider operation was performed.

## Next Phase Readiness

- Later Phase 13 plans can use the versioned readiness contract; the current wedged Gateway has intentionally not been re-probed here.
- The immutable Plan 13-12 evidence remains untouched. Plan 13-16 owns supervised runtime proof and later plans own any fixture, D1, API, browser, or provider execution.

## Self-Check: PASSED

- All seven created or modified implementation/test files exist.
- All four Task 1/Task 2 RED/GREEN commits are present in git history.
