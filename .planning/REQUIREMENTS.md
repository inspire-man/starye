# Requirements: Starye v1.4 播放可用性与生产自愈闭环

**Defined:** 2026-08-05
**Core Value:** 部署在公网、能稳定日常使用的个人内容中台；优先保证内容可访问、可阅读、可观看。

## v1 Requirements

### Source Readiness

- [x] **SRC-01**: 用户可以在任务详情和 MovieDetail 中分别看到 metadata persisted 与 playback readiness；状态至少区分 `ready`、`no_source`、`source_failed`、`repairing` 和 `playback_verified`。
- [x] **SRC-02**: 用户可以查看每个受控播放源的 source 类型与有限健康信息；至少区分 direct、magnet、TorrServer、inactive、unverified 和 failed，并显示最近观察时间或受控失败原因。
- [x] **SRC-03**: 每次新的受控视频抓取都会得到“存在候选源并进入健康检查”或“明确 no-source / repairable”两种终态；`SUN-064` 的 `players=0` 必须完成状态读回和修复判定。

### Repair Operations

- [x] **REP-01**: 用户可以在 Dashboard 为已入库电影发起固定模板的 `repair_players` 任务；输入限定为受控电影身份、原因和目标意图，URL、命令、workflow 和 secrets 由服务端 registry 管理。
- [ ] **REP-02**: 用户可以看到 repair 的 queued、running、succeeded、failed 和 retry 状态；相同请求或事件重放保持幂等，失败重试创建新 attempt，并保留旧日志、receipt 与 source observation。
- [ ] **REP-03**: 用户可以从 `no_source` 或 `source_failed` 内容进入受控修复，并在成功后回到同一个内容身份查看更新后的 source state 与 validated receipt。

### Playback Experience

- [ ] **PLAY-01**: 用户在 MovieDetail 中能分别看到 ready、no-source、source-failed 和 repairing 状态，并获得对应的播放、修复、刷新或切换源动作。
- [ ] **PLAY-02**: 用户在 Player 中能看到加载、缓冲、失效和播放错误的明确反馈；当前源重试次数有边界，失败后可切换候选源或进入现有 TorrServer/Aria2 路径。
- [ ] **PLAY-03**: Player 按 source 类型和 eligibility 选择回退顺序；direct、magnet、TorrServer 和 Aria2 走各自受控路径，评分或排序字段不单独代表健康或可播放。

### Production Evidence

- [ ] **EVID-01**: 用户可以通过一个独立 fresh production run 完成 Dashboard command -> D1 task/run/attempt -> provider -> validated receipt -> source observation -> Viewer -> 实际播放的同 tuple 验收。
- [ ] **EVID-02**: 用户可以查看脱敏的播放证据摘要；证据至少包含受控的 `canplay`、`playing`、`waiting`、`stalled`、`error` 事件和 `currentTime` 推进结果，不保存完整媒体或签名材料。
- [ ] **EVID-03**: 用户可以从 Dashboard task detail 追溯到对应 content ID、source revision、repair receipt 和 Viewer evidence；provider success、repair success 与 actual playback 分别呈现。

## v2 Requirements

Deferred to future release. Tracked but not in the current roadmap.

### Broader Repair

- **FUT-01**: 用户可以为漫画、actor、publisher 和其他内容类型使用通用 repair 模板。
- **FUT-02**: 系统提供高频、全库、无限自动重抓和时间序列 source health 平台。

### Media Infrastructure

- **FUT-03**: 系统使用 Cloudflare Stream、R2 视频托管、转码、DRM 或新的媒体平台承载视频。

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dashboard 任意命令、来源 URL、密钥、workflow 或定时策略编辑 | 保留 v1.3 的受控模板、target-profile、凭据和审计边界 |
| 在 Cloudflare Worker 内运行 Puppeteer 或代理全部视频 | 生产 crawler 继续由 GitHub Actions 执行，并遵守 Cloudflare 免费额度约束 |
| 为 repair receipt 创建第二套 Movies 编辑器或内容平台 | 复用现有 `primaryContentId` 和 Movies CRUD，避免出现两套内容真相 |
| 复用历史 Phase 13 carrier 作为 v1.4 production proof | 历史 carrier 已冻结；本轮使用独立 fresh production run |
| 多用户、协作、商业化和移动端原生应用 | 与单用户个人内容中台的当前核心价值无关 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRC-01 | Phase 20 | Complete |
| SRC-02 | Phase 21 | Complete |
| SRC-03 | Phase 20 | Complete |
| REP-01 | Phase 21 | Complete |
| REP-02 | Phase 23 | Pending |
| REP-03 | Phase 23 | Pending |
| PLAY-01 | Phase 22 | Pending |
| PLAY-02 | Phase 22 | Pending |
| PLAY-03 | Phase 22 | Pending |
| EVID-01 | Phase 24 | Pending |
| EVID-02 | Phase 24 | Pending |
| EVID-03 | Phase 24 | Pending |

**Coverage:**

- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-08-05 after v1.4 requirements scoping*
