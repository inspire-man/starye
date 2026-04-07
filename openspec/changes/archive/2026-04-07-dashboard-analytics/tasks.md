## 1. API：管理端分析接口

- [x] 1.1 在 `apps/api/src/routes/admin/movies/index.ts` 中新增 `GET /analytics` 端点，鉴权要求 admin 角色
- [x] 1.2 实现热门影片查询：`ORDER BY view_count DESC, created_at DESC LIMIT 10`，返回 `id, code, title, cover_image, view_count, is_r18`
- [x] 1.3 实现 Genre 分布查询：`json_each(genres)` 聚合，含 R18 全量，按 count DESC LIMIT 50，过滤空 genre
- [x] 1.4 用 `Promise.all` 并行执行两个查询，合并为单一响应 `{ hotMovies, genreDistribution }`
- [x] 1.5 定义响应 Schema（Valibot）并接入 `describeRoute` / `resolver`

## 2. Dashboard API Client

- [x] 2.1 在 `apps/dashboard/src/lib/api.ts`（或对应 API client 文件）中新增 `getMovieAnalytics()` 方法，调用 `GET /api/admin/movies/analytics`

## 3. Dashboard 首页展示

- [x] 3.1 在 `apps/dashboard/src/views/Home.vue` 中新增"内容洞察"section，`onMounted` 时并行调用 `getMovieAnalytics()`
- [x] 3.2 实现热门影片 Top 10 列表：序号、影片标题（可点击跳转 `/movies`）、viewCount 数值，加载中显示 skeleton
- [x] 3.3 实现 Genre 分布列表：展示前 20 个 genre、count、相对占比进度条（count / 总影片数 * 100%）
- [x] 3.4 无数据时（hotMovies 为空）显示"暂无观看数据"空状态提示

## 4. 单测

- [x] 4.1 为 `GET /admin/movies/analytics` 新增 API 单测：验证热门排行按 viewCount DESC 返回，最多 10 条
- [x] 4.2 验证非管理员访问返回 403
- [x] 4.3 验证 genreDistribution 含 R18 影片的 genre（与公开 /genres 接口行为区分）
- [x] 4.4 验证空 genre 被过滤

## 5. 类型检查与验收

- [x] 5.1 运行 `apps/api` type-check 确认无类型错误
- [x] 5.2 运行 `apps/dashboard` type-check 确认无类型错误
- [x] 5.3 运行全量单测确认通过
