---
phase: 11-deployment-target-foundation
plan: "02"
subsystem: infra
tags: [deployment-target, dotenv, vitest, local-env]
requires:
  - phase: 11-01
    provides: Explicit non-secret TargetResolution and starye-org profile fixture
provides:
  - Explicit target-to-local-env projection for API, gateway, root, and crawler consumers
  - Marker-aware managed block replacement that preserves operator-managed local values
affects: [11-03-preflight, phase-12-cloudflare-config-switching]
tech-stack:
  added: []
  patterns:
    - Explicit TargetResolution drives every local env projection; no implicit target default exists.
    - Marker-aware updates remove only allowlisted target-managed keys and preserve user-managed lines byte-for-byte outside markers.
key-files:
  created:
    - packages/config/src/deployment-target/projection-plan.ts
    - packages/config/src/deployment-target/env-file-block.ts
    - packages/config/src/deployment-target/__tests__/projection-plan.test.ts
    - packages/config/src/deployment-target/__tests__/env-file-block.test.ts
  modified:
    - packages/config/src/deployment-target/index.ts
key-decisions:
  - "The only modeled consumer files are apps/api/.dev.vars, apps/gateway/.dev.vars, .env.local, and packages/crawler/.env."
  - "Browser public API values remain http://localhost:8080 locally, while target identity, origin, and resource metadata comes from the explicit resolution."
  - "User-managed secrets are validated by key name only and are never projected, deleted, or represented by placeholder values."
patterns-established:
  - "Projection: build a complete typed plan before validating or updating local env content."
  - "Env update: replace the marker region in place, then remove only named managed residue outside it."
requirements-completed: [PROF-02, PROF-03, ENV-01, ENV-02, TEST-02]
coverage:
  - id: D1
    description: Explicit target resolution produces a deterministic projection for exactly four existing local env consumers without public direct-port URLs.
    requirement: ENV-01
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/projection-plan.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Marker-aware env block replacement preserves user-managed values and removes only known stale managed keys.
    requirement: ENV-02
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/env-file-block.test.ts
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-07-14
status: complete
---

# Phase 11 Plan 02: Local Env Projection Summary

**A resolved non-secret deployment target now projects deterministically into the four existing local env consumers, while marker-aware updates preserve every operator-managed secret and unrelated line.**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-07-14T18:37:20+08:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a typed projection plan for API, gateway, root public runtime env, and crawler env files, with explicit target identity markers in every managed block.
- Kept user-managed secret keys out of profile-derived values; projection validation reports only missing key names.
- Added pure marker-aware block replacement and stale-key cleanup that never rewrites complete env files or deletes unrelated/operator-managed values.

## Task Commits

1. **Task 1: Build the local env projection plan** - `bad7166` (feat)
2. **Task 2: Add marker-aware env file block updater** - `1348b8d` (feat)

## Files Created/Modified

- `packages/config/src/deployment-target/projection-plan.ts` - typed four-file plan, key ownership lists, parsing, and validation.
- `packages/config/src/deployment-target/env-file-block.ts` - marker serialization, targeted stale cleanup, and in-place block application.
- `packages/config/src/deployment-target/__tests__/projection-plan.test.ts` - locked file coverage, canonical local URL, and secret-boundary tests.
- `packages/config/src/deployment-target/__tests__/env-file-block.test.ts` - preservation, replacement, stale residue, and empty-content tests.
- `packages/config/src/deployment-target/index.ts` - public exports for Plan 03 preflight consumption.

## Decisions Made

- The projection accepts only an explicit `TargetResolution`; it does not resolve target IDs itself or read a default.
- `VITE_API_URL` and `NUXT_PUBLIC_API_URL` remain `http://localhost:8080`, matching the Gateway canonical local entry.
- A managed block can remove only keys declared in `targetManagedEnvKeysByFile`; all user-managed secrets remain outside its authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replace a lint-rejected env parsing regex**
- **Found during:** Task 1 commit hook.
- **Issue:** The initial assignment parser used a potentially super-linear regular expression rejected by the repository ESLint rule.
- **Fix:** Switched to `indexOf('=')` plus a bounded environment-key validation expression.
- **Files modified:** `packages/config/src/deployment-target/projection-plan.ts`
- **Verification:** Focused projection tests passed; the normal pre-commit hook completed successfully.
- **Committed in:** `bad7166`

---

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** No runtime or file-I/O scope changed; the parser is safer and preserves the intended validation behavior.

## Issues Encountered

- Vitest 4.1.4 rejects the planned `-x` option. All focused and overall commands used the equivalent non-watch `vitest run` form without `-x`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-03 can consume the projection plan, parsed env values, validation issues, and marker constants for fail-closed preflight.
- The four existing env consumer files remain untouched; only reusable projection helpers and tests were added.

## Self-Check: PASSED

---
*Phase: 11-deployment-target-foundation*
*Completed: 2026-07-14*
