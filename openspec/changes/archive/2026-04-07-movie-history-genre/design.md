# Design：观看历史 + Genre 浏览

## 总体架构

```
movie-app                     API
─────────────────────         ─────────────────────────────────
Home.vue                 ──►  GET /public/genres
  ├ Genre 标签栏               GET /public/progress/watching (enhanced)
  └ 继续观看板块
History.vue              ──►  GET /public/progress/watching/history
  └ 历史列表 + 分页
api-client.ts
  ├ genreApi.getGenres()
  └ progressApi.getWatchingHistory()
router.ts
  └ /history 路由
```

---

## A. API 设计

### A1 — 观看历史接口（增强现有）

**选择方案**：扩展现有 `GET /progress/watching` 接口，当 `movieCode` 为空时改为 JOIN 查询返回历史详情。

**理由**：避免新增路由路径，现有 `progressApi.getWatchingProgress(movieCode)` 传入 movieCode 时走单条进度路径，不受影响。

**实现**（D1 Drizzle）：

```typescript
// 无参数时：JOIN movies 返回历史列表
const results = await db
  .select({
    id: watchingProgress.id,
    movieCode: watchingProgress.movieCode,
    progress: watchingProgress.progress,
    duration: watchingProgress.duration,
    updatedAt: watchingProgress.updatedAt,
    title: movies.title,
    coverImage: movies.coverImage,
    isR18: movies.isR18,
  })
  .from(watchingProgress)
  .innerJoin(movies, eq(watchingProgress.movieCode, movies.code))
  .where(eq(watchingProgress.userId, user.id))
  .orderBy(desc(watchingProgress.updatedAt))
  .limit(limit)  // 支持 ?limit=N，默认 20，最大 50
```

**返回格式**：
```typescript
{
  success: true,
  data: Array<{
    id: string
    movieCode: string
    title: string
    coverImage: string | null
    isR18: boolean
    progress: number       // 已看秒数
    duration: number | null  // 总时长秒数
    updatedAt: string      // ISO 8601
  }>
}
```

### A2 — Genre 列表接口（新增）

**路由**：`GET /public/genres`（不需要登录）

**核心 SQL**（SQLite `json_each` 聚合）：

```typescript
// D1 支持 SQLite json_each 扩展
const results = await db.all(
  sql`
    SELECT j.value AS genre, COUNT(*) AS count
    FROM ${movies} m, json_each(m.genres) j
    WHERE m.genres IS NOT NULL
      AND m.genres != '[]'
      AND j.value != ''
      ${!user?.isR18Verified ? sql`AND m.is_r18 = 0` : sql``}
    GROUP BY j.value
    ORDER BY count DESC
    LIMIT 100
  `
)
```

**返回格式**：
```typescript
{
  success: true,
  data: Array<{ genre: string, count: number }>
}
```

**文件位置**：`apps/api/src/routes/public/movies/index.ts`（追加新路由）

---

## B. 前端设计

### B1 — api-client.ts 扩展

新增类型 `WatchingHistoryItem`（含影片详情字段）：

```typescript
export interface WatchingHistoryItem {
  id: string
  movieCode: string
  title: string
  coverImage: string | null
  isR18: boolean
  progress: number
  duration: number | null
  updatedAt: string
}
```

新增 `progressApi.getWatchingHistory(limit?)` 方法（内部调 `GET /progress/watching?limit=N`）。

新增 `genreApi.getGenres()` 方法（调 `GET /public/genres`）。

### B2 — Home.vue：Genre 标签栏

**位置**：筛选控件行（`sortOptions Select`）下方，影片列表上方。

**UI 结构**：
```html
<div class="genre-bar">
  <button class="genre-tag" :class="{ active: activeGenre === '' }" @click="setGenre('')">全部</button>
  <button
    v-for="item in genres"
    :key="item.genre"
    class="genre-tag"
    :class="{ active: activeGenre === item.genre }"
    @click="setGenre(item.genre)"
  >
    {{ item.genre }}
    <span class="count">{{ item.count }}</span>
  </button>
</div>
```

**样式**：横向滚动，隐藏滚动条，标签 pill 形状，active 状态高亮。

**数据加载**：`onMounted` 时调用 `genreApi.getGenres()`，结果缓存在 `genres ref`（页面级缓存，不需要 Pinia）。

**逻辑**：`setGenre(genre)` 设置 `activeGenre`，调用 `syncUrl()` + `fetchMovies()`。

### B3 — Home.vue："继续观看"板块

**条件**：`userStore.isLoggedIn` 为 true 时才请求并展示。

**数据加载**：`onMounted` 时（与 genres 并行）请求 `progressApi.getWatchingHistory(10)`，过滤 `progress / duration < 0.9`（未看完的）取前 5 条。

**UI 结构**：
```html
<section v-if="continueWatchingList.length > 0" class="continue-watching">
  <h2>继续观看</h2>
  <div class="continue-list">
    <RouterLink
      v-for="item in continueWatchingList"
      :to="`/movie/${item.movieCode}/play`"
    >
      <div class="progress-bar" :style="{ width: progressPercent(item) + '%' }"/>
      <img :src="item.coverImage" />
      <span>{{ item.title }}</span>
    </RouterLink>
  </div>
</section>
```

**进度计算**：`progressPercent = (item.progress / (item.duration || 1)) * 100`，上限 95%。

### B4 — History.vue

**路由**：`/history`，`meta: { requiresAuth: true }`（复用现有 router guard）。

**分页**：每页 10 条，前端分页（请求一次 50 条，前端分页展示），避免频繁 API 请求。

**UI**：
- 顶部 header："观看历史"标题
- 每条记录：封面图（竖版，80px 宽）、标题、进度条、`HH:mm:ss / HH:mm:ss` 格式时间、"继续观看"按钮
- 空状态：未登录或无记录时展示提示
- RouterLink 到 `/movie/:code/play`（可直接恢复播放）

---

## 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| genre 独立页 vs 首页过滤 | 首页过滤 | 已有 `activeGenre` 状态，URL 已支持 `?genre=`，成本最低 |
| 历史 API：新路径 vs 扩展现有 | 扩展现有 `GET /progress/watching` | 无参数时返回历史详情，与现有单条查询路径共存；保持接口精简 |
| genres 聚合：DB vs 内存 | DB `json_each` | 避免全表拉 movies 到 Worker 内存聚合；D1 支持 json_each |
| 历史分页：API 分页 vs 前端分页 | 前端分页（每次取 50 条） | 历史记录量小，一次请求减少 RTT；Cloudflare Workers 内存限制不影响 50 条 |
| 继续观看门槛 | progress/duration < 0.9 | 已完成 90% 以上视为看完，不再出现在继续观看列表 |

---

## 风险缓解

- `json_each` 兼容性：在 D1 环境已验证 SQLite JSON1 支持，上线前需在 staging 执行一次验证测试
- `GET /progress/watching` 返回格式变化：无参数时新增 `title`、`coverImage`、`isR18` 字段，属于向后兼容（只增不删）；现有代码调用路径（传 movieCode）不受影响
- 继续观看板块登录状态异步：初始化时 `userStore` 可能尚未完成认证，需等 `userStore.initialized` 后再请求进度列表
