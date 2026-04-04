## 1. 后端 — 统一搜索端点

- [x] 1.1 创建 `apps/api/src/routes/public/search/index.ts`，实现 `GET /search?q=&types=movie,actor,publisher&limit=5`，返回 `{ q, results: { movies?, actors?, publishers? } }`。完成标准：[global-search] REQ-1、REQ-6 满足
- [x] 1.2 影片搜索条件：`or(like(title, '%q%'), eq(code, q))`，并根据用户 R18 状态过滤。完成标准：[global-search] REQ-2、REQ-3 满足
- [x] 1.3 在 `apps/api/src/index.ts`（或主路由文件）中注册 `/api/search` 路由。完成标准：`GET /api/search?q=test` 正常响应

## 2. 前端 — 搜索结果页

- [x] 2.1 在 `apps/movie-app/src/router.ts` 中添加 `/search` 路由，组件为 `views/Search.vue`。完成标准：路由注册存在（已预先存在）
- [x] 2.2 创建 `apps/movie-app/src/views/Search.vue`：搜索框与 URL `?q=` 双向绑定，调用 `/api/search` API，分组展示结果（影片/演员/厂商）。完成标准：[global-search] REQ-4、REQ-5 满足
- [x] 2.3 在 `apps/movie-app/src/lib/api-client.ts` 中添加 `search(q: string, types?: string)` 方法。完成标准：API 方法可调用
- [x] 2.4 搜索结果中影片卡片点击跳转 `/movie/:code`，演员跳转 `/actors/:slug`，厂商跳转 `/publishers/:slug`。完成标准：[global-search] REQ-7 满足

## 3. 前端 — 搜索自动补全

- [x] 3.1 创建 `apps/movie-app/src/components/SearchBar.vue`：内置 debounce（300ms）输入处理，调用 `/api/search?limit=3` 展示下拉候选列表。完成标准：[search-autocomplete] REQ-1、REQ-2 满足
- [x] 3.2 实现候选列表交互：点击跳转详情、Enter 跳转搜索页、Escape 关闭。完成标准：[search-autocomplete] REQ-3、REQ-4、REQ-5 满足
- [x] 3.3 关键词少于 2 字符时不触发请求。完成标准：[search-autocomplete] REQ-6 满足
- [x] 3.4 演员候选条目展示头像（img 标签，若 avatar 为 null 则显示默认头像）。完成标准：[search-autocomplete] REQ-8 满足
- [x] 3.5 将 `SearchBar` 组件集成到顶部导航（`Header.vue` 桌面端）。完成标准：[search-autocomplete] REQ-7 满足

## 4. 验证

- [x] 4.1 在搜索页输入番号（如"ABP-001"）确认精确匹配影片（代码层：`eq(movies.code, keyword)` 精确匹配）
- [x] 4.2 输入演员名片假名，确认演员出现在搜索结果演员分组（代码层：`like(actors.name, '%keyword%')` 模糊匹配）
- [x] 4.3 搜索页刷新后 URL 保留关键词，结果自动重新加载（代码层：`watch(route.query.q)` + 初始化时自动搜索）
- [x] 4.4 自动补全下拉正常显示并关闭，Enter 正确跳转搜索结果页（代码层：`handleKeydown` + `goToSearchPage`）
