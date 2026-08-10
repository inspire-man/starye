---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: 爬虫运管与内容可用性闭环
status: planning
last_updated: "2026-08-10T12:27:39.058Z"
last_activity: 2026-08-10
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Starye — 个人内容中台

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-05)

**Core value:** 部署在公网、能稳定日常使用的个人内容中台；优先保证内容可访问、可阅读、可观看。
**Current focus:** v1.5 — 爬虫运管与内容可用性闭环

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-10 — Milestone v1.5 started

## Performance Metrics

**Velocity:**

- Total plans completed: 23
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 20 | 3 | 3 | — |
| 21 | 7 | 7 | — |
| 22 | 3 | - | - |
| 23 | 5 | - | - |
| 24 | 5 | - | - |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 20 P03 | 1h 20m | 3 tasks | 15 files |
| Phase 21 P01 | 31m | 2 tasks | 5 files |
| Phase 21 P02 | 33m | 2 tasks | 5 files |
| Phase 21-source-health-and-local-repair-players-vertical-slice P03 | 32m | 2 tasks | 7 files |
| Phase 21 P6 | 32m | 2 tasks | 5 files |
| Phase 21 P7 | unmeasured-continuation | 2 tasks | 1 files |
| Phase 23 P01 | 23 min | 3 tasks | 6 files |
| Phase 23 P02 | unmeasured-continuation | 3 tasks | 10 files |
| Phase 24 P01 | 14min | 3 tasks | 8 files |
| Phase 24 P02 | 36min | 3 tasks | 7 files |
| Phase 24 P3 | 1h 30m | 2 tasks | 3 files |
| Phase 24 P4 | unmeasured-continuation | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- v1.4 continues numbering from Phase 20; the five phases follow the researched source → repair → playback → production proof dependency chain.
- Execution, source readiness and browser playback remain separate facts; `playing` plus `currentTime` progress is required for actual playback proof.
- Production Puppeteer remains in GitHub Actions; the Dashboard exposes only server-owned repair templates and the v1.4 proof uses a fresh tuple.
- [Phase 20]: Phase 20-03 将 metadata persisted、source readiness、receipt 和 browser playback proof 作为独立 typed projection 消费。
- [Phase 20]: 标准 Player 只有在 server-owned ready、eligibleCount>0 且 active source 非空时进入 view tracking 与 xgplayer constructor。
- [Phase ?]: Phase 21-01 keeps source readiness and browser playback proof independent from bounded per-source health; inactive rows remain visible but ineligible.
- [Phase ?]: Phase 21-01 adds operation alongside templateKey for backward-compatible ordinary crawler snapshots and explicit repair_players discrimination.
- [Phase ?]: Phase 21-01 binds append-only source observation uniqueness to canonical movie identity, source revision, operation, run, attempt, sequence, event, and source ordinal.
- [Phase ?]: 保持 deriveSourceReadiness 与 ordinary sync contract 不变，repair observation 作为新增 operation-aware 服务边界。
- [Phase ?]: 在同一 D1 transaction 内先做 sourceRevision CAS projection guard，再写 player 与 append-only observation facts，提交后只从 persisted readback 生成 bounded DTO。
- [Phase ?]: 成功 readback 后清理注入的 API detail cache 与 Gateway movies cache group。
- [Phase ?]: repair_players snapshot reuses movie templateKey but owns operation/movieId/reason/sourceRevision/targetIntent server-side
- [Phase ?]: repair success requires authoritative readback equality on movieId/sourceRevision/observedAt/sourceSummary before succeeded
- [Phase ?]: repair transient source_read/source_write failures auto-retry once on the same task; manual retry always creates a new task after reread
- [Phase ?]: Dashboard uses the existing repair task detail/readback as the source-health focal surface; the client never selects target, workflow, adapter, URL, command or secret fields.
- [Phase ?]: MovieDetail remains informational and hands the same movie identity plus bounded reason to Dashboard without an admin mutation call.
- [Phase ?]: 21-07 通过 active local D1 fixture 完成 canonical Gateway repair_players proof；local control-plane proof 与 production/provider/playback proof 保持分离。
- [Phase ?]: Phase 23-01 keeps provider identity server-owned: registry target, entrypoint, workflow, repository, ref, and environment are validated before dispatch.
- [Phase ?]: Phase 23-01 validates workflow readback against the fixed snapshot workflow and accepts only positive numeric provider run IDs.
- [Phase ?]: Phase 23-01 keeps provider acceptance, provider observation, receipt validation, and repair success as independent fact layers.
- [Phase ?]: Phase 23-01 reuses the existing GitHub App installation-token boundary without package or credential setup changes.
- [Phase ?]: Keep poll and claim as strict control envelopes; provider and source-revision fields remain on lifecycle/source callbacks for Plan 04.
- [Phase ?]: Select repair_players only from the validated claimed movie snapshot and never fall back to ordinary movie crawling.
- [Phase ?]: Treat an accepted=false heartbeat as a bounded runner failure so a lost lease cannot reach a success callback.
- [Phase ?]: Keep default repair source discovery as an explicit injected boundary until a canonical movie.id-to-source read contract is planned.
- [Phase ?]: Playback evidence uses one closed tuple with github-actions provider, bounded attempt number, explicit media-event observations, and finite progress samples.
- [Phase ?]: Artifact output is built from an allowlist after schema and forbidden key/value scans; redaction failure remains checkpoint state.
- [Phase ?]: playback_verified requires matching content/source revision, successful provider and repair readback, canplay plus playing, no terminal error, and delta >= 1 second; source and receipt projections remain independent.
- [Phase ?]: Playback evidence endpoint 以 authenticated path 的 server-owned task/run/attempt 为边界，repository 继续负责 provider、source revision、window、redaction、idempotency 与 CAS
- [Phase ?]: Task detail 用 playbackEvidence.current 与 bounded history 分开展示 playback，不引入 provider、receipt、source、playback 的 overall success 聚合
- [Phase ?]: D1 只保存 bounded summary、hash、reference 和 rejection facts，raw JSON/Markdown artifact 与媒体留在 production application reads 之外
- [Phase 24]: MovieDetail uses direct-first eligible source selection and Player requires visible Play, allowlisted media events, and one-second currentTime progress before playback verification. — Keep source readiness, provider receipt, and actual playback as independent facts while preserving a server-owned same-movie route context.

### Pending Todos

- [ ] Execute Phase 22 plans through the canonical Gateway and complete local UI/state verification.

### Blockers/Concerns

- Phase 24 needs an explicit selected production target, signed Dashboard session and fresh run allocation; absence of those prerequisites must remain a checkpoint rather than a production pass.
- Third-party source authentication, Range behavior, TorrServer behavior and cache freshness require phase-specific observation.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| verification_gap | Historical Phase 13 selected-production Viewer proof | frozen; v1.4 fresh tuple only | v1.2 closeout |
| artifact_audit | Eight historical v1.3 artifact-audit items | deferred; not v1.4 success evidence | v1.3 closeout |
| technical_debt | `@starye/config` CI lint baseline | non-causal; separate follow-up | v1.3 closeout |

## Session Continuity

Last session: 2026-08-08T08:30:18.295Z
Stopped at: Completed 24-04-PLAN.md
Resume file: None
