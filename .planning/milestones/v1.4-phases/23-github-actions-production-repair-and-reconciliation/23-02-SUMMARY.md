---
phase: 23-github-actions-production-repair-and-reconciliation
plan: 02
subsystem: infra
tags: [github-actions, crawler, repair-players, runner, hmac, lease]

# Dependency graph
requires:
  - phase: 23-01
    provides: server-owned provider snapshots, fixed workflow dispatch bindings, and bounded provider readback
provides:
  - shared movie workflow contract coverage for post-claim repair dispatch
  - fail-closed movie-only repair adapter selection and bounded readback receipt handling
  - signed production runner poll, claim, lease, source-observation, and terminal callback binding
affects: [23-03, 23-04, 23-05, production-repair]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - strict control envelopes are separate from provider-bound lifecycle envelopes
    - the claimed server snapshot is the only authority for operation-aware adapter selection
    - rejected lease callbacks stop the current attempt before any success callback

key-files:
  created:
    - .planning/phases/23-github-actions-production-repair-and-reconciliation/23-02-SUMMARY.md
  modified:
    - packages/crawler/scripts/target-crawl-mutation.ts
    - packages/crawler/src/task-runner/template-adapters.ts
    - packages/crawler/src/task-runner/repair-adapter.ts
    - packages/crawler/src/task-runner/actions-event-client.ts
    - packages/crawler/src/task-runner/runner-client.ts
    - packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts
    - packages/crawler/src/task-runner/__tests__/production-adapter.test.ts
    - packages/crawler/src/task-runner/__tests__/template-adapters.test.ts
    - packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts
    - packages/crawler/src/task-runner/__tests__/runner-client.test.ts

key-decisions:
  - "Keep poll and claim as strict control envelopes; provider and source-revision fields remain on lifecycle/source callbacks for the Plan 04 schema boundary."
  - "Select repair_players only from the validated claimed movie snapshot and never fall back to ordinary movie crawling."
  - "Treat an accepted=false heartbeat as a bounded runner failure so a lost lease cannot reach a success callback."
  - "Keep default repair source discovery as an explicit injected boundary until a canonical movie.id-to-source read contract is planned."

patterns-established:
  - "Production runner order: poll -> validate -> claim -> provider-start -> heartbeat -> adapter select -> bounded facts -> terminal receipt."
  - "Runner callbacks retain run, application attempt, provider tuple, sequence, event ID, nonce, timestamp, and source revision where applicable."

requirements-completed: [REP-02, REP-03]

coverage:
  - id: D1
    description: "Existing movie workflow keeps only fixed run_id, attempt, template, and target inputs and validates dispatch before execution."
    requirement: REP-03
    verification:
      - kind: integration
        ref: "packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A claimed movie repair snapshot selects the repair adapter after claim, rejects malformed contracts, and preserves bounded receipt/readback checks."
    requirement: REP-03
    verification:
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/template-adapters.test.ts"
        status: pass
      - kind: integration
        ref: "packages/crawler/src/task-runner/__tests__/production-adapter.test.ts"
        status: pass
    human_judgment: true
    rationale: "The focused suite proves the injected discovery and callback contract; live provider source discovery is not wired by this plan."
  - id: D3
    description: "Signed runner poll, claim, lifecycle, source observation, lease, and terminal envelopes keep the production identity tuple bounded and redacted."
    requirement: REP-02
    verification:
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/runner-client.test.ts"
        status: pass
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Crawler focused regression suite and type-check pass after the production runner continuation."
    verification:
      - kind: other
        ref: "pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/production-workflow.integration.test.ts src/task-runner/__tests__/template-adapters.test.ts src/task-runner/__tests__/production-adapter.test.ts src/task-runner/__tests__/actions-event-client.test.ts src/task-runner/__tests__/runner-client.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/crawler type-check"
        status: pass
    human_judgment: false

# Metrics
metrics:
  duration: unmeasured-continuation
  completed: 2026-08-07
status: complete
---

# Phase 23 Plan 02: Production Repair Runner Binding Summary

**Shared movie workflow repair dispatch with post-claim snapshot selection, signed runner identity binding, and lease fail-closed behavior**

## Performance

- **Duration:** unmeasured-continuation after prior executor timeout
- **Started:** continuation after prior executor timeout
- **Completed:** 2026-08-07
- **Tasks:** 3
- **Files modified:** 10 source/test files across the plan (plus this summary)

## Accomplishments

- Kept the existing movie workflow as the shared scheduled/manual production boundary and covered its fixed four-input dispatch contract.
- Added movie-only post-claim repair adapter selection with strict snapshot validation, bounded source observation, authoritative readback equality, and no ordinary-crawl fallback.
- Bound production runner calls to the application/provider tuple and signed envelope facts, with strict poll/claim control payloads and lease rejection stopping the current attempt before success.
- Preserved the existing RED/GREEN history and verified the complete five-file focused suite at 28/28 tests plus crawler type-check.

## Task Commits

Each task was committed atomically (TDD tasks include their RED/GREEN commits):

1. **Task 1: Reuse the fixed movie workflow for repair dispatch** - `56001a1` (test)
2. **Task 2: Select and run the movie repair adapter after claim** - `3763c9d` (RED), `8f9fe44` (GREEN), with production integration coverage completed in `480cff6`
3. **Task 3: Bind production poll, claim, lease, and signed runner calls** - `f96b19c` (RED), `480cff6` (GREEN)

The production-code continuation commit is `480cff6` (`feat(23-02): bind production repair runner lifecycle`).

## Files Created/Modified

- `packages/crawler/scripts/target-crawl-mutation.ts` - polls and claims the server snapshot, selects the registry adapter, renews the lease, and emits bounded terminal facts.
- `packages/crawler/src/task-runner/runner-client.ts` - validates candidates, creates strict control envelopes, signs bound lifecycle/source callbacks, and sanitizes repair receipts.
- `packages/crawler/src/task-runner/actions-event-client.ts` - carries provider run identity on signed provider lifecycle callbacks.
- `packages/crawler/src/task-runner/template-adapters.ts` - validates operation-aware movie and repair snapshot selection.
- `packages/crawler/src/task-runner/repair-adapter.ts` - validates source observation/readback and maps bounded failures.
- `packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts` - shared workflow contract regressions.
- `packages/crawler/src/task-runner/__tests__/template-adapters.test.ts` - fail-closed registry and repair contract regressions.
- `packages/crawler/src/task-runner/__tests__/production-adapter.test.ts` - poll/claim ordering, repair execution, lease, cancellation, receipt, and redaction regressions.
- `packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts` - signed provider callback and bounded retry regressions.
- `packages/crawler/src/task-runner/__tests__/runner-client.test.ts` - candidate binding, strict control envelopes, source observation, receipt, and time injection regressions.

## Decisions Made

- The workflow remains the shared movie job; operation, movie identity, source revision, reason, and target intent stay in the server-owned claimed snapshot.
- Poll and claim use only the strict control fields accepted by the current API schema. Provider and source-revision fields remain on the callbacks that Plan 04 will extend at the API boundary.
- A rejected heartbeat is treated as a runner failure and cannot be followed by an ordinary or repair success event.
- The runner keeps raw source details inside the source-observation boundary and emits only bounded receipt fields on terminal success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed provider and repair fields from strict poll/claim envelopes**

- **Found during:** Task 3
- **Issue:** The current API poll and claim schemas are strict and reject provider identity/source revision fields in those control requests.
- **Fix:** Split pure control envelope construction from provider-bound lifecycle/source envelope construction and added exact payload assertions.
- **Files modified:** `packages/crawler/src/task-runner/runner-client.ts`, `packages/crawler/src/task-runner/__tests__/runner-client.test.ts`
- **Verification:** Focused runner tests and crawler type-check passed.
- **Committed in:** `480cff6`

**2. [Rule 1 - Bug] Stopped production execution after a rejected lease heartbeat**

- **Found during:** Task 3
- **Issue:** `accepted: false` was treated like a normal heartbeat and could allow the adapter to report success after lease/runner rejection.
- **Fix:** Convert heartbeat rejection into a bounded failure in both runner-backed and legacy provider-backed production checkpoints, with regression coverage proving no success callback follows.
- **Files modified:** `packages/crawler/scripts/target-crawl-mutation.ts`, `packages/crawler/src/task-runner/__tests__/production-adapter.test.ts`
- **Verification:** Focused suite passed 28/28.
- **Committed in:** `480cff6`

**3. [Rule 1 - Bug] Made default source-observation timestamps honor the injected clock**

- **Found during:** Task 3
- **Issue:** `observeRepairSource()` used wall-clock `Date.now()` instead of the configured clock, making signed request tests and bounded timing behavior non-deterministic.
- **Fix:** Derive the fallback observation timestamp from `this.now()` and assert it in the runner client regression.
- **Files modified:** `packages/crawler/src/task-runner/runner-client.ts`, `packages/crawler/src/task-runner/__tests__/runner-client.test.ts`
- **Verification:** Focused runner tests passed.
- **Committed in:** `480cff6`

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)

**Impact on plan:** All fixes were required for the strict API contract, lease correctness, or deterministic signed facts. No unrelated files were changed.

## Issues Encountered

- The prior executor timed out after the RED/partial GREEN commits and before the plan summary; the continuation verified the existing commits and resumed only the remaining declared changes.
- The first normal commit attempt was rejected by commitlint because PowerShell passed literal `\\n` text in the body. The same staged files were committed with separate message arguments and normal hooks passed.
- GitNexus staged-change detection reported an aggregate `critical` risk, but its changed files and affected execution flows were limited to the expected crawler runner/action paths; prior symbol impact reports were MEDIUM for `RunnerClient` and LOW for the other edited symbols.

## Known Stubs

- `packages/crawler/src/task-runner/repair-adapter.ts:106` - production repair source discovery still requires the explicit `discoverSources` dependency. `target-crawl-mutation.ts` intentionally does not invent a default movie source resolver because the repository has no canonical `movie.id` to source-read contract in this plan. The adapter therefore fails closed with `repair source discovery is not configured` when a real production repair run lacks that injected boundary. The focused tests prove post-claim selection, bounded observation, and readback validation; live provider source discovery remains a follow-up boundary for production proof.

## Threat Scan

- No additional threat flags were found beyond the plan threat register. The new runner-to-internal-API path is the declared T-23-07/T-23-08/T-23-09 surface, and the implementation keeps strict envelopes, HMAC signing, bounded fields, and lease checkpoints.

## User Setup Required

None - no external service configuration or credential setup was required.

## Next Phase Readiness

- 23-03 can consume the claimed runner lifecycle and bounded provider/source facts for retry, reconciliation, and source CAS.
- 23-04 can extend the API schemas/routes for the provider tuple and runner source-revision fields already emitted by the clients.
- A future production proof must supply the canonical source-discovery implementation before claiming a live repair success.

## Self-Check: PASSED

- Summary file exists on disk.
- Task commits `56001a1`, `3763c9d`, `8f9fe44`, `f96b19c`, and `480cff6` exist in git history.
- No tracked files were deleted by the production commit.
- Focused suite passed 5 files / 28 tests, crawler type-check passed, and `git diff --check` passed.

---
*Phase: 23-github-actions-production-repair-and-reconciliation*
*Plan: 02*
*Completed: 2026-08-07*
