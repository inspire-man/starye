# Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度 - Research

**Researched:** 2026-05-13
**Domain:** D1/Drizzle 统一进度表重构、Hono progress API 收口、movie/comic 端恢复与写入语义统一、登录门控切换
**Confidence:** HIGH（主要结论都来自本仓库现有代码与 Phase 4 CONTEXT；`db.batch([...])` 在本仓库具体落地点仍需执行阶段用真实类型检查最终确认）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01..D-05:** Phase 4 采用硬切换；旧 `reading_progress` / `watching_progress` 不迁移、不兼容、不公告，同 phase 直接删旧表与旧语义。
- **D-06..D-17:** movie 进度以影片为粒度聚合；完成阈值固定 `progress / duration >= 90%`；已完成后重开从头播放；重新开始即清掉 `completed`；小于 30 秒的不恢复也不入库；`duration` 缺失时不再靠 `progress >= 3600` 猜完成；可信 TorrServer / `streamUrl` 路径纳入统一规则。
- **D-18..D-22:** comic 章节读到最后一页记为 `completed=true`，同时保留最后页位置；已完成章节重开默认回第一页；重新开始即清掉 `completed`；已完成仍保留在历史里。
- **D-23..D-27:** 进度入口可见但匿名点击跳 `/auth/login?next=...`；匿名直接进进度页也要前置重定向登录；现有 toast 阻断统一收口到 `useAuthGuard(nextPath?)`，不新造第二套 guard。
- **D-28/D-29:** 本 phase 只改 movie 的 `Home.vue` / `History.vue` / `Profile.vue` / `Player.vue`，comic 的 `Reader.vue` / `Profile.vue` 与相关路由；不扩成 comic 首页继续阅读横幅或独立历史页。

### Claude's Discretion

- 统一表的具体列名可以在不违背 `PROG-01..08` 的前提下定稿，但必须保持“position / duration / completed / updatedAt / contentType / contentId”这组清晰语义。
- API 路由形状可在“满足需求里的统一 upsert 能力”和“尽量兼容现有 `/api/public/progress/*` 消费面”之间折中；如果执行阶段需要两层路由，可保留对旧前端客户端的短期同语义包装，但不能双表双写。
- “重新开始即清掉 completed”的精确触发点可以在 Player / Reader 的首个有效用户动作上实现，只要用户体感是新会话开始就恢复为未完成状态。

### Deferred Ideas

- 不在 Phase 4 新增 comic 首页继续阅读 rail、独立 comic 历史页、播放源偏好记录、跨设备偏好同步或额外发现型 UI。
- 不在 Phase 4 引入新的全站权限系统；只收口 progress 入口与 progress 页面门控。
- 不在 Phase 4 处理部署备份、迁移回滚自动化、Sentry 接入，这些留到 Phase 5。

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Requirement | Planning implication |
|----|-------------|----------------------|
| PROG-01 | D1 新增 `progress` 表 | 需要 schema、relations、migration、旧表删除策略 |
| PROG-02 | `(userId, updatedAt)` 索引 | 需要 history / continue query 明确走统一表 |
| PROG-03 | upsert + `ON CONFLICT DO UPDATE` / 批写 | API 设计要围绕冲突键和 flush 策略展开 |
| PROG-04 | movie 打开即恢复位置 | `Player.vue` 读取逻辑与完成后重开规则需重写 |
| PROG-05 | movie 每 10 秒 + pause/seek/pagehide 写入 | 现有 2s debounce 需替换，补 pagehide flush |
| PROG-06 | comic 打开章节恢复页码 | `Reader.vue` 的 chapterId 与 page scroll 需要重新核对 |
| PROG-07 | comic 500ms debounce + pagehide flush | 现有 1000ms scroll 保存需收敛到更明确事件流 |
| PROG-08 | 最后一页自动 `completed=true` | Reader 读取/写入两侧都要感知 completed 语义 |

</phase_requirements>

## Summary

Phase 4 不是“加一张表”这么简单，而是一次**跨 schema / API / 两个前端客户端 / 两套路由门控 / 两个消费面的统一语义收口**。目前代码库里已经有 reading / watching 两套进度实现，但它们彼此独立、语义也不一致：movie 端历史页把“`duration` 为空且 `progress >= 3600`”当作已看完，comic 端 `Reader.vue` 用的是 `${slug}-${chapterId}` 拼接 ID 保存进度，而 API 侧保存阅读进度时还会先查 `chapters.id` 是否存在。这些现状恰好说明：Phase 4 必须先统一模型，再让消费面回到同一条真相链上。

最重要的 VERIFIED 结论有五个：

1. **当前 API 真实挂载点仍是 `/api/public/progress/*`。** `apps/api/src/index.ts` 把 `publicProgressRoutes` 挂在 `/api/public/progress`，前端两个 app 的 `api-client.ts` 也全部直接请求这一路径。也就是说，需求里写的 `PUT /api/progress/:contentType/:id` 目前还不是仓库既有接口风格；如果 Phase 4 要采用统一 REST 形状，必须同步修改两个 app 的客户端与相关测试 / e2e mock。
2. **movie 与 comic 的“标识键”当前并不对齐。** watching 用 `movieCode` 且数据库外键直接指向 `movies.code`；reading 用 `chapterId`，但 `Reader.vue` 保存时传的是 `${slug}-${chapterId}` 这种拼接值，和 `comicApi.getChapterDetail()` 返回的真实 `chapter.id` 并不一致。这是 Phase 4 必须先修的 bug 类问题，否则统一表只会把错误键统一进去。
3. **movie 端当前完成规则和新的 phase 决策冲突。** `History.vue` 把 “`duration` 为空时 `progress >= 3600`” 当成已看完，而 `Home.vue` 继续观看列表则只按 `duration` 存在且 `< 90%` 过滤。Phase 4 已明确取消所有猜测性完成规则，必须把完成语义收回到显式 `completed`。
4. **进度门控在两个前端里仍是 toast/阻断式。** `apps/movie-app/src/router.ts` 用 `useToast()` + `next(false)`，`apps/comic-app/src/router.ts` 用 `warning()` + `next(false)`。而两个 app 已经都存在完全符合本 phase 目标的 `useAuthGuard(nextPath?)`。这意味着路由与入口门控的最佳方案是直接复用现成 guard，而不是在 router 里继续堆 toast。
5. **现有 schema 没有复合主键先例，只有 `id` 主键 + unique index`。** `reading_progress` / `watching_progress` 现在都是 `id` 主键，再辅以 `(userId, chapterId)` / `(userId, movieCode)` 的唯一索引。需求写的是复合主键 `(userId, contentType, contentId)`，但从仓库现状看，更稳妥的执行路径是：planner 需要明确是否采用真正复合主键，还是保留 `id` + 唯一索引，同时在 API upsert 上以唯一索引作为 conflict target。这个点要在计划里写死，不能留给执行阶段临时拍板。

Primary recommendation:

- **Wave 1 先统一数据模型和 API，再改前端。** 这个 phase 的最危险点不是 UI，而是“前端各自按旧假设继续写库”。如果先改 `Player.vue` / `Reader.vue`，后面再改 schema/api，很容易出现一轮返工。
- **保留 `/api/public/progress` 命名空间，但在内部统一为 contentType 驱动的单表 API。** 这是对仓库现有风格最友好的折中：既不强行重命名所有前端路径，也能满足 `PROG-03` 的统一 upsert 语义。
- **把 progress 类型、客户端、测试和 e2e mock 一起改。** 当前 `movie-app`、`comic-app`、`api schema`、`progress.test.ts`、`torrserver-integration.spec.ts` 都写死了旧字段形状，任何只改业务代码不改类型边界的方案，都会在 Phase 4 留下隐性双轨。

## Current Code Audit

### 1. `packages/db/src/schema.ts`

**VERIFIED：**

- 当前存在 `reading_progress` 与 `watching_progress` 两张旧表。
- reading 结构：`id`, `userId`, `chapterId`, `page`, `updatedAt`，唯一索引 `(userId, chapterId)`。
- watching 结构：`id`, `userId`, `movieCode`, `progress`, `duration`, `updatedAt`，唯一索引 `(userId, movieCode)`。
- relations 已经分别接到了 `user -> readingProgress / watchingProgress`、`chapter -> readingProgress`、`movie -> watchingProgress`。

**Implication：**

- Phase 4 改 unified 表时，不能只加新表定义，必须同步改 relations，否则 Drizzle 查询链会断。
- 旧表删掉后，`userRelations`、`readingProgressRelations`、`watchingProgressRelations` 都要一起收口到新 `progressRelations`。
- 本仓库的 schema 风格偏向 `id` 主键 + unique index；如果要换复合主键，需要在计划里专门加 migration / relation 验证点。

### 2. `apps/api/src/routes/public/progress/index.ts`

**VERIFIED：**

- 所有 progress 接口都要求登录，middleware 已经在入口层做 401 防线。
- reading 与 watching 当前各是一组完全独立的 `POST /reading`, `GET /reading`, `POST /watching`, `GET /watching`。
- reading 保存走“先 select 再 update/insert”的手写 upsert；watching 也是同样模式，还没有 `ON CONFLICT DO UPDATE`。
- reading 的 `comicSlug` 查询不是 SQL join，而是先查章节列表、再拉用户所有 progress、最后在 JS 里过滤。
- watching 历史页查询会 inner join `movies` 返回 `title / coverImage / isR18`。

**Key bug / mismatch：**

- `Reader.vue` 保存时传入的 `chapterId` 不是数据库里的真实 `chapters.id`，但 API 保存 reading 时会验证章节存在；现有行为意味着阅读进度写入很可能并不可靠，或者依赖某种偶然匹配。
- API 目前没有 `completed`、`contentType`、统一 `position`、统一列表模型，也没有针对 `pagehide` / flush 的批写接口。

### 3. `apps/api/src/schemas/progress.ts`

**VERIFIED：**

- reading schema 是 `{ chapterId, page }` / `{ chapterId?, comicSlug? }`。
- watching schema 是 `{ movieCode, currentTime, duration }` / `{ movieCode?, limit? }`。
- response 类型也分成 `ReadingProgressItemSchema`、`WatchingProgressItemSchema`、`WatchingHistoryItemSchema`。

**Implication：**

- unified 方案必须先在 schema 层统一“单条记录”、“历史记录”、“写入 payload”的外形，不然两个前端的 `types.ts` 没法同步到同一语义。
- `WatchingProgressItemSchema` 目前没有 `completed`，而 `History.vue` / `Home.vue` 只好各自猜。这正是显式 `completed` 要解决的问题。

### 4. `apps/movie-app/src/views/Player.vue`

**VERIFIED：**

- 标准模式下，播放进度只在 `timeupdate` 中触发 `debounceSaveProgress()`，且 debounce 固定为 2 秒，不是需求里的“每 10 秒 + pause/seek/pagehide”。
- TorrServer / `streamUrl` 模式下，`timeupdate` 被 `!isTorrServerMode.value` 直接排除，不会写入进度。
- 恢复进度只在标准模式读取 `progressApi.getWatchingProgress(code)`，并直接把 `startTime = progress`。
- `ended` 事件只清 loading/error，不会标记 completed。

**Implication：**

- `streamUrl` 已被 Phase 4 context 明确纳入统一 movie progress，所以 `Player.vue` 的 “TorrServer 不保存进度” 必须被重构。
- progress 写入不能继续只靠 `timeupdate + 2s debounce`，需要拆出“定时 checkpoint + pause/seek/pagehide flush + completed 切换”。
- 完成后重开从头播、重新开始即清 completed 这两个行为都得在 `Player.vue` 与 API 侧一起配合。

### 5. `apps/movie-app/src/views/Home.vue` / `History.vue` / `Profile.vue`

**VERIFIED：**

- `Home.vue` 的 continue rail 只展示登录用户的最近未完成记录，并通过 `progress / duration < 0.9` 过滤；`duration` 为空则视为不可展示。
- `History.vue` 有 `all / watching / watched` 三个 tab，但“已看完”逻辑是本地函数 `isWatched(item)`，其中 `duration` 为空时用 `progress >= 3600` 猜测。
- `Profile.vue` 目前拿的是 `progressApi.getWatchingProgress()`，如果 data 是数组就当历史列表用，但类型定义仍然是 `WatchingProgress[]`，只显示 `movieCode`，没有标题 / 封面 / completed 信息。

**Implication：**

- unified 表落地后，movie 至少有两种消费形态：`history item with joined movie info` 和 `single progress item for Player seek`。这些形态必须在 API/类型层明确区分。
- `Profile.vue` 与 `History.vue` 现在对同一资源拿的是两种不同形状；Phase 4 最好顺手统一，不然以后还会继续分裂。

### 6. `apps/comic-app/src/views/Reader.vue` / `Profile.vue`

**VERIFIED：**

- `Reader.vue` 现在用滚动位置推断当前页，`debounceSaveProgress` 固定 1000ms。
- 保存 reading progress 时传的是 `const chapterId = \`${route.params.slug}-${route.params.chapterId}\``。
- 加载 reading progress 时又用 `response.data.id` 去查，说明读写的 chapter key 根本不是同一个语义源。
- `Profile.vue` 只会显示 `章节 ID` 和 `第 N 页`，没有章节标题 / 漫画标题 / completed 信息，也没有入口跳转。

**Implication：**

- comic 端是本 phase 风险最高的部分，因为现有 progress 键与真实 chapter ID 的脱节可能导致“看起来在写、其实恢复不了”。
- 如果 Phase 4 要满足 “最后一页自动 completed + 重开回第一页”，Reader 读取逻辑必须能识别 completed 状态，而不仅是简单 `scrollToPage(page)`。

### 7. 路由门控与 `useAuthGuard`

**VERIFIED：**

- `apps/movie-app/src/composables/useAuthGuard.ts` 与 `apps/comic-app/src/composables/useAuthGuard.ts` 已完全同构，支持 `nextPath?`。
- `apps/movie-app/src/router.ts` 仍用 `useToast()` + `next(false)`；`apps/comic-app/src/router.ts` 仍用 `warning()` + `next(false)`。
- `History.vue`、`Profile.vue`（movie）和 `Profile.vue`（comic）都还是 meta.requiresAuth 页面。

**Implication：**

- Phase 4 的门控计划应该聚焦两件事：路由守卫改成前置登录跳转，入口点击改成 `useAuthGuard`。不需要再造新的 store 或 middleware。
- 这个部分非常适合单独出一个 plan，因为它横跨两个 app，但改动面很聚焦。

## API Shape Decision

需求写的是 `PUT /api/progress/:contentType/:id`，但当前仓库已广泛依赖 `/api/public/progress/*`：

- `apps/movie-app/src/lib/api-client.ts`
- `apps/comic-app/src/lib/api-client.ts`
- `apps/movie-app/src/lib/__tests__/api-client.test.ts`
- `apps/movie-app/e2e/torrserver-integration.spec.ts`

因此最稳妥的规划决策是：

1. **保留 `/api/public/progress` 作为对外命名空间**，避免把整个前端和 e2e mock 一起重命名；
2. 在这个命名空间下，引入更统一的 contentType 驱动形状，例如：
   - `PUT /api/public/progress/:contentType/:contentId`
   - `GET /api/public/progress/:contentType/:contentId`
   - `GET /api/public/progress/:contentType?limit=...`
3. 若执行阶段确实希望和 REQUIREMENTS 的字面完全一致，再额外加一个内部/别名路由映射，但**不建议**以“重命名路径”为主价值。

这样既满足统一单表与 upsert 目标，也最大限度复用现有 app client 的思维模型。

## Recommended Plan Split

基于当前代码面，最稳妥的 Phase 4 拆分是 4 个 plan：

1. **04-01：数据模型与 API 基线**
   - schema / migration / relations
   - unified progress schema / route / tests
   - 旧表删除与新 query shape

2. **04-02：movie 端统一恢复 / 完成 / 历史消费**
   - `Player.vue`
   - `Home.vue`
   - `History.vue`
   - `Profile.vue`
   - movie app types/client/tests/e2e mock

3. **04-03：comic 端恢复 / 完成 / history 收口**
   - `Reader.vue`
   - `Profile.vue`
   - comic app types/client
   - chapter key 统一与 completed 读取语义

4. **04-04：进度门控、验证与回归**
   - movie/comic router
   - progress 入口点击 guard
   - API / front-end targeted tests
   - human UAT / migration 验证

不建议把 DB 和 API 再拆开，因为 unified progress 是一个紧耦合边界：如果 schema 先改、API 后改，或者反过来，都会让执行阶段在中途进入无法运行的半状态。

## Validation Architecture

### Test Frameworks

| Area | Framework | Existing anchor |
|------|-----------|-----------------|
| API route | Vitest | `apps/api/src/routes/public/progress/__tests__/progress.test.ts` |
| movie app client | Vitest | `apps/movie-app/src/lib/__tests__/api-client.test.ts` |
| movie app E2E | Playwright | `apps/movie-app/e2e/torrserver-integration.spec.ts` |
| movie/comic TS surface | `vue-tsc` / `tsc` | app-local typecheck commands |

### Recommended automated coverage

| Scope | Best fit |
|-------|----------|
| unified route payload / history join / auth guard | API route unit tests |
| progress client URL shape change | `api-client.test.ts` |
| Player / Reader pure progress policy | extracted helper tests if logic gets split |
| route guard redirect semantics | small composable/router tests where possible |
| real pagehide / playback / scroll persistence | human UAT priority |

### Manual-only checks

- 浏览器关闭 / 刷新标签页后的 `pagehide` flush 是否真的落库
- 已完成 movie / chapter 再次打开是否从头开始
- TorrServer `streamUrl` 模式是否按同一套规则恢复与保存
- comic 阅读器在最后一页完成后再次进入是否回到第一页

## Risks & Open Questions

### Medium risk

1. **复合主键 vs `id` + 唯一索引**
   - REQUIREMENTS 字面要求复合主键，但仓库现状全是 `id` 主键。
   - 如果强切复合主键，relations 与现有查询 helper 的改动面会变大。
   - 计划里必须把这个选择写死，并把 acceptance criteria 写成 schema 断言，而不是留给执行时随缘。

2. **comic 章节标识统一**
   - 当前 Reader 的 `${slug}-${chapterId}` 保存方式明显可疑。
   - 这是一个可能比“新增 completed 字段”更影响恢复成功率的真实 bug。

3. **movie Profile / History 的数据模型分裂**
   - 一个拿 history item，一个拿 raw progress array。
   - unified route 如果不顺手统一，会继续留下重复消费逻辑。

### Low risk / resolved

1. **登录门控是否需要新 guard**
   - **RESOLVED:** 不需要，已有 `useAuthGuard(nextPath?)` 足够。

2. **未登录读写是否需要新后端防线**
   - **RESOLVED:** API 入口已有 401 middleware，前端门控是 UX 收口，不是新增安全边界。

3. **`streamUrl` 路径是否另起一套进度表**
   - **RESOLVED:** 不需要，已被 Phase 4 决策明确纳入统一 movie progress。

## Sources

### Primary (HIGH confidence)

- `.planning/phases/04-progress/04-CONTEXT.md`
- `.planning/phases/04-progress/04-DISCUSSION-LOG.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `packages/db/src/schema.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/public/progress/index.ts`
- `apps/api/src/routes/public/progress/__tests__/progress.test.ts`
- `apps/api/src/schemas/progress.ts`
- `apps/movie-app/src/lib/api-client.ts`
- `apps/comic-app/src/lib/api-client.ts`
- `apps/movie-app/src/views/Player.vue`
- `apps/movie-app/src/views/Home.vue`
- `apps/movie-app/src/views/History.vue`
- `apps/movie-app/src/views/Profile.vue`
- `apps/comic-app/src/views/Reader.vue`
- `apps/comic-app/src/views/Profile.vue`
- `apps/movie-app/src/router.ts`
- `apps/comic-app/src/router.ts`
- `apps/movie-app/src/composables/useAuthGuard.ts`
- `apps/comic-app/src/composables/useAuthGuard.ts`
- `apps/movie-app/src/types.ts`
- `apps/comic-app/src/types.ts`

### Secondary (MEDIUM confidence)

- `packages/db/MIGRATION.md`
- `.agents/skills/starye-db-migration/SKILL.md`
- `.agents/skills/starye-hono-rpc/SKILL.md`
- `apps/movie-app/src/lib/__tests__/api-client.test.ts`
- `apps/movie-app/e2e/torrserver-integration.spec.ts`

### Tertiary (LOW confidence / needs execution confirmation)

- `db.batch([...])` 在当前 API runtime / Drizzle D1 适配器上的最佳落点与具体类型签名，执行阶段需用真实 typecheck 验证。

## Metadata

**Confidence breakdown:**

- Existing schema / API / frontend state: HIGH
- Route shape migration recommendation: HIGH
- Movie/comic progress mismatch diagnosis: HIGH
- `db.batch([...])` implementation detail: MEDIUM

**Research date:** 2026-05-13
**Valid until:** 2026-06-13（前提：Phase 4 相关代码未在此期间被其他分支大改）

## RESEARCH COMPLETE
