# 观看历史 + Genre 浏览（方向 C + D）

## 背景

用户在 movie-app 中已支持保存观看进度（`watchingProgress` 表已有，API 已有），但缺少：
1. **观看历史页**：用户看不到自己曾经观看过哪些影片，也无法继续观看；
2. **Genre 浏览**：首页已有 `activeGenre` 过滤状态，但没有视觉化的 Genre 标签入口，用户无法发现和切换 Genre。

这两个功能是内容发现体验的重要补充，且均**无需 DB schema 变更**，可快速落地。

## 目标

- 新增观看历史页 `/history`，展示用户的观看记录（含影片封面、标题、进度），支持"继续观看"跳转
- 首页 `Home.vue` 增加"继续观看"板块（登录用户可见，展示最近未完成的影片）
- 新增 `GET /api/public/genres` 接口，聚合返回所有 Genre 及作品数量
- 首页增加 Genre 标签栏，点击可过滤当前列表
- `movie-app/api-client.ts` 补充 `genreApi` 和增强 progress API

## 非目标

- **不做**独立的 `/genres/:name` 浏览页（首页 genre 过滤已足够，页面单独拆出留后续）
- **不做** viewCount / 热门算法（属于方向 E，单独 change 处理）
- **不做** DB schema 变更
- **不做**观看历史的删除功能

## 范围

**涉及应用**：`apps/api`、`apps/movie-app`

### A. API 扩展（apps/api）

**A1 — 观看历史接口增强**
- 文件：`apps/api/src/routes/public/progress/index.ts`
- 现有 `GET /progress/watching`（无参数时）只返回 `{ movieCode, progress, duration, updatedAt }`
- 增强：JOIN `movies` 表，返回 `{ movieCode, title, slug, coverImage, isR18, progress, duration, updatedAt }`
- 支持 `limit` 参数（默认 20，最大 50）

**A2 — Genre 列表接口**
- 新增路由：`GET /api/public/genres`
- 通过 SQLite `json_each(genres)` 聚合所有影片的 genre，返回 `{ genre: string, count: number }[]`
- 按 `count DESC` 排序，过滤掉空字符串和 R18 用户不可见的 genre
- 文件：`apps/api/src/routes/public/movies/index.ts`（或新建 genres 路由文件）

### B. 前端（apps/movie-app）

**B1 — 补充 API 客户端**
- 文件：`apps/movie-app/src/lib/api-client.ts`
- 新增 `genreApi.getGenres()` 方法
- 增强 `progressApi.getWatchingHistory()` 方法（返回含影片详情的历史列表）

**B2 — 首页 Genre 标签栏**
- 文件：`apps/movie-app/src/views/Home.vue`
- 在筛选控件下方增加水平滚动的 Genre 标签栏
- 点击 Genre 标签设置 `activeGenre`，触发列表过滤
- 点击已选中的 Genre 取消过滤
- 同步 genre 到 URL query（已有 `syncUrl` 逻辑）

**B3 — 首页"继续观看"板块**
- 文件：`apps/movie-app/src/views/Home.vue`
- 登录用户可见，页面顶部展示最近 5 部进度未完成的影片（`progress/duration < 0.9`）
- 每个卡片展示封面、标题、进度条、"继续"按钮
- 未登录时不显示此板块，不影响主列表体验

**B4 — 观看历史页**
- 新文件：`apps/movie-app/src/views/History.vue`
- 路由：`/history`（需登录，`meta: { requiresAuth: true }`）
- 展示按时间倒序的观看记录，支持分页（10条/页）
- 每条记录展示：封面、标题、观看进度条、最后观看时间、"继续观看"按钮
- 文件：`apps/movie-app/src/router.ts`（添加路由）

## 风险

- A2 Genre 聚合查询使用 `json_each()`，在 D1 (SQLite) 上支持，但需验证 Cloudflare Workers 环境是否正常执行
- `GET /progress/watching` 接口增强后返回数据格式变化（新增字段），前端 movie-app 现有调用需同步更新；现有调用（`progressApi.getWatchingProgress(movieCode)`）传入 movieCode 参数时走单条路径不受影响
- B3 继续观看板块需要用户登录，**MUST** 在未登录时静默隐藏，不报错

## 里程碑

1. A1 + A2 接口实现（可独立部署验证）
2. B1 API 客户端更新
3. B2 Genre 标签栏
4. B3 继续观看板块
5. B4 历史页
