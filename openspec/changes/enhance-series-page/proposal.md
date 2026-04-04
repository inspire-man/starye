## Why

系列页面（`/series/:name`）已有基础实现（列表 + 分页），但信息密度极低：没有系列统计信息（总时长、年份跨度）、没有所属厂商链接、影片列表未按发布日期排序、且无法发现同厂商的相关系列。用户浏览系列时无法获得完整上下文，与厂商详情页的内聚性割裂。

## What Changes

- **系列概览卡片**：页面顶部展示系列统计数据（影片数、总时长、最早/最新发行年份、所属厂商链接）
- **按发行日期排序**：系列内影片默认按 `releaseDate DESC` 排列（最新在前）
- **所属厂商联动**：系列页顶部展示厂商名称并可点击跳转厂商详情页
- **同厂商其他系列**：页面底部展示该厂商名下其他系列的快捷入口
- **后端 series 聚合 API**：新增 `GET /api/series/:name` 端点，返回系列元信息和统计

## Capabilities

### New Capabilities

- `series-detail-api`: 系列详情 API — 返回系列名称、统计数据、所属厂商
- `series-related-series`: 同厂商相关系列推荐 — 系列页底部展示同厂商其他系列

### Modified Capabilities

（无现有 spec 级别行为变更）

## Impact

- **后端 API**: 新增 `apps/api/src/routes/public/series/index.ts` — 系列详情端点
- **客户端视图**: 增强 `apps/movie-app/src/views/Series.vue` — 添加概览卡片和相关系列
- **客户端 API**: `apps/movie-app/src/lib/api-client.ts` — 添加 getSeriesDetail 方法
- **范围外**: 系列 CRUD 管理、系列封面图上传、系列 SEO 优化
