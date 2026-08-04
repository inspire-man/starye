---
phase: 18-github-actions-production-orchestration
plan: 06
subsystem: api-crawler-config-integration
tags: [github-actions, d1, libsql, hmac, vitest, target-profile, coverage]

requires:
  - phase: 18-04
    provides: Provider lifecycle state, reconciliation window, cancellation race, retry attempt, and validated receipt contracts.
  - phase: 18-05
    provides: Registry-owned production crawler adapters, fixed workflows, prepared child boundary, and signed terminal receipt path.
provides:
  - LibSQL/D1 API and crawler-run callback integration fixtures covering dispatch, provider binding, polling, receipts, mismatch/lost, cancellation, retry, and late events.
  - Workflow and ActionsEventClient contract coverage for fixed manual/schedule inputs, target resolution, signed callback sequence, Environment binding, prepared entry, and cleanup.
  - Target-profile/prepared mutation integration coverage with secret-free context and a Phase 19 provider-proof handoff contract.
affects: [phase-19-dashboard-operations, production-proof, provider-orchestration]

tech-stack:
  added: []
  patterns: [in-memory LibSQL/D1 lifecycle fixtures, signed Actions callback sequence assertions, fixed prepared-entry target boundary, local-vs-credentialed evidence separation]

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts
    - packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts
    - packages/config/src/deployment-target/__tests__/production-workflow.integration.test.ts
    - .planning/phases/18-github-actions-production-orchestration/18-06-SUMMARY.md
  modified:
    - apps/api/src/domain/crawler-tasks/repository.ts
    - .planning/phases/18-github-actions-production-orchestration/COVERAGE.md

key-decisions:
  - "A validated receipt is copied back into the runner_succeeded transition event before state-machine evaluation; the persisted receipt remains the API-derived validated projection."
  - "Terminal crawler runs reject late provider_started callbacks and retain a redacted terminal_run event outcome, preserving attempt boundaries after provider_lost or cancellation."
  - "Local Gateway/control-plane fixtures are labeled as contract evidence only; credentialed GitHub App, Environment, provider run URL, and terminal receipt remain a Phase 19 target-environment handoff."

patterns-established:
  - "Integration fixtures use deterministic LibSQL/D1 migrations, IDs, clocks, signed envelopes, and SQL row assertions rather than HTTP status alone."
  - "Workflow tests verify fixed registry entry, target, repository, ref, Environment, callback order, and always cleanup without treating dispatch acceptance as success."

requirements-completed: [PROD-01, PROD-02, PROD-03]

coverage:
  - id: D1
    description: "API/D1/provider lifecycle fixture replays manual and scheduled execution through provider binding, poll compensation, validated receipt, mismatch/lost, cancellation, retry, and late-event boundaries."
    requirement: PROD-01
    verification:
      - kind: integration
        ref: "apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Movie and manga workflow shells plus ActionsEventClient preserve fixed inputs, signed callback order, target Environment, prepared child, and unconditional cleanup."
    requirement: PROD-02
    verification:
      - kind: integration
        ref: "packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Target-profile and prepared mutation boundary forwards only declared production credentials and rejects Environment drift or free-form child controls."
    requirement: PROD-03
    verification:
      - kind: integration
        ref: "packages/config/src/deployment-target/__tests__/production-workflow.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Coverage matrix and Phase 19 handoff preserve the distinction between local Gateway proof and credentialed provider proof."
    verification:
      - kind: other
        ref: "node C:/Users/11407/.codex/gsd-core/bin/gsd-tools.cjs query check api-coverage.verify-pre .planning/phases/18-github-actions-production-orchestration"
        status: pass
    human_judgment: true
    rationale: "The exact provider run, Environment secrets, and signed terminal receipt require a target-environment operation owned by Phase 19."

duration: 25 min
completed: 2026-08-01
status: complete
---

# Phase 18 Plan 06: API, Actions, and target-boundary integration Summary

**Deterministic LibSQL/D1 and signed GitHub Actions fixtures now prove the Phase 18 lifecycle locally while handing one exact credentialed provider tuple to Phase 19.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-01T03:29:00+08:00
- **Completed:** 2026-08-01T03:55:32+08:00
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Added real in-memory LibSQL/D1 integration fixtures for manual create, schedule bucket idempotency, provider_started, poll success, three-way receipt validation, mismatch/reconciliation expiry, cancellation, retry attempts, redaction, and late callbacks.
- Added signed crawler-runs route integration coverage and fixed two lifecycle correctness gaps: validated receipts are bound to `runner_succeeded` transitions, and terminal runs reject late provider starts.
- Added workflow/adapter/target-profile contracts for fixed movie/manga entries, `starye-org` Environment, prepared child execution, declared secret forwarding, and `always()` cleanup.
- Re-ran API coverage: 13 capabilities present, 12 integrated, 1 explicitly opted out for credentialed remote production proof.

## Task Commits

Each task was committed atomically (TDD Task 1 has the required test → fix sequence):

1. **Task 1: 验证 API/D1/provider lifecycle vertical contract**
   - `b6a9570` (test: initial failing lifecycle fixture)
   - `64682bc` (fix: bind validated receipts to success transitions)
   - `f68700b` (fix: reject terminal late provider callbacks and expand lifecycle coverage)
   - `4c02c55` (test: signed crawler-runs route integration)
2. **Task 2: 验证 workflow、adapter 与 target boundary**
   - `0fde10f` (test: workflow and target integration contracts)
3. **Task 3: 复核 API coverage 与生产 proof handoff**
   - `d8515d0` (docs: local coverage and Phase 19 handoff)

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts` — LibSQL/D1 provider lifecycle and attempt-boundary fixture.
- `apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` — signed schedule/provider/terminal route fixture.
- `apps/api/src/domain/crawler-tasks/repository.ts` — receipt backfill and terminal provider-start guard.
- `packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts` — static workflow and signed adapter sequence contract.
- `packages/config/src/deployment-target/__tests__/production-workflow.integration.test.ts` — explicit target, Environment, prepared child, and secret boundary contract.
- `.planning/phases/18-github-actions-production-orchestration/COVERAGE.md` — local evidence labels and Phase 19 tuple handoff.

## Decisions Made

- Keep provider identity server-owned and assert the full provider/application/receipt triple before success.
- Treat provider-lost and terminal callback facts as immutable attempt history; a later business retry receives a new attempt and association.
- Keep local evidence on the Gateway boundary and make the credentialed GitHub Actions proof a separate Phase 19 target operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bound the validated receipt to the state-machine success event.**

- **Found during:** Task 1 (manual provider lifecycle fixture)
- **Issue:** `processRunnerEvent` validated and stored the receipt but passed a `runner_succeeded` event without `receipt`, causing `hasValidReceipt` to dereference undefined.
- **Fix:** Copy the original validated candidate receipt onto the transition event while retaining the API-derived receipt projection for persistence.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`
- **Verification:** API integration fixture and repository/regression suites pass.
- **Committed in:** `64682bc`

**2. [Rule 1 - Bug] Reject provider_started after a terminal run.**

- **Found during:** Task 1 (provider mismatch/reconciliation-window fixture)
- **Issue:** A late provider_started callback could bind a provider after provider_lost had already failed the attempt.
- **Fix:** Record a redacted `terminal_run` event outcome and return `accepted: false` before association mutation.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`
- **Verification:** Late callback integration assertion passes; provider association remains unbound.
- **Committed in:** `f68700b`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 correctness bugs).
**Impact on plan:** Both fixes close lifecycle correctness gaps directly exercised by the planned fixtures; no architectural scope expansion.

## Issues Encountered

- The first coverage-gate rerun parsed an added Markdown evidence table as capability rows. The evidence was converted to bullet entries; the canonical gate then passed with 13 capabilities, 12 integrate, and 1 opt-out.
- GitNexus detected a conservative HIGH risk for the repository container because `processRunnerEvent`/`providerStarted` participate in crawler-runs and reconciliation flows. Pre-change impact reports were LOW for both symbols; no unrelated dirty files were staged.
- Existing unrelated dirty and untracked Phase 13 evidence files were preserved and left untouched.

## User Setup Required

None for local contract verification. Phase 19 must configure the GitHub App metadata, installation permission, `starye-org` Environment secrets, and one exact provider run tuple before remote proof can be recorded.

## Next Phase Readiness

- Phase 18 local automation is complete and all three PROD requirements have automated mappings.
- Phase 19 can consume the tuple fields in `COVERAGE.md`: target, template, fixed workflow/repository/ref, D1 run/attempt, provider run/attempt/SHA/URL, callback event bindings, and validated receipt.
- The local fixture results are not remote provider completion; a fresh credentialed target-environment run is required for the handoff to become terminal proof.

## Self-Check: PASSED

- All four integration test files, `COVERAGE.md`, and this summary exist on disk.
- All six production/test/docs commits are present in `git log`.
- Plan-level API, crawler, config, and API coverage commands passed.
- Only this new summary remains uncommitted; unrelated dirty files remain untouched.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-08-01*
