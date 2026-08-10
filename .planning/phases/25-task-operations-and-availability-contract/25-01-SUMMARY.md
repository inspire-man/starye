---
phase: 25-task-operations-and-availability-contract
plan: 25-01
subsystem: api-database-testing
tags: [crawler-tasks, operation-registry, availability, cas, evidence, d1, drizzle]

requires:
  - phase: 24
    provides: playback evidence tuple binding and redaction boundary
provides:
  - server-owned closed operation snapshots with canonical fingerprints and replay/conflict classification
  - bounded append-only availability observation and revision/policy/tuple CAS contracts
  - bounded redacted evidence validation and D1 observation/current projection schema
affects: [25-02, 25-03, 25-04]

tech-stack:
  added: []
  patterns:
    - closed server-owned command parsing with immutable serialized snapshots
    - append-only observation history with one bounded current projection and explicit CAS rejection codes
    - allowlisted, redacted, size-bounded evidence summaries

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/operation-registry.ts
    - apps/api/src/domain/crawler-tasks/availability-contract.ts
    - apps/api/src/domain/crawler-tasks/evidence-contract.ts
    - packages/db/drizzle/20260810153608_crawler_task_availability.sql
    - packages/db/drizzle/meta/20260810153608_snapshot.json
    - apps/api/src/domain/crawler-tasks/__tests__/operation-registry.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/availability-contract.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/evidence-contract.test.ts
    - packages/db/src/__tests__/crawler-task-availability-migration.test.ts
  modified:
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/reconciliation.test.ts
    - packages/db/src/schema.ts
    - packages/db/drizzle/meta/_journal.json

key-decisions:
  - "Keep operation, target, policy, and intent closed at the server boundary; provider routing and execution details remain server-owned."
  - "Persist availability as append-only observations plus a separate current projection; late, stale, duplicate, and conflict writes never overwrite newer current state."
  - "Reuse the existing crawler task/run/attempt/provider/receipt tuple and preserve the user SQL alias repair without adding a new scheduler."

patterns-established:
  - "Snapshot isolation: canonical JSON is built from a validated command and is not coupled to later caller mutation."
  - "Evidence boundary: only bounded safe codes, counts, and samples may cross into durable availability facts."

requirements-completed: [TASK-01, TASK-04, TASK-05]

coverage:
  - id: D1
    description: "Closed operation registry creates immutable server-owned snapshots and classifies idempotent replay/conflict."
    requirement: TASK-01
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/operation-registry.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Availability observation validation and current projection CAS distinguish accepted, duplicate, stale, late, and conflict outcomes."
    requirement: TASK-04
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-contract.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/reconciliation.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Availability evidence is allowlisted, redacted, and bounded against URLs, cookies, secrets, raw responses, media, and unbounded payloads."
    requirement: TASK-05
    verification:
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/evidence-contract.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/availability-contract.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Drizzle schema and generated migration provide append-only observation history, one current row per target, tuple foreign keys, identity uniqueness, and bounded columns."
    requirement: TASK-04
    verification:
      - kind: integration
        ref: "packages/db/src/__tests__/crawler-task-availability-migration.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/db type-check"
        status: pass
    human_judgment: true
    rationale: "The repository's apps/api/wrangler.toml has no D1 binding or migrations_dir, so the canonical Wrangler local apply/readback command cannot run in this checkout; the generated SQL and in-memory D1 readback test pass."

duration: 48 min
completed: 2026-08-10
status: complete
---

# Phase 25 Plan 25-01: Task Operations And Availability Contract Summary

**Closed crawler operation snapshots, bounded availability/CAS/evidence contracts, and generated D1 observation/current projection schema**

## Performance

- **Duration:** 48 min
- **Started:** 2026-08-10T23:11:34+08:00
- **Completed:** 2026-08-10T23:59:31+08:00
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added a server-owned operation registry that rejects unknown operations, targets, intents, extra fields, and client-controlled workflow/URL/secret material while producing immutable request snapshots and deterministic fingerprints.
- Added availability observation/current projection contracts with tuple binding, bounded readback, explicit duplicate/stale/late/conflict outcomes, and projection-preserving rejection behavior.
- Added bounded evidence redaction/validation and a Drizzle-generated D1 migration with observation history, current target uniqueness, tuple foreign keys, and query indexes.
- Added cross-plan repository/reconciliation fixtures proving the operation snapshot and availability observation retain the same task/run/attempt identity boundary.

## Task Commits

1. **Task 1: Define closed operation, availability, CAS, and evidence contracts** - `900d322` (feat)
2. **Task 2: Add D1 observation and current projection schema with generated migration** - `c89a78f` (feat)
3. **Task 3: Verify cross-plan interfaces and persistence rejection semantics** - `c9cea8a` (test)

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/operation-registry.ts` - closed command input, immutable snapshot builder, canonical fingerprint, and idempotency result types.
- `apps/api/src/domain/crawler-tasks/availability-contract.ts` - tuple-bound observation validation and revision/policy/projection CAS classification.
- `apps/api/src/domain/crawler-tasks/evidence-contract.ts` - bounded evidence model, redaction, and rejection checks.
- `packages/db/src/schema.ts` - observation/current projection tables, relations, foreign keys, and indexes.
- `packages/db/drizzle/20260810153608_crawler_task_availability.sql` - actual Drizzle-generated migration.
- `apps/api/src/domain/crawler-tasks/__tests__/` and `packages/db/src/__tests__/crawler-task-availability-migration.test.ts` - focused contract, tuple, and D1-shaped readback coverage.

## Decisions Made

- Operation snapshots are built only from closed client input; provider workflow, entrypoint, routing, and secret boundaries remain server-owned.
- Availability facts are append-first history plus a separate current projection guarded by revision, policy, tuple, and projection-version expectations.
- Evidence stores bounded redacted facts only, with no signed URLs, cookies, secrets, raw provider responses, media, or unbounded arrays/text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the repository tuple fixture to use the returned run task identity.**

- **Found during:** Task 3 (cross-plan interface verification)
- **Issue:** The new test accessed `created.task.id`, but `createOrGetActiveRun()` returns the task identity as `created.run.taskId`.
- **Fix:** Bound the availability observation fixture and assertion to `created.run.taskId`.
- **Files modified:** `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts`
- **Verification:** Focused API suite passed with 5 files and 30 tests.
- **Committed in:** `c9cea8a`

**Total deviations:** 1 auto-fixed (1 correctness bug)
**Impact on plan:** The fix narrows the fixture to the existing repository return contract and does not expand production scope.

## Issues Encountered

- The original `25-01` executor stopped without writing its summary after completing production commits; the plan was recovered manually from commits `900d322` and `c89a78f`, then completed with `c9cea8a`.
- `pnpm --filter @starye/db drizzle-kit generate` resolves as a missing workspace script in this repo; `pnpm --filter @starye/db exec drizzle-kit generate` reaches Drizzle but requires an interactive schema-conflict prompt in the non-TTY runner. The migration file in this summary was already generated by Drizzle and validated by the migration test.
- `pnpm exec wrangler d1 migrations apply starye-db --local` cannot run because `apps/api/wrangler.toml` has no `migrations_dir`; direct `d1 execute` also reports no `starye-db` D1 binding. No local D1 apply result is reported as passed; the in-memory D1-shaped migration/readback test and database type-check pass.

## User Setup Required

None - no external service configuration is required for the contract implementation. A later local D1 proof still needs the existing Wrangler configuration to define the database binding and migration directory.

## Next Phase Readiness

- `25-02` can consume the closed operation registry and immutable snapshot builder for admin task lifecycle routes.
- `25-03` can consume the availability observation/current projection contracts and generated schema for signed internal observation persistence.
- No video, magnet, manga chapter, or chapter image probe was introduced in this plan.

---
*Phase: 25-task-operations-and-availability-contract*
*Plan: 25-01*
*Completed: 2026-08-10*

## Self-Check: PASSED

- Focused API Vitest: 5 files, 30 tests passed.
- API type-check passed.
- Database migration/readback Vitest: 1 file, 2 tests passed.
- Database type-check passed.
- `pnpm check:services` passed with Gateway `http://localhost:8080` healthy.
- `git diff --check` and staged GitNexus detect-changes passed for the intended 9-file follow-up commit.
