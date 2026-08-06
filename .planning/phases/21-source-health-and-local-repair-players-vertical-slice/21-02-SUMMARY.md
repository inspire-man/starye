---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 02
subsystem: api-database-testing
tags: [typescript, vitest, drizzle, d1, source-health, repair-players, cas, cache]

# Dependency graph
requires:
  - phase: 21-01
    provides: bounded source health contracts, repair operation identity, and source observation schema
provides:
  - locally applied source health repair migration with live D1 schema evidence
  - transactional repair observation acceptance with revision CAS and append-only facts
  - bounded same-movie persisted source readback with duplicate/stale/failure outcomes
  - repair success cache invalidation hooks for API detail and Gateway movies group
affects: [21-03-repair-control-plane, 21-04-repair-routes, source-readiness, crawler-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional source observation acceptance, persisted-fact readback, bounded failure DTOs, injected cache invalidation]

key-files:
  created:
    - apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts
    - .planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-02-SUMMARY.md
  modified:
    - apps/api/src/domain/movies/source-reconciliation.ts
    - apps/api/src/routes/movies/__tests__/services/sync.service.test.ts
    - packages/db/drizzle/0030_source_health_repair.sql
    - packages/db/src/__tests__/source-health-repair-migration.test.ts

key-decisions:
  - "保持 deriveSourceReadiness 和既有 ordinary sync contract 不变；repair observation 作为新增 operation-aware 服务边界。"
  - "在同一 D1 transaction 内先做 sourceRevision CAS projection guard，再写 player rows 与 append-only observation facts；提交后只从 persisted state/readback 生成 bounded DTO。"
  - "API detail cache 使用调用方注入的清理回调，Gateway movies group 使用既有 clearGatewayCacheGroup seam；两者只在 authoritative readback 成功后执行。"
  - "raw source URL、异常和 runner material 只留服务端边界；readback/source summary 仅返回 source type、health、observedAt、bounded reason 和 eligibility。"

patterns-established:
  - "Repair observation identity is bound to one movie, repair operation, run, attempt, sequence, event, and source revision."
  - "Inactive and blank source rows remain representable in repair facts while isEligiblePlayer remains the single eligibility predicate."

requirements-completed: [SRC-02, REP-01]

coverage:
  - id: D1
    description: "Local D1 contains crawler operation, movie source observation facts, foreign keys, and replay indexes."
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/source-health-repair-migration.test.ts"
        status: pass
      - kind: other
        ref: "wrangler d1 migrations list/execute starye-db --local --config .target-wrangler.local-dev-10424-movie.toml"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repair source acceptance appends facts, advances current projection by CAS, handles duplicate/stale/failure outcomes, and returns authoritative bounded readback."
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing movie sync keeps active non-blank eligibility semantics and bounded source failure behavior."
    requirement: REP-01
    verification:
      - kind: unit
        ref: "apps/api/src/routes/movies/__tests__/services/sync.service.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api build; pnpm --filter @starye/db build"
        status: pass
    human_judgment: false
---

# Phase 21 Plan 02 Summary

**Transactional repair source observation persistence with sourceRevision CAS, bounded same-movie readback, cache invalidation, and local D1 migration proof.**

## Performance

- **Duration:** approximately 33 minutes
- **Started:** 2026-08-06T14:32:00+08:00
- **Completed:** 2026-08-06T15:04:33+08:00
- **Tasks:** 2 completed (Task 1 resumed from prior commit; Task 2 completed here)
- **Files modified:** 5 plan artifacts/code files

## Accomplishments

- Confirmed `0030_source_health_repair.sql` is applied to local Wrangler D1 as history id 32. Live readback showed `crawler_task.operation`, `movie_source_observation`, movie/run foreign keys, and identity/run-event/revision indexes.
- Added `acceptRepairSourceObservation` and `readRepairSourceReadback` with bounded input checks, one-movie repair operation binding, append-only persisted observation facts, current `movie_source_state` projection, revision CAS, duplicate/stale handling, and post-commit authoritative readback.
- Readback exposes only persisted source type, health, observation time, bounded reason, eligibility, and summary. Successful acceptance clears the injected API detail cache hook and the Gateway `movies` cache group.
- Preserved existing `deriveSourceReadiness` and `isEligiblePlayer` semantics; inactive and blank candidates remain excluded from eligibility while repair facts can represent their bounded health state.

## Task Commits

Each task was committed atomically. Task 2 followed the required TDD gates:

1. **Task 1: apply local source health repair migration** - `eac4d84` (`feat`)
2. **Task 2 RED: add repair source reconciliation regressions** - `239d70b` (`test`)
3. **Task 2 GREEN: persist repair source observations and readback** - `61910c6` (`feat`)

## Files Created/Modified

- `packages/db/drizzle/0030_source_health_repair.sql` - additive migration already applied to local D1.
- `packages/db/src/__tests__/source-health-repair-migration.test.ts` - migration schema, foreign-key, index, duplicate, and sensitive-field checks.
- `apps/api/src/domain/movies/source-reconciliation.ts` - repair observation acceptance, CAS, projection, readback, redaction, and cache invalidation boundary.
- `apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts` - success, revision, duplicate/stale, write/readback failure, eligibility, cache, and sentinel-redaction coverage.
- `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts` - active/non-blank eligibility regression.

## Decisions Made

- Kept the existing HIGH-impact readiness path additive and unchanged; the new repair service is operation-specific and does not expand `deriveSourceReadiness`.
- Used a transaction-local CAS guard before player and observation writes so stale revisions return without mutating the current projection or facts.
- Kept API detail invalidation as an injected callback because the current service has no request URL/session cache context; the existing Gateway group helper remains the default group invalidator.

## Deviations from Plan

Task 2 executed as written. The inherited Task 1 generator baseline is recorded separately below because it was intentionally not papered over.

## Issues Encountered

- The planned Drizzle generate command remains blocked by the repository's pre-existing missing/non-contiguous snapshot baseline and `Interactive prompts require a TTY`. The canonical migration was retained from `eac4d84`; no unrelated `meta` files were rewritten or success fabricated.
- The first API type-check found that D1 transaction objects lack top-level `batch/$client` properties expected by the `Database` alias. The reconciliation helpers were narrowed to their actual query/insert/update/delete interface; API and DB type-checks then passed. This was a Rule 3 blocking type fix in `61910c6`.
- GitNexus pre-change impact for `reconcileMovieSources` was LOW with two direct callers and two sync processes; `deriveSourceReadiness` was left untouched. The final CLI `npx gitnexus detect-changes --repo starye --scope all` reported only the user's pre-existing AGENTS.md/CLAUDE.md edits, low risk, and zero affected processes.

## Verification

- `pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts src/domain/movies/__tests__/source-reconciliation.test.ts src/routes/movies/__tests__/services/sync.service.test.ts` -> 3 files, 38 tests passed.
- `pnpm --filter @starye/db exec vitest run src/__tests__/source-health-repair-migration.test.ts` -> 1 file, 2 tests passed.
- `pnpm --filter api type-check` and `pnpm --filter @starye/db type-check` passed.
- `pnpm --filter api build` and `pnpm --filter @starye/db build` passed.
- Local D1 readback via `apps/api/.target-wrangler.local-dev-10424-movie.toml`: migration list reported no pending migrations; `d1_migrations` reported id 32 `0030_source_health_repair.sql`; `sqlite_master`, `PRAGMA foreign_key_list(movie_source_observation)`, and `PRAGMA index_list(movie_source_observation)` returned the expected schema.

## Known Stubs

None. Empty arrays and nullable values found by the stub scan belong to bounded failure/readback fixtures or internal accumulator initialization and do not feed an unwired UI projection.

## Auth Gates

None.

## Threat Surface Scan

The changed service writes only the plan-declared D1 observation/current projection boundary and clears the plan-declared cache groups. No new endpoint, authentication path, raw file access, or unplanned trust-boundary surface was introduced.

## Next Phase Readiness

The persisted operation/source observation boundary is ready for 21-03 operation-aware task/receipt validation and 21-04 signed route wiring. The local migration is applied and independently read back; production migration and provider/browser proof remain later-phase work.

## Self-Check: PASSED

- Summary file exists at the canonical phase path.
- Task commits `eac4d84`, `239d70b`, and `61910c6` exist in git history.
- Post-commit working tree contains only the pre-existing user changes to `AGENTS.md` and `CLAUDE.md`.

---
*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Plan: 02*
*Completed: 2026-08-06*
