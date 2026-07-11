# Phase 3: movie-app 播放稳定化（现有路径错误恢复） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 03-movie-app-r2
**Areas discussed:** 内容源与 R2 key 策略, R18 签名机制 + 续签, 错误恢复 UI 覆盖范围, R2 CORS/Cache + 客户端播放器验证

---

## 前置事实摆齐（未走 AskUserQuestion，discuss 阶段直接陈述）

在提出 4 个 gray area 之前，Claude 先读过：

- `apps/movie-app/src/views/Player.vue`（395 行）—— 主流路径是 magnet → TorrServer → xgplayer，或直接把 `player.sourceUrl` 喂 xgplayer
- `apps/api/src/lib/r2.ts` —— 只有 `PutObject` presign（上传），没有 GetObject 签名
- `apps/api/wrangler.toml` —— `R2_PUBLIC_URL = "https://cdn.starye.org"` 仍是注释状态
- `packages/db/src/schema.ts` —— `players.sourceUrl` 是混合存 magnet/外链的 text 字段
- `.planning/codebase/CONCERNS.md` —— "R2 Upload Implementation Missing" 记录 admin 上传路由是 501 stub
- `apps/api/src/routes/*` —— 没有 `/api/stream/sign` 路由

基于这些事实判断：VIDEO-01 "R2 直发" 的前提（R2 里有视频）在当前代码库几乎不成立。决定先向用户核对这个前提，再进细节讨论。

---

## 内容源与 R2 key 策略

| Option | Description | Selected |
|--------|-------------|----------|
| 主力已上 R2 | R2 bucket 里已有大量 MP4，只是 Player.vue / sync 还没链起来 —— Phase 3 是「把现有文件对接上」 | |
| 零星在 R2 | R2 只存封面/头像/演员图等轻量文件，不存视频。Phase 3 先把一些手动上传或外部导入的视频跑通 R2 直发，其余 magnet 源保持现状 | |
| R2 里没视频 | 视频还未入库。Phase 3 的「直发」须同时解决「从哪来」—— 要在 Phase 3 内扩到 admin 上传落地 | ✓ |
| 还不确定 | 需要先查再答 | |

**User's choice:** R2 里没视频

**Notes:** 用户回答后追问「Phase 3 要不要扩容连上传一起做」。三选一（A 扩 scope / B 地基先做 / C 重定目标）时，用户给了一条自由文本：「R2 储存成本太高了，其实我希望逐步把当前的漫画详情也迁移出来，只用爬取源，R2 只储存一些比较轻量的文件」。

这条回答等于把路径 A/B/C 全部推翻，重定 Phase 3 方向：R2 不做视频宿主，VIDEO-01/02/03/06 整体下线。Claude 向用户复述了影响范围（ROADMAP / REQUIREMENTS / PROJECT 三文档都要改），用户在后续问题中确认「直接改 v1」。

---

## 日常播放「偶尔出错」具体长什么样

| Option | Description | Selected |
|--------|-------------|----------|
| TorrServer 流播不稳 | 缓冲不起 / 播到一半挂住 / `<video>` error 但 UI 没提示 | ✓ |
| 播放器黑屏无提示 | xgplayer 黑屏 / 加载中卡住，无任何反馈 | ✓ |
| 下载器连接错误 | aria2 / TorrServer 离线时 UI 没清楚标示，或点发起但没成功醒目报错 | ✓ |
| 其他具体痛点 | | |

**User's choice:** 前三项全选（multi-select）

**Notes:** 三个都是"现有路径的反馈不充分"，与"R2 直发"无关。这固化了 Phase 3 重定方向 —— 做错误可见化，不是搬数据。

---

## 错误恢复 UI 覆盖范围（原第 3 个 gray area 的落地）

| Option | Description | Selected |
|--------|-------------|----------|
| 统一错误卡片 | 所有播放失败（xgplayer error / TorrServer 失效 / aria2 离线）都套同一个可见错误卡片：错误文案 + 重试 + 补救动作。代码集中在 Player.vue 一处 | ✓ |
| 分源类 UI | TorrServer 的 `torrServerError` 保留现形（已有）；xgplayer error / aria2 离线 另外有自己的 UI 踹踹 | |
| 录入 Sentry + banner | 错误上报到 Sentry + 页面弹 toast/banner；重试按钮内置 | |
| 我有具体参考 | 用户心里有具体的样式（比如某个见过的网站）给我参考 | |

**User's choice:** 统一错误卡片

**Notes:** 决定把现有 `torrServerError` / `torrServerBuffering` 合并进新卡片，不再维护独立 overlay。

---

## R18 签名机制 + 续签

| Option | Description | Selected |
|--------|-------------|----------|
| 全删签名机制 | R18 过滤靠 Phase 2 的 `buildAdultVisibilityCondition` 在服务端列表过滤即可，播放层不再加签名。VIDEO-06 开吊 | ✓ |
| 前端额外拦截 | R18 视频的 magnet/外链本身不鉴权，但对 `isR18Verified=false` 用户在详情页的播放按钮显示浏览受限提示（前端拦截） | |
| 另有想法 | R18 播放链路其他想法 | |

**User's choice:** 全删签名机制

**Notes:** 单用户自用场景无泄漏面；Phase 2 WHERE 过滤已经让 `isR18Verified=false` 的用户根本看不到 R18 卡片。VIDEO-06 从 v1 完整下线。

---

## 点「重试」时具体怎么做

| Option | Description | Selected |
|--------|-------------|----------|
| 只简重试同源 | 重试按钮只刷 `player.src`（保留 currentTime）。换源 / 跳到下载 由用户手动点「返回详情页」再换 —— 最简单，也不容易做错 | ✓ |
| 自动跳下一个源 | 重试 2 次同源失败后自动切下一个 player（movie.players 可能多个）；切都试完再显式失败。需要埋切换顺序逻辑 | |
| 用户选下一步 | 错误卡片上同时列出「重试 / 换源 · 列出 player.list / 跳回详情」三个按钮，用户选 | |
| 另说 | | |

**User's choice:** 只简重试同源

**Notes:** 明确否决了 VIDEO-04 原文"reload src → swap codec → 显式失败"的多级降级链。Phase 3 只做第一层 reload，codec swap 下线。

---

## aria2 / TorrServer 离线时操作反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 按钮 disabled + 提示 | 未配置 / 无法连接时按钮直接 disabled + tooltip「请先在设置中配置」，点不了也就不会「默默失败」。aria2 状态用 useAria2 现有的 isConnected | ✓ |
| 点后 toast 纠正 | 按钮常亮，点后如果未连上弹 toast + 链接到设置页 | |
| 全局 banner 提示 | 顶部 / bottom nav 增一个全局离线 banner | |
| 另说 | | |

**User's choice:** 按钮 disabled + 提示

---

## 统一错误卡片放哪里

| Option | Description | Selected |
|--------|-------------|----------|
| Player.vue 直接改 | 保持单文件，加几个 ref 和函数，黑屏时走统一卡片。改动集中，既有 torrServerError 逻辑合并 | ✓ |
| 抽 composable + 组件 | `useVideoError` + `VideoErrorCard.vue`。聚合更清晰，未来 comic-app / blog 如果有播放也可复用（实际可能永远用不到）| |
| 先密集后抽 | 先在 Player.vue 改落地，未来需要复用时再抽 | |
| 另说 | | |

**User's choice:** Player.vue 直接改

**Notes:** movie-app 是唯一播放消费方；提前抽象无收益。

---

## R2 转向后，VIDEO-01/02/03/06 + 成功标准不再成立 — 需求文档怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| 直接改 v1 | VIDEO-01/02/03/06 从 v1 移除，入 Out of Scope；成功标准 #1 #5 删、#2 改。REQUIREMENTS / ROADMAP / PROJECT 三文档同步修订 | ✓ |
| 需求文档不动 | 只在 CONTEXT 里说明。需求文档保留假设，Phase 3 只做 VIDEO-04/05 | |
| 先补 /gsd-spec-phase | 走 spec phase 重写需求再回来讨论 —— 最正规但重复已有讨论 | |
| 另说 | | |

**User's choice:** 直接改 v1

**Notes:** 直接锁了 D-20..D-22 的文档修订作为 Phase 3 Planner 的 Wave 0。

---

## Claude's Discretion

用户在讨论中明确或间接让 Claude 决定的部分：

- `errorState` 的具体形状（单 ref 对象 vs 多独立 ref）
- 错误文案的中文表述初稿
- xgplayer 重置 src 的两条路径（`player.src = url` vs `destroy + new Player`）—— 交给 researcher 实验后 planner 选
- tooltip 组件（radix-vue / `packages/ui` 是否已有 `<Tooltip>` / 降级到 `title`）
- 错误卡片视觉设计（沿用 `torrServerError` 当前的居中黑底半透明或新设计）
- 10s waiting 超时阈值是否调整（Safari/Android 实测后定）

## R2 CORS/Cache + 客户端播放器验证（原第 4 个 gray area 的落地）

这条 gray area 在用户「R2 里没视频 + 储存成本高」的回答后整体失去意义：

- wrangler r2 bucket cors 不需要配置（R2 不做视频宿主）
- Cache-Control 不需要讨论（同上）
- cdn.starye.org custom domain 不需要绑 R2 video
- xgplayer 在 Safari/Android 的 Range 行为 —— 现有 TorrServer / 外链路径由源站自行决定，不在本 phase 控制面（D-18）

记录在 CONTEXT.md `<deferred>` 的 "R2 作为视频宿主" 与 "<video> 的 codec swap 降级链" 条目下。

## Deferred Ideas

- R2 作为视频宿主 —— 永久下线（不进 v2，直接 Out of Scope）
- 漫画详情图片迁出 R2 —— 方向声明在 PROJECT.md，迁移工作归后续独立 phase
- R18 独立鉴权（PIN / 签名）—— v2 GATE-01 范围，本期不考虑
- codec swap 降级链 —— 用户明确否决
- 自动重试 / 指数退避 —— 用户选"人点才重试"
- 自动切 player 源 —— 用户选"简重试同源"
- 反馈入口按钮 —— feedback 系统还是 stub（CONCERNS 记录）
- Sentry 上报点 —— Phase 5 做；`errorKind` 已预留打标字段
- 错误卡片 i18n —— tooltip 过 i18n 是硬要求（D-14），卡片文字 i18n 由 planner 酌情
