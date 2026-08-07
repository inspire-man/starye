---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: 播放可用性与生产自愈闭环
current_phase: 23
current_phase_name: GitHub Actions Production Repair And Reconciliation
status: planning
stopped_at: Phase 22 complete, transitioned to Phase 23
last_updated: "2026-08-07T08:14:44.456Z"
last_activity: 2026-08-07
last_activity_desc: Phase 22 complete, transitioned to Phase 23
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 13
---

# Project State: Starye — 个人内容中台

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-05)

**Core value:** 部署在公网、能稳定日常使用的个人内容中台；优先保证内容可访问、可阅读、可观看。
**Current focus:** Phase 23 — GitHub Actions Production Repair And Reconciliation

## Current Position

Phase: 23 — GitHub Actions Production Repair And Reconciliation
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-07 — Phase 22 complete, transitioned to Phase 23

Progress: ██████░░░░ 60% (Phase 20: 100%; Phase 21: 100%; Phase 22: 100%)

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 20 | 3 | 3 | — |
| 21 | 7 | 7 | — |
| 22 | 3 | - | - |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 20 P03 | 1h 20m | 3 tasks | 15 files |
| Phase 21 P01 | 31m | 2 tasks | 5 files |
| Phase 21 P02 | 33m | 2 tasks | 5 files |
| Phase 21-source-health-and-local-repair-players-vertical-slice P03 | 32m | 2 tasks | 7 files |
| Phase 21 P6 | 32m | 2 tasks | 5 files |
| Phase 21 P7 | unmeasured-continuation | 2 tasks | 1 files |

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

Last session: 2026-08-07T03:27:09.695Z
Stopped at: Phase 22 planning complete
Resume file: .planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-01-PLAN.md
