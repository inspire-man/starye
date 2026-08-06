# Roadmap: Starye — 个人内容中台

## Overview

v1.4 将 v1.3 已验证的受控 crawler control plane 延伸到播放可用性和生产自愈闭环：先把 metadata、source health 与实际 playback 分成可审计的状态层，再完成本地 `repair_players` vertical slice、MovieDetail/Player 状态闭环、GitHub Actions 生产修复与 reconciliation，最后用独立 fresh production tuple 证明 Dashboard → Viewer → 实际播放。生产 Puppeteer 继续运行在 GitHub Actions，历史 Phase 13 carrier 保持 frozen。

## Milestones

- ✅ **v1.0 部署可用、日常使用态** — Phases 1-5 shipped 2026-07-11. Archive: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 存储成本控制与代码/文件整理** — Phases 6-10 shipped 2026-07-13. Archive: [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ⚠ **v1.2 Cloudflare 账户/域名切换与全链路发布验证** — archived 2026-07-29 by override closeout. Archive: [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ⚠ **v1.3 后台爬虫任务与内容运维** — Phases 16-19 shipped 2026-08-04 by override closeout. Archive: [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- 🚧 **v1.4 播放可用性与生产自愈闭环** — Phases 20-24 planned

## Current Milestone

**Goal:** 让爬虫入库结果稳定转化为可播放内容，并用 fresh production run 证明 Dashboard → Viewer → 实际播放的完整日常使用链路。

**Constraints carried forward:** v1.3 的 D1 task/run/attempt/lease、receipt、target-profile 和受控 template 继续作为控制面；生产 Puppeteer 只在 GitHub Actions 执行；Phase 13 carrier 不得作为 v1.4 proof；生产成功必须绑定独立 fresh tuple。

## Phases

**Phase Numbering:**

- Integer phases continue from Phase 19.
- Decimal phases are reserved for urgent insertions and are not planned for v1.4.

- [x] **Phase 20: Source Contract, Receipt Boundary And SUN-064** - 建立 metadata 与 playback readiness 的边界，形成 source disposition、receipt 和 SUN-064 的诚实状态。
- [ ] **Phase 21: Source Health And Local repair_players Vertical Slice** - 提供来源健康观察和本地受控修复纵向链路。
- [ ] **Phase 22: Dashboard, MovieDetail And Player State Closure** - 将 source projection 转化为 Dashboard、MovieDetail 和 Player 的可操作状态体验。
- [ ] **Phase 23: GitHub Actions Production Repair And Reconciliation** - 把受控修复接入生产 provider，并保持 attempt、lease、callback 和 receipt 可追溯。
- [ ] **Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof** - 用独立 fresh production run 验收完整 Dashboard → Viewer → 实际播放证据链。

## Phase Details

### Phase 20: Source Contract, Receipt Boundary And SUN-064

**Goal**: 用户能区分 metadata 已入库、source 当前状态和实际可播放 readiness；新抓取结果不会再把 `players=0` 或 source 写入异常显示成可播放成功。
**Depends on**: Phase 19 (v1.3 crawler task and content operations)
**Requirements**: SRC-01, SRC-03
**Success Criteria** (what must be TRUE):

  1. 用户在 crawler task detail 和 MovieDetail 中能分别看到 metadata persisted 与 playback readiness，并能区分 `ready`、`no_source`、`source_failed`、`repairing` 和 `playback_verified`。
  2. 用户查看新受控视频抓取结果时，有候选源的内容进入 source health/ready 路径；零源、解析失败或 source 写入失败的内容显示明确的 `no_source`、repairable 或 `source_failed` 结果，不被 metadata success 包装为可播放。
  3. 用户查看 `SUN-064` 时，`players=0` 被读回为明确的 `no_source`/repairable disposition，receipt/source summary 与同一 content identity 一致，并给出受控修复意图。

**Plans**:
3/3 plans executed

- [x] 20-01-PLAN.md — Source contract、eligibility 与 D1 schema/migration

**Wave 2**

- [x] 20-02-PLAN.md — Receipt readback、sync reconciliation 与 SUN-064 回归

**Wave 3**

- [x] 20-03-PLAN.md — Admin/MovieDetail DTO、Dashboard 与 Player no-source guard

**UI hint**: yes

### Phase 21: Source Health And Local repair_players Vertical Slice

**Goal**: 用户能查看受控播放源的有限健康信息，并从本地 Gateway 通过固定模板发起可审计的 `repair_players` 修复。
**Depends on**: Phase 20
**Requirements**: SRC-02, REP-01
**Success Criteria** (what must be TRUE):

  1. 用户能查看每个受控播放源的 `direct`、`magnet` 或 `TorrServer` 类型，以及 `inactive`、`unverified`、`failed` 等有限健康状态、最近观察时间或受控失败原因。
  2. 用户从已入库的 `no_source` 或 `source_failed` 电影发起修复时，只需选择受控电影身份、原因和目标意图；Dashboard 不要求也不暴露任意 URL、命令、workflow 或 secrets。
  3. 用户通过 `http://localhost:8080` 观察本地修复纵向链路时，能看到固定 `repair_players` 请求进入受控任务并返回同一电影的 source observation/readback；失败仍保留可解释的 repairable 状态和下一步动作。

**Plans**: 7 plans

Plans:
**Wave 1**

- [ ] 21-01-PLAN.md — source health、repair operation contracts 与 Drizzle schema

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 21-02-PLAN.md — local D1 migration、observation persistence 与 authoritative readback

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 21-03-PLAN.md — operation registry、repair receipt 与 task lifecycle/CAS/retry

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 21-04-PLAN.md — admin repair command 与 signed runner callback routes

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 21-05-PLAN.md — local repair_players adapter 与 signed runner envelope
- [ ] 21-06-PLAN.md — Dashboard confirmation/source health 与 MovieDetail handoff

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 21-07-PLAN.md — canonical Gateway local vertical proof 与全阶段 verification

**UI hint**: yes

### Phase 22: Dashboard, MovieDetail And Player State Closure

**Goal**: 用户在 Dashboard、MovieDetail 和 Player 中能理解来源状态，并对播放失败执行有界的重试、切换或修复动作。
**Depends on**: Phase 21
**Requirements**: PLAY-01, PLAY-02, PLAY-03
**Success Criteria** (what must be TRUE):

  1. 用户在 MovieDetail 中能分别看到 `ready`、`no_source`、`source_failed` 和 `repairing`，并获得与状态匹配的播放、修复、刷新或切换源动作。
  2. 用户在 Player 中能看到加载、缓冲、失效和播放错误的明确反馈；当前源重试有边界，达到上限后能切换候选源或进入现有 TorrServer/Aria2 路径。
  3. 用户选择来源时，direct、magnet、TorrServer 和 Aria2 走各自受控路径；播放器只选择 eligible source，评分或排序字段不会单独被呈现为健康或可播放证明。

**Plans**: TBD
**UI hint**: yes

### Phase 23: GitHub Actions Production Repair And Reconciliation

**Goal**: 用户可以通过生产受控修复恢复同一内容的播放源，并在 provider 波动、重试和迟到回调下保留诚实的运行历史与 reconciliation 结果。
**Depends on**: Phase 22
**Requirements**: REP-02, REP-03
**Success Criteria** (what must be TRUE):

  1. 用户能看到 repair 的 `queued`、`running`、`succeeded`、`failed` 和 `retry` 状态；重复请求或事件重放不会产生重复有效变更，失败重试会创建新的 attempt，同时保留旧日志、receipt 和 source observation。
  2. 用户能从 Dashboard 看到固定生产 repair 的 provider、lease、attempt 和 reconciliation 结果；provider dispatch 受理、repair 成功和 receipt 校验失败不会被合并成同一个成功状态，生产浏览器执行仍发生在 GitHub Actions。
  3. 用户可以从 `no_source` 或 `source_failed` 内容进入生产受控修复，并回到同一个 content ID 查看更新后的 source state 与 validated receipt；迟到的旧 attempt 不能覆盖当前 source revision。

**Plans**: TBD
**UI hint**: yes

### Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof

**Goal**: 用户可以用一个独立 fresh production tuple 证明从 Dashboard command 到 Viewer 实际播放的完整日常使用链路，并获得可追溯的脱敏证据。
**Depends on**: Phase 23
**Requirements**: EVID-01, EVID-02, EVID-03
**Success Criteria** (what must be TRUE):

  1. 用户能用一个新的 task/run/attempt/provider tuple 从 Dashboard command 追溯到 validated receipt、source observation、Viewer 和实际播放；历史 Phase 13 carrier 不会被计入本次 production pass。
  2. 用户能查看脱敏的播放证据摘要，其中包含受控的 `canplay`、`playing`、`waiting`、`stalled`、`error` 事件和 `currentTime` 推进结果，且不包含完整媒体或签名材料。
  3. 用户从 Dashboard task detail 能追溯到 content ID、source revision、repair receipt 和 Viewer evidence，并能分别辨认 provider success、repair success 与 actual playback。

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases 20 → 21 → 22 → 23 → 24

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 20. Source Contract, Receipt Boundary And SUN-064 | 3/3 | Complete | 2026-08-05 |
| 21. Source Health And Local repair_players Vertical Slice | 0/TBD | Not started | - |
| 22. Dashboard, MovieDetail And Player State Closure | 0/TBD | Not started | - |
| 23. GitHub Actions Production Repair And Reconciliation | 0/TBD | Not started | - |
| 24. Fresh Production Dashboard -> Viewer -> Playback Proof | 0/TBD | Not started | - |
