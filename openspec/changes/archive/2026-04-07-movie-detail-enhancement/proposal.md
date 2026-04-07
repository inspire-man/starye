## Why

影片详情页的"相关影片"推荐已有骨架（演员+系列），但当影片关联演员不足时推荐列表为空，体验断层；有系列的影片缺乏位置感（"第几部/共几部"）；观看历史页面无"已看完"视觉标记，用户无法快速区分完成状态。以上三点是当前影片核心体验的遗留缺口，MUST 在本次一并补齐。

## What Changes

- **相关影片 genre 兜底**：当演员+系列推荐数量 < 4 时，追加同 genre 的热门影片补足至 6 条
- **系列导航组件**：详情页和播放页新增"系列导航"区块，显示系列位置（第 N 部 / 共 M 部）及前后跳转链接
- **观看历史"已看完"标记**：History.vue 中 progress/duration ≥ 0.9 的记录显示"已看完 ✓"徽标，并支持按状态筛选

## Capabilities

### New Capabilities

- `related-movies-genre-fallback`：相关影片在演员/系列结果不足时的 genre 补全逻辑
- `series-navigation`：影片所属系列的导航展示（位置 + 前后链接）
- `watch-status-badge`：历史页观看完成状态的视觉标识与筛选

### Modified Capabilities

无（不改变现有接口约定，均为新增逻辑分支或纯前端展示）

## Impact

- `apps/api/src/routes/public/movies/index.ts`：`GET /:code` 中相关影片查询新增 genre fallback 分支
- `apps/movie-app/src/views/MovieDetail.vue`：新增系列导航组件渲染
- `apps/movie-app/src/views/Player.vue`：同步新增系列导航
- `apps/movie-app/src/views/History.vue`：新增"已看完"徽标与筛选 tab
- 无 DB schema 变更，无 migration
