---
phase: 17-local-runner-vertical-slice
plan: 01
subsystem: crawler-control-plane
tags: [hono, valibot, hmac, d1, node, puppeteer, vitest]
requires:
  - phase: 16-task-domain-foundation
    provides: API-owned crawler run repository, lifecycle state machine, and callback key rotation
provides:
  - Strict signed runner poll and claim control-plane routes
  - A single-active-run local Node daemon with closed movie and manga adapters
  - Cooperative cancellation acknowledgement and deterministic runner tests
affects: [17-02, 17-03, phase-18, phase-19]
tech-stack:
  added: []
  patterns: [exact-byte HMAC callbacks, post-CAS replay outcomes, local-only runner configuration, one-active-run daemon]
key-files:
  created:
    - packages/crawler/src/task-runner/local-runner.ts
    - packages/crawler/src/task-runner/runner-client.ts
    - scripts/local-task-runner.ts
  modified:
    - apps/api/src/routes/internal/crawler-runs/index.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - packages/crawler/src/core/optimized-crawler.ts
    - packages/crawler/src/crawlers/comic-crawler.ts
key-decisions:
  - "Poll is read-only; claim records and replays the actual CAS result only after the repository decision."
  - "The runner has one in-flight poll/claim and one active run, while cancellation is observed only at heartbeat checkpoints."
  - "Movie and manga adapters expose source-safe candidate codes/slugs only after existing API sync acknowledgement; API remains receipt authority."
patterns-established:
  - "Runner clients serialize once, HMAC that exact UTF-8 body, and never log callback secrets or raw headers."
  - "Public adapter selection is closed to API-issued movie/manga snapshots; controlled adapters stay test-only."
requirements-completed: [LOCAL-01, LOCAL-02]
coverage:
  - id: D1
    description: Strict signed poll/claim routes and post-CAS replay outcomes
    requirement: LOCAL-01
    verification:
      - kind: unit
        ref: pnpm --filter api test --run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter api test --run src/domain/crawler-tasks/__tests__/repository.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local serial runner, HMAC client, closed adapters, and cooperative cancellation
    requirement: LOCAL-02
    verification:
      - kind: unit
        ref: pnpm --filter @starye/crawler test --run src/task-runner/__tests__/event-signer.test.ts src/task-runner/__tests__/runner-client.test.ts src/task-runner/__tests__/local-runner.test.ts src/task-runner/__tests__/template-adapters.test.ts
        status: pass
      - kind: other
        ref: pnpm --filter @starye/crawler type-check
        status: pass
    human_judgment: false
metrics:
  duration: 44m
  completed: 2026-07-30
status: complete
---

# Phase 17 Plan 01: Local Runner Control Plane Summary

**Signed API-owned poll/claim control plane and a one-active-run local Node crawler daemon for closed movie/manga snapshots.**

## Performance

- **Duration:** 44 min
- **Tasks:** 2/2
- **Files modified:** 22

## Accomplishments

- Added strict Valibot poll/claim DTOs, exact raw-body HMAC verification, key rotation, timestamp validation, and API-only work snapshots.
- Bound signed claims to run, attempt, and sequence; D1 persists the actual CAS result after transition, so stale/rejected callbacks never replay as accepted.
- Added local-only `local:task-runner`, byte-signed client, serial daemon, closed movie/manga registry, source-safe sync observers, and deterministic cooperative-cancellation coverage.

## Task Commits

1. **Task 1: strict poll/claim and actual CAS outcomes** — `2d82b4d` (RED tests), `e36352f` (feature)
2. **Task 2: serial local runner and fixed adapters** — `c5d934f` (feature)

## Files Created/Modified

- `apps/api/src/routes/internal/crawler-runs/index.ts` — signed poll/claim boundaries and heartbeat cancellation projection.
- `apps/api/src/domain/crawler-tasks/repository.ts` — read-only queue discovery, signed-claim idempotency, and post-CAS outcomes.
- `packages/crawler/src/task-runner/` — signer, runner client, daemon, registry, adapters, and focused tests.
- `scripts/local-task-runner.ts` — local process entry reading only `TASK_RUNNER_LOCAL_CONFIG`.

## Decisions Made

- Reused the Phase 16 repository/state machine as the exclusive queue, lease, and lifecycle authority.
- Kept generic `ApiClient.syncMovie()` unchanged; crawler subclasses only observe successful sync candidates.
- `cancel_requested` is an API-owned heartbeat response flag; runners do not kill Puppeteer or issue success receipts after cancellation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added repository-backed poll/claim idempotency**
- **Found during:** Task 1
- **Issue:** The existing repository exposed only `claimDispatch(runId)` and stored lifecycle `accepted` outcomes before CAS.
- **Fix:** Added API-owned queued discovery plus signed-claim bindings and persisted actual transition outcomes after the decision.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`, repository tests
- **Verification:** API route/repository focused tests and API type-check pass.
- **Committed in:** `e36352f`

**2. [Rule 2 - Missing critical functionality] Projected cancellation at heartbeat checkpoints**
- **Found during:** Task 2
- **Issue:** The runner could emit heartbeats but could not observe an API `cancel_requested` state.
- **Fix:** Added a safe API-owned cancellation flag to lifecycle acknowledgement responses and exercised deterministic cancellation without success receipt.
- **Files modified:** crawler-runs route/tests and local runner tests
- **Verification:** route tests and runner tests pass.
- **Committed in:** `c5d934f`

**3. [Rule 1 - Test fixture] Corrected the claim replay double to return repository conflict**
- **Found during:** Task 1
- **Issue:** The route test expected a replay conflict without creating a prior repository event.
- **Fix:** The injected repository double now explicitly returns `conflict`, matching the production persistence boundary.
- **Files modified:** crawler-runs route test
- **Verification:** all eight route tests pass.
- **Committed in:** `e36352f`

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 1). All were required for secure runner operation and did not widen into Worker, Pages, GitHub Actions, or target mutation.

## GitNexus Review

- Pre-change impacts: runner route/repository and crawler sync methods were LOW; `ApiClient` was MEDIUM and remained unmodified.
- Pre-commit detect-changes reported HIGH because the expected `processManga` and HMAC route flows are central execution paths. Focused regression tests and API/crawler type-checks passed.

## Verification

- `pnpm --filter api test --run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` — pass (8 tests)
- `pnpm --filter api test --run src/domain/crawler-tasks/__tests__/repository.test.ts` — pass (6 tests)
- `pnpm --filter api type-check` — pass
- `pnpm --filter @starye/crawler test --run src/task-runner/__tests__/event-signer.test.ts src/task-runner/__tests__/runner-client.test.ts src/task-runner/__tests__/local-runner.test.ts src/task-runner/__tests__/template-adapters.test.ts` — pass (6 tests)
- `pnpm --filter @starye/crawler type-check` — pass
- `pnpm --filter @starye/crawler run local:task-runner --help` — pass
- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/crawler-source-entry-contract.test.ts` — pass

## User Setup Required

Set `TASK_RUNNER_LOCAL_CONFIG` to an ignored local JSON file containing the API base URL, callback key ID/secret, and crawler credentials. It is intentionally not projected to browser, Worker, Pages, or GitHub Actions configuration.

## Next Phase Readiness

Phase 17 Plans 02 and 03 can now consume the signed API control plane and local daemon contracts for receipt validation, Dashboard workflow, and Gateway-scoped end-to-end evidence.

## Self-Check: PASSED

- Verified commits `2d82b4d`, `e36352f`, and `c5d934f` exist.
- Verified all local runner, route, schema, repository, and summary artifacts exist.
