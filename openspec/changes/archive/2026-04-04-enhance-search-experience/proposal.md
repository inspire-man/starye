## Why

Movie App 目前仅在首页提供基础的关键词过滤（前端内存过滤），无法跨类型搜索（影片 + 演员 + 厂商），搜索结果不可分享（URL 不携带搜索状态），且无自动补全。用户往往不知道如何快速定位内容，尤其是想按番号、演员名搜索时体验极差。

## What Changes

- **全局搜索页**：新增 `/search` 路由，支持关键词同时搜索影片（code/title）、演员（name）、厂商（name），结果分组展示
- **搜索状态 URL 化**：搜索关键词持久化到 URL query `?q=`，支持分享和浏览器历史
- **搜索自动补全**：搜索框键入时实时显示候选列表（debounce 300ms），候选项支持演员头像预览
- **后端搜索 API 增强**：统一搜索端点 `GET /api/search?q=&types=movie,actor,publisher`，返回混合结果

## Capabilities

### New Capabilities

- `global-search`: 全局搜索页与后端搜索端点 — 跨类型关键词搜索，结果分组展示
- `search-autocomplete`: 搜索自动补全 — 实时候选列表，debounce 输入

### Modified Capabilities

（无现有 spec 级别行为变更，首页现有过滤保持不变）

## Impact

- **后端 API**: 新增 `apps/api/src/routes/public/search/index.ts` — 统一搜索端点
- **客户端路由**: `apps/movie-app/src/router.ts` — 新增 `/search` 路由
- **客户端视图**: 新增 `apps/movie-app/src/views/Search.vue`
- **客户端组件**: 新增 `SearchBar` 组件（Header 全局展示）或扩展现有搜索框
- **范围外**: Elasticsearch / 全文索引、搜索历史服务端存储、拼音搜索
