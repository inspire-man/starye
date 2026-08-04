---
phase: 16-task-domain-foundation
plan: 03
subsystem: api
tags: [hono, cloudflare-workers, d1, hmac, replay-protection, cron]

requires:
  - phase: 16-01
    provides: D1 crawler task repository, lifecycle CAS, event receipts, and bounded detailed logs
provides:
  - Independent current/previous-key Web Crypto HMAC verification for runner callbacks
  - Raw-body internal run-event route with strict envelope, replay, attempt, and receipt binding
  - Daily repository-scoped expiry cleanup for detailed crawler run logs
affects: [phase-17-local-runner, phase-18-github-actions-orchestration, phase-19-task-dashboard]

tech-stack:
  added: []
  patterns: [raw-body-before-parse HMAC verification, receipt-digest replay classification, injected scheduled cleanup]

key-files:
  created:
    - apps/api/src/domain/crawler-tasks/runner-event-auth.ts
    - apps/api/src/domain/crawler-tasks/log-redaction.ts
    - apps/api/src/schemas/crawler-run-events.ts
    - apps/api/src/routes/internal/crawler-runs/index.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
    - apps/api/src/__tests__/crawler-task-log-cleanup.test.ts
  modified:
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/lib/auth.ts
    - apps/api/src/index.ts
    - apps/api/wrangler.toml

key-decisions:
  - "Runner callbacks use separate callback bindings and never reuse the broad CRAWLER_SECRET service credential."
  - "The repository stores a fixed response outcome before state handling so identical signed replays are side-effect free, while body/event/nonce mismatches are conflicts."
  - "The scheduled Worker delegates only to purgeExpiredRunLogs, keeping task, run, transition, and terminal-summary retention outside the cron scope."

patterns-established:
  - "Verify raw bytes and a non-secret key ID before JSON decoding or Valibot validation."
  - "Use an injected scheduled dependency to test Worker maintenance without live D1."

requirements-completed: [OPS-01, CTRL-03]

coverage:
  - id: D1
    description: Current/previous raw-body HMAC verification and redact-before-write runner event normalization
    requirement: OPS-01
    verification:
      - kind: unit
        ref: apps/api/src/domain/crawler-tasks/__tests__/runner-event-auth.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: HMAC-only internal crawler run event route with attempt, timestamp, replay, and receipt protections
    requirement: CTRL-03
    verification:
      - kind: integration
        ref: apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
        status: pass
      - kind: integration
        ref: apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Daily detailed-log expiry hook that delegates solely to the repository cleanup contract
    requirement: OPS-01
    verification:
      - kind: unit
        ref: apps/api/src/__tests__/crawler-task-log-cleanup.test.ts
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-07-30
status: complete
---

# Phase 16 Plan 03: Runner Event HMAC and Retention Summary

**Raw-body HMAC runner callbacks with key rotation, replay-safe D1 lifecycle binding, redacted bounded logs, and daily detailed-log expiry.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-30T15:54:58+08:00
- **Completed:** 2026-07-30T16:23:27+08:00
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments

- Added native Web Crypto HMAC validation with non-secret key IDs, exact 24-hour previous-key validity, and safe log normalization before persistence.
- Mounted `POST /api/internal/crawler-runs/:runId/events`, which verifies untouched request bytes before strict parsing and binds events to attempt, key, run, timestamp, sequence, receipt, and D1 replay receipts.
- Added a daily Cloudflare Worker cron whose scheduled handler delegates solely to `purgeExpiredRunLogs(now)` through `waitUntil`.

## Task Commits

1. **Task 1: Test native HMAC key rotation and redact-before-write event normalization** - `1b2315b` (feat)
2. **Task 2: Expose the HMAC-only raw event route and bind it to D1 idempotency** - `0146c78` (feat), `836d3bb` (style)
3. **Task 3: Schedule and test detailed-log expiry cleanup** - `cc92afe` (feat)

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/runner-event-auth.ts` - Web Crypto signature verification with current/previous callback keys.
- `apps/api/src/domain/crawler-tasks/log-redaction.ts` - allowlisted, redacted, UTF-8-bounded storage projections.
- `apps/api/src/domain/crawler-tasks/repository.ts` - attempt/template-bound receipt processing with duplicate and conflict classification.
- `apps/api/src/routes/internal/crawler-runs/index.ts` - HMAC-only lifecycle callback router.
- `apps/api/src/index.ts` - internal router mount plus injected scheduled detailed-log cleanup handler.
- `apps/api/wrangler.toml` - daily cron trigger.

## Decisions Made

- The callback key selection happens only from the request key ID; no endpoint path uses `serviceAuth`, cookies, or `CRAWLER_SECRET` as authorization.
- A matching event ID, nonce, and body digest returns its stored fixed outcome. Any mismatch of these bindings is rejected before a lifecycle mutation.
- Terminal success requires a receipt matching the task's server-owned template; receipt fields are rejected for non-success events.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added receipt conflict and stored-outcome processing to the repository.**
- **Found during:** Task 2
- **Issue:** The existing receipt insert returned only a boolean, so the route could not distinguish an identical replay from a reused event ID or nonce with a changed body, nor return a stored outcome.
- **Fix:** Added the parameter-bound `processRunnerEvent` repository path, which validates the immutable attempt and receipt template, compares persisted event/nonce/body bindings, and only delegates accepted events to transition/log methods.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`, `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts`
- **Verification:** Repository replay, conflict, attempt, receipt-template, and terminal-state assertions pass.
- **Committed in:** `0146c78`

**2. [Rule 3 - Blocking Issue] Normalized Web Crypto inputs to concrete ArrayBuffer values.**
- **Found during:** Task 2 type-check
- **Issue:** TypeScript 6 rejected an unconstrained `Uint8Array<ArrayBufferLike>` as a Workers `BufferSource` for HMAC verification.
- **Fix:** Copy typed-array input to a concrete `ArrayBuffer` before `crypto.subtle.verify`.
- **Files modified:** `apps/api/src/domain/crawler-tasks/runner-event-auth.ts`
- **Verification:** HMAC tests and API type-check pass.
- **Committed in:** `0146c78`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking type issue)
**Impact on plan:** Both changes close required replay and Workers crypto correctness gaps without expanding the callback authority or touching legacy crawler authentication.

## Issues Encountered

- The initial route test used an empty D1 mock that could not supply a leased run for lifecycle transition. The route now accepts an injected repository processor for focused boundary tests, while repository tests exercise the real in-memory D1 behavior.
- The commit hook formatted the new route after staging; the formatting-only follow-up is recorded separately in `836d3bb`.

## User Setup Required

None - no secret values, remote Worker configuration, or crawler process was changed during this plan.

## Next Phase Readiness

- Phase 17 local runner and Phase 18 GitHub Actions adapters can report lifecycle events through the same independent callback contract.
- Operators must provision the new callback bindings in their existing Worker and runner secret-management flow before a real runner can use the endpoint.

## Verification

- `pnpm --filter api test --run src/domain/crawler-tasks/__tests__/runner-event-auth.test.ts src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts src/__tests__/crawler-task-log-cleanup.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts` - 17 tests passed.
- `pnpm --filter api type-check` - passed.

## Self-Check: PASSED

- Summary file and all Task 1-3 commits are present in the repository history.

---
*Phase: 16-task-domain-foundation*
*Completed: 2026-07-30*
