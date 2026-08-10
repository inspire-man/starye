---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 01
subsystem: api-database-contracts
tags: [source-health, repair-players, valibot, drizzle, d1, crawler-tasks]

# Dependency graph
requires:
  - phase: 20-source-contract-receipt-boundary-and-sun-064
    provides: typed movie readiness, bounded source reasons, receipt identity, and playback-proof separation
provides:
  - bounded per-source health projection with source type, health, observedAt, reason, and eligibility
  - strict single-movie repair_players command, snapshot, and dedicated receipt contracts
  - additive crawler operation and append-only movie source observation Drizzle schema
affects: [21-02-local-d1-migration-and-readback, 21-03-repair-control-plane, 21-04-repair-routes, source-readiness, crawler-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [operation-discriminated task snapshots, bounded source DTO redaction, append-only observation identity]

key-files:
  created: [.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-01-SUMMARY.md]
  modified:
    - apps/api/src/domain/movies/source-contract.ts
    - apps/api/src/domain/movies/__tests__/source-contract.test.ts
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/schemas/crawler-tasks.ts
    - packages/db/src/schema.ts

key-decisions:
  - 'Keep Phase 20 readiness disposition and browser playback proof independent from per-source health; inactive sources remain visible but never contribute eligibility.'
  - 'Add operation alongside templateKey so ordinary movie/manga snapshots and receipts remain backward-compatible while repair_players is explicitly discriminated.'
  - 'Use movie.id as canonical content identity and bind observation uniqueness to movie, source revision, operation, run, attempt, sequence, event, and source ordinal.'

patterns-established:
  - 'Public source health projections contain only sourceType, health, observedAt, bounded reasonCode, and eligible; raw source material stays at the server boundary.'
  - 'Repair commands expose only movieId, current disposition-derived reason, and restore_playable_sources; adapter, workflow, target, and secret remain server-owned.'

requirements-completed: [SRC-02, REP-01]

coverage:
  - id: D1
    description: 'Bounded source health projection supports direct, magnet, inactive, and failed source fixtures with independent eligibility.'
    requirement: SRC-02
    verification:
      - kind: unit
        ref: 'apps/api/src/domain/movies/__tests__/source-contract.test.ts (15 tests)'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Strict repair_players input and operation-discriminated snapshot/receipt keep single-movie repair proof separate from ordinary receipts.'
    requirement: REP-01
    verification:
      - kind: unit
        ref: 'apps/api/src/domain/movies/__tests__/source-contract.test.ts (repair command/receipt cases)'
        status: pass
      - kind: other
        ref: 'pnpm --filter api type-check'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Drizzle schema exposes crawler operation, append-only source observations, foreign keys, relations, and replay identity indexes without new raw source fields.'
    verification:
      - kind: other
        ref: 'pnpm --filter @starye/db type-check'
        status: pass
      - kind: other
        ref: 'pnpm --filter @starye/db build'
        status: pass
    human_judgment: false

# Metrics
duration: 31m
completed: 2026-08-06
status: complete
---

# Phase 21 Plan 01: Source health and repair operation contracts summary

**Bounded source health, strict single-movie repair_players contracts, and additive D1 observation schema for the local repair vertical slice.**

## Performance

- **Duration:** 31m
- **Started:** 2026-08-06T12:57:00+08:00
- **Completed:** 2026-08-06T13:28:00+08:00
- **Tasks:** 2
- **Files modified:** 5 implementation/test files; 1 summary file

## Accomplishments

- Added SourceType (direct, magnet, TorrServer), SourceHealth (inactive, unverified, failed), bounded health reasons, and SourceHealthProjection. Magnet defaults to unverified; inactive rows remain visible but are ineligible; readiness and browser playback proof remain independent.
- Added strict CreateRepairPlayersTaskSchema accepting only canonical movieId, no_source|source_failed, and literal restore_playable_sources.
- Added operation-discriminated RepairPlayersTaskSnapshot and RepairPlayersReceipt, preserving ordinary movie/manga snapshot and receipt compatibility.
- Added crawler_task.operation and movie_source_observation schema definitions with bounded facts, movie/run foreign keys, relations, source revision, operation, run/attempt/sequence/event identity, source ordinal, and replay uniqueness indexes.
- Preserved the existing HIGH-impact deriveSourceReadiness behavior; focused source/readback/sync regressions and API/DB type checks passed.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: bounded source health and repair contract tests** - 5d7b5cc (test)
2. **Task 1 GREEN: source health and repair operation contracts** - 499bce7 (feat)
3. **Task 2: crawler operation and source observation schema** - c1cf42e (feat)

## Files Created/Modified

- apps/api/src/domain/movies/source-contract.ts - bounded source health types and redacted projection helper alongside existing readiness contract.
- apps/api/src/domain/movies/__tests__/source-contract.test.ts - table-driven health, eligibility, redaction, strict input, and receipt discriminator regressions.
- apps/api/src/domain/crawler-tasks/types.ts - repair operation, snapshot, receipt, and compatibility union types.
- apps/api/src/schemas/crawler-tasks.ts - strict repair command schema with fixed target intent.
- packages/db/src/schema.ts - crawler operation discriminator, source observation table, indexes, foreign keys, and relations.

## Decisions Made

- Kept the existing deriveSourceReadiness contract unchanged because GitNexus identified HIGH risk across syncMovies, syncCrawlerData, and processRunnerEvent; the new per-source projection is additive.
- Kept templateKey: movie for permission and ordinary read-model compatibility while adding an independent operation discriminator for repair tasks.
- Deferred migration generation and local D1 apply to 21-02, as required by the plan dependency and its blocking migration task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reordered observation table declaration to satisfy foreign-key initialization order**

- **Found during:** Task 2 (Drizzle schema implementation)
- **Issue:** movie_source_observation.runId references crawlerRuns, which is declared later in the schema module; declaring the table earlier creates a module initialization/type boundary problem.
- **Fix:** Moved the observation table definition after crawlerRuns, while retaining the foreign key, relations, and indexes.
- **Files modified:** packages/db/src/schema.ts
- **Verification:** pnpm --filter @starye/db type-check and pnpm --filter @starye/db build passed.
- **Committed in:** c1cf42e

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** Declaration order was required for the planned schema to load correctly; no schema boundary or scope changed.

## Issues Encountered

- GitNexus initially reported a stale index and the first full analyzer run exceeded the command timeout. A subsequent analyzer completed and gitnexus status reported the index up to date before impact analysis and commits.
- The pre-existing unstaged AGENTS.md and CLAUDE.md edits were preserved and never staged. They only update GitNexus-generated symbol counts.

## Auth Gates

None.

## Known Stubs

None. Migration generation/apply is intentionally owned by the blocking task in 21-02 and is not a stub in this plan.

## Threat Surface Scan

The plan's declared threat mitigations are represented in the changed files: strict allowlist parsing, bounded public projections, server-owned repair fields, source revision/event identity, and replay uniqueness indexes. No additional endpoint, auth path, raw file access, or unplanned trust-boundary surface was introduced.

## Verification

- pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts - 15/15 passed.
- pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts src/domain/crawler-tasks/__tests__/state-machine.test.ts - 20/20 passed during Task 1 GREEN.
- pnpm --filter api exec vitest run src/routes/movies/__tests__/services/sync.service.test.ts src/routes/admin/sync/__tests__/handlers.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts - 29/29 passed.
- pnpm --filter api type-check - passed.
- pnpm --filter @starye/db type-check - passed.
- pnpm --filter @starye/db build - passed.
- git diff --check - passed.
- npx gitnexus detect-changes --repo starye --scope staged - only intended task files staged before each task commit; user document edits stayed unstaged.

## Next Phase Readiness

- 21-02 can generate/apply the additive migration and prove live local D1 schema readback against the exported operation and observation definitions.
- 21-03 can import the repair snapshot/receipt unions and add operation-aware registry, receipt validation, CAS, retry, and replay behavior.
- Existing ordinary movie/manga task consumers remain source-compatible; the new operation discriminator is ready for explicit repair routing.

---
*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Plan: 21-01*
*Completed: 2026-08-06*

## Self-Check: PASSED

- Summary file created at the planned path.
- Task commits 5d7b5cc, 499bce7, and c1cf42e exist in git history.
- Five implementation/test files exist and match the plan's file list.
- No task commit deleted tracked files.
- AGENTS.md and CLAUDE.md remain unstaged and retain only their pre-existing GitNexus count edits.
