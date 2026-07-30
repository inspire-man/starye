# Requirements: Starye v1.3 后台爬虫任务与内容运维

**Defined:** 2026-07-30
**Core Value:** 部署在公网、能稳定日常使用的个人内容中台

## v1.3 Requirements

### 任务控制

- [x] **CTRL-01**: 管理员可从固定的视频或漫画模板创建爬虫任务，接口拒绝任意命令、URL、密钥和 workflow 参数。
- [x] **CTRL-02**: 系统持久化任务、每次 attempt、结构化日志、操作者与受控输入快照。
- [x] **CTRL-03**: 任务状态支持排队、分发、运行、成功、失败、取消请求和已取消；非法状态迁移被拒绝。
- [x] **CTRL-04**: 失败或已取消任务可创建新的可追溯 attempt，历史状态和日志保持不变。
- [x] **CTRL-05**: 视频/漫画模板的重复活动执行受 D1 claim/lease 约束，避免双重运行。

### 本地执行

- [ ] **LOCAL-01**: 本地 runner 使用 API 创建的 run ID 执行现有视频或漫画 crawler。
- [ ] **LOCAL-02**: 本地 runner 回写启动、心跳、日志、终态和入库 receipt，并支持协作取消。
- [ ] **LOCAL-03**: 本地任务可在 Gateway `http://localhost:8080` 观察状态、取消、重试和入库结果。

### 生产编排

- [ ] **PROD-01**: 生产 API 使用最小权限凭据触发固定的电影或漫画 GitHub Actions workflow。
- [ ] **PROD-02**: Actions 将应用 run 与 `GITHUB_RUN_ID` 绑定，并以签名事件回写状态、日志和终态 receipt。
- [ ] **PROD-03**: 生产任务支持 provider 状态补偿、取消和重试，且不会把 dispatch 受理视为成功。

### 后台与内容运维

- [ ] **DASH-01**: Dashboard 支持创建、列表、详情、分页日志和状态自动刷新。
- [ ] **DASH-02**: Dashboard 支持确认后的取消/重试，并继承现有视频/漫画资源权限。
- [ ] **DASH-03**: 成功 receipt 链接到现有视频/漫画内容 CRUD，管理员可完成增删改。
- [ ] **DATA-01**: 成功任务必须记录可验证的入库摘要与内容标识；空或不匹配 receipt 不得标记成功。

### 安全与运维

- [x] **OPS-01**: runner 回调使用独立 HMAC、时间窗、nonce、事件幂等和日志脱敏。
- [ ] **OPS-02**: 为 GitHub 凭据、日志留存、失联 run、取消、重试和回滚更新 canonical RUNBOOK。
- [ ] **TEST-01**: 本地与生产路径均具备从任务创建到入库后内容 CRUD 的可重复验收证据。

## Future Requirements

### 任务扩展

- **TASKX-01**: 管理员可管理 crawler 的定时计划、启停和受控参数配置。
- **TASKX-02**: 管理员可为 actor/publisher 等额外 crawler 模板创建任务。
- **TASKX-03**: Dashboard 提供实时流式日志和可配置的通知策略。

## Out of Scope

| Feature | Reason |
|---------|--------|
| 任意 shell、来源 URL、workflow、环境变量或密钥输入 | 会绕过受控模板、target-profile 和凭据边界。 |
| Worker/Pages 内执行 Node/Puppeteer crawler | 生产 crawler 保持在现有 GitHub Actions，Worker 只承担控制面。 |
| 无限自动重试 | 会放大来源站压力、GitHub Actions 消耗和错误入库风险。 |
| 后台定时策略编辑 | 本里程碑保持既有 workflow schedule，先收口手动任务的可信执行链路。 |
| 新建第二套视频/漫画编辑器 | receipt 应复用既有 Dashboard 内容 CRUD，避免内容管理逻辑分叉。 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTRL-01 | Phase 16 | Complete |
| CTRL-02 | Phase 16 | Complete |
| CTRL-03 | Phase 16 | Complete |
| CTRL-04 | Phase 16 | Complete |
| CTRL-05 | Phase 16 | Complete |
| LOCAL-01 | Phase 17 | Pending |
| LOCAL-02 | Phase 17 | Pending |
| LOCAL-03 | Phase 17 | Pending |
| PROD-01 | Phase 18 | Pending |
| PROD-02 | Phase 18 | Pending |
| PROD-03 | Phase 18 | Pending |
| DASH-01 | Phase 19 | Pending |
| DASH-02 | Phase 19 | Pending |
| DASH-03 | Phase 19 | Pending |
| DATA-01 | Phase 17 | Pending |
| OPS-01 | Phase 16 | Complete |
| OPS-02 | Phase 19 | Pending |
| TEST-01 | Phase 19 | Pending |

**Coverage:**

- v1.3 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after v1.3 roadmap creation*
