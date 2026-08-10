# Roadmap: Starye — 个人内容中台

## Overview

v1.5 将已经稳定的 crawler control plane 延伸为“任务运管 → 数据可用性检查 → 受控修复/重试 → 内容读回 → Gateway 证据验收”的日常闭环。先统一任务 CRUD、不可变快照、可用性结果、观察记录和 revision/CAS 契约，再分别实现视频 direct/magnet、漫画章节、章节图片的检查与修复，最后用一个 fresh tuple 证明 Dashboard、D1、runner、内容页面和 Reader/Viewer 使用的是同一组事实。生产浏览器继续运行在 GitHub Actions，章节正文图片继续遵守外链存储策略。

## Milestones

- ✅ **v1.0 部署可用、日常使用态** — Phases 1-5 shipped 2026-07-11. Archive: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 存储成本控制与代码/文件整理** — Phases 6-10 shipped 2026-07-13. Archive: [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ⚠ **v1.2 Cloudflare 账户/域名切换与全链路发布验证** — archived 2026-07-29 by override closeout. Archive: [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ⚠ **v1.3 后台爬虫任务与内容运维** — Phases 16-19 shipped 2026-08-04 by override closeout. Archive: [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 播放可用性与生产自愈闭环** — Phases 20-24 shipped 2026-08-10. Archive: [v1.4-phases/](milestones/v1.4-phases/)
- 🚧 **v1.5 爬虫运管与内容可用性闭环** — Phases 25-28 in progress

## Current Milestone

**Goal:** 将爬虫任务运管、数据入库、磁链与漫画内容可用性检查、修复重试和 Dashboard 证据验收串成可持续迭代的完整日常使用链路。

**Constraints carried forward:**

- 继续复用 D1 `crawler_task` / `run` / `attempt` / `lease` / `provider` / `receipt` 控制面；可用性检查和修复不另建调度器。
- 任务快照、run/attempt、source/content revision、observation、receipt 和 projection 保持可审计、幂等、CAS 保护和旧回调隔离。
- Dashboard 与本地验收统一经 `http://localhost:8080/...` canonical Gateway；生产浏览器执行继续由 GitHub Actions 承担。
- metadata、execution、transport、content integrity 和实际播放/阅读是独立事实；任一单项成功都不自动提升整体可用性。
- 漫画正文图片保留源站外链，不把批量图片或完整 provider 响应写入 R2、D1 或长期 artifact。

## Phases

**Phase Numbering:**

- Integer phases continue from Phase 24.
- Decimal phases are reserved for urgent insertions and are not planned for v1.5.

- [x] **Phase 20: Source Contract, Receipt Boundary And SUN-064** - 建立 metadata、source readiness、receipt 和 SUN-064 的诚实状态边界。
- [x] **Phase 21: Source Health And Local repair_players Vertical Slice** - 提供来源健康观察和本地受控修复纵向链路。
- [x] **Phase 22: Dashboard, MovieDetail And Player State Closure** - 将 source projection 转化为 Dashboard、MovieDetail 和 Player 的可操作状态体验。
- [x] **Phase 23: GitHub Actions Production Repair And Reconciliation** - 把受控修复接入生产 provider，并保持 attempt、lease、callback 和 receipt 可追溯。
- [x] **Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof** - 用独立 fresh production tuple 验收 Dashboard 到实际播放的证据链。
- [ ] **Phase 25: Task Operations And Availability Contract** - 完成任务增删改、归档、历史、审计和共享可用性结果契约。
- [ ] **Phase 26: Video Source And Magnet Availability** - 完成视频 metadata、direct source、magnet/TorrServer 检查和受控修复。
- [ ] **Phase 27: Comic Chapter Completeness** - 完成漫画 source snapshot、缺章/重复/顺序诊断和定向重抓。
- [ ] **Phase 28: Chapter Image Availability And Gateway Acceptance** - 完成章节图片探测、定向修复和全链路 Gateway 证据验收。

## Phase Details

### Phase 25: Task Operations And Availability Contract

**Goal**: 用户可以在一个受控运管入口中创建、查看、修改、归档、取消和重试任务，并让视频、章节和图片检查共用同一套不可变任务身份、结果、观察、投影和证据边界。
**Depends on**: Phase 24
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06
**Success Criteria** (what must be TRUE):

  1. 用户可以通过 operation registry 创建任务、查看分页列表和详情、修改允许修改的字段并归档任务；workflow、URL、命令和 secrets 不由客户端提供，已有 run/attempt/receipt/observation 不被归档抹除。
  2. 用户可以取消 queued/running 任务并对失败或取消任务执行有界重试；重复请求、重复点击和迟到回调不会产生重复有效变更或覆盖新快照。
  3. 用户在任务详情可以看到当前状态、目标、最新 run/attempt、provider、日志摘要、receipt、转换历史以及创建/更新/归档/取消/重试/修复审计事实。
  4. 可用性检查可以写入 revision-bound 的 append-only observation 和 bounded current projection，且结果包含状态、reason、policy version、observedAt、新鲜度和下一步动作，不把 runner 成功直接当作内容可用。

**Plans**: 1/4 plans executed

Plans:
**Wave 1**

- [x] 25-01-PLAN.md — 共享 operation、availability result、observation/projection、revision/CAS 和 evidence 契约

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 25-02-PLAN.md — 任务 CRUD、归档/supersede、取消、重试、幂等和审计生命周期
- [ ] 25-03-PLAN.md — D1 schema、bounded persistence、current readback 与缓存失效边界

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 25-04-PLAN.md — Dashboard task detail、历史/审计投影和 canonical Gateway 基线验收

### Phase 26: Video Source And Magnet Availability

**Goal**: 用户可以区分电影 metadata、direct source、magnet/TorrServer 和实际 playback readiness，并从具体的可用性 finding 发起受控复查或修复。
**Depends on**: Phase 25
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05
**Success Criteria** (what must be TRUE):

  1. 用户在电影详情和任务结果中能分别看到 metadata persisted、direct source、magnet source 与 playback readiness；metadata 入库成功不会掩盖 no-source、failed 或 stale source。
  2. direct source 检查可以在有界的 URL/HTTP/Range/浏览器路径中区分可用、无效 URL、HTTP 失败、挑战/阻断、过期和不确定，并按 source revision 写入可追溯观察。
  3. magnet 检查只经过受控 Aria2/TorrServer 路径，并能区分 metadata、解析、peer/下载、流和播放各层结果；磁链语法有效或 resolver 接受不单独构成可用。
  4. 用户可以从 no-source、source-failed、stale 或 degraded finding 发起幂等 recheck/repair；成功必须绑定同一 movie/source revision，经 receipt 和权威读回后才更新 projection。

**Plans**: 4 plans (to be detailed by `$gsd-plan-phase 26`)

Plans:

- [ ] 26-01-PLAN.md — 视频检查 operation registry、source result contract 和 probe policy
- [ ] 26-02-PLAN.md — direct source transport/browser observation 与 freshness projection
- [ ] 26-03-PLAN.md — Aria2/TorrServer magnet resolution、stream state 和 bounded failure evidence
- [ ] 26-04-PLAN.md — 视频 recheck/repair、MovieDetail/Dashboard actions 和同 revision readback

### Phase 27: Comic Chapter Completeness

**Goal**: 用户可以看到漫画源章节集合与入库章节集合之间的真实差异，并对缺失、重复、顺序或部分抓取结果执行定向、可回溯的修复。
**Depends on**: Phase 26
**Requirements**: CHAP-01, CHAP-02, CHAP-03, CHAP-04
**Success Criteria** (what must be TRUE):

  1. 系统在比较或修复前保存 source chapter snapshot，保留稳定章节 identity、source ordinal、章节号、slug/URL identity 和 terminal state；源快照不会因 delete-and-rebuild 丢失。
  2. 用户可以看到按章节 identity 计算的 missing、duplicate、sequence 和 order finding；总数相等不再被展示为章节完整的唯一证明，重复 source rows 可审计。
  3. 用户可以区分 source unavailable、partial、inconclusive、complete 等内容完整性状态与 crawler execution 的 queued/running/succeeded/failed 状态。
  4. 用户可以从漫画或指定章节 finding 发起 revision-bound、幂等的 targeted recrawl/repair；空结果和少于已知良好基线的结果不会破坏现有章节，完成后可读回最新 projection。

**Plans**: 3 plans (to be detailed by `$gsd-plan-phase 27`)

Plans:

- [ ] 27-01-PLAN.md — source chapter snapshot schema、章节 identity/ordinal normalization 和 terminal contract
- [ ] 27-02-PLAN.md — missing/duplicate/order/sequence comparison、bounded finding projection 和状态读回
- [ ] 27-03-PLAN.md — targeted chapter recrawl、空结果/非回归保护、receipt 和 Dashboard 演示

### Phase 28: Chapter Image Availability And Gateway Acceptance

**Goal**: 用户可以判断章节图片是否真实可读，按异常发起定向修复，并通过 canonical Gateway 验收从 Dashboard 到 Reader/Viewer 的同 tuple 数据可用性链路。
**Depends on**: Phase 27
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, EVID-01, EVID-02, EVID-03
**Success Criteria** (what must be TRUE):

  1. 用户可以看到章节 expected/stored page count、页码/URL identity、缺页、无效 URL、重复页码和顺序异常，并能区分检查不确定与确认不可用。
  2. 图片检查经过有界 HEAD、Range 或浏览器加载探测，能识别真实图片、HTTP 失败、HTML/challenge、错误 content type 和重定向异常；HTTP 200 不单独提升图片状态。
  3. 用户可以看到 bounded、脱敏的逐页或失败样本 observation，并从 finding 发起指定章节/页集合的幂等 recheck/repair；已知良好页集不会被空结果或回归结果覆盖。
  4. 一个 fresh task/run/attempt/provider tuple 可以从 Dashboard command 追溯到 runner result、D1 observation/projection、receipt、内容读回和 Reader/Viewer 结果；provider success、任务 success、内容可用和实际消费结果分别呈现，缓存失效后可读回最新事实。

**Plans**: 4 plans (to be detailed by `$gsd-plan-phase 28`)

Plans:

- [ ] 28-01-PLAN.md — page identity/count/order contract、URL guard 和 bounded image probe adapters
- [ ] 28-02-PLAN.md — per-page observation、failure sample、chapter projection 和 cache freshness
- [ ] 28-03-PLAN.md — targeted page/chapter repair、Reader readback 和 Dashboard availability surface
- [ ] 28-04-PLAN.md — canonical Gateway fresh tuple、证据脱敏审计和全链路验收

## Progress

**Execution Order:** Phases 25 → 26 → 27 → 28

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 20. Source Contract, Receipt Boundary And SUN-064 | v1.4 | 3/3 | Complete | 2026-08-05 |
| 21. Source Health And Local repair_players Vertical Slice | v1.4 | 7/7 | Complete | 2026-08-06 |
| 22. Dashboard, MovieDetail And Player State Closure | v1.4 | 3/3 | Complete | 2026-08-07 |
| 23. GitHub Actions Production Repair And Reconciliation | v1.4 | 5/5 | Complete | 2026-08-08 |
| 24. Fresh Production Dashboard -> Viewer -> Playback Proof | v1.4 | 5/5 | Complete | 2026-08-10 |
| 25. Task Operations And Availability Contract | v1.5 | 1/4 | In Progress | 2026-08-11 |
| 26. Video Source And Magnet Availability | v1.5 | 0/4 | Not started | - |
| 27. Comic Chapter Completeness | v1.5 | 0/3 | Not started | - |
| 28. Chapter Image Availability And Gateway Acceptance | v1.5 | 0/4 | Not started | - |
