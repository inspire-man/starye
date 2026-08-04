---
phase: 18-github-actions-production-orchestration
plan: 05
subsystem: crawler-config-workflows
tags: [github-actions, crawler, prepared-mutation, receipt, cancellation, vitest]

requires:
  - phase: 18-03
    provides: Signed Actions event client, callback envelopes, and closed schedule/manual workflow gates.
  - phase: 18-04
    provides: D1 provider lifecycle, receipt gate, cancellation race, and retry-attempt contracts.
provides:
  - Registry-owned movie and manga production crawler adapters with signed lifecycle callbacks.
  - Closed production prepared-mutation entries, secret allowlists, and workflow execution boundary.
  - Receipt, partial-ingest, cancellation-race, retry, and redaction contract coverage.
affects: [18-06, phase-19-dashboard-operations, production-orchestration]

tech-stack:
  added: []
  patterns: [prepared-child lifecycle ownership, fixed production operation registry, receipt-gated success]

key-files:
  created: []
  modified:
    - packages/crawler/scripts/target-crawl-mutation.ts
    - packages/crawler/src/task-runner/movie-adapter.ts
    - packages/crawler/src/task-runner/manga-adapter.ts
    - packages/crawler/src/task-runner/actions-event-client.ts
    - packages/crawler/src/task-runner/__tests__/production-adapter.test.ts
    - packages/config/src/deployment-target/mutation-entry.ts
    - packages/config/src/deployment-target/__tests__/mutation-entry.test.ts
    - packages/config/src/deployment-target/__tests__/crawler-source-entry-contract.test.ts
    - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
    - .github/workflows/daily-movie-crawl.yml
    - .github/workflows/daily-manga-crawl.yml

key-decisions:
  - "Only the matching prepared child may emit production lifecycle events and terminal receipts; workflow shells retain validate, prepare, run, and cleanup orchestration."
  - "movie-production and manga-production use fixed target/profile/template/provider bindings; free-form operation, URL, command, target, and secret inputs fail closed."
  - "A success requires a signed terminal event plus a non-empty receipt matching content ID, template, provider, run, and attempt; partial ingest and cancellation facts remain queryable."

patterns-established:
  - "Actions adapter checkpoints read cancel_requested before further crawler work and report cancel_not_effective when a verified success wins the race."
  - "Production registry tests enumerate entry, secret, path, cleanup, and cross-template boundaries rather than trusting workflow input shape."

requirements-completed: [PROD-02, PROD-03]

coverage:
  - id: D1
    description: "Movie/manga registry-owned production adapters send signed provider lifecycle events and matching validated receipts."
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "pnpm --filter crawler exec vitest run src/task-runner/__tests__/production-adapter.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Prepared mutation registry and workflows expose only fixed production entries, secret allowlists, and cleanup paths."
    requirement: PROD-03
    verification:
      - kind: integration
        ref: "pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__"
        status: pass
    human_judgment: false
  - id: D3
    description: "Receipt mismatch, partial ingest, late cancellation, retry attempt, and secret redaction contracts remain fail-closed."
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/production-adapter.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-01
status: complete
---

# Phase 18 Plan 05: Production crawler adapters Summary

**GitHub-hosted movie and manga crawlers now execute only fixed registry-owned prepared entries, return signed lifecycle facts, and close successfully only on a binding-matched non-empty receipt.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-01T03:06:21+08:00
- **Completed:** 2026-08-01T03:21:00+08:00
- **Tasks:** 3/3
- **Files modified:** 11

## Accomplishments

- Added `movie-production` and `manga-production` operations to the guarded prepared-context crawler boundary, including `provider_started`, heartbeat, progress/log, cancellation, failure, and success-receipt events.
- Kept site crawler transport and API synchronization in the crawler process while propagating observed content identifiers into the validated receipt path.
- Closed production mutation entries and GitHub workflows to fixed `starye-org` profile/environment bindings, allowed secrets, generated prepared context, and unconditional cleanup.
- Added contract coverage for empty and mismatched receipts, partial ingest, late cancellation/cancel-not-effective, retry attempts, and payload/header/error redaction.

## Task Commits

Each task was committed atomically:

1. **Task 1: 加入 registry-owned movie/manga production operations** - `a2b4e59` (feat)
2. **Task 2: 更新 prepared mutation registry 与来源契约** - `cbef532` (feat)
3. **Task 3: 验证 receipt、部分入库和取消竞态契约** - `57bd6ce` (test)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `packages/crawler/scripts/target-crawl-mutation.ts` - closed movie/manga production dispatch and receipt/cancellation control flow.
- `packages/crawler/src/task-runner/movie-adapter.ts` / `manga-adapter.ts` - synchronize observed content IDs through the existing crawler transport.
- `packages/crawler/src/task-runner/actions-event-client.ts` - builds the fixed run/attempt/provider binding from the prepared environment.
- `packages/crawler/src/task-runner/__tests__/production-adapter.test.ts` - production receipt, retry, cancellation, partial-ingest, and redaction contracts.
- `packages/config/src/deployment-target/mutation-entry.ts` - fixed production entries, options, and required-secret allowlists.
- `.github/workflows/daily-movie-crawl.yml` / `daily-manga-crawl.yml` - prepared-child-only execution path with unconditional cleanup.

## Decisions Made

- Preserved the Worker as control plane only; Puppeteer/crawler transport remains in the prepared GitHub Actions child process.
- Kept `validate-dispatch -> prepare -> run-prepared-entry -> cleanup` as the workflow lifecycle, with provider events and terminal receipts emitted by the prepared child alone.
- Rejected empty receipts and any run/attempt/provider/template/content-ID mismatch before success is reported; partial-ingest audit detail remains available on failure or cancellation.

## GitNexus Impact Analysis

- `runTargetCrawlerMutation`: LOW — 1 direct caller, no affected execution flow.
- `prepareTargetMutation` and `runPreparedTargetMutation`: LOW — 3 direct callers; affected flows are `runDataChainSmoke` and `runTargetProfileCli`.
- `ActionsEventClient`: LOW — 1 direct caller in the task-runner CLI flow.
- **HIGH/CRITICAL:** none for this plan; no escalation was required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Capability] Moved workflow lifecycle callbacks into the prepared child.**

- **Found during:** Task 2 (prepared mutation registry and source contracts)
- **Issue:** Shell-level lifecycle/receipt handling could produce an empty receipt or collide with the prepared child's event sequence.
- **Fix:** Retained only validate, prepare, run-prepared-entry, and unconditional cleanup in both workflows; the registry-owned child now owns provider start, checkpoints, logs, and terminal receipt.
- **Files modified:** `.github/workflows/daily-movie-crawl.yml`, `.github/workflows/daily-manga-crawl.yml`, `packages/crawler/src/task-runner/actions-event-client.ts`, and workflow/source contract tests.
- **Verification:** Full deployment-target contract suite and production-adapter suite pass.
- **Committed in:** `cbef532`

---

**Total deviations:** 1 auto-fixed (1 lifecycle correctness closure). **Impact on plan:** Required to preserve one signed event sequence and receipt authority; no crawler transport or Worker scope expansion.

## Issues Encountered

- The plan references `18-CONTEXT.md`, but that file is absent. The decision-coverage check therefore returned `skipped`; the implemented work followed the executable plan, `18-RESEARCH.md`, `18-PATTERNS.md`, and preceding summaries.
- The initial parallel full config-suite run observed two unrelated Phase 13 process-test timeouts. The canonical full deployment-target suite was rerun and passed; no production-adapter failure remained.
- Existing user changes in `.planning/config.json`, `AGENTS.md`, `CLAUDE.md`, dashboard/API files, and the large Phase 13 evidence tree remain untouched and unstaged.

## Verification

- PASS `pnpm --filter crawler exec vitest run src/task-runner/__tests__/production-adapter.test.ts` (1 file, 8 tests)
- PASS `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__` (31 files, 273 tests)
- PASS `pnpm --filter crawler type-check`

## Self-Check: PASSED

- All three task commits are present in `git log` and all required production adapter/registry artifacts exist.
- Every task acceptance suite and the plan-level verification commands pass.
- Production paths remain fixed to registry-owned prepared entries; no free-form child operation or secret input is accepted.

## User Setup Required

None for local contract verification. A credentialed GitHub Actions run remains a target-environment proof for the later production handoff.

## Next Phase Readiness

- 18-06 can exercise the closed API/D1/Actions integration fixture against these adapter and receipt contracts.
- The Phase 18 production-proof boundary remains explicit: local/Gateway contract evidence does not substitute for a credentialed provider run.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-08-01*
