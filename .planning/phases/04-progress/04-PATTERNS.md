# Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度 - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 17
**Analogs found:** 10 / 10（其余为本 phase 新增的统一模型或同文件就地重构）

## File Classification

| 新建/修改文件 | Role | Data Flow | 最近 Analog | 匹配质量 |
|---|---|---|---|---|
| `packages/db/src/schema.ts`（修改） | schema | D1/Drizzle model | 现有 `reading_progress` / `watching_progress` 定义与 relations | strong |
| `packages/db/drizzle/*.sql`（新增） | migration | schema evolution | `packages/db/drizzle/0025_normal_marten_broadcloak.sql` 单表增量迁移 | partial |
| `apps/api/src/schemas/progress.ts`（修改） | schema | request/response contracts | 当前 progress schema 双轨定义 | strong |
| `apps/api/src/routes/public/progress/index.ts`（重构） | route | auth + read/write + history join | 当前 `publicProgressRoutes` 结构 | exact |
| `apps/api/src/routes/public/progress/__tests__/progress.test.ts`（修改） | route test | auth + list / single query | 当前 progress route tests | exact |
| `apps/movie-app/src/lib/api-client.ts`（修改） | client | raw fetch progress API | 当前 `progressApi` wrapper | exact |
| `apps/comic-app/src/lib/api-client.ts`（修改） | client | raw fetch progress API | 当前 `progressApi` wrapper | exact |
| `apps/movie-app/src/views/Player.vue`（修改） | view | seek / periodic save / flush / complete | 自身现有 progress load/save + Phase 3 状态机 | strong |
| `apps/comic-app/src/views/Reader.vue`（修改） | view | page restore / debounce save / flush / complete | 自身现有 scroll-based reading progress | strong |
| `apps/movie-app/src/router.ts` / `apps/comic-app/src/router.ts`（修改） | router | auth gate redirect | Phase 2 的 `useAuthGuard.ts` | strong |

## Pattern Assignments

### 1. `apps/api/src/routes/public/progress/index.ts`

**Analog:** 当前 `publicProgressRoutes` 本身

**现有模式：**

- 路由文件内部先建 `const publicProgress = new Hono<AppEnv>()`
- 统一 `publicProgress.use('*', ...)` 做登录态检查
- 每个 handler 都在内部拿 `const db = c.get('db')` / `const user = c.get('user')!`
- OpenAPI 描述通过 `describeRoute + resolver + validator` 就地定义

**Pattern recommendation：**

- 保持 `publicProgressRoutes` 挂载点不变，继续沿用一个文件内部承载 progress route 的组织方式。
- 不要把 unified progress 直接拆成多文件 service/controller；仓库当前 public route 还没有为简单业务抽那一层。
- 将新的统一 progress route 仍然建在同一个 `publicProgress` router 下，reading/watching 旧 handler 允许在 phase 内部过渡为统一 helper 调用，但最终对外行为要收口到一套统一模型。

### 2. `apps/api/src/routes/public/progress/__tests__/progress.test.ts`

**Analog:** 当前 progress route test

**现有模式：**

- 通过 `createSelectChain(result)` 构造可 await 的 Drizzle fluent 链 mock。
- 使用 `createApp(db, user)` 包一层 Hono app，把 mock db/user 注入 context。
- 测试粒度聚焦认证守卫、history 列表、单条查询，不跑真实数据库。

**Pattern recommendation：**

- 继续沿用这种“Fluent 链 Mock + Hono route fetch”的模式验证 unified route。
- 新增 case 时优先测：
  - 未登录 401
  - movie 单条读取 completed / duration / position
  - history 列表 `limit`、`updatedAt` 排序
  - comic 单条读取 completed=true 时的原始返回
  - save route 的 upsert 行为与非法 contentId 校验
- 不要在 Phase 4 引入真实 D1 integration test，当前 route test 模式已经足够覆盖 API contract。

### 3. `apps/movie-app/src/lib/api-client.ts` / `apps/comic-app/src/lib/api-client.ts`

**Analog:** 当前 progressApi wrapper

**现有模式：**

- progress 不是 Hono RPC，而是 `apiFetch('/public/progress/...')` 的原生 fetch 包装。
- app 层把 API 差异隔离在 `progressApi`，view 层不直接拼路径。

**Pattern recommendation：**

- 继续把 unified progress 改动压在 `progressApi` 边界上，不让 `Player.vue` / `Reader.vue` 直接感知路径拼接。
- Phase 4 如果需要保留旧方法名以减少视图改动，可以接受：
  - `saveWatchingProgress()` / `getWatchingProgress()` 内部改成统一 route
  - `saveReadingProgress()` / `getReadingProgress()` 同理
- 同时新增更统一的内部 helper 命名也可以，但不要强迫 view 一次性全部换成全新 API 名字，除非能显著减少分支逻辑。

### 4. `apps/movie-app/src/views/Player.vue`

**Analog:** 自身现有 progress load/save 路径 + Phase 3 的状态机重构

**现有关键片段：**

```ts
if (userStore.user) {
  const progressResponse = await progressApi.getWatchingProgress(code)
  if (progressResponse.success && progressResponse.data && !Array.isArray(progressResponse.data)) {
    startTime = progressResponse.data.progress
  }
}
```

以及：

```ts
player.on('timeupdate', () => {
  if (userStore.user && player && !isTorrServerMode.value) {
    debounceSaveProgress(player.currentTime, player.duration)
  }
})
```

**Pattern recommendation：**

- 保留“视图内直接装配 progress 行为”的方式，不要为了 Phase 4 顺手再抽 composable。
- 参考 Phase 3 处理状态机的方式，在 `Player.vue` 内增加更明确的 helper：
  - `shouldPersistMovieProgress(position, duration)`
  - `shouldMarkMovieCompleted(position, duration)`
  - `flushMovieProgress(reason)`
- `pagehide` flush 推荐使用 `window.addEventListener('pagehide', ...)` + 现有 `onUnmounted()` 清理的组合，符合当前组件管理习惯。
- `streamUrl` 模式不应再单独排除进度写入；统一逻辑可以保留 “是否可信来源” 的既有安全前提，但不再在 progress 层分支排斥它。

### 5. `apps/movie-app/src/views/Home.vue`

**Analog:** 当前 continue watching rail

**现有模式：**

- `fetchContinueWatching()` 拉 history 列表，再在前端按 `progress / duration < 0.9` 过滤未完成记录。

**Pattern recommendation：**

- Phase 4 应该尽量把“是否 completed”从前端计算改为使用后端返回字段。
- `Home.vue` 适合保持“消费 history list 然后 slice 前 5 条”的模式，但过滤条件应改成 `!item.completed`，不再自己猜 90%。
- 不新增新的 rail 或新的页面，只保留当前 UI 壳子。

### 6. `apps/movie-app/src/views/History.vue`

**Analog:** 当前 history page

**现有模式：**

- 本地 `isWatched(item)` 函数决定 tab 分类。
- 进度条、已看完徽标、继续观看按钮都在这个页面内部计算。

**Pattern recommendation：**

- 继续保留 `all / watching / watched` 三个 tab 的 UI 结构。
- 但 `isWatched(item)` 应优先退化为读 `item.completed`，不再使用 `progress >= 3600` 的猜测逻辑。
- 计划里最好要求 `WatchingHistoryItem` 类型扩展出 `completed`，这样 Home / History / Profile 三处消费都能共用真值。

### 7. `apps/movie-app/src/views/Profile.vue`

**Analog:** 当前“个人中心历史 tab”

**现有模式：**

- `fetchWatchingHistory()` 调 `getWatchingProgress()`，如果 data 是数组就直接渲染。
- UI 很轻，只显示 `movieCode` 和 `观看至` 时间。

**Pattern recommendation：**

- 不需要把 Profile 做成第二个 History 页面。
- 但应改成消费与 `History.vue` 同一类 history item，至少能显示 completed 与更可信的时间/标题信息。
- 最轻量的模式是：继续保留简表 UI，只是数据源与类型换成统一 history list。

### 8. `apps/comic-app/src/views/Reader.vue`

**Analog:** 自身现有 scroll + page progress 模式

**现有关键片段：**

```ts
const chapterId = `${route.params.slug}-${route.params.chapterId}`
await progressApi.saveReadingProgress(chapterId, page)
```

**Pattern recommendation：**

- Phase 4 必须把“持久化 key”改成真实 chapter identity 源，而不是继续拼 `${slug}-${chapterId}`。
- 现有“可视区域中心点推断当前页”的算法可以保留，不需要额外改成分页模式。
- 但写入 helper 应收口成更明确的语义，比如：
  - `saveReadingPosition(page, completed)`
  - `flushReadingProgress(reason)`
- 最后一页自动 completed 的判断，适合继续留在 Reader 侧完成，然后把 completed 一起送到 API。

### 9. `apps/comic-app/src/views/Profile.vue`

**Analog:** 当前阅读历史列表

**现有模式：**

- 只展示 `章节 ID` + `阅读至第 N 页`，没有跳转、没有章节标题、没有 completed。

**Pattern recommendation：**

- 保持这是“轻历史列表”，不扩 scope 做独立历史页。
- 但至少应该让 API history item 提供可用的人类可读信息，例如 chapter title / comic slug / completed。
- 如果本 phase 无法低成本补足所有 join 字段，优先保证 completed 与稳定 key，再视情况补标题。

### 10. `apps/movie-app/src/router.ts` / `apps/comic-app/src/router.ts`

**Analog:** `useAuthGuard.ts`

**现有冲突：**

- router 目前是 toast/warning + `next(false)`
- guard composable 已存在且正是 `next` 登录跳转语义

**Pattern recommendation：**

- Router 层直接复用 `window.location.href = /auth/login?next=...` 的 guard 模式。
- 不必在 router 里弹 toast，再让用户自己点登录。
- 这与 Phase 2 已经落地的收藏按钮语义保持一致，也是本 phase context 明确锁定的方向。

## Shared Patterns

### 统一 API 命名空间

**Source:** `apps/api/src/index.ts`

```ts
.route('/api/public/progress', publicProgressRoutes)
```

**Apply to:** Phase 4 统一 progress API 仍应挂在 `/api/public/progress` 命名空间下，避免大面积路径重命名。

### App-local auth guard

**Source:** `apps/movie-app/src/composables/useAuthGuard.ts` / `apps/comic-app/src/composables/useAuthGuard.ts`

```ts
function requireLogin(nextPath?: string): boolean {
  if (userStore.user)
    return true
  const target = nextPath ?? (window.location.pathname + window.location.search)
  window.location.href = `/auth/login?next=${encodeURIComponent(target)}`
  return false
}
```

**Apply to:** Phase 4 的 progress 入口点击、progress 页面路由守卫。

### Minimal migration style

**Source:** `packages/db/drizzle/0025_normal_marten_broadcloak.sql`

```sql
ALTER TABLE `movie` ADD `view_count` integer DEFAULT 0 NOT NULL;
```

**Apply to:** Phase 4 migration 可继续保持“SQL 文件直白表达 schema change”的风格；不要在计划里引入额外自定义迁移框架。

## No Analog Found

以下内容在仓库里没有完全对应的现成 analog，计划中需要显式写出目标状态，而不能只说“参照现有模式”：

1. **带 `completed` 字段的 unified progress history item**
   - 现有 movie/comic history 都没有显式 completed。

2. **pagehide flush 验证**
   - 当前没有现成测试先例覆盖 browser `pagehide` 触发保存。

3. **复合主键的 Drizzle schema 先例**
   - 现有 schema 没有同类例子，执行阶段要么用复合主键，要么用唯一索引作为冲突键，必须在计划里写清 acceptance criteria。

## Suggested Plan Granularity

推荐 4 个 plan，且顺序固定：

1. `04-01` Wave 1：schema + migration + unified API + tests
2. `04-02` Wave 2：movie 端 seek/save/history 收口
3. `04-03` Wave 2：comic 端 page/save/history 收口
4. `04-04` Wave 3：门控、回归、human UAT、迁移验证

`04-02` 和 `04-03` 可以在 Wave 2 并行，因为它们共享统一 API 契约，但写集基本不重叠。

## PATTERNS COMPLETE
