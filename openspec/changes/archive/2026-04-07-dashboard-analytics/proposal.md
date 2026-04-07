## Why

`viewCount` 字段自上次迭代起已在生产环境积累数据，Genre 聚合接口也已就绪，但 Dashboard 对这些数据完全没有消费——管理员无法感知哪些影片最受欢迎、哪些 Genre 占比最高。在不引入任何 DB schema 变更的前提下，MUST 将已有数据转化为可操作的管理洞察。

## What Changes

- **热门影片 Top N 排行**：Dashboard 首页新增"热门影片"卡片，展示 viewCount 最高的前 10 部影片，可点击跳转管理页
- **Genre 分布统计**：Dashboard 首页新增"Genre 分布"列表，展示各 genre 影片数量占比，数据复用已有 `/public/movies/genres` 聚合逻辑
- **新增管理端分析 API**：`GET /api/admin/movies/analytics` 返回热门排行 + genre 分布，供 Dashboard 专用（需鉴权，与公开接口隔离）

## Capabilities

### New Capabilities

- `movie-hot-ranking`：管理端热门影片排行接口与 Dashboard 展示
- `movie-genre-distribution`：管理端 Genre 分布统计接口与 Dashboard 展示

### Modified Capabilities

无（不修改现有公开 API 的行为）

## Impact

- `apps/api/src/routes/admin/movies/index.ts`（或新建 analytics 子路由）：新增 `GET /analytics` 端点
- `apps/dashboard/src/views/Home.vue`：新增热门排行与 Genre 分布两个 section
- `apps/dashboard/src/lib/api.ts`（或对应 API client）：新增 `getMovieAnalytics()` 方法
- 无 DB schema 变更，复用 `view_count` 字段与 `json_each(genres)` 聚合
