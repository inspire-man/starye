# API Coverage - Phase 23 Production Repair And Reconciliation

> This phase integrates the existing GitHub Actions REST client, the fixed movie workflow, the signed runner callback boundary, and the repository-owned D1 reconciliation control plane. No new provider SDK or package is installed. The matrix records every provider-facing capability in scope and the deliberate Phase 24 or v2 opt-outs.

## Capability Matrix

| capability | decision | reason |
|---|---|---|
| GitHub Actions workflow dispatch | INTEGRATE | Plans 23-01 and 23-02: production `repair_players` reuses the fixed movie workflow and sends only the closed binding envelope. |
| GitHub Actions workflow-run readback | INTEGRATE | Plans 23-01 and 23-03: reconciliation needs provider status, conclusion, run attempt, SHA, and bounded provider failure mapping. |
| GitHub App installation-token boundary | INTEGRATE | Plan 23-01: the existing server-side client remains the only provider credential holder. |
| movie `repair_players` snapshot and adapter selection | INTEGRATE | Plans 23-01 and 23-02: the claimed server snapshot is the sole operation and content identity source. |
| signed provider-started, lifecycle, source-observation, and receipt callbacks | INTEGRATE | Plan 23-04: callback identity, replay, sequence, nonce, and source revision are verified before D1 mutation. |
| lease recovery, reconciliation window, and bounded retry | INTEGRATE | Plan 23-03: provider loss, timeout, and lease expiry require one auditable task-level retry with preserved facts. |
| receipt validation and authoritative source readback | INTEGRATE | Plans 23-03 and 23-04: provider completion is an observation; repair success requires a matching validated receipt and readback. |
| Dashboard lease, reconciliation, provider-run-link, and attempt DTO projection | INTEGRATE | Plan 23-05: REP-02 and REP-03 require a bounded current-attempt and history surface. |
| canonical local Gateway verification | INTEGRATE | Plan 23-05: local browser checks use `http://localhost:8080` as the project entry point. |
| fresh production tuple and Viewer playback evidence | OPT-OUT | Phase 24 owns fresh production evidence, Viewer navigation, `canplay`, `playing`, `waiting`, `stalled`, `error`, and `currentTime`. |
| comics, actors, publishers, and other repair templates | OPT-OUT | v2 and D-01: Phase 23 is movie-only; existing ordinary manga workflow behavior remains outside repair scope. |
| arbitrary Dashboard URL, command, workflow, secret, or schedule controls | OPT-OUT | Existing boundary and D-03, D-15, D-17: these fields remain registry- and server-owned and are never added to the user command or projection. |

## Multi-Source Planning Audit

- GOAL / Phase 23 goal / plans 23-01 through 23-05: COVERED. Contract, runner, D1, callback, and Dashboard slices form the complete path.
- REQ / REP-02 / plans 23-01, 23-03, 23-04, 23-05: COVERED. Statuses, idempotent replay, new-attempt retry, and retained provider, receipt, observation, and UI history are covered.
- REQ / REP-03 / plans 23-02, 23-03, 23-04, 23-05: COVERED. Server reread, movie-only adapter, readback, and same-movie Dashboard return are covered.
- RESEARCH / none: COVERED. No `23-RESEARCH.md` exists; the plans use CONTEXT, PATTERNS, UI-SPEC, and live source.
- CONTEXT / D-01 through D-17: COVERED. Each decision is mapped to the plans and the capability rows above, including movie-only scope, fixed workflow, bounded retry, append-only facts, source CAS, duplicate lock, bounded DTOs, and Phase 24 playback ownership.

## Gate Result

All in-scope provider capabilities are marked `INTEGRATE`. The only opt-outs are the explicitly deferred Phase 24 playback proof, v2 broader repair types, and the existing server-owned provider-control boundary. No package install or new external credential setup is part of Phase 23.

## Verification Evidence

- Plan 23-01: provider-association suite passed 7/7; GitHub Actions client suite passed 8/8; API type-check passed; no package manifest or credential-boundary change was introduced.
- Plan 23-02: crawler production runner suite passed 28/28 across five files; crawler type-check passed; the existing workflow and signed runner boundaries remain covered.
- Plan 23-03: API retry, reconciliation, receipt, and source-CAS suite passed 43/43 across six files; API type-check passed; late facts and authoritative readback remain covered.
- Plan 23-04: signed callback suite passed 18/18 across two files; API type-check passed; bounded duplicate, stale, conflict, and receipt outcomes remain covered.
- Plan 23-05: admin route suite passed 22/22; Dashboard Crawlers suite passed 17/17; API and Dashboard type-checks passed; `git diff --check` passed.
- Phase 23 rerun: 17 focused test files passed with 143 tests total; API, crawler, and Dashboard type-checks passed; `git diff --check` passed.
- Phase 24 boundary: Phase 23 displays `播放未验证` and does not claim a fresh production tuple, Viewer navigation, `playing`, or `currentTime` playback proof.
