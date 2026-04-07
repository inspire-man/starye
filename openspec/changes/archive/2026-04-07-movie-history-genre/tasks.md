# Tasks：观看历史 + Genre 浏览

## Task 1：增强观看历史接口（JOIN movies）

**文件**：`apps/api/src/routes/public/progress/index.ts`

修改 `GET /watching`（无 movieCode 参数时）的查询逻辑：
- 将 `db.select().from(watchingProgress)` 改为 `db.select({...}).from(watchingProgress).innerJoin(movies, eq(...))`
- 选取字段：`id, movieCode, progress, duration, updatedAt`（来自 watchingProgress）+ `title, coverImage, isR18`（来自 movies）
- 新增 `limit` query 参数（默认 20，最大 50，使用 `Math.min(limit, 50)` 限制）
- 更新 Valibot schema：`GetWatchingProgressQuerySchema` 增加可选 `limit` 字段

**完成标准**：
- [x] 无 movieCode 时返回含 title/coverImage 的历史列表
- [x] limit 参数生效，上限 50 条
- [x] 传入 movieCode 时行为与原来一致（向后兼容）
- [x] 影片已删除的进度记录不出现在列表中（INNER JOIN 保证）

---

## Task 2：新增 Genre 列表接口

**文件**：`apps/api/src/routes/public/movies/index.ts`

在 `publicMoviesRoutes` 追加新路由：`GET /genres`

- 使用 SQLite `json_each` 聚合 `movies.genres` 字段
- 根据用户 R18 认证状态过滤（`!user?.isR18Verified` 时加 `AND isR18 = 0`）
- 按 count DESC 排序，最多返回 100 条
- 为响应添加 OpenAPI 描述（`describeRoute`）

**完成标准**：
- [x] `/public/genres` 返回 `{ genre, count }[]`
- [x] 按 count 降序
- [x] R18 用户与非 R18 用户返回结果正确区分
- [x] 空 genres 字段的影片不产生 genre 条目

---

## Task 3：更新 api-client.ts

**文件**：`apps/movie-app/src/lib/api-client.ts`

- 新增类型 `WatchingHistoryItem`（含 title、coverImage、isR18 字段）
- 新增 `progressApi.getWatchingHistory(limit?: number)` 方法，调用 `GET /progress/watching?limit=N`
- 新增 `genreApi` 对象，含 `getGenres()` 方法，调用 `GET /public/genres`
- 新增类型 `GenreItem = { genre: string; count: number }`

**完成标准**：
- [x] `getWatchingHistory()` 可调用，返回 `WatchingHistoryItem[]`
- [x] `genreApi.getGenres()` 可调用，返回 `GenreItem[]`
- [x] TypeScript 类型无报错

---

## Task 4：首页 Genre 标签栏

**文件**：`apps/movie-app/src/views/Home.vue`

- `onMounted` 时调用 `genreApi.getGenres()`，结果存入 `genres ref`
- 在筛选栏下方插入 Genre 标签栏 HTML（水平滚动，pill 样式）
- 添加"全部"标签，active 判断为 `activeGenre === ''`
- `setGenre(genre)` 函数：设置 `activeGenre`，调用 `syncUrl()` + `fetchMovies()`
- URL 初始化：从 `route.query.genre` 恢复 `activeGenre`（已有 syncUrl 机制，验证是否已覆盖）
- 添加对应 `<style scoped>` 样式：`.genre-bar`、`.genre-tag`、`.genre-tag.active`

**完成标准**：
- [x] Genre 标签正确渲染，按 count 降序
- [x] 点击标签触发列表过滤
- [x] URL query `?genre=` 正确同步（双向）
- [x] 横向滚动，不影响页面布局

---

## Task 5：首页"继续观看"板块

**文件**：`apps/movie-app/src/views/Home.vue`

- 在 `userStore.isLoggedIn` 为 true 且 `userStore.initialized` 完成后，请求 `progressApi.getWatchingHistory(10)`
- 过滤：`item.progress && item.duration && item.progress / item.duration < 0.9`
- 取前 5 条存入 `continueWatchingList ref`
- 在 Genre 标签栏上方（影片列表最顶部）插入"继续观看"板块 HTML
- RouterLink 跳转 `/movie/:movieCode/play`，展示封面缩略图 + 标题 + 进度条
- 添加对应 scoped 样式：`.continue-watching`、`.continue-card`、`.progress-fill`

**完成标准**：
- [x] 未登录时板块不显示，不报错
- [x] 已看完（≥90%）的影片不出现
- [x] 最多展示 5 条
- [x] 点击跳转 `/movie/:movieCode/play`

---

## Task 6：观看历史页

**文件（新建）**：`apps/movie-app/src/views/History.vue`

- 页面加载时调用 `progressApi.getWatchingHistory(50)`，存入 `historyItems ref`
- 前端分页：每页 10 条，`currentPage ref` 控制当前页
- 每条记录展示：封面、标题、进度百分比进度条、最后观看时间（格式化为"X天前"或日期）、"继续观看"RouterLink
- 空状态：`historyItems.length === 0` 时展示"暂无观看历史"提示
- 注意 R18 内容处理：`isR18 = true` 时封面替换为占位图（复用 MovieCard 组件已有逻辑或添加 class）

**文件（修改）**：`apps/movie-app/src/router.ts`

- 在 `/profile` 和 `/favorites` 路由附近新增：
  ```typescript
  {
    path: '/history',
    component: () => import('./views/History.vue'),
    meta: { requiresAuth: true },
  }
  ```

**完成标准**：
- [x] `/history` 路由正常访问
- [x] 未登录访问 MUST 跳转登录页（复用现有 router guard）
- [x] 历史记录按时间倒序展示，含封面、标题、进度
- [x] 分页正确（每页 10 条）
- [x] 空状态正常显示
- [x] "继续观看"跳转正确

---

## Task 7：类型检查 & 单元测试

**文件**：`apps/api/src/routes/public/movies/__tests__/` 或相关测试文件

- 验证 `GET /public/genres` 接口 mock 测试
- 运行 `npm run type-check` 确认 apps/api 和 apps/movie-app 无 TS 报错

**完成标准**：
- [x] `npm run type-check` 在 api 和 movie-app 均通过
- [x] Genre 接口基本 happy path 测试通过
