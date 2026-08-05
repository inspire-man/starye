# Project Research Summary

**Project:** Starye v1.4 播放可用性与生产自愈闭环
**Domain:** 单用户个人视频库从 crawler 入库、播放源修复到 Viewer 实际播放的运营闭环
**Researched:** 2026-08-05
**Overall confidence:** MEDIUM

## Executive Summary

Starye v1.4 面对的不是一个新的视频平台建设问题，而是 brownfield 内容中台中“metadata 已持久化”与“浏览器真的能播放”之间的断层。专家会把执行生命周期、内容 source readiness 和单次浏览器 playback proof 分成三个事实层：crawler receipt 说明受控执行与 D1 内容结果，source observation 说明候选源当前是否可修复或可用，`playing` 加 `currentTime` 推进才说明一次 Viewer 播放实际发生。`SUN-064 players=0` 正是现有 metadata success 可以掩盖 source 失败的实例。

推荐沿用现有 xgplayer、Vue、Hono/Cloudflare Workers、D1/Drizzle、GitHub Actions、Puppeteer、Playwright 和 Gateway，不新增媒体托管、队列或第二套编辑器。API/D1 继续是控制面与业务事实源，生产 Puppeteer 继续运行在 GitHub Actions；新增服务端拥有的 `repair_players` 子任务、source revision/health 投影、版本化 receipt 和脱敏播放证据。先以一个可在 Gateway 本地观察的 repair vertical slice 验证契约，再接生产 provider，最后用同一 fresh task/run/attempt/receipt/source tuple 完成 Dashboard -> Viewer -> 实际播放验收。

主要风险是错误成功：`players.length > 0`、HTTP 200、dispatch 受理、Actions 绿色、receipt 有 content ID、页面加载或截图都不足以单独代表 playback ready。并发 repair、旧回调、lease 过期、签名 URL/防盗链和缓存陈旧会放大这个风险。每个阶段都应使用有界探测、D1/CAS 幂等、分层 attempt/provider identity、source-aware cache freshness 和 fail-closed evidence；历史 v1.2 Phase 13 carrier 只能作为冻结背景，不构成 v1.4 验收证据。

## Key Findings

### Recommended Stack

沿用 lockfile 和当前运行时，v1.4 不需要新增生产依赖。健康探测是 Node runner 的有界 HEAD 或 `Range: bytes=0-0` 请求；浏览器 `canplay` 只是中间 readiness 信号，`playing` 与后续 `currentTime` 增量才是实际播放证据。磁力链接继续走现有 TorrServer/Aria2 路径，不应被当作 HTML5 direct URL。

**Core technologies:**

- **Vue 3.5.32 + xgplayer 3.0.24 + HTMLMediaElement events:** 复用现有 MovieDetail/Player 生命周期、错误卡片和重试能力，以显式状态机补上 `canplay`、`playing`、`waiting`、`stalled`、`error` 与有限 fallback。
- **Hono + Cloudflare Workers + D1/Drizzle 0.45.2:** 继续承载鉴权、状态迁移、source projection、receipt 校验和固定 dispatch；D1 是唯一可审计业务事实源，使用 prepared statements 与短 `batch()`，不在 Worker 内运行 Puppeteer 或长循环。
- **`@starye/api-types` + Valibot:** 共享闭合的 source state、repair input、receipt v2 和 evidence DTO；Dashboard 只传 allowlisted movie ID/template/target intent，workflow、URL、命令和 secrets 由 registry/server snapshot 持有。
- **Node 24 + Puppeteer 24.x + GitHub Actions:** 继续作为生产 crawler、`repair_players` 和 source probe 执行边界，复用 target-profile、Environment secrets、provider association、lease 和 HMAC callback。
- **Playwright Test 1.59.1 + Gateway:** 复用现有 browser projects 和 trace/video/screenshot 诊断；本地证据统一从 `http://localhost:8080/...` 进入，生产证据使用选定 Gateway origin。

关键版本和边界应与现有 workspace 保持一致：pnpm 10.33.0、Vue 3.5、xgplayer 3.0.24、Hono 4.12、Drizzle 0.45、Node 24、Puppeteer 24.x、Playwright 1.59.1。升级播放器、引入 HLS/DRM engine、Cloudflare Stream、Queues/DO/BullMQ/Temporal 或 Worker media proxy 都不属于 v1.4。

### Expected Features

研究把产品优先级集中在“一个内容从入库到恢复播放”的可观察链路，而不是扩大平台范围。

**Must have (table stakes):**

- **Metadata / playback readiness 双状态:** metadata persisted、source candidate、`ready`、`no_source`、`source_failed`、`repairing` 和 `playback_verified` 必须可区分；`players=0` 应进入无源或待修复状态。
- **Source health 与分类:** 区分 direct、magnet、TorrServer、inactive/unverified/failed，并保存有限的观察时间、错误码和 source revision；健康语义由独立字段承担，`player.isActive` 维持既有运营含义。
- **明确的无源或可播放终态:** 新抓取结果要么有实际候选源并进入健康检查，要么记录可修复 no-source 原因和 repair key。
- **受控 `repair_players` 入口:** 从 Dashboard 以 movie ID 发起固定模板的修复 task/run，不接受任意 URL、命令、workflow 或 secrets；优先修复 `SUN-064`。
- **幂等重试与历史保留:** 相同 operation/event 重放返回既有结果，失败 retry 创建新 attempt，旧 receipt/log/source observation 保留；旧 generation 的结果应被拒绝覆盖新 source。
- **MovieDetail / Player 状态闭环:** 无源、失效、修复中、加载、缓冲、错误、同源重试、有限回退和全部候选失败都要有可读动作。
- **fresh production playback proof:** 同一 fresh tuple 贯穿 Dashboard command、D1 run/attempt、provider、validated receipt、source state、Viewer 和 `playing`/时间推进证据。

**Should have (differentiators):**

- **Receipt-backed self-healing loop:** no-source/source-failed 内容从任务详情进入 repair，结果回写同一内容身份和 source state。
- **Source-aware fallback order:** 按 source kind 和 eligibility 选择 direct、TorrServer、Aria2 等已有路径，评分和排序不冒充健康证明。
- **浏览器观测驱动的 source evidence:** 保存脱敏的媒体事件、时间窗口、attempted/selected player 和 failure class，不保存完整媒体或签名材料。
- **单 tuple 运营追溯:** task/run/attempt、provider run、receipt、source observation、content ID 和 Viewer artifact 可从 Dashboard 互相定位。

**Defer (v2+):**

- 漫画、actor/publisher 及任意来源的通用 repair 模板；v1.4 只做一个受控 movie vertical slice。
- Cloudflare Stream/R2 视频托管、转码、DRM、Worker 代理或新的媒体平台。
- 任意命令/URL/凭据/定时策略编辑、通用任务编排、无限自动重抓和高频时间序列健康平台。
- 多用户、协作、商业化和与本闭环无关的全库运营能力。

### Architecture Approach

把 v1.3 已验证的 D1 crawler control plane 当作唯一执行权威，在旁边增加 source lifecycle 和 repair operation；不要把 source health 塞进 `crawler_run.status`，也不要把浏览器播放结果回写成 crawler success。推荐使用 append-only source observation 加 current projection，player rows 继续保存候选源身份和排序，`isActive` 保留现有运营/兼容语义。

**Major components:**

1. **D1/Drizzle control plane:** 保存 task、run、attempt、lease、provider association、日志、transition 和 receipt；repair 是绑定 `parentRunId`、movie snapshot、source revision 的 child run。
2. **Source contract and observation boundary:** 由 API 根据 D1 实际 player rows 派生 source disposition、eligible count、bounded failure code、source revision 和 receipt v2；runner 上报值只是候选。
3. **Closed operation registry:** `operation: 'repair_players'` 固定 template、entrypoint、workflow、target、permission resource 和版本；调用者只提交 movie ID/受控原因。
4. **Local/Actions runner adapters:** local runner 先完成签名 poll/claim/event/receipt 的 repair vertical slice；GitHub Actions 负责生产 Puppeteer、probe、sync、heartbeat、reconciliation 和 callback，保持 Worker 短请求边界。
5. **Dashboard read model:** 读取 D1 的父子 run、source summary、receipt、cooldown 和 repair action；不直接读 GitHub 文件、不拼接 shell 命令。
6. **Movie API + MovieDetail/Player:** API 返回 source state/revision/repair summary 与候选源；MovieDetail 显示 no-source/repairing/failed/ready，Player 通过共享 resolver 选择 eligible source、重试和回退。
7. **Gateway + Playwright evidence:** Gateway 是本地和生产 canonical origin，动态 task/detail/source 响应必须 fresh；Playwright 把 Dashboard -> Viewer -> actual playback 绑定到同一个 fresh tuple。

**Patterns to follow:** 三层状态分离（execution、content source、browser playback）；server-owned closed registry；按 source revision/CAS 的 idempotent child repair；source mutation、current projection 与 validated receipt 的短事务提交；source-aware cache freshness；以 `playing` 和 `currentTime` 作为 playback proof。

### Critical Pitfalls

1. **`players=0` 被 metadata success 掩盖:** 在 Phase 20 写入明确 source disposition 和 repairable no-source；receipt 必须重新查询实际 eligible player，不以 movie 行存在或 crawler count 作为 ready。
2. **URL/HTTP 200/206/magnet 被误判为可播放:** Node probe 只做筛选；direct source 需要有限状态/类型/Range 观察，magnet 需要现有 TorrServer 路径，最终由 Viewer `canplay`、`playing` 和 currentTime delta 收口。
3. **并发或旧 repair 覆盖新 source:** 使用 operation id、source revision/generation、D1 CAS/transaction、canonical source key 唯一性和实际 rows 重算 counters；晚到 callback 只能进入 ignored/conflict。
4. **业务 retry、provider rerun、callback retry 和 lease 波动串成幽灵运行:** 分开 application run/attempt、provider run/attempt、event/sequence、operation/generation；阶段 deadline、heartbeat/lease CAS 和 provider reconciliation 缺一不可。
5. **截图、page-load、Actions 绿色或旧 carrier 被拼成 playback pass:** evidence matrix 必须绑定 fresh target/run/attempt/content/source tuple，并观察实际媒体事件和时间推进；Phase 13 frozen carrier 永远不作为 v1.4 success。

其他必须贯穿各阶段的防线是 bounded probe/poll、Cloudflare 免费额度预算、signed URL/cookie/token redaction、source TTL，以及人工 player CRUD 与 repair operation 的 ownership 冲突处理。

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 20: Source Contract, Receipt Boundary And SUN-064

**Rationale:** 所有 runner、API、Dashboard 和 Viewer 都依赖同一 source 语义；先修复 metadata success 与 playback ready 混淆，后续实现才有稳定验收边界。

**Delivers:** D1/Drizzle migration 与 shared types；execution/source/browser 三层状态契约；source identity、eligible predicate、source revision、`players=0`/player write failure outcome；receipt v2/source summary；实际 player count/counter reconcile；source-bearing detail 的 no-store 或 revision cache policy；`SUN-064` 可验证的 no-source/repairable 状态。

**Addresses:** metadata/playback 双状态、source classification、新内容 ready/no-source、receipt-backed evidence 的基础。

**Avoids:** metadata receipt 掩盖空源、inactive source 默认播放、HTTP 200 伪 ready、旧 detail cache 继续返回 `players=0`。

**Research flag:** 需要 repo-specific planning research，尤其是现有 sync/receipt/cache 路径和 source-specific no-source 语义；通用 D1/Drizzle migration 模式本身可复用。

### Phase 21: Source Health And Local `repair_players` Vertical Slice

**Rationale:** 在接入 GitHub provider 前，先用本地 runner 验证修复 operation、source health、幂等和 receipt 的完整闭环，降低异步 provider 不确定性。

**Delivers:** Node 24 bounded HEAD/Range probe；health status、failure taxonomy、TTL/expiry；operation id、canonical source uniqueness、source generation/CAS、D1 batch 和 count rebuild；server-owned `repair_players` adapter；child task/run、signed events、local cancellation/retry/replay；repair receipt 与 Movie API readback。通过 `http://localhost:8080` 证明 Dashboard repair command -> local run -> source projection -> content detail 的纵向链路。

**Addresses:** 受控修复入口、幂等 retry/history、receipt-backed self-healing loop、source-aware health。

**Avoids:** 先删后插丢好源、重复 repair 抖动、旧 callback 覆盖新结果、无限 probe/retry、把完整 signed URL 写入日志。

**Research flag:** 需要目标 source 的 parser/AJAX、鉴权/防盗链、签名 TTL、rate limit 和实际 repairable 条件研究；MDN 或 schema 本身不足以推断这些行为。

### Phase 22: Dashboard, MovieDetail And Player State Closure

**Rationale:** UI 必须消费已经稳定的 source projection，而不是自己猜 `players[0]` 或把静态 URL 当健康状态；这一阶段把失败转化为用户可执行动作。

**Delivers:** Dashboard source summary/parent-child run/repair cooldown；MovieDetail 的 ready/no-source/repairing/source-failed/all-inactive 分支；共享 candidate resolver；xgplayer bounded same-source retry、next-source fallback、TorrServer/Aria2 分流、waiting/error/ended handling；稳定的 media proof markers；Vue/DOM/Playwright media fixtures。

**Addresses:** MovieDetail / Player table stakes、source-aware fallback、浏览器观测 evidence。

**Avoids:** inactive source 被默认选中、fallback loop、只加载 DOM/播放器实例就算成功、autoplay/waiting 误判和无限 loading。

**Research flag:** 需要对 direct、magnet、TorrServer 的真实事件序列做目标化验证；Vue/xgplayer 生命周期和 Playwright assertion 属于标准模式，可跳过泛化 research。

### Phase 23: GitHub Actions Production Repair And Reconciliation

**Rationale:** local vertical slice 证明控制面与 source mutation 后，再接生产 provider，才能把 provider 波动定位在 provider 层，而不是混入基础契约错误。

**Delivers:** 固定 `repair_players` workflow/job；registry-owned target snapshot、Environment secrets 和最小 dispatch/cancel；`GITHUB_RUN_ID`/`GITHUB_RUN_ATTEMPT`/application attempt 绑定；heartbeat/lease expiry、provider rerun、callback replay/conflict、cancellation、deadline 和 reconciliation；生产 repair receipt 与 source observation 回写。

**Addresses:** 受控生产自愈、单 tuple 追溯、GitHub Actions provider integration。

**Avoids:** Worker 运行 Puppeteer、dispatch 204 被当成执行成功、provider success 无 receipt、幽灵 runner、旧 attempt 串单和 secrets 泄露。

**Research flag:** 必须核对 live repository 的 GitHub permissions、workflow dispatch/cancel/rerun 语义、Chrome/Actions 排队波动和 selected target 的 secret/session 前置条件；先做 production-like 或受控 staging run。

### Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof

**Rationale:** 这是最后的业务门禁，必须在 source contract、repair、UI 和 provider 都稳定后执行，避免将局部成功拼成生产成功。

**Delivers:** 一个独立 fresh production task/run/attempt/provider tuple；Dashboard command/read、validated receipt、source observation/revision、Gateway cache policy、MovieDetail source identity、Player selected source、`canplay`/`playing`/`timeupdate` 和 currentTime 前后值；脱敏 JSON/Markdown evidence 及失败时的 trace/video/screenshot。

**Addresses:** fresh production playback proof 和完整日常使用链路；成功后再回读 `SUN-064` 等目标内容。

**Avoids:** 复用 v1.2 frozen carrier、历史 receipt 跨 run 复用、只看页面加载/截图/HTTP 200、错误 content code/target/source tuple 通过。

**Research flag:** 不需要新的通用框架 research；需要 selected target、signed Dashboard session、run allocation、evidence 保存位置和真实 source 的执行前确认。缺少这些输入时，结论限定为 local contract proof，production playback pass 需要另行验证。

### Phase Ordering Rationale

- Phase 20 先定义共享数据契约和 receipt 门槛，避免 UI、local runner 与 Actions 各自发明状态。
- Phase 21 先做 local `repair_players` vertical slice，验证 source mutation、幂等、计数和 receipt，再承担 provider 异步复杂度。
- Phase 22 消费稳定 projection 并把浏览器事件显式化；Dashboard、MovieDetail、Player 围绕同一 source lifecycle 交付。
- Phase 23 只增加 GitHub Actions 的 production execution/reconciliation，保持 Worker/Puppeteer 边界与 v1.3 control plane 原样。
- Phase 24 以 fresh tuple 做独立证据门禁；任何缺失的 source、provider、receipt 或 browser surface 都保留 failed/checkpoint，不由 summary、截图或历史 carrier 覆盖。

## Research Flags

Phases likely needing deeper research during planning:

- **Phase 20:** source-specific extraction outcome、receipt v2 兼容旧 v1.3 metadata receipt、API Cache API 与 Gateway freshness 的真实交界。
- **Phase 21:** 真实 provider 的 parser/AJAX、鉴权、防盗链、签名 TTL、Range 行为和 repair budget；source health TTL 需要现场数据。
- **Phase 22:** TorrServer/magnet 的 metadata/cache/stream error、xgplayer/native event timing、autoplay 和 production-like media fixture。
- **Phase 23:** GitHub App/token 最小权限、dispatch/cancel/rerun、Actions queue/Chrome 波动、lease 与 provider reconciliation 的 production-like 验证。
- **Phase 24:** selected target、signed session、fresh run allocation 和 evidence retention；这是执行前条件研究，不是重新研究 Playwright。

Phases with standard patterns (skip broad research-phase):

- **Phase 20 shared types/migration:** Drizzle/D1 prepared statement、batch 和 Valibot contract 模式已有仓库先例，仍需做本项目 source semantics 研究。
- **Phase 22 Vue/Playwright mechanics:** 现有 xgplayer、MovieDetail/Player 和 Playwright projects 足以作为实现基线，研究集中在真实 source fixture。
- **Phase 24 evidence mechanics:** Playwright assertions、trace/video/screenshot 和 Gateway local entry 已有模式；只需执行新鲜目标的生产前置核对。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | 当前 package/workflow/runtime 事实可直接复核，官方平台文档支持主要选择；xgplayer、Actions、D1 和浏览器跨源行为仍有环境依赖。 |
| Features | HIGH | 直接来自 v1.4 目标、v1.3 归档缺口和现有 MovieDetail/Player/receipt 行为；范围判断清晰。 |
| Architecture | MEDIUM | v1.3 control plane 边界为 HIGH，source observation、repair child run 和 cache revision 是有依据的增量设计，尚未在代码中实现。 |
| Pitfalls | MEDIUM | 源码事实和历史 evidence 约束为 HIGH，第三方防盗链、TorrServer、GitHub runner 波动和媒体事件时序需 fresh run 验证。 |

**Overall confidence:** MEDIUM. Roadmap 的依赖顺序和禁止项足够明确；外部 source/provider 行为不应在规划阶段被伪装成已验证事实。

### Gaps To Address

- **第三方 source contract:** 具体 AJAX/parser、cookie/Origin/Referer、signed URL TTL、Range 和 challenge 行为需要选定 source 后做 local/production-like 观察；只保存脱敏 failure class。
- **TorrServer/Aria2 实际播放:** magnet metadata、缓存、超时和 stream error 需要真实配置验证；字符串存在或 HTTP probe 不足以判定 ready。
- **Cache freshness:** API `detailCache()` 与 Gateway KV `movies` invalidation 是不同层次，Phase 20 必须选 no-store 或 sourceRevision key 并用 Gateway URL 验证。
- **Provider authority:** GitHub repository permissions、workflow/cancel/rerun 细节、queued runner/Chrome timing 和 callback secret rotation 需在 Phase 23 前确认。
- **Production proof inputs:** selected target、signed Dashboard session、fresh run ID、evidence artifact path 和 production source 选择尚未固定；缺任一项只能完成 local proof。
- **Schema shape:** minimal current projection 是 `movie/player` 字段还是独立 `movie_source_state`，应在 Phase 20 结合查询/迁移成本定案；append-only observation 与 current projection 的双层原则不变。

## Sources

### Primary (HIGH confidence)

- [PROJECT.md](../PROJECT.md) 与 [STATE.md](../STATE.md) — v1.4 目标、`SUN-064 players=0`、v1.3 control plane、旧 carrier 冻结和 fresh run 边界。
- [STACK.md](STACK.md)、[FEATURES.md](FEATURES.md)、[ARCHITECTURE.md](ARCHITECTURE.md)、[PITFALLS.md](PITFALLS.md) — 本次 v1.4 四类研究的完整证据与来源索引。
- [v1.3 roadmap](../milestones/v1.3-ROADMAP.md)、[v1.3 requirements](../milestones/v1.3-REQUIREMENTS.md) 与生产 provider evidence — task/run/attempt/lease、signed callback、validated receipt、Dashboard CRUD handoff 和生产 executor 边界。
- [sync.service.ts](../../apps/api/src/routes/movies/services/sync.service.ts)、[receipt-validation.ts](../../apps/api/src/domain/crawler-tasks/receipt-validation.ts)、[schema.ts](../../packages/db/src/schema.ts) — metadata/player 分离、当前 receipt 只验证 movie 行、冗余计数与 `isActive` 现状。
- [MovieDetail.vue](../../apps/movie-app/src/views/MovieDetail.vue)、[Player.vue](../../apps/movie-app/src/views/Player.vue) — 当前默认 `players[0]`、xgplayer、waiting/error/retry/fallback 播放链路。

### Secondary (MEDIUM confidence)

- [MDN HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)、[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) 与 [HTTP Range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests) — metadata/readiness/playing/buffering/error、跨源和媒体 Range 语义。
- [xgplayer official repository](https://github.com/bytedance/xgplayer) — 现有 xgplayer 3.0.24 初始化、事件和 destroy/rebuild 能力。
- [Cloudflare D1 API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[SQLite UNIQUE](https://www.sqlite.org/lang_createtable.html#unique_constraints) — batch、prepared statements、预算和 source identity 约束。
- [GitHub workflow dispatch/runs](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)、[concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency) 与 [default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables) — provider dispatch、run/attempt、cancel/concurrency 和 identity 语义。
- [Playwright assertions/webServer/trace/video](https://playwright.dev/docs/test-assertions) — Gateway browser proof 与辅助 artifact 能力；这些 artifact 不替代媒体事件。

### Tertiary (LOW confidence)

- 无。Brave websearch 因环境缺少 `BRAVE_API_KEY` 未作为来源；未交叉验证的社区或竞品结论不进入 roadmap 建议。

---
*Research completed: 2026-08-05*
*Ready for roadmap: yes*
