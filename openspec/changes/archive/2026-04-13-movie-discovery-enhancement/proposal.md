## Why

Movie App 目前具备基础浏览能力（Genre 标签、关键词搜索、排序），但缺乏精细化内容发现工具——用户无法按发布年份或时长缩小范围，也无法看到近期新作的时间线，更没有基于个人观看偏好的推荐。随着影片库持续扩大，内容发现体验亟需升级，让用户从"泛浏览"转向"精准找片"与"被动发现"。

## What Changes

- **API 新增年份 / 时长过滤参数**：`GET /public/movies` 新增 `yearFrom`、`yearTo`、`durationMin`、`durationMax` 四个可选查询参数，后端 SQL 按 `releaseDate` 时间戳范围与 `duration` 分钟数范围过滤
- **首页高级筛选面板**：在现有 Genre 标签栏下方新增 inline 展开的高级筛选区，包含年份范围选择和时长分段选择；状态同步到 URL query，刷新后可恢复
- **最新发布页**（新路由 `/new-releases`）：按发布年份分组展示影片，顶部年份 Tab 快速切换，内部按月份聚合；复用高级筛选 API 扩展
- **首页"猜你喜欢"推荐区块**：仅登录用户可见，基于近期观看历史的 genre/演员偏好计算，冷启动降级为热门影片；新增 `GET /public/movies/recommended` 接口

## Capabilities

### New Capabilities

- `movie-filter-params`: API 层年份与时长范围筛选参数，供高级筛选面板与最新发布页共用
- `movie-advanced-filter-panel`: 首页 inline 展开高级筛选面板（年份范围 + 时长分段）
- `movie-new-releases-page`: 最新发布浏览页，按年份/月份时间线组织影片
- `movie-recommendation`: 首页个性化推荐区块（猜你喜欢）及其后端推荐接口

### Modified Capabilities

（无现有 spec 级需求变更）

## Impact

- `apps/api/src/schemas/movie.ts`：扩展 `GetMoviesQuerySchema`
- `apps/api/src/routes/public/movies/index.ts`：扩展列表查询 SQL + 新增 `/recommended` 路由
- `apps/movie-app/src/lib/api-client.ts`：`movieApi.getMovies` 新增参数；新增 `movieApi.getRecommended`
- `apps/movie-app/src/views/Home.vue`：新增高级筛选面板区块 + 猜你喜欢区块
- `apps/movie-app/src/router.ts`：新增 `/new-releases` 路由
- `apps/movie-app/src/views/` (新文件)：`NewReleases.vue`
- `packages/db`：无 schema 变更，MUST 不新增 migration
