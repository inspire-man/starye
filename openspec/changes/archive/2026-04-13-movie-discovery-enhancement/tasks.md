## 1. API：年份/时长过滤参数扩展

**文件**：`apps/api/src/schemas/movie.ts`、`apps/api/src/routes/public/movies/index.ts`

- [x] 1.1 在 `GetMoviesQuerySchema` 新增 `yearFrom`（可选整数字符串，范围 2000-2099）、`yearTo`（同上）、`durationMin`（可选正整数字符串）、`durationMax`（可选正整数字符串）四个字段，均含 `v.description` 注释
- [x] 1.2 在 `publicMoviesRoutes GET /` 的 `conditions` 构建逻辑中追加年份范围条件：`yearFrom` 转为年初 Unix 秒数（`new Date(yearFrom, 0, 1).getTime() / 1000`），`yearTo` 转为年末 Unix 秒数（`new Date(yearTo + 1, 0, 1).getTime() / 1000 - 1`）；使用 Drizzle `gte` / `lte` 对 `movies.releaseDate` 过滤
- [x] 1.3 追加时长范围条件：`durationMin` 时用 `gte(movies.duration, durationMin)`，`durationMax` 时用 `lte(movies.duration, durationMax)`
- [x] 1.4 运行 `apps/api` type-check 确认无类型错误

**完成标准**：`GET /public/movies?yearFrom=2024&yearTo=2025` 能正确过滤；`GET /public/movies?durationMin=60&durationMax=120` 能正确过滤

---

## 2. API：个性化推荐接口

**文件**：`apps/api/src/routes/public/movies/index.ts`

> 注意：`/recommended` 路由 MUST 注册在 `/genres` 之后、`/:code` 之前，避免 "recommended" 被解析为 movie code

- [x] 2.1 在 `publicMoviesRoutes` 中追加 `GET /recommended` 路由（含 `describeRoute` OpenAPI 描述）
- [x] 2.2 实现冷启动逻辑：若未登录或历史记录为空，直接查询 `viewCount DESC` 热门影片 12 部并返回（`meta.strategy = 'hot'`）
- [x] 2.3 实现 Query 1：`SELECT DISTINCT movie_code FROM watching_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`（已登录用户）
- [x] 2.4 实现 Query 2：从 movies 表批量查询历史影片的 genres（JSON 数组），在内存中统计 genre 出现频次，提取 top3 genres；同时通过 `movieActors` join 提取 top5 actorIds
- [x] 2.5 实现 Query 3：查询满足 top3 genres（JSON_EACH 匹配）或 top5 actors 的影片，排除已看 movieCodes，按 `viewCount DESC` 取 12 部；结果不足 12 部时用热门影片补充（去重）
- [x] 2.6 响应体包含 `{ success: true, data: Movie[], meta: { strategy: 'personalized' | 'hot' } }`
- [x] 2.7 运行 `apps/api` type-check 确认无类型错误

**完成标准**：有历史用户调用返回 `strategy: 'personalized'` 且结果不含已看影片；无历史用户返回 `strategy: 'hot'`

---

## 3. 前端 API Client 更新

**文件**：`apps/movie-app/src/lib/api-client.ts`

- [x] 3.1 在 `movieApi.getMovies` 的参数类型中追加 `yearFrom?: number`、`yearTo?: number`、`durationMin?: number`、`durationMax?: number`，并在 Hono RPC query 中传入（toString()）
- [x] 3.2 新增 `movieApi.getRecommended(): Promise<{ success: boolean, data: Movie[], meta: { strategy: string } }>`，调用 `GET /api/public/movies/recommended`（使用 `apiFetch`）
- [x] 3.3 运行 `apps/movie-app` vue-tsc 确认无类型错误

---

## 4. 前端：首页高级筛选面板

**文件**：`apps/movie-app/src/views/Home.vue`

- [x] 4.1 在 `filters` reactive 对象中追加 `yearFrom: number | ''`、`yearTo: number | ''`、`duration: '' | 'short' | 'medium' | 'long'`（时长分段枚举）
- [x] 4.2 在 `fetchMovies` 调用中根据 `filters.duration` 转换为对应的 `durationMin`/`durationMax` 数值（short: max=59；medium: min=60,max=120；long: min=121），随 `yearFrom`/`yearTo` 一并传入 `movieApi.getMovies`
- [x] 4.3 在 `syncUrl` 中追加 yearFrom/yearTo/duration 参数写入逻辑（有值时写入，空时不写）；在 `onMounted` 中从 URL query 恢复这三个状态
- [x] 4.4 在 Genre 标签栏下方模板中新增高级筛选区块（inline 常驻）：两个 `<input type="number">` 输入年份范围（min=2000, max=当前年）；时长按钮组（"不限" / "短片 <60分" / "中等 60-120分" / "长片 >120分"），点击后高亮激活，再次点击恢复"不限"
- [x] 4.5 年份 input 的 `@change` 和时长按钮的 `@click` 均触发 `pagination.page = 1; syncUrl(); fetchMovies()`
- [x] 4.6 验收：选择年份 2024-2025 后影片列表正确过滤；选择时长"中等"后返回 60-120 分钟影片；URL 参数写入正确；刷新后状态恢复

---

## 5. 前端：最新发布页

**文件**：`apps/movie-app/src/views/NewReleases.vue`（新建）、`apps/movie-app/src/router.ts`、`apps/movie-app/src/components/BottomNavigation.vue`

- [x] 5.1 新建 `NewReleases.vue`：定义 `activeYear` ref（默认当前年），`movies` ref，`pagination` reactive，`loading` ref
- [x] 5.2 实现 `fetchMovies()`：调用 `movieApi.getMovies({ yearFrom: activeYear, yearTo: activeYear, sortBy: 'releaseDate', sortOrder: 'desc', page, limit: 20 })`
- [x] 5.3 实现 `groupedByMonth` computed：将 movies 数组按 `releaseDate` 月份分组为 `Map<string, Movie[]>`（键如"2026-04"），过滤 releaseDate 为 null 的影片；月份组按月份倒序排列
- [x] 5.4 实现顶部年份 Tab：展示近 5 年（含当前年），点击切换 `activeYear`，重置 page=1，syncUrl，fetchMovies
- [x] 5.5 渲染月份分组列表：每组显示标题（"YYYY 年 M 月（N 部）"）及影片卡片网格；空状态展示"该年份暂无发布日期数据"
- [x] 5.6 在 `router.ts` 新增路由 `{ path: '/new-releases', component: () => import('./views/NewReleases.vue') }`
- [x] 5.7 在 `BottomNavigation.vue` 新增"新片"入口（图标 + 标签），路径 `/new-releases`，与现有导航项样式保持一致
- [x] 5.8 验收：访问 `/new-releases` 默认展示当前年影片，按月分组显示；切换年份 Tab 正确过滤；底部导航"新片"可点击跳转

---

## 6. 前端：首页"猜你喜欢"推荐区块

**文件**：`apps/movie-app/src/views/Home.vue`

- [x] 6.1 新增 `recommendedMovies` ref 和 `recommendedLoading` ref
- [x] 6.2 实现 `fetchRecommended()`：仅在 `userStore.user` 存在时调用 `movieApi.getRecommended()`，失败时静默（catch 空处理）；更新 `recommendedMovies`
- [x] 6.3 在 `onMounted` 中将 `fetchRecommended()` 加入并行加载（与 `fetchMovies()`/`fetchGenres()`/`fetchContinueWatching()` 同时触发）
- [x] 6.4 在模板"继续观看"区块下方添加"猜你喜欢"区块：`v-if="userStore.user"`；加载中显示 skeleton 卡片（3 个）；有数据时横向可滚动卡片列表（最多 12 部）；卡片点击跳转 `/movie/:code`
- [x] 6.5 验收：已登录有历史用户加载首页，"猜你喜欢"区块出现，影片与历史偏好相关；未登录用户不显示该区块；推荐接口失败时区块静默隐藏

---

## 7. 类型检查与验收

- [x] 7.1 运行 `apps/api` type-check 确认通过
- [x] 7.2 运行 `apps/movie-app` vue-tsc 确认通过
- [x] 7.3 运行全量单测确认通过（`apps/api` + `apps/movie-app`）
