---
phase: 11-deployment-target-foundation
plan: "01"
subsystem: infra
tags: [cloudflare, deployment-target, valibot, vitest]
requires:
  - phase: v1.2-planning
    provides: Phase 11 target identity decisions D-01 through D-16
provides:
  - Strict non-secret TargetProfile schema with current starye-org fixture
  - Explicit target resolver without defaults or legacy aliases
  - Tested @starye/config package boundary for later projection and preflight plans
affects: [11-02-local-env-projection, 11-03-preflight, phase-12-cloudflare-config-switching]
tech-stack:
  added: ["valibot ^1.3.1 importer metadata for @starye/config (existing lockfile version)"]
  patterns:
    - Strict Valibot profile parsing with cross-field route and canonical URL checks
    - Explicit target selection with typed missing/unknown profile errors
key-files:
  created:
    - packages/config/src/deployment-target/target-profile.schema.ts
    - packages/config/src/deployment-target/target-profiles.ts
    - packages/config/src/deployment-target/target-resolver.ts
  modified:
    - packages/config/package.json
    - packages/config/src/deployment-target/index.ts
key-decisions:
  - "Tracked target profiles retain only stable identity and required-secret metadata; no secret values are representable."
  - "starye-org is the sole current fixture and declares local.wranglerProfile plus ci.githubEnvironment as starye-org."
  - "Target resolution requires an explicit ID; whitespace is normalized, while aliases and defaults remain unknown targets."
patterns-established:
  - "Target profile: strict object schemas require every URL surface and reject overlay or secret-value fields."
  - "Target resolver: parse the selected registry entry again before returning a TargetResolution."
requirements-completed: [PROF-01, PROF-02, PROF-03, TEST-02]
coverage:
  - id: D1
    description: Strict non-secret starye-org target profile with explicit account, domain, Worker, Pages, D1, R2, KV, route, URL, and local/CI identity metadata.
    requirement: PROF-01
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts#accepts-current-target-and-declares-resource-identity
        status: pass
    human_judgment: false
  - id: D2
    description: Profile validation rejects missing URL/resource/secret metadata and secret value fields.
    requirement: PROF-03
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts#requires-identity-and-rejects-secret-values
        status: pass
    human_judgment: false
  - id: D3
    description: Resolver requires an explicit target and rejects aliases or fallback defaults.
    requirement: PROF-02
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/target-resolver.test.ts#resolveTargetProfile
        status: pass
    human_judgment: false
  - id: D4
    description: Config package exposes focused TypeScript and Vitest validation for target profile contracts.
    requirement: TEST-02
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config test --run
        status: pass
      - kind: other
        ref: pnpm --filter @starye/config exec tsc --noEmit
        status: pass
    human_judgment: false
duration: 42min
completed: 2026-07-14
status: complete
---

# Phase 11 Plan 01: Deployment Target Package Foundation Summary

**A strict Valibot-backed `starye-org` deployment profile and explicit resolver now provide one non-secret target identity without defaults, aliases, or resource overlays.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-14T16:58:01+08:00
- **Completed:** 2026-07-14T17:39:59+08:00
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Prepared `@starye/config` with module exports, TypeScript composite build support, Node-based Vitest configuration, and the existing `valibot@^1.3.1` dependency version.
- Added a strict, non-secret profile schema and the explicit `starye-org` fixture for account, domain, URL, Worker, Pages, D1, R2, KV, route, local Wrangler, CI, and required-secret metadata.
- Added an injectable resolver that requires `--target <id>`, rejects missing input and legacy aliases, and returns a schema-validated `TargetResolution`.

## Task Commits

1. **Task 1: Prepare @starye/config as a tested deployment-target package** - `3530f25` (chore)
2. **Task 2: Define strict TargetProfile schema and current target registry** - `0b019d8` (feat)
3. **Task 3: Add explicit selected-target resolver** - `6744909` (feat)

## Files Created/Modified

- `packages/config/package.json` - package scripts, module metadata, and public entry points.
- `packages/config/tsconfig.json` and `packages/config/vitest.config.ts` - package-local build and test configuration.
- `packages/config/src/deployment-target/target-profile.schema.ts` - strict profile contract, parsing, and issue formatting.
- `packages/config/src/deployment-target/target-profiles.ts` - tracked non-secret current target registry.
- `packages/config/src/deployment-target/target-resolver.ts` - explicit target resolution and typed failures.
- `packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts` - profile and secret-boundary coverage.
- `packages/config/src/deployment-target/__tests__/target-resolver.test.ts` - selected-target and alias-rejection coverage.

## Decisions Made

- Target profiles are complete, standalone identity records; strict objects reject overlay, alias, and secret-value fields.
- `starye-org` carries both local Wrangler and CI GitHub environment identity as required by D-14/D-15.
- Resolver normalization trims an explicitly supplied ID only; it never supplies a default or interprets legacy aliases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Metadata] Restore Phase 11 ROADMAP details after progress sync**
- **Found during:** Plan metadata synchronization
- **Issue:** `roadmap.update-plan-progress` replaced the existing Goal and Requirements table cells with a legacy compact row.
- **Fix:** Restored the canonical Phase 11 goal and requirement mapping while retaining the `1/3 plans executed` progress indicator.
- **Files modified:** `.planning/ROADMAP.md`, `.planning/STATE.md`
- **Verification:** The Phase 11 roadmap retains all requirement mappings and STATE reports `2 of 3` with 33% progress.
- **Committed in:** Plan metadata commit.

**2. [Rule 3 - Blocking] Use the supported Vitest 4 command form**
- **Found during:** Task 2 and plan-level verification
- **Issue:** The planned `vitest run ... -x` command fails because Vitest 4.1.4 no longer accepts `-x`.
- **Fix:** Ran the equivalent non-watch `vitest run` commands without `-x`.
- **Files modified:** None
- **Verification:** Focused suites passed 12/12 tests, and `pnpm --filter @starye/config test --run` passed.
- **Committed in:** Not applicable; verification-only adjustment.

---

**Total deviations:** 2 auto-fixed (1 metadata correction, 1 blocking verification command compatibility issue).
**Impact on plan:** No runtime implementation scope changed; all intended test coverage ran under the installed Vitest version.

## Issues Encountered

- The newly declared workspace dependency was already in the lockfile but not linked into the local package directory. An offline `pnpm install` rebuilt the existing lockfile links without adding or upgrading packages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-02 can consume `@starye/config/deployment-target` to project target-managed values into final local env files.
- Plan 11-03 can reuse the resolver error categories and parsed profile for fail-closed preflight checks.
- `PROF-02`, `PROF-03`, and `TEST-02` remain pending in the phase requirements ledger until Plan 11-03 completes the preflight coverage they also require.

## Self-Check: PASSED

---
*Phase: 11-deployment-target-foundation*
*Completed: 2026-07-14*
