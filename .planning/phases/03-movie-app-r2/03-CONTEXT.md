# Phase 3: movie-app 播放稳定化（现有路径错误恢复） - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

> ⚠️ **本 phase 的 scope 相对 ROADMAP/REQUIREMENTS 原稿有重大收窄** ——
> 用户在 discuss 环节明确否决「R2 当视频宿主」方向（存储成本不划算，且计划逐步把
> 漫画图片也迁出 R2，只留轻量文件）。VIDEO-01/02/03/06 整体从 v1 下线。
> **Planner 的第一件事是把 REQUIREMENTS.md / ROADMAP.md / PROJECT.md 三份文档
> 按 D-20..D-23 的描述同步修订，再进入实现 plan。**

**In scope（本 phase 收口）：**

- Player.vue 内统一错误卡片（`errorState` + `errorKind` + `errorMessage` + `retry()`）
- xgplayer `error` / `waiting-timeout` / 加载失败 / seek 黑屏 的事件捕获与映射
- TorrServer 流播失败（现有 `torrServerError` 逻辑合并进统一卡片）
- 重试动作：仅重置 `player.src` 并保留 `currentTime`（不自动跳 player 源）
- aria2 / TorrServer 离线时的按钮 `disabled` + tooltip（MovieDetail + Player 两处）
- 需求文档三连改：REQUIREMENTS.md、ROADMAP.md、PROJECT.md

**Out of scope（本 phase 明确不做）：**

- R2 绑 `cdn.starye.org` 直出 MP4（VIDEO-01） → 归 Out of Scope / 永久下线
- R2 bucket CORS + Range 头配置（VIDEO-02） → 同上
- R2 响应 `Cache-Control: public, max-age=86400`（VIDEO-03） → 同上
- R18 内容 `GET /api/stream/sign` 短期签名链 + 续签（VIDEO-06） → 同上
- ROADMAP 成功标准 #1（DevTools 看到 `cdn.starye.org` 206） → 删除
- ROADMAP 成功标准 #5（CF-Cache-Status: HIT） → 删除
- 播放失败自动跳下一个 `player` 源（用户明确选「只简重试同源」，留到未来）
- VIDEO-04 的 codec swap 降级链（用户选「只重载同源」，codec swap 下线）
- Sentry 上报（Phase 5 处理，本期不占位）
- 进度（seek/timeupdate 写入 `progress` 表） → Phase 4

</domain>

<decisions>
## Implementation Decisions

### 方向性（Phase 3 重定）

- **D-01:** R2 **不**作视频宿主。理由：R2 存储 + 出站即便在 Cloudflare 免费/低价档下
  对整部视频（GB 级）也不划算；作者的日常播放路径一直是 magnet → TorrServer /
  aria2 / 外链，不需要重新上传一份到 R2。VIDEO-01/02/03/06 四条需求整体作废。
- **D-02:** R2 仅保留「轻量文件」宿主定位：封面、头像、演员图等。**漫画详情图片**
  后续也要逐步迁出 R2，改为直接引用爬取源直链。此方向写入 PROJECT.md Key Decisions，
  Phase 3 不做漫画侧迁移，仅声明方向。
- **D-03:** Phase 3 实质交付从「R2 直发 + 错误恢复」收窄为「现有播放路径的错误可见化 +
  统一重试 + 下载器离线按钮禁用」。

### 统一错误卡片（UI 收口）

- **D-04:** Player.vue 内直接改，**不**抽 composable / 不抽共享组件。理由：
  movie-app 是唯一播放消费方，comic-app 是静态图像流不涉播放，blog/auth 更无关；
  提前抽象是无收益的。未来真有第二处播放需求再重构。
- **D-05:** 新增响应式状态：`errorState: { visible, kind, message, recoverable }`。
  `kind` 枚举约束为 `'torrserver' | 'xgplayer' | 'network' | 'source-invalid' | 'unknown'`
  五个值，便于 future Sentry 打标（Phase 5 复用）。
- **D-06:** 现有 `torrServerBuffering` / `torrServerError` 两个 ref **合并进**新错误卡片：
  缓冲状态走 `loading` 语义，失败走 `errorState.visible=true`，不再保留独立 overlay。
- **D-07:** xgplayer 事件订阅清单至少覆盖：`error`、`waiting`（叠加超时 10s 进入 error）、
  `ended`（不算错）、`canplay`（清 error）、`playing`（清 error）。具体 event 结构
  以 xgplayer v3 为准，由 researcher 在 Phase 3 研究阶段 pin 一次（STATE.md 已标此为
  P3 kick-off todo）。
- **D-08:** 错误卡片内容：标题 + 一句人话 + 「重试」主按钮 + 「返回详情页」次按钮。
  **不**提供「切换源」按钮（D-11 决定），**不**提供「发送反馈」按钮（feedback 系统
  还是 stub，CONCERNS.md 记录在案）。

### 重试动作语义

- **D-09:** 重试 = 重置 `player.src` 为同一 URL，保留当前 `currentTime`。用 xgplayer
  的 `src` setter 或销毁后 `new Player({ startTime: lastTime })` 重建 —— 两条路径由
  researcher 比较哪条在 Safari/Android 上回弹更稳，planner 选一落地。
- **D-10:** 重试失败（3 秒内再次触发 `error`）→ 错误卡片显示「多次失败，请返回详情页
  切换源」。**不**做自动 N 次重试，不做指数退避 —— 单用户自用场景，人在看，用户点才重试。
- **D-11:** 不自动切换到下一个 `player.sourceUrl`。用户选「只简重试同源」。MovieDetail
  上已经有 player 列表 UI，切换由用户显式操作，不在 Player.vue 内做自动跳。

### aria2 / TorrServer 离线反馈

- **D-12:** MovieDetail.vue 与 Player.vue 上的 aria2 相关按钮（「添加到 Aria2」「失败
  降级到 Aria2」）：当 `useAria2.isConnected === false` 时 `disabled` + tooltip
  `「aria2 未连接，请先在设置中配置」`。**不**弹 toast，**不**加全局 banner。
- **D-13:** TorrServer 按钮同理 —— 依赖 `useTorrServer` 的连接状态 ref（若不存在则
  planner 在 `useTorrServer` 里新增 `isConnected` 读属性）。
- **D-14:** tooltip 文案需要国际化位 —— 查 `packages/locales` 现有键，沿用 `vue-i18n`
  注入。researcher 需确认 locales 里已有或需新增 key。

### R18 视频处理（VIDEO-06 作废后）

- **D-15:** R18 过滤完全依赖 Phase 2 的 `buildAdultVisibilityCondition`（WHERE 层已
  过滤），播放层不再签名、不再加任何鉴权。`isR18Verified=false` 的用户根本看不到 R18
  电影卡片，Player 路由也进不去（直接 fetch movie detail 会返回 404/403 —— 由
  Phase 2 adult-filter 的 detail handler 覆盖，若未覆盖由 planner 补一行条件）。
- **D-16:** 若 `isR18Verified=true` 的用户拿到一部 R18 movie 的 magnet/外链，播放
  走与非 R18 相同的 TorrServer/aria2/外链路径，**不加额外鉴权**。Core Value 是自用
  工具，单用户场景无泄漏面。

### 其他决定

- **D-17:** 不引入 Sentry、不提前注入上报钩子。Phase 5 上 Sentry 时在 Player.vue 的
  `errorState` 变化处加一个 `Sentry.captureMessage` 调用即可，`errorKind` 已经预留
  打标字段（D-05），无缝接入。
- **D-18:** `<video>` 的 CORS / Range 行为作为"非问题"处理：既然视频不经 R2，
  Range/Accept-Ranges 由 TorrServer / 外链源站各自决定，不在本 phase 控制面。
- **D-19:** xgplayer 升级 / 换播放器（hls.js / video.js）不在本期 —— 保留现有
  `xgplayer ^3.0.24`，仅围绕其 error 事件做稳健性工作。

### 需求文档修订（Planner 第一步）

> Planner 的 Wave 0 先执行 D-20..D-23 的文档修订，再开始实现 plan。文档修订各自
> 一个 commit（`docs(p03): ...`），与实现 plan 分离，便于回看。

- **D-20:** `REQUIREMENTS.md`：
  - § Video Playback 段：
    - `VIDEO-01`、`VIDEO-02`、`VIDEO-03`、`VIDEO-06` 从 v1 Active 移除
    - `VIDEO-04` 文案改为「`<video>` 捕获 `error` 事件，显示可见错误卡片 + 重试按钮」
      （去掉「自动降级 reload src → swap codec → 显式失败」的多级降级措辞，只留
      「重置 src 保留 currentTime」）
    - `VIDEO-05` 保持不变
  - § Out of Scope 表新增一行：「R2 作为视频宿主 —— 存储 + 出站成本相对价值不划算；
    视频保持现有 magnet/TorrServer/aria2/外链路径」
  - § Traceability 表同步：VIDEO-01/02/03/06 改为 `Out of Scope`；Phase 3 只剩
    VIDEO-04/05 两条；Coverage 计数由 45 → 41，并在文档头注记说明
- **D-21:** `ROADMAP.md`：
  - Phase 3 Goal 改为「播放稳定化：现有 magnet/TorrServer/外链路径下，`<video>`
    异常时用户看到可见错误卡片 + 重试按钮；aria2/TorrServer 离线时相关按钮 disabled
    并带提示」
  - Requirements 行：`VIDEO-04, VIDEO-05`
  - Success Criteria 重写：
    1. 播放异常（xgplayer error / TorrServer 失败 / seek 失败 / 加载超时）时用户看到
       统一错误卡片 + 「重试」按钮，不出现无反馈的黑屏
    2. 重试按钮重置 `player.src` 并从上次 `currentTime` 继续；3 秒内再次失败显示
       「多次失败，请返回详情页切换源」
    3. aria2 未连接时 MovieDetail / Player 上的 aria2 按钮 `disabled` + tooltip
    4. TorrServer 未连接时对应按钮同样处理
    5. R18 可见性由 Phase 2 的 `buildAdultVisibilityCondition` 完全控制；播放层无
       额外鉴权
  - Coverage Validation 与 Phase Ordering Rationale 相应更新；v1 requirements
    mapped 由 `45/45` 改为 `41/41`
  - Phase Ordering Rationale 的 P3 段落改一句：移除「R2 直发 + R18 签名」描述
- **D-22:** `PROJECT.md`：
  - Key Decisions 表新增一行：`R2 不做视频宿主 / 漫画详情图片逐步迁出 R2` — Rationale:
    `存储 + 出站成本相对价值不划算；单用户内容中台优先用爬取源直链` — Outcome: `New`
  - `### Active` 清单中的「movie-app 播放页稳定性：消除"偶尔出错"」保留
  - Last updated 日期改为 `2026-05-11 after Phase 3 context gathering`
- **D-23:** `STATE.md`（由 `update_state` 步骤自动处理，本决策只声明）：移除
  `P3 kick-off: 确认 xgplayer error 事件结构 + R2 custom domain 与 Cache Rules 交互`
  里的「R2 custom domain 与 Cache Rules 交互」子句，只保留 xgplayer error 事件结构。

### Claude's Discretion

- `errorState` 具体形状（`ref<{...}>` vs 多个独立 `ref`）由 planner 选，只要 kind
  枚举和可恢复标记齐全即可
- 错误文案的中文表述由 planner 起草一版，DISCUSSION-LOG 里有初稿但不锁文字
- xgplayer 重置 src 的两条路径（`player.src = ...` vs `destroy + new Player`）由
  researcher 实验后 planner 定
- tooltip 组件用 radix-vue / `packages/ui` 里是否已有 `<Tooltip>` 由 planner 查后
  接入；若无则直接用原生 `title` 属性，不为此加依赖
- 错误卡片的视觉设计（沿用 `torrServerError` 当前的居中黑底半透明，或新设计）由
  planner 在实现 plan 里给出一个简单方案，不需要回来 discuss
- 10s waiting 超时是否可配（或者改为 15s/20s）由 planner 凭 Safari/Android 实测调整

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图（将被 Phase 3 修订的文档）

- `.planning/REQUIREMENTS.md` § Video Playback — VIDEO-01..06 原文；D-20 要修订
- `.planning/REQUIREMENTS.md` § Out of Scope — D-20 要新增一行
- `.planning/REQUIREMENTS.md` § Traceability — D-20 要更新计数与 Phase 3 行
- `.planning/ROADMAP.md` Phase 3 段（`58..70` 行）— D-21 要改 Goal / Requirements /
  Success Criteria
- `.planning/ROADMAP.md` Coverage Validation + Phase Ordering Rationale — D-21 要同步
- `.planning/PROJECT.md` — D-22 要追加 Key Decisions 行
- `.planning/STATE.md` — D-23 要移除 R2 custom domain 子句
- `.planning/phases/01-auth-gateway/01-CONTEXT.md` — Phase 1 D-07（带 cookie 全
  bypass）对本期无直接影响但应知悉
- `.planning/phases/02-dashboard/02-CONTEXT.md` — Phase 2 D-06..D-10 的
  `buildAdultVisibilityCondition` / `isR18Verified` 语义是 D-15 的地基

### 播放端实现

- `apps/movie-app/src/views/Player.vue` — 本 phase 改动核心落地处
- `apps/movie-app/src/views/MovieDetail.vue` — aria2 / TorrServer 按钮状态改动落地处
  （D-12/D-13）
- `apps/movie-app/src/composables/useAria2.ts` — `isConnected` 读属性现有
- `apps/movie-app/src/composables/useTorrServer.ts` — `isConnected` 读属性若无则新增
- `apps/movie-app/src/composables/useAria2WebSocket.ts` — 连接状态事件源
- `apps/movie-app/src/utils/errorHandler.ts` — 现有错误分类工具，可为 `errorKind` 提供
  参考枚举
- `apps/movie-app/src/utils/magnetLink.ts` — `isMagnetLink` 判定，重试逻辑可能用到

### API 侧（仅影响 R18 访问 detail 的防御）

- `apps/api/src/services/adult-filter.ts` — Phase 2 落地；Phase 3 要确认 `getMovieDetail`
  handler 是否也调用了该过滤（若未调用，Phase 3 补一行；若已调用，不改）
- `apps/api/src/routes/public/movies/index.ts` — detail handler 位置

### 数据库（只读确认，不改）

- `packages/db/src/schema.ts` `players` 表（line 186）— `sourceUrl` 当前存 magnet/外链
  混合；Phase 3 不改 schema

### 代码库背景

- `.planning/codebase/ARCHITECTURE.md` § Media Playback（若有）/ Component Responsibilities
  的 Movie App 行
- `.planning/codebase/CONCERNS.md` § Tech Debt — `R2 Upload Implementation Missing`
  在 Phase 3 作废后该 stub 条目变成 v2 问题（漫画图片迁出 R2 前可保留，漫画后也可下线）
- `.planning/codebase/CONCERNS.md` § Fragile Areas — 本 phase 不触碰 Anti-Detection /
  Queue Manager / Better Auth / Gateway Cache
- `.planning/codebase/INTEGRATIONS.md` § Object Storage — R2 定位从"媒体（images +
  未来视频）"改为"仅轻量文件（images + 未来移走的漫画）"，文档同步由 Phase 5 的
  docs-update 做（非本期）

### xgplayer 官方

- `https://v3.h5player.bytedance.com/plugins/error/` — error plugin 行为
- `https://v3.h5player.bytedance.com/api/` — Player API（`on('error')` / `src` setter /
  `destroy` / `currentTime`）
- `https://github.com/bytedance/xgplayer/blob/main/CHANGELOG.md` — 3.x 变更（researcher
  挑关键项）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `Player.vue` 已有 `torrServerError` / `torrServerBuffering` 两个 ref + fallback 到
  Aria2 的 overlay —— D-06 要合并，**不是**在旁边新开一套
- `useAria2.isConnected` in `apps/movie-app/src/composables/useAria2.ts` —— D-12 的
  判定基础
- `progressApi.saveWatchingProgress` in `Player.vue:200` —— Phase 3 不改这块；Phase 4
  才会把它整体替换为 `progress` 表 upsert
- `apps/movie-app/src/utils/errorHandler.ts` `ErrorType` 联合类型（`aria2-connection |
  aria2-task | rating | websocket | network | other`）—— `errorKind` 枚举可对齐
  类似结构
- `getFriendlyErrorMessage()` in `utils/errorHandler.ts` —— 错误文案集中点，可复用

### Established Patterns

- movie-app 的所有 toast 都走 `useToast()` —— Phase 3 **不**用 toast，错误统一走卡片
- `composables` 用 `use*` 前缀；Phase 3 不新增 composable（D-04）
- MovieDetail.vue 当前 1162 行，属于 CONCERNS 记录的"大组件"。本期 aria2 按钮改动
  仅在现有按钮上加 `disabled` + `title`，不拆组件
- xgplayer v3 API：`new Player({ url, startTime, videoInit, fluid })` 构造一次，
  `player.src = newUrl` 可重置；`player.on('error', cb)` / `player.on('canplay', cb)`

### Integration Points

- Player.vue 内部：xgplayer 事件 → 更新 `errorState` → 触发卡片渲染 → 「重试」按钮
  调用 `retry()` → 重置 src + 保留 currentTime
- MovieDetail.vue：`useAria2` / `useTorrServer` 读连接状态 → 影响按钮 `disabled`
  属性（不需要跨文件组件通信）
- 无 API 侧改动（只有 D-15/D-16 验证 detail handler 的 R18 过滤是否到位 —— 可能零改动）

### Phase 3 不触碰的脆弱区（CONCERNS 提示）

- `apps/api/src/middleware/service-auth.ts` CRAWLER_SECRET 明文头 —— 继续 deferred
- `apps/gateway/src/cache-middleware.ts:436` `invalidateCache` 前缀扫描 —— 不碰
- `apps/movie-app/src/composables/useAria2.ts:60` localStorage 凭据 —— Phase 3 只读
  `isConnected`，不改存储方式
- `apps/api/src/services/query-builder.ts:33` `sql.raw()` 注入风险 —— 本期无 SQL
  改动，不触发
- 大组件（Player.vue 395 行、MovieDetail.vue 1162 行）—— Player.vue 本期改动集中
  在错误状态 + 重试，行数可能再涨 ~100 行，仍在可维护阈内；MovieDetail 仅改按钮属性

</code_context>

<specifics>
## Specific Ideas

- **"R2 储存成本太高了"** —— 用户直陈。不是技术取舍，是钱包取舍。漫画图片迁出 R2
  已被用户点名作为方向（D-02）
- **"统一错误卡片"** —— 用户明确选：所有错因（xgplayer / TorrServer / 网络 / 源失效）
  合并到 Player.vue 内一张卡片，不分源做不同 UI
- **"只简重试同源"** —— 用户明确否决"自动跳下一个 player 源"和"codec swap 降级链"。
  重试语义最窄：同一 URL 重试一次，失败就人来处理
- **"按钮 disabled + 提示"** —— 用户否决 toast-after-click / 全局 banner，选最轻量
  的按钮级禁用 + tooltip
- **"全删签名机制"** —— 用户明确：VIDEO-06 整条从 v1 抹掉，不留占位。R18 依靠 Phase 2
  的 WHERE 过滤即可
- **"直接改 v1"** —— 用户选择立刻改 REQUIREMENTS.md / ROADMAP.md / PROJECT.md，不走
  `/gsd-spec-phase` 重来一遍。Planner 的 Wave 0 就是做三文档修订

</specifics>

<deferred>
## Deferred Ideas

- **R2 作为视频宿主** —— 永久下线。若未来 R2 定价大幅下降或个人场景下有新算账方式
  再回来评估。不回 v2，直接入 Out of Scope。
- **漫画详情图片迁出 R2** —— 方向在 PROJECT.md Key Decisions（D-22）声明，但实际
  迁移工作归后续一个独立 phase（估计在 v1 尾声或 v2 初）。
- **R18 内容的独立鉴权（链接签名 / PIN）** —— 单用户场景无泄漏面。若未来切「朋友
  共用」场景再评估（v2 `GATE-01` 已在 REQUIREMENTS 的 v2 段，无需新增）。
- **<video> 的 codec swap 降级链** —— VIDEO-04 原文中的多级降级被用户明确否决，
  `reload src` 作为唯一降级路径。未来如果确实遇到 Safari/Android 特定 codec 问题
  再按实际 case 回来加。
- **自动重试（N 次 / 指数退避）** —— 用户明确「人点才重试」，省得不可预期的后台
  流量。
- **自动切 player 源** —— 用户选「简重试同源」。切源由用户在 MovieDetail 上手动。
- **全局播放质量 banner / 反馈入口** —— feedback 系统 stub 未完（CONCERNS 记录），
  Phase 3 不接。
- **Sentry 上报点** —— Phase 5 做完整 Sentry 接入；Phase 3 通过 `errorKind` 枚举
  预留打标字段（D-05 / D-17），Phase 5 直接挂钩即可。
- **错误卡片的 i18n 文案** —— D-14 要求 tooltip 过 i18n；卡片标题/描述的 i18n 处理
  由 planner 决定是否跟上，非硬要求。

### Reviewed Todos (not folded)

None —— `gsd-sdk query todo.match-phase 3` 返回 `todo_count: 0`。

</deferred>

---

*Phase: 03-movie-app-r2*
*Context gathered: 2026-05-11*
