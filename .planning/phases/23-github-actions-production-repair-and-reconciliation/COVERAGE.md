# API Coverage - Phase 23 Production Repair And Reconciliation

> This phase integrates the existing GitHub Actions REST client, the fixed movie workflow, the signed runner callback boundary, and the repository-owned D1 reconciliation control plane. No new provider SDK or package is installed. The matrix records every provider-facing capability in scope and the deliberate Phase 24 or v2 opt-outs.

## Capability Matrix

| capability | decision | plan | reason |
|---|---|---|---|
| GitHub Actions workflow dispatch | INTEGRATE | 23-01, 23-02 | Production `repair_players` must reuse the fixed movie workflow and send only the closed binding envelope. |
| GitHub Actions workflow-run readback | INTEGRATE | 23-01, 23-03 | Reconciliation needs provider status, conclusion, run attempt, SHA, and bounded provider failure mapping. |
| GitHub App installation-token boundary | INTEGRATE | 23-01 | The existing server-side client remains the only provider credential holder. |
| movie `repair_players` snapshot and adapter selection | INTEGRATE | 23-01, 23-02 | The claimed server snapshot is the sole operation and content identity source. |
| signed provider-started, lifecycle, source-observation, and receipt callbacks | INTEGRATE | 23-04 | Callback identity, replay, sequence, nonce, and source revision must be verified before D1 mutation. |
| lease recovery, reconciliation window, and bounded retry | INTEGRATE | 23-03 | Provider loss, timeout, and lease expiry require one auditable task-level retry with preserved facts. |
| receipt validation and authoritative source readback | INTEGRATE | 23-03, 23-04 | Provider completion is an observation; repair success requires a matching validated receipt and readback. |
| Dashboard lease, reconciliation, provider-run-link, and attempt DTO projection | INTEGRATE | 23-05 | REP-02 and REP-03 require a bounded current-attempt and history surface. |
| canonical local Gateway verification | INTEGRATE | 23-05 | Local browser checks use `http://localhost:8080` as the project entry point. |
| fresh production tuple and Viewer playback evidence | OPT-OUT | Phase 24 | Fresh production evidence, Viewer navigation, `canplay`, `playing`, `waiting`, `stalled`, `error`, and `currentTime` remain Phase 24-owned. |
| comics, actors, publishers, and other repair templates | OPT-OUT | v2 / D-01 | Phase 23 is movie-only; existing ordinary manga workflow behavior remains outside repair scope. |
| arbitrary Dashboard URL, command, workflow, secret, or schedule controls | OPT-OUT | Existing boundary / D-03, D-15, D-17 | These fields remain registry- and server-owned and are never added to the user command or projection. |

## Multi-Source Planning Audit

| source | id | feature or requirement | plan | status | notes |
|---|---|---|---|---|---|
| GOAL | Phase 23 goal | Production controlled repair with honest provider, retry, late-callback, and reconciliation history | 23-01 through 23-05 | COVERED | Contract, runner, D1, callback, and Dashboard slices form the complete path. |
| REQ | REP-02 | Statuses, idempotent replay, new attempt retry, retained history | 23-01, 23-03, 23-04, 23-05 | COVERED | Provider, run, receipt, observation, and UI projections stay separate. |
| REQ | REP-03 | Repairable movie entry, same content identity, updated source state, validated receipt | 23-02, 23-03, 23-04, 23-05 | COVERED | Server reread, movie-only adapter, readback, and same-movie Dashboard return are all planned. |
| RESEARCH | none | No `23-RESEARCH.md`; research was explicitly skipped by the user | all plans use CONTEXT, PATTERNS, UI-SPEC, and live source | COVERED | There is no research artifact with additional features or constraints to omit. |
| CONTEXT | D-01 | Movie-only `repair_players` | 23-01, 23-02, 23-05 | COVERED | Repair adapter and UI entry are restricted to movies. |
| CONTEXT | D-02 | Reuse the existing movie workflow | 23-01, 23-02 | COVERED | No dedicated repair workflow is introduced. |
| CONTEXT | D-03 | Four binding inputs; server-owned operation and repair facts | 23-01, 23-02, 23-05 | COVERED | Dispatch and Dashboard command DTOs remain closed. |
| CONTEXT | D-04 | Shared job and post-claim adapter selection | 23-02 | COVERED | Poll, claim, snapshot validation, and adapter choice are one runner path. |
| CONTEXT | D-05 | Fail closed on snapshot contract errors | 23-02, 23-04 | COVERED | Contract failures end the attempt and never invoke ordinary crawl. |
| CONTEXT | D-06 | One retry only for transient, timeout, lost, or lease expiry | 23-03 | COVERED | Deterministic snapshot, auth, and receipt failures remain terminal. |
| CONTEXT | D-07 | New run, attempt, lease, and provider association; old facts retained | 23-03 | COVERED | Task aggregation derives current retry state from immutable run history. |
| CONTEXT | D-08 | Immediate dispatch retry; windowed timeout/lost/lease retry | 23-03 | COVERED | Reconciliation controls the retry timing boundary. |
| CONTEXT | D-09 | Task-level retry, unchanged run status vocabulary | 23-03, 23-05 | COVERED | DTOs expose retry beside the current attempt. |
| CONTEXT | D-10 | Append-only late facts and CAS current writes | 23-03, 23-04, 23-05 | COVERED | Old callbacks remain auditable and are projected as bounded outcomes. |
| CONTEXT | D-11 | Current application attempt owns current source projection | 23-03, 23-04 | COVERED | Source revision CAS selects the winning current projection. |
| CONTEXT | D-12 | Provider success is not repair success; receipt failure is terminal without retry | 23-03, 23-04, 23-05 | COVERED | Receipt and source-readback facts are independent. |
| CONTEXT | D-13 | Stable duplicate, stale, and conflict outcomes | 23-04, 23-05 | COVERED | Signed replay and sequence handling are tested and rendered on the originating attempt. |
| CONTEXT | D-14 | Current attempt focal point with expandable history | 23-05 | COVERED | `latestRunId` remains the top-level focus. |
| CONTEXT | D-15 | Bounded history and safe logs without raw provider material | 23-01, 23-05 | COVERED | Projection allowlists are enforced server-side and in Dashboard tests. |
| CONTEXT | D-16 | Active same-movie duplicate lock and fresh disposition reread | 23-05 | COVERED | The command is disabled while active and rereads before a new task. |
| CONTEXT | D-17 | Allowlisted provider summary and independent fact layers | 23-01, 23-05 | COVERED | Provider link and status are distinct from repair, receipt, and source state. |

## Gate Result

All in-scope provider capabilities are marked `INTEGRATE`. The only opt-outs are the explicitly deferred Phase 24 playback proof, v2 broader repair types, and the existing server-owned provider-control boundary. No package install or new external credential setup is part of Phase 23.

## Plan 23-01 Verification Evidence

| evidence | result | scope |
|---|---|---|
| provider-association focused suite | PASS (`7/7`) | Movie-only provider snapshot, exact dispatch contract, and redacted provider summary. |
| GitHub Actions client focused suite | PASS (`8/8`) | Fixed workflow binding, provider readback, bounded transport retry, and deterministic failures. |
| API type-check | PASS | `pnpm --filter api type-check` completed without errors. |
| package and credential boundary | PASS | No package manifest changed and no new credential setup was introduced. |
