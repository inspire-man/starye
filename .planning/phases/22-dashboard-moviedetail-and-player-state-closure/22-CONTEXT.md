# Phase 22: Dashboard, MovieDetail And Player State Closure - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段把 Phase 21 已持久化的 bounded source health、readiness、repair task 和 authoritative readback 转化为 Dashboard、MovieDetail 与 Player 的可操作状态体验。用户应能理解 `ready`、`no_source`、`source_failed`、`repairing`，按 source 类型进入 direct、TorrServer 或 Aria2 路径，并在播放失败时经历有界重试、来源切换和清晰的错误升级。

本地可观察入口继续使用 `http://localhost:8080`。本阶段覆盖前端状态投影、来源选择、重试边界、任务详情同步和同一电影的回流；GitHub Actions provider repair/reconciliation 属于 Phase 23，fresh production Dashboard -> Viewer -> actual playback evidence 属于 Phase 24。

</domain>

<decisions>
## Implementation Decisions

### 来源选择与回退
- **D-01:** 标准播放入口优先使用 eligible direct source；magnet 通过 MovieDetail 的受控 TorrServer 或 Aria2 路径处理。
- **D-02:** 多个同类 eligible source 沿用服务端受控顺序，首个 eligible 作为默认源。评分、画质和更新时间只用于来源列表排序或并列提示，不作为健康或可播放证明。
- **D-03:** Player 通过 URL 或旧入口遇到 magnet 时，停在受控提示页并返回 MovieDetail；浏览器播放器只初始化可播放的 direct source。
- **D-04:** MovieDetail 来源卡片默认按 eligible direct、eligible magnet、inactive/ineligible 展示；所有来源的 bounded health 信息继续可见。

### 重试边界与错误升级
- **D-05:** 同一 direct source 在同一播放会话最多尝试 2 次；达到上限后展示“切换来源”并回到 MovieDetail。
- **D-06:** 重试计数按当前 source 和当前播放会话计算；切换 source 或重新进入播放页重新计数。
- **D-07:** 暂时性网络、缓冲和 TorrServer 流错误进入有限重试；source-invalid 与 magnet 直接进入 MovieDetail 的受控路径。
- **D-08:** 同一加载周期出现缓冲超时和 Player `error` 时合并为一次失败事件，一次加载周期最多消耗一次重试额度。

### MovieDetail 状态动作
- **D-09:** 四种 readiness 状态使用专属动作：`ready` 主操作为播放；`no_source`/`source_failed` 提供“查看修复意图”和“重试读取”；`repairing` 提供“刷新状态”。
- **D-10:** `repairing` 期间保留 source health 摘要、观察时间、revision 和修复状态，暂停播放入口，等待新的 server-owned readback。
- **D-11:** `no_source` 与 `source_failed` 共用修复入口和重试读取，但保留各自的原因文案与 bounded reason。
- **D-12:** `ready` 状态按 source 类型提供操作：direct 进入浏览器播放；magnet 提供 TorrServer、Aria2 等受控操作；inactive/ineligible 只展示健康信息。

### Dashboard 与详情状态同步
- **D-13:** Dashboard 沿用可见页 5 秒轮询，自动更新 queued/running/succeeded/failed 与 bounded readback；MovieDetail 使用“刷新状态”主动读取。
- **D-14:** 用户从 MovieDetail 发起修复并进入 Dashboard 后，自动打开新建的 `repair_players` 任务详情，保留同一 movie identity、reason 和 source revision。
- **D-15:** repair 终态提供同一电影的“查看影片”入口；成功展示新的 source revision/readback，失败展示 bounded reason 和下一步动作；用户点击后回到 MovieDetail 再刷新。
- **D-16:** 同一电影存在多个 repair task 或旧 attempt 时，Dashboard 聚焦最新 repair task，同时保留旧日志和 receipt；MovieDetail 读取当前 server-owned source projection。

### the agent's Discretion
- 具体 Vue 状态变量、组件拆分、按钮/图标样式、错误文案细节和可见页轮询的生命周期清理方式。
- 重试计数与加载周期去重的内部数据结构，只要满足 D-05 至 D-08，并覆盖 waiting/error 竞态测试。
- source card 的响应式布局、状态色彩、空态和可访问性标记，只要维持 bounded projection 与 source-type action boundary。
- 测试 fixture、mock 组织和 Phase 22 focused/E2E 验证命令，只要覆盖每个 success criterion 的真实数据流。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §Phase 22 — 阶段目标、PLAY-01/02/03 成功标准以及 Phase 23/24 边界。
- `.planning/REQUIREMENTS.md` §Playback Experience — PLAY-01、PLAY-02、PLAY-03 的状态、重试、回退和 source eligibility 要求。
- `.planning/REQUIREMENTS.md` §Source Readiness / §Repair Operations — readiness projection、bounded source health、repair task 和同一 content identity 约束。
- `.planning/PROJECT.md` §Current Milestone / §Constraints / §Out of Scope — Gateway、Cloudflare、受控模板和后续生产证明边界。
- `.planning/STATE.md` — 当前 Phase 22 planning 状态，以及 Phase 20/21 已锁定的 readiness、receipt、source revision 和 local repair 决策。

### Prior phase contracts and verification
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-CONTEXT.md` — source health、repair mutation、authoritative readback、MovieDetail handoff 和 local Gateway boundary。
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-VERIFICATION.md` — Phase 21 SRC-02/REP-01 证据、bounded DTO 和 local-only proof boundary。
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-03-SUMMARY.md` — readiness projection、MovieDetail repair-intent boundary 和 Player no-source guard。
- `.planning/phases/20-source-contract-receipt-boundary-and-sun-064/20-VERIFICATION.md` — metadata/source/playback 分层和 playback proof 不提前宣称的验证结论。

### Research and codebase patterns
- `.planning/research/FEATURES.md` — source health、repair、MovieDetail/Player 状态和后续生产播放范围。
- `.planning/research/PITFALLS.md` — stale state、敏感输出、source readiness 与 browser playback 的风险清单。
- `.planning/research/ARCHITECTURE.md` — Gateway -> API -> frontend data flow、D1/KV 边界和现有应用职责。
- `.planning/research/SUMMARY.md` — v1.4 source/repair/playback dependency chain。
- `.planning/codebase/ARCHITECTURE.md` — monorepo 分层、Gateway canonical entry 和 API/frontend integration pattern。
- `.planning/codebase/CONVENTIONS.md` — Vue、composable、route、test 和命名约定。
- `.planning/codebase/TESTING.md` — Vitest、Vue component test、Playwright E2E 和 CI validation pattern。
- `.planning/codebase/INTEGRATIONS.md` — Aria2 RPC、TorrServer、Gateway、D1 和生产执行边界。

### Current integration files
- `apps/movie-app/src/views/Player.vue` — readiness guard、xgplayer lifecycle、loading/waiting/error handlers、Aria2 fallback 和 TorrServer mode。
- `apps/movie-app/src/views/MovieDetail.vue` — readiness blocks、source health rows、repair handoff、refresh、Aria2/TorrServer actions 和 source cards。
- `apps/movie-app/src/utils/playbackSources.ts` — 现有 source sorting/rating helpers；必须与 eligibility 和播放选择保持语义分离。
- `apps/movie-app/src/types.ts` — MovieDetail、Player、ReadinessProjection 和 source DTO 类型。
- `apps/dashboard/src/views/Crawlers.vue` — task detail/readiness/source health、repair confirmation、5 秒 polling 和 same-movie management links。
- `apps/dashboard/src/lib/api.ts` — Dashboard typed API calls for crawler task/readiness/repair data。
- `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` — MovieDetail readiness/source health/handoff regression pattern。
- `apps/movie-app/src/views/__tests__/Player.security.test.ts` — Player source guard/security regression pattern。
- `apps/dashboard/src/views/__test__/Crawlers.test.ts` — Dashboard task/readiness/repair/source health regression pattern。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/movie-app/src/views/Player.vue` 已有 readiness guard、统一 loading/error overlay、waiting timeout、xgplayer event handlers、progress persistence、Aria2 fallback 和 trusted TorrServer stream mode；Phase 22 应围绕这些状态边界补齐 source selection/retry state。
- `apps/movie-app/src/views/MovieDetail.vue` 已有 readiness/source health summary、repair intent handoff、refresh action、`useAria2`、`useTorrServer` 和 source card action；实际 repair mutation 仍由 Dashboard 拥有。
- `apps/dashboard/src/views/Crawlers.vue` 已有 task detail、bounded readiness/source health projection、5 秒 visible polling、repair confirmation 和 task-to-movie link，可作为同步焦点。
- `apps/movie-app/src/utils/playbackSources.ts` 已有排序、评分和 source type helper；它适合展示排序，播放候选仍需单独过滤 eligible source。

### Established Patterns
- 所有本地可观察 API/UI 流量经过 `http://localhost:8080` Gateway；前端直接端口不是 canonical verification path。
- Phase 20/21 将 metadata、source readiness、source health、receipt 和 browser playback proof 分层；页面只消费 server-owned/bounded projection。
- source eligibility 先于播放初始化；inactive、空地址、magnet 浏览器直播放径和 source revision 需要显式处理。
- Dashboard 使用可见页定时刷新，MovieDetail 使用显式刷新；修复 task、run、attempt、receipt 和 source observation 保留历史事实。

### Integration Points
- Player 的 standard mode 与 `streamUrl` TorrServer mode 共享页面生命周期，但 source validation、retry cap 和 error escalation 需要分别覆盖。
- MovieDetail source card action 连接 public movie DTO、TorrServer composable、Aria2 composable 和 `/movie/:code/play` route query。
- Dashboard repair task detail 连接 admin crawler DTO、repair task polling、same-movie navigation 和 current readiness readback。
- Phase 22 的前端状态完成后，Phase 23 将在相同 task/readiness/receipt 边界上接入 production provider，Phase 24 再验证真实浏览器播放事件。

</code_context>

<specifics>
## Specific Ideas

- 继续使用 `SUN-064`/zero-player 的 bounded readiness 场景作为 no-source、repairing、source_failed 和修复后 ready 的回归 fixture。
- `ready`、receipt 和 browser playback proof 继续保持独立；出现 `ready` 时页面仍以播放操作和状态提示表达，不把评分或 receipt 自动写成 playback proof。
- 用户希望来源选择行为可预测：direct 是浏览器入口，magnet 是 TorrServer/Aria2 入口，inactive/ineligible 可见但不进入播放候选。
- 播放失败反馈应让用户知道当前 source 的尝试次数、可执行的下一步和回到同一电影详情的路径。

</specifics>

<deferred>
## Deferred Ideas

- GitHub Actions production repair、provider dispatch、lease/attempt reconciliation、迟到 callback 和生产 repair receipt 属于 Phase 23。
- fresh production Dashboard -> Viewer -> actual playback proof，以及 `canplay`、`playing`、`waiting`、`stalled`、`error` 和 `currentTime` 的脱敏证据属于 Phase 24。
- 漫画或其他内容类型的通用 repair/playback template 属于 v2 requirements。

</deferred>

---

*Phase: 22-dashboard-moviedetail-and-player-state-closure*
*Context gathered: 2026-08-07*
