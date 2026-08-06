# Phase 21: Source Health And Local repair_players Vertical Slice - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在 Phase 20 的 typed readiness、receipt 和 content identity 边界之上，提供每个受控播放源的有限健康观察，并从 Dashboard 经本地 Gateway 发起一个固定模板的 `repair_players` 任务。纵向链路覆盖受控输入、任务快照、本地串行执行、source observation 持久化、权威读回和可审计终态；任务粒度限定为单部电影。

本阶段的可观察入口是 `http://localhost:8080`。Phase 22 负责 MovieDetail/Player 的播放动作与状态体验，Phase 23 负责 GitHub Actions 生产修复和 reconciliation，Phase 24 负责 fresh production Dashboard -> Viewer -> actual playback proof；这些能力保持在后续阶段。

</domain>

<decisions>
## Implementation Decisions

### Source health 展示粒度
- **D-01:** 每个源的健康投影使用有限稳定集：`sourceType` (`direct | magnet | TorrServer`)、`health` (`inactive | unverified | failed`)、`observedAt` 和 bounded reason。`ready` 继续由 Phase 20 的 source disposition 表达，browser playback proof 单独保留。
- **D-02:** `magnet` 是候选源类型，默认健康状态为 `unverified`，不会单独升级为 direct-ready。TorrServer、Aria2 等具体传输动作留在 Phase 22 的受控路径。
- **D-03:** `failed` 只呈现 bounded reason code 和对应中文文案。原始来源值、请求材料、页面内容、异常细节和签名材料留在服务端边界内。
- **D-04:** `inactive` 在 source health 列表中可见，用于解释数量差异；资格判断和默认播放候选只消费 eligible source。

### Repair 入口和输入形状
- **D-05:** 实际修复 mutation 从 Dashboard 发起。MovieDetail 保留状态和引导入口，指向 Dashboard 的修复/任务状态；MovieDetail 本身只承担展示，不直接承担管理员 mutation。
- **D-06:** 使用专用后台接口 `POST /api/admin/crawler-tasks/repair-players`。请求只表达受控电影身份、当前 source disposition 对应的 `reason` 和固定 `targetIntent`；adapter、workflow、target、secret 由服务端 registry 和任务快照拥有。
- **D-07:** `reason` 只允许当前 source disposition 派生的 `no_source` 或 `source_failed`；`targetIntent` 固定为 `restore_playable_sources`，管理员不选择 direct、magnet 或 TorrServer 目标，也不填写自由文本原因。
- **D-08:** 发起 mutation 前使用二次确认。确认摘要只包含影片名称、当前受控原因和“恢复可播放源”意图，确认完成后才创建任务。
- **D-09:** 一个 `repair_players` 任务只绑定一部影片，便于保持 content identity、source revision 和 readback 的单一边界。

### 本地 repair_players 执行契约
- **D-10:** 任务快照带独立 `operation: repair_players`，并由专用 adapter 注册表选择执行器。普通 movie crawler 与 repair adapter 保持显式分离，快照缺少匹配 operation 时进入受控失败。
- **D-11:** adapter 通过既有受控服务/API 边界提交 source observation；服务端负责持久化、派生 projection 和权威 readback。adapter 直接写数据层或以 runner 日志推断业务状态均不属于本阶段契约。
- **D-12:** 本地进程正常退出只是中间结果。任务进入 `succeeded` 前，服务端必须已经持久化本次 observation，且 runner 读回的同一影片 source health 与本次任务结果一致。
- **D-13:** 成功事件使用专用 repair receipt，至少绑定 `operation`、影片 ID、`sourceRevision`、`observedAt` 和有限 source summary；普通 movie receipt 的 `contentIds/templateKey` 形状单独保留，不能作为 repair 成功证明。

### 失败、重试和旧事件保护
- **D-14:** 仅对明确归类的短暂执行、写入或 readback 故障自动新增一次 attempt。确定性输入/契约/源状态失败进入终态；人工重试创建新任务，并在创建前重新读取当前 source disposition。
- **D-15:** 事件处理绑定 `runId`、`attempt`、`sequence`、`eventId`，并校验任务关联的 source revision。完全相同的重复投递保持幂等；旧 attempt、乱序或内容冲突事件返回受控结果，当前 source health 只接受有效的新观察。
- **D-16:** 任务和 source health 的界面只显示有限状态、attempt/观察时间和受控失败原因，并给出当前允许的下一步动作；runner 原始输出不成为界面或外部证据的一部分。

### the agent's Discretion
- bounded reason code 的具体 allowlist、中文文案和 API schema 的字段命名细节，只要保持 D-01、D-03、D-07 的稳定边界。
- source observation 的存储表/DTO 拆分、CAS/readback 的具体实现、retryable code 的精确分类和本地 polling 时间，只要满足 D-12、D-14、D-15。
- Dashboard 与任务详情的间距、颜色、加载态和测试 fixture 组织；视觉实现沿用现有 dashboard 组件和状态投影模式。

</decisions>

<specifics>
## Specific Ideas

- `SUN-064` 的 `players=0` 是 Phase 20 已建立的 no-source/repairable 代表场景；Phase 21 应沿用同一 movie identity 和 source projection 接入修复链路。
- 这条链路的本地观察以 `http://localhost:8080` 为 canonical 入口，证明任务进入受控控制面并回到同一影片的 source observation/readback。
- `MovieDetail` 现有的“查看修复意图”属于 informational boundary；本阶段把它接到 Dashboard 修复/状态路径，实际 mutation 仍由后台专用入口拥有。
- `ready`、receipt、页面加载和 browser playback proof 保持独立语义；`canplay`、`playing`、`currentTime` 等浏览器证据留给后续播放/生产证明阶段。

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §Phase 21 — 阶段目标、SRC-02/REP-01 成功标准以及 Phase 22-24 的边界。
- `.planning/REQUIREMENTS.md` §Source Readiness / §Repair Operations — SRC-02、REP-01 的字段和受控输入要求，以及 REP-02/REP-03 的后续依赖。
- `.planning/PROJECT.md` — v1.4 milestone 目标、Cloudflare/GitHub Actions 执行边界、受控模板和成本约束。
- `.planning/STATE.md` — Phase 20 已完成的 readiness/receipt 决策与 Phase 21 当前工作位置。

### Prior source contract
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-03-SUMMARY.md` — typed readiness projection、bounded reason、MovieDetail repair-intent boundary 和 Player guard。
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-VERIFICATION.md` — Phase 20 的验证结论和未提前宣称的 playback proof 边界。

### Research baseline
- `.planning/research/SUMMARY.md` — v1.4 source/repair/playback 研究摘要。
- `.planning/research/ARCHITECTURE.md` — 现有 API、Dashboard、crawler runner 和 provider 控制面结构。
- `.planning/research/FEATURES.md` — 受控修复、source health 和后续播放体验的功能边界。
- `.planning/research/PITFALLS.md` — stale event、敏感输出、source readiness 与 browser proof 的风险清单。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domain/movies/source-contract.ts`: 已有 typed source disposition、bounded reason code、source revision 和 server-owned readiness projection；Phase 21 应在此契约上扩展 source health/repair receipt。
- `apps/dashboard/src/views/Crawlers.vue` 与 `apps/dashboard/src/lib/api.ts`: 已有 crawler task/run 详情、receipt/readiness 投影和受控操作展示，可作为修复任务状态焦点。
- `packages/crawler/src/task-runner/local-runner.ts`: 已有 poll -> claim -> heartbeat -> adapter execute -> terminal event 的串行本地 runner，以及 cooperative cancellation。
- `packages/crawler/src/task-runner/runner-client.ts`: 已有签名 runner envelope、attempt/sequence 事件提交和 terminal callback 客户端；普通 receipt 形状需与 repair receipt 分开。

### Established Patterns
- `packages/crawler/src/task-runner/template-adapters.ts` 当前按 template/entrypoint 做显式 adapter 选择；repair operation 应沿用“快照约束 + 注册表选择”，避免隐式 fallback。
- Phase 20 的 readiness projection 将 metadata、source、receipt 和 playback 分层，页面只消费 validated/bounded projection；Phase 21 继续沿用这一 boundary。
- v1.3 控制面以 D1 task/run/attempt/log/lease 为审计事实，runner 只通过受控 callback 反馈状态；本阶段的 retry 和 stale-event 规则要接在同一生命周期上。

### Integration Points
- 专用 admin repair route 需要创建 server-owned task snapshot，并连接既有 poll/claim/lease 状态机。
- Dashboard mutation、确认框、task detail 和 MovieDetail 引导需要共享同一 movie identity 与 readiness projection。
- 本地 repair adapter 需要调用受控源观察/回读边界，并将 repair receipt 交给现有 terminal event/reconciliation 处理。

</code_context>

<deferred>
## Deferred Ideas

- TorrServer、Aria2 和各 source type 的实际播放/切换动作 - Phase 22。
- GitHub Actions provider repair、生产 reconciliation 和迟到回调的完整闭环 - Phase 23。
- fresh production Dashboard -> Viewer -> actual playback proof - Phase 24。
- 更广泛内容类型的通用 repair 模板和高频全库自动重抓 - v2 requirements。

</deferred>

---

*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Context gathered: 2026-08-06*
