---
phase: 14-test-and-operations-hardening
plan: "04"
subsystem: testing
tags: [vitest, playwright, static-audit, deployment-target, git]
requires:
  - phase: 14-03
    provides: TargetProfile-derived Pages redirect inputs and workflow contracts
provides:
  - Strict tracked-file fixed-literal legacy-domain audit
  - Root static gate that rejects target and provider arguments
  - Target-neutral active config examples and .test E2E identities
affects: [TEST-01, Phase 14 final verification, CI static checks]
tech-stack:
  added: []
  patterns:
    - Fixed-string audits use explicit path-and-fragment allowances with named reasons.
    - Local static gates enumerate Git-tracked files with NUL-delimited output and never receive deployment inputs.
key-files:
  created:
    - packages/config/src/deployment-target/legacy-domain-audit.ts
    - scripts/audit-legacy-domain.ts
  modified:
    - packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts
    - package.json
    - apps/api/.dev.vars.example
    - apps/auth/typecheck.pages-build.env
    - apps/gateway/src/index.ts
    - apps/blog/e2e/session.spec.ts
    - apps/dashboard/e2e/auth-crosspath.spec.ts
key-decisions:
  - "Allowances match an exact tracked path and trimmed source fragment, with a category and reason; no directory, glob, regex, or count baseline is accepted."
  - "The audit command accepts no arguments, enumerates Git-tracked files with git ls-files -z, and returns nonzero for the first unclassified active literal."
  - "Non-production examples use fixture.invalid or .test values instead of the tracked target's default domain."
patterns-established:
  - "Static identity gates must pass a pure, injected reader through unit tests and keep CLI filesystem access under the repository root."
requirements-completed: [TEST-01]
coverage:
  - id: D1
    description: "Tracked active source, configuration, and test files are audited for fixed legacy-domain literals with exact documented allowances."
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/legacy-domain-audit.test.ts"
        status: pass
      - kind: other
        ref: "pnpm check:legacy-domain"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migrated Blog and Dashboard E2E fixtures remain discoverable after their identity literals changed to .test values."
    requirement: "TEST-01"
    verification:
      - kind: e2e
        ref: "pnpm --filter blog exec playwright test e2e/session.spec.ts --list"
        status: pass
      - kind: e2e
        ref: "pnpm --filter dashboard exec playwright test e2e/auth-crosspath.spec.ts --list"
        status: pass
    human_judgment: false
duration: 22min
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 04: Legacy-Domain Static Gate Summary

**A deterministic, tracked-file-only fixed-literal gate now rejects undocumented `starye.org` use while preserving only explicit target-profile, alias-deny-list, and named test-fixture records.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-21T03:34:03Z
- **Completed:** 2026-07-21T03:56:00Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Added a pure fixed-string audit that produces stable `path:line:fragment` diagnostics and requires each retained occurrence to match an exact documented allowance.
- Added `pnpm check:legacy-domain`, a read-only Git-tracked-file gate that rejects all target, credential, provider, deploy, migration, crawler, rollback, and smoke arguments.
- Migrated active configuration examples, the Gateway comment, and Blog/Dashboard E2E identity fixtures without changing runtime routing or test discovery.

## Task Commits

1. **Task 1: Implement the fixed-literal, exact-allowance audit** - `2e8315d` (test RED), `491d81c` (feat GREEN)
2. **Task 2: Migrate active configuration, comment, and email fixtures** - `bd08eaf` (fix)
3. **Task 3: Make the local audit a required static test gate** - `491d81c` (implemented with Task 1's CLI and root command; verified independently without a duplicate commit)

## Files Created/Modified

- `packages/config/src/deployment-target/legacy-domain-audit.ts` - Pure active-path filter, exact allowance model, and deterministic audit results.
- `packages/config/src/deployment-target/__tests__/legacy-domain-audit.test.ts` - Failure-first coverage for unclassified literals, exact retained fragments, exclusions, and hyphenated target IDs.
- `scripts/audit-legacy-domain.ts` - NUL-safe `git ls-files` adapter with repository-root containment and nonzero issue propagation.
- `package.json` - Exposes the no-argument `check:legacy-domain` static gate.
- `apps/api/.dev.vars.example` - Uses a target-neutral public URL placeholder.
- `apps/auth/typecheck.pages-build.env` - Uses an explicitly named generated typecheck fixture boundary.
- `apps/gateway/src/index.ts` - Removes the stale target-specific development comment without changing logic.
- `apps/blog/e2e/session.spec.ts` and `apps/dashboard/e2e/auth-crosspath.spec.ts` - Use dedicated `.test` fixture identities.

## Decisions Made

- Used whole trimmed source lines as allowance fragments, keeping retained literals auditable while avoiding pattern-based exemptions.
- Kept the CLI read-only and local: its sole child operation is `git ls-files -z`; it has no credential, provider, network, or mutation path.
- Rejected all extra CLI arguments before file enumeration so local and CI callers cannot reinterpret the gate as an operations command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Included the tracked typecheck `.env` fixture in active config classification**
- **Found during:** Task 1
- **Issue:** The initial active-path model excluded `typecheck.pages-build.env`, despite it being a tracked configuration input named in the plan.
- **Fix:** Added `.env` to supported active config suffixes while retaining ignored local `.env` exclusions.
- **Files modified:** `packages/config/src/deployment-target/legacy-domain-audit.ts`
- **Verification:** Audit unit suite passed and the CLI identified the fixture before migration.
- **Committed in:** `491d81c`

**2. [Rule 1 - Bug] Added the missing exact Gateway cache fixture record**
- **Found during:** Task 1
- **Issue:** The first audit run reported one existing Gateway cache test line outside the intended Task 2 migration scope.
- **Fix:** Added its exact path-and-fragment named-fixture allowance.
- **Files modified:** `packages/config/src/deployment-target/legacy-domain-audit.ts`
- **Verification:** The pre-migration CLI then reported only the seven planned migration records.
- **Committed in:** `491d81c`

**3. [Rule 1 - Bug] Conformed the CLI to repository Node lint rules**
- **Found during:** Task 1 commit hook
- **Issue:** The initial script used global `process` and an operator line break rejected by ESLint.
- **Fix:** Imported `node:process` explicitly and applied the repository formatter.
- **Files modified:** `scripts/audit-legacy-domain.ts`, `packages/config/src/deployment-target/legacy-domain-audit.ts`
- **Verification:** Scoped ESLint and the commit hook passed.
- **Committed in:** `491d81c`

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)

**Impact on plan:** All fixes tightened the specified static contract and did not broaden the audit or application scope.

## Issues Encountered

- GitNexus detect-changes maps the comment-only Gateway hunk to the enclosing `fetch` symbol and six Proxy flows as HIGH. The pre-edit upstream impact for `gatewayHandler` was LOW (zero direct callers/processes), and the word diff confirmed no executable statement changed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-01 now has a deterministic local/CI gate with no provider or credential dependency.
- Later Phase 14 verification can run `pnpm check:legacy-domain` directly; a newly tracked unclassified active literal fails immediately and must be migrated or documented as an exact allowance.

## Self-Check: PASSED

- Confirmed the audit module, unit suite, CLI adapter, and Summary exist on disk.
- Confirmed TDD RED `2e8315d`, Task 1 GREEN `491d81c`, and Task 2 `bd08eaf` exist in Git history.
