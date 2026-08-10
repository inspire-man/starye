---
phase: 23-github-actions-production-repair-and-reconciliation
verified: 2026-08-07T19:39:51Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
deferred:
  - truth: "Fresh production Dashboard command through Viewer playback with playing and currentTime evidence"
    addressed_in: "Phase 24"
    evidence: "ROADMAP Phase 24 owns the fresh production tuple, Viewer, playback event, and currentTime proof; Phase 23 renders 播放未验证."
---

# Phase 23: GitHub Actions Production Repair And Reconciliation Verification Report

**Phase Goal:** 用户可以通过生产受控修复恢复同一内容的播放源，并在 provider 波动、重试和迟到回调下保留诚实的运行历史与 reconciliation 结果。
**Verified:** 2026-08-07T19:39:51Z
**Status:** passed
**Verification mode:** Goal-backward, source and focused-test evidence

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Repair exposes queued, running, succeeded, failed, and retry states; duplicate requests and replayed events remain idempotent; retry creates a new attempt while retaining prior facts. | VERIFIED | `apps/api/src/domain/crawler-tasks/repository.ts` creates bounded automatic and manual retry runs, keeps `latest_run_id` CAS, records immutable run facts, and maps duplicate, stale, late, ignored, and conflict outcomes. The reconciliation suite passed 43/43 and the signed callback suite passed 18/18. |
| 2 | Dashboard exposes bounded provider, lease, attempt, reconciliation, receipt, source, and safe-log facts as separate layers, with provider dispatch and repair success kept distinct. | VERIFIED | Provider snapshots and allowlisted run links are built in `provider-association.ts`; the fixed workflow is `.github/workflows/daily-movie-crawl.yml`; admin DTO projection exposes `currentAttempt`, `latestRunId`, `receiptValidation`, and `sourceReadback`; `Crawlers.vue` renders current focus, collapsed history, duplicate lock, source rows, bounded logs, and 播放未验证. Admin tests passed 22/22 and Dashboard tests passed 17/17. |
| 3 | A repairable movie can enter the controlled repair path and return to the same movie identity with validated source state; late attempts cannot replace the current source revision. | VERIFIED | `repair_players` snapshots are movie-only and select the repair adapter after claim. Admin creation rereads disposition immediately before mutation, source reconciliation uses source-revision and latest-run CAS, and receipt validation requires matching identity, revision, observation time, counts, and rows. Provider/runner, reconciliation, callback, and admin suites cover this chain. |

**Score:** 3/3 roadmap truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/api/src/domain/crawler-tasks/provider-association.ts` | Fixed provider snapshot, dispatch binding, and bounded provider projection | VERIFIED | Movie and manga workflow registry, closed dispatch input, allowlisted metadata, and reconstructed GitHub run URL. |
| `apps/api/src/lib/github-app/github-actions-client.ts` | Snapshot-bound GitHub Actions dispatch and run readback | VERIFIED | Fixed workflow and repository/ref/environment binding, positive run-id validation, bounded transport retry, and retryable failure classification. |
| `.github/workflows/daily-movie-crawl.yml` | Existing GitHub Actions production execution boundary | VERIFIED | The workflow carries the server-owned provider binding and runner callback environment. |
| `packages/crawler/src/task-runner/template-adapters.ts` | Post-claim movie-only repair adapter selection | VERIFIED | Validates the repair snapshot before selecting `repair_players`; ordinary template selection stays separate. |
| `packages/crawler/src/task-runner/repair-adapter.ts` | Bounded repair observation and receipt construction | VERIFIED | Validates movie identity, source revision, target intent, authoritative readback, and receipt fields. The source-discovery dependency is explicit for the Phase 24 production proof boundary. |
| `apps/api/src/domain/crawler-tasks/repository.ts` | Task/run/attempt/lease/retry persistence and event reconciliation | VERIFIED | Automatic retry creation, manual retry, append-only event handling, late/stale/conflict outcomes, and current-run CAS are present. |
| `apps/api/src/domain/crawler-tasks/reconciliation.ts` | Provider reconciliation and bounded outcome projection | VERIFIED | Provider observations are retained independently from receipt validation and repair success. |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` | Authoritative receipt and source readback validation | VERIFIED | Missing, mismatched, or incomplete readback produces receipt failure. |
| `apps/api/src/domain/movies/source-reconciliation.ts` | Source revision CAS and append-only source observations | VERIFIED | Current projection writes require the expected revision and current application run; observations remain historical facts. |
| `apps/api/src/routes/internal/crawler-runs/index.ts` | Signed provider-started and lifecycle callback boundary | VERIFIED | HMAC-bound event identity, nonce, sequence, attempt, source revision, and stable duplicate/stale/conflict responses. |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | Bounded admin task detail and repair command projection | VERIFIED | Current attempt, history, source readback, receipt validation, duplicate lock, disposition reread, and same-movie return are wired. |
| `apps/dashboard/src/lib/api.ts` and `apps/dashboard/src/views/Crawlers.vue` | Dashboard read model and current-attempt focal UI | VERIFIED | Typed projections, current-first history, bounded source health, safe logs, refresh state, repair action, and Phase 24 playback boundary are rendered. |
| `.planning/phases/23-github-actions-production-repair-and-reconciliation/COVERAGE.md` | Valid API capability matrix | VERIFIED | Seal-time gate passed with 12 capabilities: 9 `INTEGRATE` and 3 reasoned `OPT-OUT`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Admin repair command | Server-owned repair task snapshot | `repairPlayers` route and repository creation | VERIFIED | Movie identity, reason, target intent, source revision, and operation are server-bound. |
| Claimed runner snapshot | `repair_players` adapter | `selectTemplateAdapter` after poll and claim | VERIFIED | Invalid operation-aware snapshots terminate with bounded contract failure. |
| Runner provider events | Internal crawler-run routes | Signed event client and callback schemas | VERIFIED | HMAC, event ID, nonce, sequence, run/attempt, and source revision checks precede persistence. |
| Provider completion | Receipt/readback validation | `projectRepairReceiptValidation` and `validateReceiptCandidate` | VERIFIED | Provider completion is an observation; matching authoritative readback is required for repair validation. |
| Receipt/readback | Current movie source projection | Source revision and latest-run CAS | VERIFIED | Late attempts remain append-only facts and do not replace the current projection. |
| Admin DTO | Dashboard current attempt | Typed API client and `Crawlers.vue` | VERIFIED | `latestRunId` selects the focal attempt; older attempts remain bounded expandable history. |

### Data-Flow Trace

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Provider snapshot | `template`, `target`, `workflow`, `providerRunId` | Server registry and GitHub Actions readback | Yes, through fixed bindings and tests | VERIFIED |
| Runner event | `eventId`, `nonce`, `sequence`, `sourceRevision` | Signed runner callback payload | Yes, schema and integration tests | VERIFIED |
| Retry projection | `attempt`, `runId`, `lease`, `reconciliation` | D1 task/run history | Yes, repository integration tests | VERIFIED |
| Receipt projection | `movieId`, `sourceRevision`, `observedAt`, source counts and rows | Persisted receipt plus authoritative source readback | Yes, receipt-validation and admin route tests | VERIFIED |
| Dashboard detail | `currentAttempt`, history, source rows, safe logs | Bounded admin DTO | Yes, Dashboard and admin route tests | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Provider contract and GitHub Actions client | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/provider-association.test.ts src/lib/github-app/__tests__/github-actions-client.test.ts` | 2 files, 15 tests passed | PASS |
| Production runner and repair adapter | `pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/production-workflow.integration.test.ts src/task-runner/__tests__/template-adapters.test.ts src/task-runner/__tests__/production-adapter.test.ts src/task-runner/__tests__/actions-event-client.test.ts src/task-runner/__tests__/runner-client.test.ts` | 5 files, 28 tests passed | PASS |
| Retry, reconciliation, receipt, and source CAS | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/state-machine.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts src/domain/crawler-tasks/__tests__/reconciliation.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts src/domain/movies/__tests__/source-reconciliation.integration.test.ts` | 6 files, 43 tests passed | PASS |
| Signed callback outcomes | `pnpm --filter api exec vitest run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` | 2 files, 18 tests passed | PASS |
| Admin and Dashboard read models | `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` and `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` | 2 files, 39 tests passed | PASS |

### Quality Gates

| Check | Result |
|---|---|
| `pnpm --filter api type-check` | PASS |
| `pnpm --filter @starye/crawler type-check` | PASS |
| `pnpm --filter dashboard type-check` | PASS |
| `git diff --check` | PASS |
| `check api-coverage.verify-pre .planning/phases/23-github-actions-production-repair-and-reconciliation` | PASS: 12 capabilities, 3 reasoned opt-outs |
| Phase plan completeness | PASS: 5 plans and 5 summaries, no incomplete plans or orphan summaries |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| REP-02 | 23-01, 23-03, 23-04, 23-05 | SATISFIED | Bounded lifecycle states, idempotent callback outcomes, retry attempts, retained facts, and Dashboard history are covered by 143 focused tests and typed projections. |
| REP-03 | 23-02, 23-03, 23-04, 23-05 | SATISFIED | Movie-only repair entry, same identity, authoritative source readback, validated receipt, disposition reread, and source CAS are covered by runner, reconciliation, callback, and admin tests. |

### Anti-Patterns Found

None blocking. The explicit `discoverSources` injection in `packages/crawler/src/task-runner/repair-adapter.ts` is a deliberate production-proof dependency boundary. Phase 24 owns supplying the canonical source-discovery implementation and proving the fresh production tuple through Viewer playback.

### Human Verification Required

None for the Phase 23 control-plane contract. The fresh production tuple, Viewer navigation, `playing`, `currentTime`, and playback event evidence are deferred to Phase 24 by the roadmap and requirements traceability.

### Deferred Items

| Item | Addressed In | Evidence |
|---|---|---|
| Fresh Dashboard command through provider, validated receipt, source observation, Viewer, and actual playback on one new tuple | Phase 24 | EVID-01 is assigned to Phase 24. |
| `canplay`, `playing`, `waiting`, `stalled`, `error`, and `currentTime` playback evidence | Phase 24 | EVID-02 is assigned to Phase 24. |
| Dashboard task detail trace to Viewer evidence with provider success, repair success, and actual playback as separate facts | Phase 24 | EVID-03 is assigned to Phase 24. |

### Gaps Summary

No Phase 23 gaps found. The phase delivers the bounded production repair and reconciliation control surface. Phase 24 remains the explicit evidence boundary for live production source discovery and browser playback.

---

_Verified: 2026-08-07T19:39:51Z_
_Verifier: local goal-backward verification after verifier-agent timeout_
