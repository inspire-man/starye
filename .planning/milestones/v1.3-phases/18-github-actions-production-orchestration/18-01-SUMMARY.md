---
phase: 18-github-actions-production-orchestration
plan: 01
subsystem: api-database-infrastructure
tags: [github-actions, github-app, drizzle, d1, crawler-tasks]

requires:
  - phase: 16-task-domain-foundation
    provides: crawler task/run/attempt state, lease, and audit persistence contracts
provides:
  - closed movie/manga GitHub Actions provider snapshots and dispatch inputs
  - D1 provider association persistence with duplicate-binding protections
  - optional GitHub App Worker binding contract with redacted configuration errors
affects: [18-02, 18-03, 18-04, 18-05, 18-06, phase-19-dashboard-operations]

tech-stack:
  added: []
  patterns: [server-owned provider snapshot, redacted provider facts, names-only binding validation]

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/provider-association.ts
    - packages/db/drizzle/0028_crawler_provider_association.sql
    - apps/api/src/domain/crawler-tasks/__tests__/provider-association.test.ts
    - packages/db/src/__tests__/crawler-provider-association-migration.test.ts
  modified:
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - packages/db/src/schema.ts
    - apps/api/src/lib/auth.ts

key-decisions:
  - "Movie/manga dispatch resolves fixed repository, main ref, starye-org target/Environment, workflow, and crawler entry on the server."
  - "A one-to-one provider association stores only bounded provider facts and protects provider run/attempt plus schedule buckets with unique indexes."
  - "GitHub App binding absence returns binding names and a stable code, never secret values."

patterns-established:
  - "Provider snapshot: accept a template key only, then derive an immutable provider identity and four-field dispatch envelope."
  - "Provider audit projection: accept only allowlisted status/conclusion/run/SHA fields and reject extras."

requirements-completed: [PROD-01, PROD-02, PROD-03]

coverage:
  - id: D1
    description: "Closed movie/manga GitHub Actions provider snapshot and dispatch tuple"
    requirement: "PROD-01"
    verification:
      - kind: unit
        ref: "pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/provider-association.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "D1 provider association migration with duplicate provider and schedule protections"
    requirement: "PROD-02"
    verification:
      - kind: integration
        ref: "pnpm --filter @starye/db exec vitest run src/__tests__/crawler-provider-association-migration.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Optional GitHub App Worker bindings with a redacted missing-configuration result"
    requirement: "PROD-03"
    verification:
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-01
status: complete
---

# Phase 18 Plan 01: Provider association foundation Summary

**GitHub Actions crawler provider identity is now server-owned, D1-persisted, and protected from caller-controlled workflow fields or credential leakage.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-31T16:48:00Z
- **Completed:** 2026-07-31T17:04:50Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Added frozen movie/manga provider snapshots, a closed dispatch envelope, and redacted bounded provider status summaries.
- Added the D1 provider-association table, relations, lookup/uniqueness indexes, and an in-memory LibSQL migration contract test.
- Declared optional GitHub App Worker bindings and a names-only `github_app_configuration_missing` result for future provider clients.

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义 provider snapshot 与闭合 registry** - `5d3ccd6` (feat)
2. **Task 2: 增加 D1 provider association schema 与 migration** - `ad7d25a` (feat)
3. **Task 3: 固化 GitHub App Worker binding 契约** - `1d3081e` (feat)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/provider-association.ts` - closed workflow mapping, dispatch parser, and redacted summary mapper.
- `packages/db/src/schema.ts` - typed provider association table and Drizzle relations.
- `packages/db/drizzle/0028_crawler_provider_association.sql` - deployable D1 association schema and indexes.
- `apps/api/src/lib/auth.ts` - optional App binding names and names-only configuration validation.

## Decisions Made

- Kept dispatch input to `runId`, `attempt`, `template`, and fixed `target`; workflow/ref/repository/environment remain snapshot-owned.
- Used a one-to-one provider association table so existing crawler-run logs, receipts, and audit history remain unchanged across later provider retries.
- Kept App bindings optional in `Env` for existing local/auth consumers, then fail closed through a stable names-only code when production orchestration needs them.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

- The initial SHA validation expression used an unused capturing group; the pre-commit lint gate identified it and the expression was corrected to a non-capturing group before the task commit.
- The DB test's `URL` type conflicted with the package Node declarations; converting the migration URL with `fileURLToPath` preserved the in-memory migration test and made DB type-check pass.

## Verification

- PASS `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/provider-association.test.ts` (5 tests)
- PASS `pnpm --filter @starye/db exec vitest run src/__tests__/crawler-provider-association-migration.test.ts` (2 tests)
- PASS `pnpm --filter @starye/db type-check`
- PASS `pnpm --filter @starye/api-types run build`
- PASS `pnpm --filter api type-check`

## Self-Check: PASSED

- Required provider-association module and 0028 migration exist.
- All three task commits are present and the plan-level verification commands pass.

## User Setup Required

None - no external service configuration is required for this foundation plan. Production GitHub App credentials remain for the subsequent provider-client/run work.

## Next Phase Readiness

- 18-02 can mint the GitHub App installation token and dispatch only the immutable snapshot produced here.
- 18-03 onward can bind signed callback/schedule events to the D1 association without introducing a second crawler state machine.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-08-01*
