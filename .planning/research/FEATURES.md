# Feature Landscape

**Project:** Starye v1.4 - 播放可用性与生产自愈闭环
**Domain:** 单用户个人视频库，从 crawler receipt 到可播放内容的运营与观看闭环
**Researched:** 2026-08-05
**Overall confidence:** HIGH（仓库与 v1.3 归档）；MEDIUM（官方媒体/API 语义）

## 研究结论

v1.4 的核心产品事实是：metadata 入库成功和 playback ready 是两个不同的终态。当前 `syncMovieData` 会先计入电影 metadata 成功，`players` 写入又由独立的 try/catch 处理；`movie.crawlStatus`、`totalPlayers` 和 `players.length` 也只能表示记录或候选源存在，无法证明浏览器已加载并实际开始播放。v1.3 生产 receipt 已证明 `SUN-064` 的 metadata CRUD 与 readback/restore，但同一归档明确记录 `players=0` 和 public MovieDetail 失败，因此该 tuple 不是 v1.4 的播放验收。

个人库的 table stakes 应围绕一个可观察链路组织：receipt 说明抓取和入库结果，source health 说明候选源当前状态，MovieDetail 让作者知道“可播放、无源、失效、修复中”处于哪一态，Player 让作者看到加载、缓冲、失败、重试和回退结果，fresh production run 则把 Dashboard、Viewer 和实际播放绑定到同一组 task/run/attempt/receipt 证据。研究建议继续复用现有 D1 crawler control plane、受控 movie template、GitHub Actions production runner、`xgplayer` 和既有 MovieDetail/Player，不引入第二套内容模型或视频托管平台。

官方 MDN 语义支持这一区分：`loadedmetadata` 只表示媒体元数据已加载；`canplay` 表示当前可以开始播放但仍可能继续缓冲；`playing` 表示已经开始或从缺数据状态恢复；`waiting`、`stalled` 和 `error` 分别提供缺数据、取数停滞和资源加载失败信号。`readyState` 可作为辅助观测，但单独的 `HEAD`、`Content-Type`、`Accept-Ranges` 或 `206` 也不能替代浏览器实际播放观察。

## Table Stakes

这些能力缺失时，作者会把“抓到了”误认为“能看”，或在播放失败后失去下一步动作。每项都要求在 Dashboard、MovieDetail、Player 或 fresh evidence 中有可观察结果。

| Feature | Why Expected | Complexity | Dependencies | 验收观察点 | Confidence |
|---------|--------------|------------|--------------|------------|------------|
| **Metadata / playback readiness 双状态** | `receipt` 成功只代表受控 crawler 写入了可验证内容；它不能代表存在可用播放源，更不能代表浏览器已播放。 | High | `crawler_run` validated receipt、movie/player 查询、明确的 playback 状态投影、现有 Dashboard/Viewer 路由 | 对同一内容分别显示 metadata 已入库与 playback `ready`、`no_source`、`source_failed` 或 `repairing`；`players=0` 的 `SUN-064` 只能进入无源/待修复状态，不能显示为可播放成功。 | HIGH |
| **Source health 与 source 分类** | `players` 当前只有 `sourceName`、`sourceUrl`、`quality`、`isActive` 和上报计数；磁力、直链、失效直链和未观测源的用户动作不同。 | High | `player.sourceUrl`、`isActive`、source 类型判定、有限的最近观察时间/原因、API 脱敏投影 | MovieDetail 能看到每个源是 direct、magnet、inactive、unverified 或 failed 等受控状态，并能知道最后一次观察/失败原因；健康信息来自有限观察或实际播放器事件，而非静态评分。 | HIGH（仓库）；MEDIUM（浏览器语义） |
| **新内容的可播放或明确无源终态** | crawler 现有策略从页面提取 `players`，但空数组会让 metadata 继续入库；用户需要知道这是可修复缺口，而非抓取成功的完整内容。 | High | 受控 movie template、crawler source extraction、`syncMovieData` 写入契约、receipt summary、playback 状态 | fresh run 逐项产生“有至少一个受控候选源并进入健康检查”或“明确 no-source / repairable”结果；日志和 receipt 显示 source 计数、跳过/失败原因，空源不会被包装成 playback ready。 | HIGH |
| **受控无源修复入口** | 作者需要从已入库内容回到固定 crawler 修复路径；手动 SQL、任意 URL 或任意命令会破坏 v1.3 的 target-profile、模板和审计边界。 | High | Dashboard 既有 task operations、固定 movie template、目标/凭据投影、`primaryContentId`、修复 attempt | 在 Dashboard 选择一个已知电影（优先用 `SUN-064`），确认后创建受控修复 run；页面能看到 queued/running/succeeded/failed 和修复 receipt，成功后再次读取 MovieDetail 可看到源状态变化。 | HIGH |
| **修复重试的幂等与历史保留** | 来源站、Actions 和回调都可能重复；重复执行若覆盖旧源或旧 receipt，会使作者无法判断哪次修复有效。 | High | `(taskId, attempt)` 唯一关系、idempotency key、runner event replay、source URL 去重、D1 CAS 状态机 | 相同 request/event 重放只返回已保存结果；修复失败后 retry 创建新 attempt，旧日志和 receipt 保留；同一 `sourceUrl` 在同一电影内只保留一份，晚到成功事件不能把旧失败 run 改写为当前成功。 | HIGH |
| **MovieDetail 的无源/失效/修复中反馈** | 当前模板只在 `sortedPlayers.length === 0` 时显示“暂无播放源”，没有说明来源状态、修复动作或刷新后预期。 | Medium | playback status projection、source health、受控 repair route、既有 `MovieDetail.vue`、权限/登录边界 | `MovieDetail` 对 `no_source`、`source_failed`、`repairing` 和 `ready` 给出不同可读状态；无源时展示回到受控修复/刷新任务的入口，失效时能进入其他源或 Player；加载和详情错误仍与无源状态分开。 | HIGH（仓库缺口）；MEDIUM（功能建议） |
| **Player 的可见错误、有限重试和源回退** | 当前 Player 已有 `waiting` 超时、`error` 卡片、同源重试和 Aria2 fallback，但标准播放仍默认取 `movie.players[0]`，且 source health 未回流到详情页。 | Medium | `xgplayer` 当前实例生命周期、`canplay`/`playing`/`waiting`/`stalled`/`error` 事件、source 列表、TorrServer/Aria2 既有入口 | 真实浏览器中分别观察：无源不创建播放器；直链失败显示错误而非无限 loading；重试当前源有次数/状态边界；失败后能返回 MovieDetail 选择其他源或进入现有 TorrServer/Aria2 路径；`canplay`/`playing` 后清除缓冲错误。 | HIGH（现有代码）；MEDIUM（MDN/xgplayer） |
| **可审计的 fresh production playback proof** | v1.3 已证明 production provider → receipt → CRUD；v1.4 的核心风险位于 receipt 之后，历史 Phase 13 carrier 已冻结，不能代替当前播放事实。 | High | 新 task/run/attempt、GitHub Actions provider tuple、签名 terminal receipt、Dashboard、Gateway Viewer、浏览器观测和实际播放事件 | 只用独立 fresh run，按同一 tuple 观察 Dashboard 状态、MovieDetail source 状态、Player `canplay`/`playing` 或等价实际播放结果；JSON/Markdown evidence 同时记录 provider 终态、validated receipt、content ID、source 观察、播放结果和时间戳，历史 carrier 单独标为 frozen。 | HIGH（项目约束与 v1.3 归档）；MEDIUM（Actions 官方语义） |

## Differentiators

这些能力让 Starye 从“存放视频元数据的后台”变成个人可恢复的视频库，但仍服务于 v1.4 的单一闭环。

| Feature | Value Proposition | Complexity | Dependencies | 验收观察点 | Confidence |
|---------|-------------------|------------|--------------|------------|------------|
| **Receipt-backed self-healing loop** | 作者从一个 `no_source` 或 `source_failed` 内容进入受控修复，修复完成后直接回到同一内容和同一证据链，减少“重新抓一遍再猜结果”的操作。 | High | playback status、repair task、new attempt、validated receipt、existing editor handoff | Dashboard 详情能从失败原因进入一次受控 repair；修复结果回写同一内容的 source health；Viewer 刷新后状态与 repair receipt 一致，失败时保留下一步动作和原始证据。 | HIGH（v1.4 范围） |
| **Source-aware fallback order** | 先区分 direct video、magnet 和无效地址，再选择可播放直链、TorrServer、Aria2 或其他现有入口；评分和 `sortOrder` 只参与排序，不能冒充健康状态。 | Medium | source classification、Player route、MovieDetail source selection、现有 TorrServer/Aria2 integrations | 首选源失败时，用户能看到可用替代源或明确的 magnet fallback；磁力链接不会被标记为浏览器 direct ready；回退动作不会创建新的内容平台或复制一份电影记录。 | MEDIUM |
| **浏览器观测驱动的 source evidence** | 将“HTTP 看起来正常”和“浏览器真的开始播放”分成两层，让 repair 优先处理真实失败源，也避免完整下载媒体造成费用和来源站压力。 | High | bounded HEAD/Range observation（可选）、Player media events、source observation schema、Sentry/structured log 的安全字段 | evidence 记录 `loadedmetadata`、`canplay`、`playing`、`waiting`/`stalled`/`error` 的受控摘要及时间；HEAD/Range 被拒时记录为观察限制，而不是伪造失败或成功；不保存完整媒体内容。 | MEDIUM（官方 MDN） |
| **单条 tuple 的运营可追溯性** | 单用户也需要知道“哪次任务修复了哪条内容、使用哪个 provider、最后在哪个 Viewer 观察到播放”，否则后续失效时无法定位。 | Medium | v1.3 provider association、callback event、validated receipt、fresh evidence pair、Gateway canonical URL | 从 Dashboard task detail 能回到 content/source 状态和 evidence；provider success、repair success、actual playback 三者分别可读，并可通过 task/run/attempt/content ID 关联；日志只投影脱敏字段。 | HIGH（v1.3 contract） |

## Anti-Features

以下方向会让用户看到错误的成功状态、扩大成本或绕过 v1.3 控制面，明确排除在 v1.4。

| Anti-Feature | Why Avoid | What to Do Instead | User-visible consequence |
|--------------|-----------|-------------------|--------------------------|
| **把 metadata receipt、Actions success 或 `players.length > 0` 当作 playback ready** | 三者最多说明写入、provider 运行或候选源存在；MDN 的媒体事件说明实际播放还要经过加载、缓冲和错误阶段。 | 使用独立 playback status；以浏览器实际 `canplay`/`playing` 或明确的 no-source/failed 结果收口。 | 用户看到“已入库”和“可播放”两个明确状态，不会点击到空播放器。 |
| **把 magnet URL 伪装成浏览器直链** | 当前 Player 已把 magnet 识别为 `source-invalid`，它需要 TorrServer 或 Aria2 等已有路径；伪装会制造反复播放失败。 | 在 MovieDetail 标注 magnet 类型，提供现有 TorrServer/Aria2 入口；direct source 单独验证。 | 用户知道应选择在线播放、下载或切换源，而非面对假成功。 |
| **无限自动 retry、每次观看都触发 crawler 或全量重抓** | 会放大来源站压力、GitHub Actions 消耗和重复入库风险，也破坏单次 evidence 的解释力。 | 有界手动 retry/new attempt；repair 需受控模板、确认和幂等键，失败后进入可读的 repairable 状态。 | 用户看到重试次数/attempt 和失败原因，系统不会静默循环。 |
| **Dashboard 任意命令、source URL、密钥、workflow 或定时策略编辑** | 直接绕过 v1.3 的固定 template、target-profile、凭据和审计边界；也会把播放修复扩张为通用运维平台。 | 只暴露固定 movie repair template 与非秘密、类型化输入；provider/URL/secret 继续由服务端快照管理。 | 用户只能发起可审计的修复任务，任务详情可解释。 |
| **Cloudflare Worker 代理或 R2/Stream 托管全部视频** | 超出 Cloudflare 免费额度优先约束，并把来源、Range、缓存和出站问题变成新的基础设施项目。 | 保持现有 source URL、TorrServer、Aria2 与受控外部播放路径；仅做小范围健康观察。 | 用户得到明确的源状态和回退动作，而不是等待新的视频平台建设。 |
| **为 repair receipt 新建第二套 Movies 编辑器或内容平台** | 会复制权限、校验、回退和 readback 逻辑，产生两套内容真相。 | 复用现有 `primaryContentId` receipt handoff 与 Movies CRUD；repair 只补 source health/receipt 视图。 | 用户从任务进入既有内容详情，修复前后记录保持同一内容身份。 |
| **复用历史 Phase 13 carrier 作为 v1.4 production proof** | 历史 carrier 的 Viewer terminal proof 已冻结，旧 evidence 不能证明当前 crawler、source 和播放器状态。 | 每次 v1.4 验收创建独立 fresh production run，并保留历史边界说明。 | 验收页面明确标记 fresh run、时间和 tuple，避免把旧成功误认成当前播放成功。 |
| **页面加载时对每个 source 做完整媒体下载或无边界探测** | 产生来源站负载、浏览器等待和不可控网络成本；HTTP 头也不能取代实际播放事件。 | 只做受限 HEAD/Range（条件允许时）和真实选择源的浏览器观测，保存摘要。 | 页面先快速给出可读状态，诊断失败也有明确的“观察受限”含义。 |

## Feature Dependencies

```text
v1.3 task/run/attempt + validated receipt + fixed movie template
    -> source extraction / URL classification / deduplication
        -> metadata_ingested != playback_ready contract
            -> source health observation and bounded failure vocabulary
                -> MovieDetail no-source / failed / repairing feedback
                    -> Player canplay / playing / waiting / stalled / error feedback
                        -> bounded retry and source fallback
                            -> controlled repair attempt
                                -> repair receipt + idempotent replay + preserved history
                                    -> fresh production tuple
                                        -> Dashboard -> Viewer -> actual playback evidence
```

依赖判断：

- 先锁定状态契约，再做 UI。否则 MovieDetail 的“暂无播放源”与 Player 的“当前源失败”会继续混成同一个错误面。
- `source health` 依赖于可观测的 source 类型和 bounded observation；它不应由用户评分、静态 `isActive` 或一次 `HEAD` 单独决定。
- repair 依赖 v1.3 的 task/run/attempt 和 receipt validation，不能绕过既有控制面直接从浏览器调用 crawler。
- fresh production proof 依赖全部前置能力，并且必须产生新 tuple；旧 Phase 13 carrier 与新 v1.4 evidence 采用不同状态标签。

## MVP Recommendation

优先级：

1. **锁定 playback readiness contract**：定义 metadata 入库、source candidate、`ready`、`no_source`、`source_failed`、`repairing` 等可投影状态，明确 `players=0` 和 source 写入异常的终态。
2. **修复 crawler/API receipt 链路**：受控 movie repair 能为新内容产生可验证 source 或明确 repairable no-source；修复 `SUN-064`，对重复 source、重复 event 和 retry attempt 做幂等验证。
3. **完成 MovieDetail / Player 状态闭环**：无源、失效、缓冲超时、播放器 error、同源 retry、其他源选择、TorrServer/Aria2 fallback 都有可读反馈；磁力维持非 direct 播放语义。
4. **执行 fresh production acceptance**：使用独立 production run，从 Dashboard 观察 task/run/attempt 和 repair receipt，进入 MovieDetail/Player，记录实际 `canplay`/`playing` 或等价播放结果，并产出脱敏 JSON/Markdown evidence。

建议 v1.4 MVP 只覆盖一个受控 movie repair vertical slice 和一个 fresh production proof。漫画、actor/publisher template、任意 source 管理、通用任务编排、实时日志和新的媒体托管均延后。

## Sources and Confidence

### 当前仓库与规划事实

| Source | Finding Used | Confidence |
|--------|--------------|------------|
| [`.planning/PROJECT.md`](../PROJECT.md) | v1.4 目标、`SUN-064 players=0`、fresh production run、生产 Puppeteer 继续使用 GitHub Actions、历史 Phase 13 carrier 冻结、受控模板和免费额度约束。 | HIGH |
| [`.planning/STATE.md`](../STATE.md) | 当前 milestone 处于 requirements 前；v1.3 provider tuple 已完成；历史 Phase 13 Viewer proof 仍为 deferred/frozen。 | HIGH |
| [v1.3 requirements](../milestones/v1.3-REQUIREMENTS.md) 与 [v1.3 roadmap](../milestones/v1.3-ROADMAP.md) | task/run/attempt、validated receipt、Dashboard CRUD handoff、生产 provider reconciliation 和无限 retry 排除项。 | HIGH |
| [`production/provider.md`](../milestones/v1.3-phases/19-dashboard-operations-and-end-to-end-proof/production/provider.md) 与 [`provider.json`](../milestones/v1.3-phases/19-dashboard-operations-and-end-to-end-proof/production/provider.json) | 真实 production provider tuple、signed callbacks、validated receipt、CRUD mutation/readback/restore 已通过；同一内容的 `players=0` 导致 public playback observation 仍是 v1.4 工作。 | HIGH |
| [`apps/api/src/routes/movies/services/sync.service.ts`](../../apps/api/src/routes/movies/services/sync.service.ts) | metadata 写入成功与 players 写入分离；players 仅在传入且去重后写入，player 错误不会回滚 metadata success。 | HIGH |
| [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts) | movie 只有 `crawlStatus`、`totalPlayers`、`crawledPlayers` 等爬取字段；player 只有 URL、active、排序、评分和上报字段，没有 playback-ready/source-observation 契约。 | HIGH |
| [`packages/crawler/src/core/optimized-crawler.ts`](../../packages/crawler/src/core/optimized-crawler.ts) 与 [`packages/crawler/src/strategies/javdb.ts`](../../packages/crawler/src/strategies/javdb.ts) | crawler 先处理 metadata/封面再调用 API；JavDB strategy 从页面 magnets 提取候选 players，空结果可继续返回电影对象。 | HIGH |
| [`apps/movie-app/src/views/MovieDetail.vue`](../../apps/movie-app/src/views/MovieDetail.vue) 与 [`apps/movie-app/src/views/Player.vue`](../../apps/movie-app/src/views/Player.vue) | MovieDetail 现有 generic no-source panel；Player 现有 xgplayer 初始化、buffer timeout、error card、same-source retry 和 Aria2 fallback。 | HIGH |
| [`apps/api/src/domain/crawler-tasks/receipt-validation.ts`](../../apps/api/src/domain/crawler-tasks/receipt-validation.ts)、[`apps/api/src/routes/internal/crawler-runs/index.ts`](../../apps/api/src/routes/internal/crawler-runs/index.ts) | receipt 必须绑定 template-owned content；succeeded 事件需要 receipt；runner event 具有签名、sequence、attempt 和 replay/conflict 边界。 | HIGH |

### 官方资料与研究缓存

| Source | Finding Used | Confidence |
|--------|--------------|------------|
| [MDN `HTMLMediaElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)、[`loadedmetadata`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event)、[`canplay`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event)、[`playing`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event)、[`waiting`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event)、[`stalled`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event)、[`error`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error_event)、[`readyState`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState) | 浏览器媒体生命周期和 metadata/playback/buffering/error 区分。 | MEDIUM（官方文档，已与当前 Player 事件处理交叉核对） |
| [MDN HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests) | `HEAD`、`Accept-Ranges`、`Range`、`206`、`Content-Range`、`416` 的 source 诊断边界；Range 观察不能单独宣告播放成功。 | MEDIUM |
| [xgplayer official README](https://github.com/bytedance/xgplayer/blob/master/README.md) 与 [official docs](https://h5player.bytedance.com/en/) | xgplayer 的 `new Player({ id, url })` 初始化、加载/缓冲职责和项目当前 `xgplayer@3.0.24` 复用判断。 | MEDIUM |
| [GitHub REST workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)、[workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)、[workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) | dispatch、provider lifecycle、cancel/re-run、concurrency 和 logs 属于独立事实；Actions success 需要与 validated receipt、实际播放证据分开。 | MEDIUM |

研究计划说明：`research-plan` 为上述 docs 问题选择了 `context7`，当前 MCP/CLI 不可用时读取官方公开文档作为 fallback；`classify-confidence --provider context7 --verified` 返回 `MEDIUM`。通用 `websearch` 因 `BRAVE_API_KEY` 缺失返回 `LOW`，没有把市场性结论写入本文件。相关摘要已按 research-store keys 缓存。

---
*Feature research for: Starye v1.4 播放可用性与生产自愈闭环*
*Researched: 2026-08-05*
