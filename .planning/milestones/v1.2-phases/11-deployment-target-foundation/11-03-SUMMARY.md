---
phase: 11-deployment-target-foundation
plan: "03"
subsystem: infra
tags: [deployment-target, preflight, wrangler, cli, vitest]
requires:
  - phase: 11-01
    provides: Explicit non-secret target profile schema and starye-org resolution
  - phase: 11-02
    provides: Typed local env projection plan and marker-aware local env updates
provides:
  - Fail-closed local, CI, and remote target preflight validation
  - Read-only injected Wrangler resource checks for remote high-risk commands
  - Import-safe target-profile CLI for validation, local projection, and preflight gates
affects: [phase-12-cloudflare-config-switching, phase-13-full-chain-data-smoke, phase-14-test-and-operations-hardening]
tech-stack:
  added: []
  patterns:
    - Explicit target and identity inputs are required; no default or legacy target can continue.
    - Remote resource checks use injected Wrangler argv arrays and remain read-only.
    - Root operational CLIs reuse an existing workspace runner rather than adding root dependencies.
key-files:
  created:
    - packages/config/src/deployment-target/preflight.ts
    - packages/config/src/deployment-target/live-checks.ts
    - scripts/target-profile.ts
    - packages/config/src/deployment-target/__tests__/identity-boundary.test.ts
    - packages/config/src/deployment-target/__tests__/live-checks.test.ts
  modified:
    - packages/config/src/deployment-target/index.ts
    - packages/config/src/deployment-target/__tests__/preflight.test.ts
    - package.json
key-decisions:
  - "Local mode requires the starye-org Wrangler profile and rejects CLOUDFLARE_API_TOKEN shadowing."
  - "CI and remote mode require the mapped starye-org GitHub environment; remote high-risk commands additionally require Cloudflare credential key names and --live checks."
  - "project-local --check verifies target-managed projections only, so an isolated fixture can validate without fabricating user-managed secret values."
patterns-established:
  - "Preflight: collect typed blocking issues rather than emitting warning-only continuation states."
  - "CLI tests: dynamically import a root TypeScript CLI from the config test project to avoid expanding its composite rootDir."
requirements-completed: [PROF-02, PROF-03, PROF-04, ENV-02, TEST-02]
coverage:
  - id: D1
    description: Target preflight rejects missing or legacy targets, profile/projection/command mismatches, local token shadowing, and wrong local or CI identities.
    requirement: PROF-02
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/preflight.test.ts and identity-boundary.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Remote deploy, migrate, rollback, crawl, and smoke gates require credentials and injected read-only D1, R2, and KV checks.
    requirement: PROF-04
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/live-checks.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Import-safe root CLI validates an explicit target, writes and checks an isolated local projection, prints boundary guidance, and fails closed without remote credentials.
    requirement: TEST-02
    verification:
      - kind: integration
        ref: pnpm run target-profile command checks
        status: pass
    human_judgment: false
duration: 3h 12min
completed: 2026-07-14
status: complete
---

# Phase 11 Plan 03: Fail-Closed Target Profile CLI Summary

**Explicit target preflight now blocks local/CI identity mixing and remote high-risk commands until the selected Cloudflare target, credential metadata, and read-only resource checks agree.**

## Performance

- **Duration:** 3h 12min, including the interrupted execution interval
- **Completed:** 2026-07-14T22:11:22+08:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added typed, fail-closed validation for target selection, projection consistency, legacy aliases, local Wrangler identity, CI environment identity, and remote credentials.
- Added injectable argv-only Wrangler checks for D1, R2, and KV resources; no mutation command or deploy workflow was changed.
- Added `pnpm run target-profile` with `validate`, `project-local`, and `preflight` commands, including local-versus-CI credential guidance without exposing values.

## Task Commits

1. **Task 1: Implement fail-closed preflight and identity boundary checks** - `51fe053` (test), `d3ce78e` (feat)
2. **Task 2: Add read-only live resource checks for remote command gates** - `d62a2d8` (test), `d925f12` (feat)
3. **Task 3: Expose import-safe root CLI commands** - `346d611` (test), `17bcd54` (feat)

## Files Created/Modified

- `packages/config/src/deployment-target/preflight.ts` - typed blocking target and identity gates.
- `packages/config/src/deployment-target/live-checks.ts` - injected argv-only D1, R2, and KV read checks.
- `scripts/target-profile.ts` - import-safe root CLI and non-secret operational output.
- `packages/config/src/deployment-target/__tests__/preflight.test.ts` - preflight and CLI parsing/help coverage.
- `packages/config/src/deployment-target/__tests__/identity-boundary.test.ts` - local and CI identity boundary coverage.
- `packages/config/src/deployment-target/__tests__/live-checks.test.ts` - remote credential and read-only check coverage.
- `packages/config/src/deployment-target/index.ts` - preflight and live-check exports.
- `package.json` - existing crawler `tsx` runner exposed as `target-profile`.

## Decisions Made

- Local preflight requires `--wrangler-profile starye-org` and fails when `CLOUDFLARE_API_TOKEN` is present.
- CI/remote preflight requires `--ci-environment starye-org`; high-risk remote commands require both credential key names and `--live`.
- Local projection check intentionally evaluates target-managed entries only. User-managed secret values remain uncreated and unprinted, while the full projection validator remains available to preflight callers that need secret-key presence checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Keep config composite type-check within its package boundary**
- **Found during:** Task 3 verification.
- **Issue:** A static root-script import in the config test pulled `scripts/target-profile.ts` outside the config composite project's `rootDir`.
- **Fix:** Changed the test to load the CLI at runtime through a URL, preserving parser/help assertions without changing config compilation boundaries.
- **Files modified:** `packages/config/src/deployment-target/__tests__/preflight.test.ts`
- **Verification:** Focused Vitest suite and `pnpm --filter @starye/config exec tsc --noEmit` pass.
- **Committed in:** `17bcd54`

---

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** No deploy/runtime consumer, secret, workflow, or package metadata scope expanded.

## Issues Encountered

- Vitest 4.1.4 does not accept the plan's `-x` flag; the equivalent focused `vitest run` command was used.
- The planned PowerShell expected-failure assertion preserved the failing child `LASTEXITCODE`; the equivalent verification added an explicit `exit 0` after confirming the CLI failed as required.

## User Setup Required

None - no remote command was run with credentials and no external service configuration changed.

## Next Phase Readiness

- All three Phase 11 plans are implemented and ready for phase verification.
- Phase 12 can consume the target-profile CLI and preflight gates before changing Worker, Pages, or GitHub workflow consumers.

## Self-Check: PASSED

---
*Phase: 11-deployment-target-foundation*
*Completed: 2026-07-14*
