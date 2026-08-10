---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 07
subsystem: testing
tags: [gateway, repair_players, source-health, local-e2e, gitnexus]

requires:
  - phase: 21-05
    provides: local repair_players adapter and signed runner envelope
  - phase: 21-06
    provides: Dashboard source-health projection and MovieDetail handoff
provides:
  - bounded repair_players fixture/evidence stages in the local task-runner harness
  - static and aggregate Phase 21 verification record
  - successful canonical Gateway fixture proof without production/provider/playback overclaim
affects: [phase-21-closeout, phase-22-playback-state-closure]

tech-stack:
  added: []
  patterns: [bounded redacted evidence, canonical Gateway origin, same-movie sourceRevision identity]

key-files:
  created: [.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-07-SUMMARY.md]
  modified: [scripts/local-task-runner.e2e.ts]

key-decisions:
  - "Keep the local proof bounded to command acceptance, observation, authoritative readback, receipt, and terminal result; do not call it provider or playback proof."
  - "Restore the local SUN-064 fixture in the active D1 target, then rerun the exact Gateway command so the proof remains tied to persisted state."

patterns-established:
  - "All runner callbacks and public reads use http://localhost:8080 as the canonical local origin."
  - "Evidence carries only bounded IDs, status, revision, observedAt, reasons, and next actions; raw source and secret material stay out."

requirements-completed: [SRC-02, REP-01]

coverage:
  - id: D1
    description: "Repair_players harness contains fresh fixture data, independent bounded evidence stages, redaction assertions, and same-movie identity checks."
    requirement: REP-01
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit --ignoreConfig --target esnext --lib esnext,dom --module esnext --moduleResolution bundler --strict --skipLibCheck --types node --allowImportingTsExtensions scripts/local-task-runner.e2e.ts"
        status: pass
      - kind: other
        ref: "pnpm exec eslint scripts/local-task-runner.e2e.ts; git diff --check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonical Gateway fresh SUN-064 command-to-readback vertical proof."
    requirement: SRC-02
    verification:
      - kind: e2e
        ref: "pnpm local:task-runner:e2e --target local --template movie --evidence-dir artifacts/phase-21-local-repair"
        status: pass
    human_judgment: false
    rationale: "The active local D1 fixture started at players=0/sourceRevision=3/no_source and the canonical Gateway flow observed bounded failure, duplicate protection, source observation, authoritative readback, dedicated receipt, same-movie readiness, ordinary movie execution, and cancellation."

duration: unmeasured-continuation
completed: 2026-08-06
status: complete
---

# Phase 21 Plan 07: Canonical Gateway Local Repair Proof Summary

**The local repair_players evidence harness and Phase 21 canonical Gateway vertical proof are complete; the result remains bounded to local control-plane behavior and does not claim provider or playback proof.**

## Performance

- **Duration:** Not reliably measured in this continuation.
- **Completed:** 2026-08-06
- **Tasks:** 2 executed; Task 1 code committed, Task 2 verification completed.
- **Files modified by the plan:** 1 source file; 1 planning summary created.

## Accomplishments

- Added a fresh `SUN-064`/zero-player repair fixture with direct, magnet, and inactive TorrServer source rows.
- Added independent bounded evidence for command acceptance, source observation, authoritative readback, dedicated repair receipt, terminal result, duplicate, stale, and bounded failure states. Evidence redaction rejects cookie, secret, raw source, signature, exception, and runner-material sentinels.
- Forced runner callback and Gateway reads through `http://localhost:8080`, with same movie identity and `sourceRevision` assertions across the intended stages.
- Completed focused regressions, package type-checks, local migration apply/readback, lint, diff checks, and final GitNexus scope analysis.

## Task Commits

1. **Task 1: Add canonical Gateway repair_players fixture and bounded evidence** - `cf8af7d` (`feat`)
2. **Task 2: Run focused verification and change-scope checks** - verification-only; no additional source commit.

## Files Created/Modified

- `scripts/local-task-runner.e2e.ts` - local repair_players fixture, runner driving, bounded redacted evidence, and canonical Gateway assertions.
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-07-SUMMARY.md` - execution and verification record.

## Verification Results

### Focused tests

- `pnpm --filter api exec vitest run ...` (8 Phase 21 API files): **8 files, 87 tests passed**.
- `pnpm --filter @starye/crawler exec vitest run ...` (3 listed runner files): **3 files, 14 tests passed**.
- `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts`: **1 file, 12 tests passed**.
- `pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts`: **1 file, 7 tests passed**.
- `pnpm --filter @starye/db exec vitest run src/__tests__/source-health-repair-migration.test.ts`: **1 file, 2 tests passed**.

Total focused result: **14 files, 122 tests passed**.

### Type, lint, and migration checks

- `pnpm --filter api type-check`: **passed**.
- `pnpm --filter @starye/crawler type-check`: **passed**.
- `pnpm --filter dashboard type-check`: **passed**.
- `pnpm --filter @starye/db type-check`: **passed**.
- `pnpm --filter @starye/movie-app type-check`: package has no such script; the package-native `pnpm --filter @starye/movie-app exec vue-tsc -b` **passed**.
- Standalone script TypeScript check with Node/DOM libs and `allowImportingTsExtensions`: **passed**.
- Targeted ESLint for the E2E script and changed admin route/test files: **passed**.
- `git diff --check`: **passed**.
- `cd apps/api; pnpm exec wrangler d1 migrations apply starye-db --local --config .target-wrangler.local-dev-51152-dashboard.toml`: **No migrations to apply**.
- Local D1 readback found migration `32 / 0030_source_health_repair.sql`, `crawler_task`, `movie_source_observation`, `movie_source_state`, and `player`; `crawler_task.operation`, three observation indexes, and both observation foreign keys were present.

### Canonical Gateway E2E

- Command: `pnpm local:task-runner:e2e --target local --template movie --evidence-dir artifacts/phase-21-local-repair`: **passed**.
- Fresh fixture: movie `phase21-sun064-20260806`, code `SUN-064`, players `0`, source disposition `no_source`, source revision `3`.
- Bounded failure: run `fe59fdbe-4684-4245-bd54-b792e0aa1d50` ended `receipt_missing` with `create_new_task`.
- Command acceptance, duplicate protection, source observation, authoritative readback, dedicated repair receipt, and terminal success shared task/run/attempt identity; successful run `1b7472b8-74a1-433a-8bc2-c59d30df15b4` advanced revision `3 -> 4`.
- Same-movie readback returned three players, two eligible sources, inactive TorrServer preserved as ineligible, and readiness `ready`.
- Ordinary movie run `9706fb17-c83f-47f8-b9a5-67626a36ddbd` succeeded; cancellation run `1706b546-33fa-4f8b-b75b-18f3a35dedb6` reached `cancelled`.
- Redacted pair evidence was written under `artifacts/phase-21-local-repair`; no cookie, secret, signature, raw source, or runner material was present.

### GitNexus scope

- Final staged `detect_changes(scope=staged, repo=starye)` reported **19 expected files, 53 touched symbols, 25 affected flows, risk CRITICAL**. The broad score comes from the cross-layer source reconciliation, internal runner callback, D1 run CAS, and local runner changes in this phase; it contains no files outside the staged Phase 21 source/tests/planning set.
- Targeted upstream impact checks for `acceptRepairSourceObservation`, `createCrawlerRunsRoutes`, `processRunnerEvent`, and `LocalTaskRunner` were individually **LOW**; their direct callers and local E2E flow were covered by the API/crawler regressions and Gateway proof. `AGENTS.md`, `CLAUDE.md`, and generated local evidence remain outside the commit.

## Gateway Proof Boundary

The standard local stack served the exact canonical origin `http://localhost:8080`. The E2E proof crossed the Gateway for command acceptance, runner callbacks, task readback, and same-movie public readback. It proves the local repair_players control-plane vertical slice only; provider dispatch, production execution, browser playback, `playing`, and `currentTime` evidence remain later-phase work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Completed missing runner registry import**

- **Found during:** Task 1 script type-check.
- **Issue:** `driveRepairTask` destructured `createTemplateAdapterRegistry` without importing it.
- **Fix:** Added the dynamic template-adapter registry import in the repair runner path.
- **Files modified:** `scripts/local-task-runner.e2e.ts`
- **Verification:** Standalone TypeScript check and ESLint passed.
- **Committed in:** `cf8af7d`

**2. [Rule 3 - Blocking] Added explicit bounded type narrowing**

- **Found during:** Task 1 script type-check.
- **Issue:** Failure reason and successful terminal next-action fields were broader than the evidence contract.
- **Fix:** Added runtime assertions before assigning those fields to bounded evidence.
- **Files modified:** `scripts/local-task-runner.e2e.ts`
- **Verification:** Standalone TypeScript check passed.
- **Committed in:** `cf8af7d`

**3. [Rule 3 - Blocking] Keep ordinary local runs queued without a configured provider**

- **Found during:** First full Gateway E2E after the fixture was restored.
- **Issue:** `dispatchCreatedRun` claimed a newly created run before checking provider configuration, leaving local ordinary work in `dispatching` where `pollDispatch` only reads `queued` runs.
- **Fix:** Return `provider_not_configured` before association/claim when provider bindings are absent; preserve the existing association/claim/dispatch order when bindings are present. Added an admin route regression for the `queued` state.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts`
- **Verification:** Admin route focused tests 16/16 and full Phase 21 API focused tests 87/87 passed.

**Total deviations:** 2 auto-fixed blocking issues; no scope expansion.

## Known Stubs

None in the modified source. The missing `SUN-064` local D1 row is an environment fixture blocker recorded above, not a fabricated or UI-fed stub.

## Threat Flags

None beyond the plan-declared local evidence and canonical Gateway boundaries. No new endpoint, authentication path, schema, or raw file access was introduced by this plan.

## Next Phase Readiness

Static contracts, runner behavior, migration schema, UI/API regressions, and the canonical local Gateway proof are complete. Phase 22 can start with the existing boundary: local repair success is separate from provider/production repair and actual browser playback proof.

---
*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Plan: 07*
*Status: complete; canonical Gateway local vertical proof passed*

## Self-Check: PASSED

- Summary file exists at the required phase path.
- Code commit `cf8af7d` exists in git history.
- No tracked file deletions were introduced.
- Focused tests, type-checks, migration readback, and canonical Gateway E2E passed.
