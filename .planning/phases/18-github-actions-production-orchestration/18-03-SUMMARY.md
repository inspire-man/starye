---
phase: 18-github-actions-production-orchestration
plan: 03
subsystem: api-crawler-workflows
tags: [github-actions, hmac, crawler-runs, schedule, provider-callbacks, vitest]

requires:
  - phase: 18-01
    provides: immutable provider snapshots, D1 provider association schema, and fixed target/environment registry
  - phase: 18-02
    provides: request-scoped GitHub App/Actions provider client contracts
provides:
  - strict signed schedule_register, dispatch_validate, provider_started, lifecycle, and receipt callback envelopes
  - D1-backed schedule idempotency and provider association binding with replay/mismatch audit facts
  - signed Actions callback client with bounded registration retries and cancel_requested propagation
  - controlled movie/manga schedule and manual workflow entrypoints
affects: [18-04, 18-05, 18-06, phase-19-dashboard-operations]

tech-stack:
  added: []
  patterns: [independent runner-event HMAC, server-owned provider snapshot, schedule-bucket idempotency, callback CLI adapter]

key-files:
  created:
    - packages/crawler/src/task-runner/actions-event-client.ts
    - packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts
  modified:
    - apps/api/src/schemas/crawler-run-events.ts
    - apps/api/src/routes/internal/crawler-runs/index.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - packages/crawler/src/task-runner/runner-client.ts
    - .github/workflows/daily-movie-crawl.yml
    - .github/workflows/daily-manga-crawl.yml
    - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts

key-decisions:
  - "schedule_register uses the immutable template/target/workflow snapshot and a schedule bucket as the D1 idempotency key."
  - "provider_started updates only the matching D1 association; mismatches create an audit transition and cannot become success."
  - "Actions callbacks use a separate HMAC key, bounded timeout/5xx retries, and return cancel_requested at every safe checkpoint."
  - "Manual dispatch gets a signed dispatch_validate gate; schedule runs register before target resolution and crawler preparation."

patterns-established:
  - "Callback routes verify raw-body HMAC, key rotation, freshness, strict identity, and replay body hash before D1 mutation."
  - "Workflow inputs remain closed to run_id/attempt/template/target; repository/ref/environment/workflow are server-owned constants."

requirements-completed: [PROD-02, PROD-03]

coverage:
  - id: D1
    description: "Strict signed schedule/provider callback schemas and route gates for replay, identity, provider mismatch, and receipt flow."
    requirement: PROD-02
    verification:
      - kind: integration
        ref: "pnpm --filter api exec vitest run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Actions callback adapter serializes/signs events, retries registration only on timeout/5xx, and propagates cancel_requested."
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "pnpm --filter crawler exec vitest run src/task-runner/__tests__/actions-event-client.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Movie and manga schedule/manual workflow entries stay target-profile/environment gated and invoke signed control-plane callbacks."
    requirement: PROD-03
    verification:
      - kind: unit
        ref: "pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/workflow-contract.test.ts"
        status: pass
    human_judgment: false

duration: 33 min
completed: 2026-07-31
status: complete
---

# Phase 18 Plan 03: Signed Actions callback orchestration Summary

**Signed schedule/provider callbacks now bind GitHub Actions runs to D1 attempts, while movie and manga workflows use closed manual/schedule control-plane gates.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-31T17:47:40Z
- **Completed:** 2026-07-31T18:20:08Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Added strict schedule registration, manual dispatch validation, provider-started binding, and lifecycle event schemas/routes with raw-body HMAC, rotation, freshness, identity, replay, sequence, and receipt gates.
- Added D1 schedule-bucket idempotency and provider association updates; provider mismatch is retained as an audit fact and cannot produce a successful terminal state.
- Added `ActionsEventClient` plus CLI entrypoints for schedule registration, dispatch validation, provider start, progress, logs, cancellation, and terminal receipts with bounded retries.
- Reworked both production crawler workflows so schedule/manual triggers resolve fixed target-profile/environment values before signed callbacks and prepared crawler entry execution; manga no longer accepts `target_url`.

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展签名事件 envelope 与内部 route**
   - `3544beb` test RED: signed callback route coverage
   - `70cb2f4` feat: signed callback lifecycle and D1 provider association handling
2. **Task 2: 增加 Actions callback client 与 schedule 注册重试**
   - `c8546d5` test RED: Actions callback client coverage
   - `d16f6ef` feat: signed Actions event client
   - `47e579e` fix: workflow CLI entrypoints
3. **Task 3: 收口 movie/manga workflow 的手动与 schedule 入口**
   - `7cde654` feat: controlled production crawler workflows and workflow contract coverage

## Files Created/Modified

- `apps/api/src/schemas/crawler-run-events.ts` - strict callback event union for schedule, dispatch validation, provider start, lifecycle, and receipt payloads.
- `apps/api/src/routes/internal/crawler-runs/index.ts` - signed schedule-register, dispatch-validate, provider-started, and lifecycle routes.
- `apps/api/src/domain/crawler-tasks/repository.ts` - schedule idempotency, provider association binding, dispatch validation, and mismatch audit facts.
- `packages/crawler/src/task-runner/actions-event-client.ts` - signed Actions adapter and workflow CLI.
- `packages/crawler/src/task-runner/runner-client.ts` - shared deterministic runner envelope builder.
- `.github/workflows/daily-movie-crawl.yml` / `.github/workflows/daily-manga-crawl.yml` - closed schedule/manual orchestration gates and callback checkpoints.
- `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` - signed route regression coverage.
- `packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts` - retry/signature/cancel/receipt regression coverage.
- `packages/config/src/deployment-target/__tests__/workflow-contract.test.ts` - workflow trigger, input, environment, callback, and cleanup contract coverage.

## Decisions Made

- Kept provider identity server-owned and reused the Phase 18-01 association table instead of adding a second lifecycle state machine.
- Used schedule `template + target + workflow + schedule_bucket` uniqueness so duplicate GitHub schedule deliveries return the existing application run.
- Kept `dispatch_validate` as a signed read-only gate for manual inputs; it validates the D1 run/attempt/template before provider start.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Capability] Added repository persistence methods omitted from the file list.**

- **Found during:** Task 1 (schedule/provider callback route implementation)
- **Issue:** The existing repository exposed only local runner lifecycle methods; schedule registration and provider association callbacks had no D1 mutation boundary.
- **Fix:** Added `scheduleRegister`, `providerStarted`, and `validateDispatch` using the existing `crawler_run_provider_association`, runner-event replay table, state transitions, and audit rows.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`
- **Verification:** API route regression and API type-check pass.
- **Committed in:** `70cb2f4` and `7cde654`

**2. [Rule 1 - Validation/Tooling] Resolved lint-staged callback-client and contract-test violations.**

- **Found during:** Task 2/Task 3 commits
- **Issue:** ESLint rejected mixed boolean operators and literal GitHub expression text in a test assertion.
- **Fix:** Added explicit parentheses and reused the existing expression helper.
- **Files modified:** `packages/crawler/src/task-runner/actions-event-client.ts`, `packages/config/src/deployment-target/__tests__/workflow-contract.test.ts`
- **Verification:** Pre-commit hooks pass; targeted Vitest and type-check pass.
- **Committed in:** `47e579e` and `7cde654`

**Total deviations:** 2 auto-fixed (1 missing critical persistence boundary, 1 validation/tooling correction).
**Impact on plan:** Both changes close required callback/control-plane behavior without changing the provider registry or state-machine architecture.

## Issues Encountered

- GitNexus initially reported the repository index eight commits stale; `npx gitnexus analyze` rebuilt it before impact analysis.
- Existing unrelated dirty files and Phase 13 evidence remain untouched and unstaged.

## User Setup Required

None - no user setup artifact was requested by this plan. The target GitHub Environment must provide the callback URL and independent `TASK_RUNNER_CALLBACK_*` secrets before a real provider run.

## Next Phase Readiness

- Phase 18-04 can consume the provider association and callback outcomes for polling/reconciliation, cancellation, and retry handling.
- All plan-level automated checks pass; no live GitHub provider run was attempted.

## Self-Check: PASSED

- Required summary and callback/workflow artifacts exist.
- Task commits are present in `git log`.
- All three acceptance suites and API/crawler type-checks pass.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-07-31*
