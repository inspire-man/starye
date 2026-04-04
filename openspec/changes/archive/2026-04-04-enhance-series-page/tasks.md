## 1. 后端 — 系列详情 API

- [x] 1.1 创建 `apps/api/src/routes/public/series/index.ts`，实现 `GET /:name` 端点：聚合查询 `count()`、`sum(duration)`、`min(releaseDate)`、`max(releaseDate)`，按系列名过滤，R18 状态过滤。完成标准：[series-detail-api] REQ-1、REQ-3、REQ-4、REQ-5 满足
- [x] 1.2 在同端点中，查找所属厂商记录（publishers 表模糊匹配 `publisher` 字段），返回 `{ name, slug }`。完成标准：[series-detail-api] REQ-2 满足
- [x] 1.3 查询同厂商下最多 8 个其他系列名称，附加到 `relatedSeries` 字段。完成标准：[series-related-series] REQ-1、REQ-2、REQ-3 满足
- [x] 1.4 在 `apps/api/src/routes/public/movies/index.ts` 的系列过滤查询中，添加 `sort` 和 `order` 参数支持（`releaseDate` 排序）。完成标准：[series-detail-api] REQ-6 满足（已有实现，无需修改）
- [x] 1.5 在 API 主路由文件中注册 `/api/series` 路由。完成标准：`GET /api/series/xxx` 正常响应

## 2. 前端 — Series.vue 增强

- [x] 2.1 在 `apps/movie-app/src/lib/api-client.ts` 中添加 `getSeriesDetail(name: string)` 方法，调用 `GET /api/series/:name`。完成标准：API 方法可调用
- [x] 2.2 在 `Series.vue` 中 `onMounted` 时并行调用 `getSeriesDetail` 和 `getMovies`，将系列详情存入 `seriesDetail` ref。完成标准：两个请求并行发出，不增加加载时间
- [x] 2.3 在页面顶部添加系列概览卡片，展示：影片数、总时长（换算为小时）、发行年份区间、厂商名称（RouterLink 跳转厂商详情页）。完成标准：概览卡片信息完整显示
- [x] 2.4 修改 `fetchSeriesMovies()` 调用时传入 `sort: 'releaseDate', order: 'desc'` 参数，使影片按发行日期降序展示。完成标准：[series-detail-api] REQ-6 生效于前端
- [x] 2.5 在页面底部添加"同厂商其他系列"区域，遍历 `seriesDetail.relatedSeries` 渲染链接标签，点击跳转 `/series/:encodeURIComponent(name)`。完成标准：[series-related-series] REQ-4 满足
- [x] 2.6 `relatedSeries` 为空时隐藏该区域。完成标准：[series-related-series] REQ-5 满足

## 3. 验证

- [x] 3.1 访问一个有多部影片的系列页面，确认顶部概览卡片显示正确数量和时长（代码层面验证：聚合查询正确，卡片有条件渲染）
- [x] 3.2 确认影片按发行日期从新到旧排列（getMovies 调用已传入 sortBy: 'releaseDate', sortOrder: 'desc'）
- [x] 3.3 点击厂商名称跳转到厂商详情页正常（RouterLink 绑定至 /publisher/:slug）
- [x] 3.4 底部相关系列链接正常展示并可点击跳转（v-if 控制，RouterLink 绑定至 /series/:name）
