# Domain Pitfalls

**Domain:** Starye v1.4 播放可用性与生产自愈闭环
**Researched:** 2026-08-05
**Overall confidence:** MEDIUM

## 研究边界与判断标准

本文件只覆盖 v1.4 的播放源可用性、受控 repair、生产浏览器执行和 fresh Dashboard -> Viewer -> 实际播放证明。v1.3 的任务、run、attempt、lease、callback、provider association 和 receipt 已存在，因此本研究把它们视为基础设施，而不是重新设计任务控制面。

文中的 Phase 20-24 是服务于 roadmap 的建议 ownership 编号，不代表当前 v1.3 ROADMAP 已经创建这些 phase；具体编号和拆分应由后续 roadmap 阶段确认。

源码事实的置信度为 HIGH：当前仓库可以直接复核。平台行为来自 MDN、Puppeteer、GitHub Actions、Cloudflare D1 和 Playwright 官方文档，置信度为 MEDIUM。Brave websearch 在本环境缺少 BRAVE_API_KEY，未把未交叉验证的社区或竞品说法当作权威依据；因此防盗链规则、具体第三方播放站兼容性和生产成功率仍需 phase-specific fresh run 验证。

本研究采用三个不同的成功层次，避免把一种证据越权解释成另一种证据：

1. source metadata：已保存 sourceUrl、sourceName 等字段，且 URL 通过 schema。
2. source reachable：在明确的请求上下文下获得可接受的响应或 TorrServer 任务状态。
3. playback ready：从实际 Viewer 打开目标 source，并观察媒体进入 canplay 或 playing，在允许的测试窗口内发生可观察的时间推进。

source metadata 不是 playback ready。磁力链接不适合用普通 HTTP HEAD 证明；直接媒体 URL 的 HTTP 200 也可能只是登录页、挑战页或不支持 Range 的响应。

## Critical Pitfalls

### Pitfall 1: players=0 被元数据成功或 receipt 成功掩盖

**What goes wrong:** 爬虫成功解析电影标题和元数据，但来源站的 player AJAX 返回空结果、被拦截、超时或解析失败。当前 JavBus strategy 在详情解析默认返回 players: []，磁链抓取异常只记录 warning 后继续返回电影信息；同步层对空 players 不进入播放源写入分支。这样一条电影记录仍可能带着完整标题、封面和 crawlStatus 被视为成功，甚至被 movie receipt 认可。

**Why it happens:** getMovieInfo 把详情页和播放源作为两个弱耦合步骤，_fetchMagnets 的失败没有提升为 source-specific failure。当前 sync.service.ts 只有在 players 且长度大于 0 时才写入 player；没有把空源写成可见的 no_source 结果，也没有在成功判定中要求 active player。

**Consequences:** 新抓取内容无法播放；空结果还可能让旧的来源状态继续被当作本次成功结果，或让新电影带着 metadata-only 状态进入内容库。Dashboard 显示成功，MovieDetail 没有可操作来源，Player 只会报“未找到播放源”。这是 SUN-064 players=0 的直接失败模式。

**Prevention:**

- Phase 20 固化 source result contract：sources_found、no_source、source_probe_failed、source_ready 等状态必须和 metadata result 分离；空 player 是有原因的业务结果，不是默认成功。
- 对新内容要求明确的 source policy：允许落库为 no_source 时，必须保存可修复原因、source attempt 和下一步 repair 状态；若本次任务契约要求播放可用，则 players=0 直接阻止 terminal succeeded。
- receipt 校验至少检查目标 movie 存在、active player 数量和 source readiness；movie 行存在本身只能证明 metadata ingestion。
- repair 不应把空输入解释为“清空当前好源”，除非操作明确选择 replace，并且先保存旧 source snapshot。

**Detection:** 对 players.length === 0、AJAX 非 2xx、详情页被挑战页替代、源解析超时、movie totalPlayers 与 active player 查询不一致建立结构化 failure code。Dashboard、MovieDetail 和 receipt 读模型必须显示 no_source 或 repairable，不能只显示任务成功。

**Phase 归属：** Phase 20「Playback source contract 与 SUN-064 修复」。

**依赖：** 依赖 v1.3 validated receipt、movie/player schema 和 crawler adapter；Phase 21 的 health/repair 只能在 Phase 20 定义的 source state 上工作。

**可执行验证：**

- crawler fixture 覆盖详情成功但 source AJAX 空、超时、非 2xx 和正常返回四种输入。
- API/D1 assertion 同时检查 movie 行、active player 行、source state 和 terminal status；只有 metadata 而无 source 时必须是明确的 no-source outcome。
- 对一个真实或受控 fixture movie 复现 SUN-064：从 Dashboard 创建任务，确认 players=0 不会伪装为 playback-ready。

**置信度：** HIGH（仓库事实），MEDIUM（平台等待/网络语义）。

### Pitfall 2: URL、HTTP 200、206 或磁链存在被误判为可播放

**What goes wrong:** sourceUrl 通过 v.url()，或一次 fetch/HEAD 得到 200/206，就被标记为可用。响应可能是 HTML 登录页、验证码、过期签名后的错误页，或者仅支持下载而不支持媒体 Range。磁链字符串合法也不表示 TorrServer 能解析、获取元数据并持续向浏览器输出媒体。

**Why it happens:** URL validity、network reachability 和 HTMLMediaElement readiness 是不同层次。当前 receipt validator 对 movie 只查询 movie.id 和 movie.code，没有 join player，也没有校验 active player、Content-Type、Range 或播放事件。Player 初始化 xgplayer 后才会通过 canplay、playing 和 error 反映实际媒体状态。

**Consequences:** Dashboard 和验收记录“来源存在”，用户进入 Viewer 后看到黑屏、无限缓冲、错误或被重定向；重试会重复写入同一坏源。

**Prevention:**

- Phase 20 将 metadata_valid、transport_reachable、playback_ready 作为不可互换的状态；不要把 HEAD-only probe 作为最终成功标准。
- 对 direct media source，在有明确请求上下文时检查最终 URL、状态码、Content-Type、Accept-Ranges/Content-Range、响应体是否明显是 HTML，并设置有限超时；这些检查只作为前置筛选。
- 对 magnet source，通过现有 TorrServer 路径验证 metadata/stream 建立，再由 Viewer 播放证明；不在 Worker 中新增 Puppeteer 或完整媒体探针。
- Phase 22 的 Player 必须以状态机驱动 fallback/retry，不能默认取一个未筛选 source。

**Detection:** 记录每个 source 的 probe_kind、最终 URL 的 host 摘要、status、Content-Type、Range 结果、TorrServer error code 和 browser media event。将“有 URL 但没有 canplay/playing”归类为 source unhealthy，而不是 task succeeded。

**Phase 归属：** 契约和 probe policy 在 Phase 20；Viewer 状态在 Phase 22；最终证明在 Phase 24。

**依赖：** 依赖 Player 的实际 source selection、TorrServer client、受控 source fixture，以及官方 HTML media event/Range 语义。

**可执行验证：**

- 用 fixture 返回 200 HTML、206 正确媒体、403、302 到登录页、过期签名和短读流，验证状态分别落入正确分类。
- 用一个有效 magnet 和一个不可解析 magnet 验证 TorrServer 错误不会被 URL schema 吞掉。
- Playwright 只在观察到 canplay 或 playing 且 currentTime 有推进后标记 playback pass；仅 DOM 节点存在、xgplayer 实例存在或 page load 不通过。

**置信度：** HIGH（当前 receipt 和 Player 代码），MEDIUM（MDN 对媒体、CORS、Range 的平台语义）。

### Pitfall 3: isActive=false 的失效来源仍进入 API、MovieDetail 和 Player

**What goes wrong:** 用户上报或 repair 标记 player 为 inactive，但 detail query 仍加载所有 player，返回 DTO 仍包含 isActive 为 false 的记录；MovieDetail 的 sortedPlayers 只按列表排序，模板也未在循环处排除 inactive。Player 的标准模式默认使用 movie.players[0]，因此可能直接选择失效源。

**Why it happens:** isActive 目前同时承担“是否展示”和“是否允许播放”的隐含含义，但 API、UI 和播放器没有共享的 playback eligibility predicate。reportCount、人工 repair、健康检查和 source replacement 也没有统一的 lifecycle transition。

**Consequences:** 用户每次打开详情都被送到已知坏源；失败后 fallback 可能再次选中相同源，失效上报与实际行为脱节。

**Prevention:**

- Phase 20 定义 source lifecycle 和 server-side eligibility：至少区分 active、unhealthy、repairing、retired、no_source；isActive 只能作为兼容投影。
- Phase 22 的 MovieDetail 默认只展示可播放候选，并显式展示无源/全部失效/正在修复状态；Player 只接受 API 返回的 eligible source 或经过统一筛选的 source id。
- API 需要在服务端过滤或明确标注不可播放项，避免把“客户端自己记得过滤”当作安全边界。
- health repair 成功要有 CAS/version 条件，防止旧 repair 把新 source 再置回 active。

**Detection:** 测试包含一条 active、一条 inactive、一条过期/repairing source；断言 API DTO、MovieDetail 列表、默认 Player source 和 fallback 序列都不选择 inactive。监控 isActive=false 被播放请求选中的次数。

**Phase 归属：** Phase 20 定义 contract；Phase 22 完成 UI/Player closure；Phase 21 负责 health transition。

**依赖：** 依赖 source state contract 和 API read model；需要保留 v1.3 player report 行为的兼容投影。

**可执行验证：**

- getMovieByIdentifier fixture 断言 inactive source 的处理方式固定且与契约一致。
- MovieDetail DOM test 断言无源、全部失效、可回退三种文案和操作状态。
- Player test 断言 player query 指向 inactive source 时被拒绝或转到 eligible fallback，而不会直接初始化。

**置信度：** HIGH（仓库源码事实）。

### Pitfall 4: 来源鉴权、防盗链、CORS 和签名过期被混成一个“URL 失效”

**What goes wrong:** 来源站可能要求 cookie、签名 query、短时 token、Origin/Referer、特定 User-Agent 或浏览器挑战。Crawler 能在来源站页面上下文中拿到磁链，不代表 Worker、TorrServer 或最终 Viewer 能用同一上下文请求媒体。反过来，浏览器的 CORS 失败、媒体服务器的 403、签名过期和来源站反爬也可能都被简化成“播放失败”。

**Why it happens:** crawler、API/Worker、TorrServer 和浏览器是不同 trust boundary。CORS 是浏览器跨源读取控制，不是来源服务器的通用防盗链协议；Origin/Referer 也不是可长期持久化的授权凭据。把完整 signed URL、cookie 或 Authorization header 写入 D1、日志或 receipt 会扩大泄露面并使 repair 复用过期凭据。

**Consequences:** 本地看起来可播，生产不播；或 crawler 的浏览器能打开来源站，但 Viewer 不能；repair 反复重放已过期签名，D1 里保存敏感 query，日志被复制到 Dashboard。

**Prevention:**

- Phase 20 为每个 source 保存非秘密的 access_mode/source_kind 和 failure class，例如 direct、magnet、torrserver、signed-url、session-bound；只保存可轮换的来源标识和过期时间摘要，不保存 cookie、token 或完整敏感 header。
- 认证材料按执行边界留在 GitHub Environment/runner 进程或用户配置；生产 Puppeteer 继续由 GitHub Actions 执行，Worker 只编排和核验受控结果。
- 不把浏览器的 Origin/Referer 伪造成“通用修复”；repair 必须使用来源协议允许的上下文，失败时返回明确的 auth/hotlink/expired code。
- source health 使用短 TTL 和抖动，签名过期后重新获取 source，而不是无限重试旧 URL。

**Detection:** 保留脱敏的 status、failure_class、source host、token expiry bucket 和请求阶段；区分 401/403、CORS console failure、challenge HTML、DNS/timeout、TorrServer auth failure。绝不以日志中存在完整 URL 或 cookie 作为成功证据。

**Phase 归属：** Phase 20 的 source access contract；Phase 21 的 health/repair；Phase 23 的 production runner secrets 和 provider context。

**依赖：** 依赖来源站实际响应、TorrServer 配置、Gateway/Viewer origin 和 GitHub Environment；第三方防盗链规则需要 fresh production run 复核。

**可执行验证：**

- 构造 cookie-required、Referer-required、expired-signature、CORS-denied 和正常媒体 fixture，断言 failure class 不混淆。
- 校验 D1、runner log、receipt 和 Dashboard projection 均没有 token、cookie、Authorization header 或完整 signed URL。
- 在 local 与 production target 分别验证同一 source 的访问上下文，并把差异记录为 evidence，而非假定一致。

**置信度：** MEDIUM（官方 CORS/Range 语义和仓库边界明确；具体来源站防盗链行为需现场验证）。

### Pitfall 5: 并发 repair 的先删后插导致好源丢失或旧结果覆盖新结果

**What goes wrong:** 当前 sync service 只对单次输入在内存中按 sourceUrl 去重，然后执行 delete all players，再批量 insert。两个 repair、一次 crawler sync 和一次人工编辑并发时，较晚完成的旧结果可以删除较新的 source；插入失败还可能留下空集合或 movie 的冗余计数不一致。player 表当前没有 movie_id + source_url 的数据库唯一约束。

**Why it happens:** 去重范围只是一个请求；source replacement 没有 operation id、generation/version 或 CAS；删除与插入不是以 source lifecycle 作为业务事务。D1 batch 可把一组 SQL 作为事务执行，但它不会自动判断两个 repair 哪一个在业务上更新。

**Consequences:** 刚修复的 source 消失、重复 player 增长、active 计数错误、用户看到 intermittent no source，且事后只能从日志猜哪一个 repair 赢了。

**Prevention:**

- Phase 21 引入 immutable repair operation：movie_id + repair_key + requested_source_generation 或同等幂等键；重复请求返回原 operation outcome，不重新 delete/insert。
- 使用 D1 事务/CAS：先读取并锁定当前 source generation，只有 generation 未变化时才替换；插入后按数据库实际 active rows 重算计数。
- 优先采用 upsert/compare-and-swap 的 source-level mutation；整组 replace 必须保存旧 snapshot、明确 replace policy，并在同一事务内完成。
- player 去重和 movie_id + canonical_source_key 唯一性应进入 schema/migration，不能只依赖 JavaScript Set。

**Detection:** 记录 repair operation id、request id、source generation、winner/loser、before/after active count；告警 deleted source 后没有对应 replacement、同一 repair key 多个 effective winner、movie totalPlayers 与 SQL count 不一致。

**Phase 归属：** Phase 21「Source health 与 repair 幂等」。

**依赖：** 依赖 Phase 20 source identity/lifecycle、D1 migration 和现有 admin movie CRUD；Phase 23 的 task retry 必须复用同一 operation contract。

**可执行验证：**

- 并发启动两个相同 repair 和两个不同 source repair，验证只产生一个相同 key 的有效 outcome，旧 generation 不得覆盖新 generation。
- 在 delete、insert、counter update 各阶段注入失败，确认事务/补偿后的 player 集合和状态可解释。
- 重复执行同一 callback、同一 Dashboard repair command 和同一 crawler result，验证结果稳定且历史完整。

**置信度：** HIGH（sync/schema 事实），MEDIUM（D1 事务行为）。

### Pitfall 6: business retry、provider rerun、callback retry 叠加成重复 repair

**What goes wrong:** 一次 source repair 的 HTTP timeout 可能触发 runner client retry；GitHub Actions 又可能 rerun 同一 workflow；Dashboard 看到失败后再创建 business retry；最后一个晚到的 succeeded callback 还可能携带旧 receipt。若这些层次都使用“重新执行 repair”而没有边界，单个电影会被重复抓取、重复替换或把旧 attempt 的结果写进新 attempt。

**Why it happens:** 应用 attempt、GitHub GITHUB_RUN_ID、GITHUB_RUN_ATTEMPT、callback event_id 和 repair operation id 是不同身份。GitHub 官方语义中 run ID 在 rerun 时保持不变，而 run attempt 增加；workflow dispatch 的受理也不等于 provider 已开始。把它们压成一个 retry count 会丢失因果关系。

**Consequences:** 任务状态回退、receipt 串单、source 反复抖动、配额浪费，或者旧 provider 成功覆盖当前管理员明确选择的新 repair。

**Prevention:**

- Phase 23 维持四层 ID：application run/attempt、provider run/attempt、callback event/sequence、repair operation/generation；每层都有明确的唯一性和 owner。
- transport retry 只重发同一个 event；provider rerun 必须绑定新的 application attempt 或 provider attempt；business retry 创建 v1.3 约定的新 run，不复用旧 receipt。
- source mutation 以 operation/generation CAS 为最后一道闸门；terminal attempt 以外的晚到 callback 只能记录 ignored/conflict。
- 失败分类要区分 transient network、source unhealthy、auth、provider_lost、receipt_missing；不要对所有 failure 自动重试。

**Detection:** Dashboard 展示 task、run、attempt、provider run/attempt 和 repair operation 的关系；对相同 operation 多个 effective mutation、旧 attempt callback 修改新 run、retry depth 超限进行告警。

**Phase 归属：** Phase 23「Production runner 与 reconciliation」；Phase 21 负责 repair mutation 的幂等底座。

**依赖：** 依赖 v1.3 Phase 18 provider association、Phase 19 retry/read model、Phase 21 operation key。

**可执行验证：**

- 模拟 callback timeout 后重发、GitHub rerun、Dashboard retry、晚到 succeeded 和 provider mismatch 的交错序列。
- 断言旧 attempt 的 receipt 不会推进新 attempt，也不会覆盖较新的 source generation。
- 断言同一 event replay 返回已存 outcome，event identity 改变但 body 不同则在 lifecycle mutation 前冲突。

**置信度：** HIGH（仓库已有 attempt/provider/event/reconciliation 代码），MEDIUM（GitHub rerun/dispatch 官方语义）。

### Pitfall 7: Puppeteer、GitHub Actions、heartbeat 和 lease 波动造成幽灵运行

**What goes wrong:** 浏览器导航、来源站 AJAX、Cloudflare challenge、Chrome 启动、GitHub runner 排队或网络上传都可能超过单个 timeout。当前部分 Puppeteer selector timeout 会被捕获后继续；domcontentloaded 只代表导航阶段，不代表 source AJAX 或媒体 ready。若 heartbeat 因网络抖动丢失，D1 lease 可能过期并将 run 标记为 lost，而原 runner 随后仍然回传 progress/succeeded。

**Why it happens:** 页面生命周期、crawler item 生命周期、Actions job 生命周期和应用 lease 生命周期不同步。GitHub schedule 可能延迟或丢失，workflow dispatch 可能返回 204 或带 provider run details 的 200，concurrency 只提供 provider 侧并发保护而不是业务队列。把一个 timeout 当作所有阶段的失败判定会造成误杀或幽灵执行。

**Consequences:** 两个 runner 同时 repair、实际仍在写入的 run 被标记失败、任务卡在 dispatching、成功 callback 被拒绝或误写、免费额度被重复消耗。

**Prevention:**

- Phase 23 为 navigation、source extraction、sync、heartbeat、callback 和 overall job 设置独立 deadline；保留 browser_started、source_extracted、sync_started 等结构化阶段。
- heartbeat/lease 使用单调 sequence 和 CAS；lease expiry 后旧 runner 只能收到 terminal/ignored outcome，不能继续改变 source。
- provider_started 必须绑定 stored provider identity；poll/reconciliation 只查询预存 run ID，并校验 workflow/path/ref/sha/environment snapshot。
- schedule 入口先注册控制面，手动 dispatch 只传 server-derived run id、attempt、template、target；Actions concurrency 只作额外 guard。
- 浏览器关闭、page/context cleanup 和 cancellation 要在 finally 路径执行；超时原因必须保留而不是 catch 后当作空结果。

**Detection:** 监控 dispatching 超时、heartbeat gap、lease expiry 后的 callback 数量、同 template 的重叠 active runs、provider tuple mismatch 和 runner process 仍存活的 terminal runs。检查 GitHub run status 与 D1 status 的差异。

**Phase 归属：** Phase 23。

**依赖：** 依赖 v1.3 lease/state machine/provider reconciliation；不把生产 Puppeteer 移入 Worker，生产执行边界保持 GitHub Actions。

**可执行验证：**

- 在 Puppeteer fixture 中注入 selector timeout、AJAX timeout、browser launch failure、page crash、slow source 和 callback timeout。
- 在 Actions/runner contract test 中交错 heartbeat 丢失、lease expiry、晚到 terminal callback、provider rerun 和 cancellation。
- 证明 lease expired 的旧 runner 不能写 source 或将新 attempt 标记成功；fresh run 仍可在新 lease 下执行。

**置信度：** HIGH（仓库 timeout、lease 和 workflow 事实），MEDIUM（Puppeteer/GitHub 平台行为）。

### Pitfall 8: dispatch、进程退出 0、receipt、截图或 page-load 被拼成生产播放成功

**What goes wrong:** Dashboard 看到 dispatch 受理、GitHub job 绿色、runner 退出 0、movie 行存在、receipt 有 primaryContentId、Viewer 页面加载或 screenshot 存在，就把整个链路标为成功。这些证据各自只能覆盖一个边界：dispatch 不证明执行，receipt 当前不证明 player，page-load 不证明媒体可播，screenshot 也可能只拍到 loading 或 error overlay。

**Why it happens:** 证据没有按 task/run/attempt/provider tuple 和 surface 分层，且历史 Phase 13 carrier 的证据与 v1.4 fresh production run 容易混用。当前 receipt validator 的 movie 分支只验证 movie id/code；Playwright 的 assertion/trace/video 是观测工具，不会自动证明业务语义。

**Consequences:** 发布结论声称“生产自愈闭环完成”，但用户实际无法播放；历史冻结 carrier 被误当作当前 production proof，问题在上线后才暴露。

**Prevention:**

- Phase 24 采用不可跳过的证据链：Dashboard command -> application run/attempt -> provider started/terminal -> validated ingestion receipt -> API movie detail -> eligible source -> Viewer -> actual media playback。
- 每个 evidence row 带 mode、target、run id、attempt、template、content id、surface、observedAt 和 status；source-specific receipt 不得跨 run 或跨 target 复用。
- succeeded 只表示该 surface 的契约已满足；production playback pass 必须追加 browser observation：打开正确 content code，选择正确 player，收到 canplay/playing，并在窗口内观察到 currentTime 或等价进度变化。
- screenshot、trace、video、network log 是辅助证据，不能替代媒体事件和内容/source tuple 校验。
- v1.4 每次使用独立 fresh run；历史 Phase 13 carrier 保持冻结，旧 CONCERNS.md 只作线索，不得转写成当前 production success。

**Detection:** 建立 evidence matrix，任一必需 surface 缺失、tuple 不匹配、receipt 没有 active player、Viewer 只加载页面、media error/timeout 或证据时间早于 fresh run 都必须是 failed/checkpoint。验证器应输出原始 gaps_found，不能由 summary 或 screenshot 覆盖。

**Phase 归属：** Phase 24「Fresh production Dashboard -> Viewer -> 实际播放验收」。

**依赖：** 依赖 Phase 20 source contract、Phase 21 health/repair、Phase 22 Viewer state、Phase 23 provider reconciliation，以及目标环境的显式生产凭据和 signed session。

**可执行验证：**

- 使用一个全新 production run，记录 Dashboard 操作、D1 run/attempt、GitHub provider tuple、receipt、API response、Viewer URL/player id 和媒体事件。
- Playwright assertion 必须失败于只加载页面、只有 screenshot、只有 xgplayer DOM、只有 HTTP 200、没有 currentTime 推进的 fixture。
- 对缺少 active source、错误 content code、错误 target、旧 attempt receipt 和 historical carrier 分别验证 fail-closed。

**置信度：** HIGH（仓库 receipt/evidence 约束和历史验证事实），MEDIUM（Playwright 观测能力及平台执行波动）。

## Moderate Pitfalls

### Pitfall 1: health probe 频率和 repair 轮询消耗 Cloudflare 免费额度

**What goes wrong:** Dashboard 自动刷新、每个 player 的定时 probe、repair 重试和 provider reconciliation 叠加，造成大量 Worker invocation、D1 read/write 和 GitHub API 请求。为证明播放而在 Worker 中做代理或长轮询，会把媒体流量和浏览器执行成本带入错误边界。

**Prevention:** Phase 21 使用 bounded probe、TTL、指数退避和 jitter；D1 只写状态变化和受限摘要；Dashboard 使用 keyset/poll backoff。生产 Puppeteer、媒体流和长任务继续留在 GitHub Actions/TorrServer/浏览器边界。

**Detection:** 按 source、movie、run 和 route 统计 probe/read/write 计数；超过单次 repair budget 或免费额度预算时 fail closed，并保留待人工处理状态。

**Phase 归属：** Phase 21，运营预算在 Phase 23。

**可执行验证：** 用 1、10、100 个 source 的模拟 repair 计算 request/D1 写入上界，确认重复刷新不会线性无界增长。

**置信度：** MEDIUM（Cloudflare 计费/执行模型来自官方文档；具体预算依赖账户计划）。

### Pitfall 2: totalPlayers、active count、health state 和 receipt count 漂移

**What goes wrong:** 删除/插入 player、用户 report、repair success 和 source health 更新分别维护计数字段，异常中断或并发完成顺序会让电影显示“有 1 个源”但查询不到 active row，或 receipt count 与实际行数不同。

**Prevention:** Phase 20 明确 totalPlayers 是兼容投影还是事实；Phase 21 在事务后从 player rows 重算 active/total count，receipt 以查询结果为准，禁止只信 crawler 传入 count。

**Detection:** 定期 read-only consistency query 比较 movie counters、player rows、source state 和 evidence；漂移只触发 repair/checkpoint，不直接自动覆盖人工状态。

**Phase 归属：** Phase 20/21。

**可执行验证：** 对 insert failure、duplicate conflict、inactive transition、manual delete 和 retry race 注入故障，断言重算结果。

**置信度：** HIGH（现有冗余字段与写入路径），MEDIUM（D1 batch 的事务边界）。

### Pitfall 3: autoplay、浏览器策略和等待时间造成错误的“播放失败”或“播放成功”

**What goes wrong:** 页面初始化成功不代表用户手势、音频策略、buffer 或 source 真的允许播放；反过来短暂 playing 也不代表 stream 能持续。固定等待时间会把慢但有效的 source 判为失败，把短暂加载判为成功。

**Prevention:** Phase 22 明确 loading、canplay、playing、waiting、error、ended 状态和 bounded waiting window；测试使用显式媒体事件与最小进度阈值，而不是 sleep 或 DOM presence。

**Detection:** 记录 first canplay、first playing、waiting duration、media error 和 currentTime delta；区分 autoplay blocked、source error、network timeout 和 user pause。

**Phase 归属：** Phase 22，最终门禁在 Phase 24。

**可执行验证：** 对 autoplay blocked、缓冲、短视频结束和持续播放四类 fixture 验证 UI 文案、fallback 和 evidence 结论。

**置信度：** MEDIUM（MDN HTMLMediaElement 和浏览器执行语义）。

### Pitfall 4: repair 成功后没有 source lifecycle TTL，旧坏源重新出现

**What goes wrong:** 某次 repair 获得的 signed URL 很快过期，或来源站暂时恢复后再次失效；系统只保存 isActive=true，没有 last checked、expiry 或 failure history，后续任务又把旧源当作新鲜 source。

**Prevention:** Phase 20/21 保存非秘密的 lastCheckedAt、health TTL、failure code、source generation 和 observed target；过期状态进入 stale/unknown，不能等同 ready。repair 成功仅对当前 generation 生效。

**Detection:** 定期列出 ready 但超过 TTL 的 source，比较 last successful playback 与 last metadata crawl；对 expired signed URL 和 repeated failure 计数。

**Phase 归属：** Phase 21。

**可执行验证：** 使用可控短 TTL fixture，验证过期后进入 stale、重新获取 source 后 generation 变化、旧 URL 不再被 Player 默认选择。

**置信度：** MEDIUM（具体 TTL 需基于来源实测）。

### Pitfall 5: 失败详情、signed URL 和浏览器网络日志泄露到 Dashboard

**What goes wrong:** 为了调试把完整 URL、query token、cookie、Referer、响应 HTML 或截图上传到 D1/R2/Dashboard；v1.3 已有日志 redaction，但 v1.4 source health 可能引入新的字段。

**Prevention:** Phase 20 先定义 source error allowlist 和 URL redaction；Phase 23 runner 只发送结构化摘要；Phase 24 evidence 只保存脱敏 tuple、状态和必要媒体事件。原始调试材料若必须保留，使用短 TTL、受权限保护的本地/Actions artifact。

**Detection:** schema/test 扫描 log、receipt、evidence JSON 中的 token、cookie、authorization、signed query 和过长 URL；在 callback boundary 和 Dashboard projection 各做一次 redaction。

**Phase 归属：** Phase 20/23/24。

**可执行验证：** 用包含 token/cookie/Authorization 的模拟错误输入跑 callback、D1 projection、Dashboard API 和 evidence builder，确认输出只保留脱敏字段。

**置信度：** HIGH（v1.3 已有 redaction/allowlist 边界），MEDIUM（新 source provider 字段仍待实现）。

## Minor Pitfalls

### Pitfall 1: fallback 选择循环或重复选择同一坏源

**What goes wrong:** source A 失败后 fallback 回到 A，或 player query、sort order、report state 和 repair state 共同作用时产生循环；用户看到反复闪烁而没有可操作终态。

**Prevention:** Phase 22 每次 playback attempt 保存 visited source ids，单次 viewer session 不重复选择；所有候选耗尽时进入 all_sources_failed，提供 repair/report，而不是无限 retry。

**Detection:** 记录 source attempt sequence 和 fallback count；超过有限阈值即停止并显示 error state。

**Phase 归属：** Phase 22。

**可执行验证：** A/B 两个坏源、一个好源、全部坏源和重复 query 四个 fixture，断言顺序稳定且不会循环。

**置信度：** MEDIUM（依赖新 Player 状态机设计）。

### Pitfall 2: repair operation 与人工 player CRUD 的 ownership 不清

**What goes wrong:** 后台管理员手动编辑/删除 player 时，正在运行的 crawler repair 又写回旧 snapshot；用户无法判断哪一个变更赢了。

**Prevention:** Phase 21 把 mutation actor、operation id、source generation 和 reason 写入审计；Phase 22/19 的 CRUD handoff 复用同一个 source lifecycle，不创建第二套播放器编辑事实。

**Detection:** 发现 manual mutation 后的 stale repair conflict 时保留双方摘要，要求重新发起 repair，不静默覆盖。

**Phase 归属：** Phase 21，并与既有 content CRUD 交接联调。

**可执行验证：** 人工更新 source 后完成旧 repair callback，确认 callback 进入 conflict/ignored，当前手工 source 保留。

**置信度：** HIGH（v1.3 既有 CRUD 与 receipt handoff），MEDIUM（新 ownership contract）。

### Pitfall 3: 只用单一“可用率”指标掩盖 source 类型差异

**What goes wrong:** direct URL、magnet、TorrServer 和 signed URL 共用一个 success rate；一个来源类型的鉴权失败或播放器错误被整体平均数掩盖。

**Prevention:** Phase 21/23 按 source kind、provider、failure class、target 和 browser surface 分维度；小样本不形成强结论。

**Detection:** Dashboard 同时显示 no_source、unhealthy、auth_failed、transport_failed、playback_failed 和 ready 的计数及时间窗口。

**Phase 归属：** Phase 21/23。

**可执行验证：** 混合 source fixture 运行一次 repair 和 playback evidence，断言聚合不会把不同 failure class 合并成 success。

**置信度：** MEDIUM。

## Feature / State Dependencies

依赖链：source identity + lifecycle -> active-source read model -> health probe / repair operation -> idempotent source mutation -> task attempt / provider reconciliation -> MovieDetail and Player state machine -> fresh production evidence。

建议的不可逆依赖顺序：

1. Phase 20 先定义 source identity、readiness 分层、players=0 语义、inactive 过滤和 receipt 最低门槛。
2. Phase 21 再实现 health TTL、failure taxonomy、operation id、generation/CAS、数据库唯一性和计数重算。
3. Phase 22 在上述 contract 上收口 MovieDetail/Player 的 no-source、inactive、retry、fallback、auth 和 media error 状态。
4. Phase 23 将 repair operation 接入 v1.3 task/run/attempt/provider/lease/reconciliation，不改变 GitHub Actions 生产执行边界。
5. Phase 24 最后执行独立 fresh production run，完成 Dashboard -> Viewer -> 实际播放证据门禁；历史 Phase 13 carrier 不参与成功判定。

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Required Verification |
|-------------|----------------|------------|-----------------------|
| Phase 20: source contract / SUN-064 | metadata 成功掩盖 players=0，或 inactive source 仍被默认选择 | 固化 source state、eligible predicate、receipt active-player 门槛和 no-source reason | crawler fixtures + D1/API receipt assertion + SUN-064 regression |
| Phase 21: health / repair | 旧 repair 覆盖新 source，重复命令造成 delete/insert 抖动 | operation id、source generation、CAS/transaction、数据库唯一性、bounded TTL | 并发 repair、故障注入、重复 callback、counter consistency |
| Phase 22: MovieDetail / Player | URL/HTTP 200 被当作可播，fallback loop，全部失效仍初始化 | server/client 双层 eligibility，状态机和有限 fallback，媒体事件/进度门槛 | Vue unit/DOM + Playwright media fixture |
| Phase 23: production runner | Actions dispatch、browser exit 0、lease heartbeat 被误当最终成功 | 分层 attempt/provider identity、阶段 deadline、lease CAS、reconciliation、独立 secrets | provider rerun/callback replay/lease expiry/browser timeout integration |
| Phase 24: fresh production proof | 截图、page load、旧 carrier 或 receipt 被拼成 playback pass | evidence matrix 绑定 fresh tuple，必须观察 canplay/playing 和 currentTime 推进 | http://localhost:8080 local rehearsal + selected fresh production run |

## Deeper Research Flags

- 第三方播放来源的真实鉴权、防盗链、签名 TTL 和允许的 Origin/Referer 组合需要在 Phase 20/21 选定 source 后做目标化实测；官方 CORS 文档不能替代 provider contract。
- TorrServer 对 magnet 的 metadata、缓存、超时和实际 stream error 需要在 Phase 22/24 使用真实配置验证；不要用字符串存在替代结果。
- GitHub Actions schedule、queued runner 和 Chrome 版本波动需要在 Phase 23 的 production-like run 中采集分阶段时间，而不是只从单次成功推断稳定性。
- fresh production proof 需要明确 selected target、signed Dashboard session、run id 分配和证据保存位置；没有这些输入时只能完成 local contract proof，不能升级为 production playback pass。

## Sources

### Current repository evidence, HIGH

- [PROJECT.md](../PROJECT.md) 与 [STATE.md](../STATE.md)：v1.4 范围、v1.3 控制面基础、Phase 13 carrier 冻结和 fresh run 约束。
- [JavBus strategy](../../packages/crawler/src/strategies/javbus.ts:220)：详情结果默认 players: []；[磁链抓取](../../packages/crawler/src/strategies/javbus.ts:254) 在失败时 warning 后返回空结果。
- [sync.service.ts](../../apps/api/src/routes/movies/services/sync.service.ts:330)：空 player 跳过写入；非空输入采用内存去重、先删后插和冗余计数更新。
- [movie.service.ts](../../apps/api/src/routes/movies/services/movie.service.ts:228)：detail query 读取 player 的 isActive 但没有在 query 层筛除 inactive；[DTO projection](../../apps/api/src/routes/movies/services/movie.service.ts:379) 继续投影该字段。
- [MovieDetail.vue](../../apps/movie-app/src/views/MovieDetail.vue:196)：列表只按 players 数组排序；[模板](../../apps/movie-app/src/views/MovieDetail.vue:749) 直接遍历 sorted players。
- [Player.vue](../../apps/movie-app/src/views/Player.vue:340)：标准模式默认取 movie.players[0]；[media event handling](../../apps/movie-app/src/views/Player.vue:396) 才能观察 canplay/playing/waiting/error。
- [receipt-validation.ts](../../apps/api/src/domain/crawler-tasks/receipt-validation.ts:50)：movie receipt 只按 id/code 验证 movie 行，未验证 player 或 playback readiness。
- [db schema](../../packages/db/src/schema.ts:153)：movies/player 的冗余计数、isActive 和现有索引；[crawler run schema](../../packages/db/src/schema.ts:353) 与 v1.3 attempt/lease 基础。
- [v1.3 roadmap](../milestones/v1.3-ROADMAP.md)：生产 Puppeteer 在 GitHub Actions、provider association、attempt/retry/reconciliation 和 evidence 分层约束。

### Official documentation, MEDIUM

- [MDN HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)：canplay、playing、waiting、error 等媒体状态事件。
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)：浏览器跨源请求与服务端响应头的边界；CORS 不是通用防盗链证明。
- [MDN HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)：媒体 seek/续传所需的 Range/Content-Range 语义。
- [Puppeteer Page.goto](https://pptr.dev/api/puppeteer.page.goto) 与 [waitForSelector](https://pptr.dev/api/puppeteer.page.waitforselector)：导航完成、等待条件和 timeout 是不同阶段。
- [GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)、[workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository)、[cancel](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run) 与 [concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)：dispatch/cancel 的编排语义、run id/attempt 和 provider 并发边界。
- [GitHub default environment variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables)：GITHUB_RUN_ID 与 GITHUB_RUN_ATTEMPT 的区别。
- [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)：batch/事务调用边界和短事务设计依据。
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)：免费额度与请求/数据库限制需要纳入 bounded probe。
- [SQLite UNIQUE constraints](https://www.sqlite.org/lang_createtable.html#unique_constraints)：source identity 唯一性应在数据库层表达。
- [Playwright assertions](https://playwright.dev/docs/test-assertions)、[webServer](https://playwright.dev/docs/test-webserver)、[trace viewer](https://playwright.dev/docs/trace-viewer) 与 [videos](https://playwright.dev/docs/videos)：浏览器断言和调试证据能力；trace/video/screenshot 仍不能替代业务媒体事件。

## Quality Check

- [x] 覆盖 players=0、失效 player URL、来源鉴权、防盗链、重复 repair、任务重试、生产浏览器波动和证据伪成功。
- [x] 每个主要 pitfall 给出 prevention、detection、phase 归属、依赖和可执行验证。
- [x] 明确区分 metadata、source reachable、playback ready 三种证据。
- [x] 当前仓库事实与官方平台语义分开标注置信度。
- [x] 保留 GitHub Actions 生产 Puppeteer 边界、Cloudflare 免费额度优先和 fresh production run 约束。
- [x] 未把历史 Phase 13 carrier 或旧 CONCERNS.md 当作 v1.4 production success。
