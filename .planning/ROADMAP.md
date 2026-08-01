# Roadmap: Starye v1.3 后台爬虫任务与内容运维

## Milestones

- ✅ **v1.0 部署可用、日常使用态** - Phases 1-5 shipped 2026-07-11. Archive: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 存储成本控制与代码/文件整理** - Phases 6-10 shipped 2026-07-13. Archive: [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ⚠ **v1.2 Cloudflare 账户/域名切换与全链路发布验证** - Archived 2026-07-29 by override closeout. Archive: [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ◇ **v1.3 后台爬虫任务与内容运维** - Planned 2026-07-30. Phases 16-19.

## Current Status

v1.3 将视频与漫画 crawler 接入一个持久化、受控的任务控制面。Cloudflare API/D1 负责任务真相、鉴权、状态与日志；本地 Node runner 和 GitHub Actions 分别执行同一类固定模板。Phase 17 已完成本地 Gateway 纵向 proof；Phase 18 已完成 provider snapshot、D1 association、GitHub App binding、生产 lifecycle 控制面、registry-owned production adapter 与 integration contract/proof handoff，credentialed provider sign-off 交由 Phase 19。

## Phase Plan

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 16 | Task Domain Foundation | 建立受控任务、运行、日志、状态机与安全回调的持久化契约。 | CTRL-01..CTRL-05, OPS-01 |
| 17 | Local Runner Vertical Slice | 通过本地 runner 证明从后台创建到入库 receipt 与内容 CRUD 的完整纵向链路。 | LOCAL-01..LOCAL-03, DATA-01 |
| 18 | GitHub Actions Production Orchestration | 让生产 API 安全编排现有 Actions，并可信关联、取消、重试和补偿任务。 | PROD-01..PROD-03 |
| 19 | Dashboard Operations and End-to-End Proof | 完善后台任务运维体验、内容管理交接、运行手册和本地/生产验收。 | DASH-01..DASH-03, OPS-02, TEST-01 |

## Phase Status

- [x] **Phase 16: Task Domain Foundation** — Complete
- [x] **Phase 17: Local Runner Vertical Slice** — Complete (2026-07-31)
- [x] **Phase 18: GitHub Actions Production Orchestration** — Complete (2026-08-01)
- [ ] **Phase 19: Dashboard Operations and End-to-End Proof** — Planned

## Phase Details

### Phase 16: Task Domain Foundation

**Goal:** 建立受控任务、运行、日志、状态机与安全回调的持久化契约。

**Requirements:** CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, OPS-01

**Success criteria:**

1. 管理员只能以固定视频/漫画模板创建任务；任意命令、URL、密钥和 workflow 参数在 API 层被拒绝。
2. D1 可保留任务、attempt、结构化日志、操作者和受控输入快照，且任务状态迁移可审计、可验证。
3. 失败或取消的任务创建新的 attempt 并完整保留历史；同一模板的活动执行不会并发重复运行。
4. runner event 经过独立 HMAC、时间窗、nonce 和幂等校验，日志内容受限并完成脱敏。

**Plans:** 4/4 plans complete

Plans:

- [x] 16-04-PLAN.md

**Wave 1**

- [x] 16-01-PLAN.md — 固化任务/attempt/lease/log 的 D1 模型、状态机与保留契约。

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 16-02-PLAN.md — 提供受会话与资源权限保护的固定模板任务命令、查询、取消与重试 API。
- [x] 16-03-PLAN.md — 提供独立 HMAC runner-event 回调、日志脱敏与 90 天明细日志清理。

### Phase 17: Local Runner Vertical Slice

**Goal:** 通过本地 runner 证明从后台创建到入库 receipt 与内容 CRUD 的完整纵向链路。

**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, DATA-01

**Success criteria:**

1. 本地 runner 只使用 API 分配的 run ID 和固定模板执行既有视频或漫画 crawler，并按生命周期回写事件。
2. 在 `http://localhost:8080` 的 Dashboard 可观察本地任务状态、心跳、分页日志、取消与重试结果。
3. 成功 run 提供经验证的入库摘要和内容标识；空或不匹配 receipt 不会标记为成功。
4. 操作者可从 receipt 进入既有视频/漫画内容 CRUD，完成一次实际入库后的管理操作。

**Plans:** 3/3 plans complete

Plans:

- [x] 17-01-PLAN.md — 签名 runner poll/claim 控制面与串行本地 crawler runner。
- [x] 17-02-PLAN.md — D1 validated receipt、safe task read model 与漫画详情交接。
- [x] 17-03-PLAN.md — Dashboard task panel、receipt editor handoff 与 Gateway 本地 E2E proof。

### Phase 18: GitHub Actions Production Orchestration

**Goal:** 让生产 API 安全编排现有 Actions，并可信关联、取消、重试和补偿任务。

**Requirements:** PROD-01, PROD-02, PROD-03

**Success criteria:**

1. 生产 API 以最小权限凭据只 dispatch 固定电影或漫画 workflow，并保存应用 run 与 provider run 的关联。
2. 两个 Actions workflow 都使用 API 分配的 run ID，签名回写启动、进度、终态和 receipt，且维持 target-profile/environment 边界。
3. 后台可取消、重试和补偿生产任务；dispatch 受理、晚到事件或 provider 不匹配均不会被误报为成功。
4. schedule 与手动 Actions run 都通过控制平面注册，避免形成不可见或双重执行的任务。

**Plans:** 6/6 plans executed

Plans:
**Wave 1**

- [x] 18-01-PLAN.md — Provider snapshot、D1 association schema 与 GitHub App binding

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-02-PLAN.md — GitHub App JWT/token 与固定 Actions REST client
- [x] 18-03-PLAN.md — 签名 callback、schedule 注册与双 workflow 入口

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-04-PLAN.md — D1 CAS lifecycle、取消/重试与 provider reconciliation
- [x] 18-05-PLAN.md — movie/manga production adapter 与 prepared mutation registry

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18-06-PLAN.md — 跨 API/D1/Actions 的 integration contract 与 proof handoff

### Phase 19: Dashboard Operations and End-to-End Proof

**Goal:** 完善后台任务运维体验、内容管理交接、运行手册和本地/生产验收。

**Requirements:** DASH-01, DASH-02, DASH-03, OPS-02, TEST-01

**Success criteria:**

1. Dashboard 提供受权限保护的创建、列表、详情、自动刷新、分页日志、确认后的取消与重试操作。
2. 成功 receipt 可直接交接至现有内容 CRUD，管理员可管理本次入库的电影或漫画记录而不产生第二套编辑器。
3. RUNBOOK 说明 GitHub 凭据、日志留存、失联 run、取消、重试和回滚；不暴露秘密内容。
4. 本地和生产均有从后台任务创建到入库后内容 CRUD 的可重复验收证据。

**Plans:** 1/6 plans executed

**Wave 1**

- [x] 19-01-PLAN.md — API 完整 task/attempt/read model、稳定游标、provider/receipt 脱敏投影。
- [ ] 19-02-PLAN.md — local/production evidence schema、JSON+Markdown builder 与模式隔离。

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 19-03-PLAN.md — Dashboard 分组历史、同页详情、attempt/log 分页、可见性刷新、取消/重试。

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 19-04-PLAN.md — validated receipt 到既有 Movies/Comics 编辑器的受控交接与可回退 CRUD 测试。

**Wave 4** *(blocked on Wave 3 and evidence contract completion)*

- [ ] 19-05-PLAN.md — Gateway 双模板 local runner → receipt → CRUD evidence 与取消 checkpoint。

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 19-06-PLAN.md — 单条 credentialed provider tuple、生产 evidence 与 RUNBOOK 运维收口。

Cross-cutting constraints:

- 稳定 `(updated_at,id)` task keyset 和 descending sequence log cursor。
- UI 仅按资源权限显示固定 movie/manga 模板；API 每次重复最终授权校验。
- provider、receipt、callback 和 evidence 只投影经过验证的脱敏字段。
- 本地 Gateway evidence 与 credentialed production tuple 永远分开标记。
- 取消保持 `cancel_requested`，重试创建新 attempt，旧历史和日志长期保留。

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTRL-01 | Phase 16 | Complete |
| CTRL-02 | Phase 16 | Complete |
| CTRL-03 | Phase 16 | Complete |
| CTRL-04 | Phase 16 | Complete |
| CTRL-05 | Phase 16 | Complete |
| OPS-01 | Phase 16 | Complete |
| LOCAL-01 | Phase 17 | Complete |
| LOCAL-02 | Phase 17 | Complete |
| LOCAL-03 | Phase 17 | Complete |
| DATA-01 | Phase 17 | Complete |
| PROD-01 | Phase 18 | Complete |
| PROD-02 | Phase 18 | Complete |
| PROD-03 | Phase 18 | Complete |
| DASH-01 | Phase 19 | Pending |
| DASH-02 | Phase 19 | Pending |
| DASH-03 | Phase 19 | Pending |
| OPS-02 | Phase 19 | Pending |
| TEST-01 | Phase 19 | Pending |

**Coverage:**

- v1.3 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Roadmap created: 2026-07-30*
*Last updated: 2026-07-31 after Phase 17 completion*
