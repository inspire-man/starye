# Proposal: 构建 Comic & Movie 用户前端应用

## Why

当前项目已完成管理后台（Dashboard）和数据爬取（Crawler）基础设施，但缺少面向终端用户的前端应用。用户无法浏览和消费已爬取的漫画与影片内容。构建独立的 Comic App 和 Movie App 是实现内容分发的必要步骤，同时满足法规要求的内容隔离（漫画与影片完全独立）和 R18 内容的访问控制需求。

## What Changes

- **新增 Comic App**：独立的漫画阅读应用（`apps/comic`），提供漫画浏览、搜索、分类、阅读器等功能
- **新增 Movie App**：独立的影片播放应用（`apps/movie`），提供影片浏览、搜索、演员/厂商筛选、在线播放等功能
- **R18 白名单系统**：实现纯白名单模式的 R18 访问控制，管理员在后台授权用户访问 R18 内容
- **进度同步功能**：记录用户的阅读/观看进度，支持跨设备同步
- **响应式设计**：确保两个应用在移动端和桌面端均有良好体验
- **播放器集成**：Movie App 使用西瓜播放器（xgplayer）支持多种视频格式和播放源切换
- **阅读器实现**：Comic App 使用纵向滚动阅读模式，优化移动端体验
- **Gateway 路由扩展**：在 `apps/gateway` 中添加 `/comic` 和 `/movie` 路由规则
- **API 扩展**：新增用户侧 API 端点，支持内容列表、详情、搜索、进度保存等功能

## Capabilities

### New Capabilities

- `comic-app-frontend`: 漫画前端应用，包含首页、列表、详情、阅读器、搜索、个人中心等功能
- `movie-app-frontend`: 影片前端应用，包含首页、列表、详情、播放页、高级搜索、个人中心等功能
- `r18-whitelist-management`: R18 白名单管理系统，包含后台授权界面和前端验证机制
- `reading-progress-sync`: 阅读/观看进度同步功能，支持云端存储和跨设备访问
- `public-api`: 面向用户侧的公开 API，提供内容查询、搜索、进度管理等接口

### Modified Capabilities

<!-- 无现有 capability 需要修改 -->

## Impact

**新增应用**：
- `apps/comic`: Vue 3 + TypeScript + Vite 单页应用
- `apps/movie`: Vue 3 + TypeScript + Vite 单页应用
- 两个应用共享 UI 组件库（可选提取到 `packages/ui`）

**数据库扩展**：
- 新增 `reading_progress` 表：存储用户阅读进度（章节 ID、页码、时间戳）
- 新增 `watching_progress` 表：存储用户观看进度（影片 code、播放进度、时间戳）
- 扩展 `user` 表：添加 `isR18Verified` 字段标记白名单用户

**API 路由新增**：
- `/api/public/comics/*`：公开漫画接口
- `/api/public/movies/*`：公开影片接口
- `/api/public/progress/*`：进度管理接口
- `/api/admin/r18-whitelist/*`：R18 白名单管理接口（管理员专用）

**Gateway 路由**：
- `/comic/*` → `apps/comic`
- `/movie/*` → `apps/movie`

**依赖新增**：
- `xgplayer`：西瓜播放器（Movie App）
- `@vueuse/core`：Vue 组合式工具库（可选）
- 图片懒加载库（待定）

**权限与隔离**：
- MUST 确保 Comic 和 Movie 内容在前端和后端完全隔离
- MUST 确保未通过 R18 验证的用户无法访问 R18 内容（API 和前端双重验证）
- MUST 在所有公开 API 中实现 `isR18` 字段的过滤逻辑

**非目标（本次不实现）**：
- 评论功能
- 用户注册（仍使用 GitHub OAuth2）
- 社交分享
- 推荐算法
- PWA 离线缓存
