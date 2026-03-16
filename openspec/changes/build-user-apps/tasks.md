# Tasks: 构建 Comic & Movie 用户前端应用

## 1. 数据库扩展

- [x] 1.1 在 `packages/db/src/schema.ts` 中扩展 `user` 表，添加 `isR18Verified` 字段
- [x] 1.2 在 `packages/db/src/schema.ts` 中创建 `readingProgress` 表（userId, chapterId, page, updatedAt）
- [x] 1.3 在 `packages/db/src/schema.ts` 中创建 `watchingProgress` 表（userId, movieCode, progress, duration, updatedAt）
- [x] 1.4 为进度表添加索引（userId, chapterId/movieCode 的复合索引）
- [x] 1.5 运行 `drizzle-kit generate:sqlite` 生成迁移文件
- [x] 1.6 在本地测试数据库迁移（`wrangler d1 execute --local`）
- [ ] 1.7 在生产环境应用数据库迁移

## 2. 后端 API - R18 白名单管理

- [x] 2.1 创建 `apps/api/src/routes/admin-r18-whitelist.ts` 文件
- [x] 2.2 实现 `GET /api/admin/r18-whitelist` 获取白名单用户列表
- [x] 2.3 实现 `POST /api/admin/r18-whitelist/:userId` 添加用户到白名单
- [x] 2.4 实现 `DELETE /api/admin/r18-whitelist/:userId` 移除用户
- [x] 2.5 添加权限验证中间件（仅 admin 和 super_admin 可访问）
- [x] 2.6 添加审计日志记录（ADD_R18_WHITELIST / REMOVE_R18_WHITELIST）
- [x] 2.7 在 `apps/api/src/index.ts` 中注册 R18 白名单路由

## 3. 后端 API - 公开漫画接口

- [x] 3.1 创建 `apps/api/src/routes/public-comics.ts` 文件
- [x] 3.2 实现 `GET /api/public/comics` 漫画列表接口（分页、筛选、排序）
- [x] 3.3 实现 R18 内容过滤逻辑（根据 user.isR18Verified）
- [x] 3.4 实现 `GET /api/public/comics/:slug` 漫画详情接口
- [x] 3.5 实现 R18 权限验证（详情接口）
- [x] 3.6 实现 `GET /api/public/comics/:slug/chapters/:chapterId` 章节详情接口
- [x] 3.7 在 `apps/api/src/index.ts` 中注册公开漫画路由

## 4. 后端 API - 公开影片接口

- [x] 4.1 创建 `apps/api/src/routes/public-movies.ts` 文件
- [x] 4.2 实现 `GET /api/public/movies` 影片列表接口（分页、筛选、排序）
- [x] 4.3 实现 R18 内容过滤逻辑
- [x] 4.4 实现 `GET /api/public/movies/:code` 影片详情接口
- [x] 4.5 实现 R18 权限验证（详情接口）
- [x] 4.6 在 `apps/api/src/index.ts` 中注册公开影片路由

## 5. 后端 API - 进度管理接口

- [x] 5.1 创建 `apps/api/src/routes/public-progress.ts` 文件
- [x] 5.2 实现 `POST /api/public/progress/reading` 保存阅读进度接口
- [x] 5.3 实现 `GET /api/public/progress/reading` 查询阅读进度接口（支持单个和批量查询）
- [x] 5.4 实现 `POST /api/public/progress/watching` 保存观看进度接口
- [x] 5.5 实现 `GET /api/public/progress/watching` 查询观看进度接口
- [x] 5.6 添加登录验证中间件（仅登录用户可访问进度接口）
- [x] 5.7 在 `apps/api/src/index.ts` 中注册进度管理路由

## 6. Gateway 路由配置

- [x] 6.1 在 `apps/gateway/src/index.ts` 中添加 `/comic` 路由（指向 comic-pages）
- [x] 6.2 在 `apps/gateway/src/index.ts` 中添加 `/movie` 路由（指向 movie-pages）
- [ ] 6.3 配置 Cloudflare Pages 部署（comic 和 movie 应用）
- [x] 6.4 测试 Gateway 路由是否正确转发请求

## 7. Comic App - 项目搭建

- [x] 7.1 创建 `apps/comic-app` 目录并初始化 Vite + Vue 3 + TypeScript 项目
- [x] 7.2 配置 Tailwind CSS 和响应式断点
- [x] 7.3 安装依赖：`vue-router`, `pinia`, `axios`
- [x] 7.4 配置 `vite.config.ts` 和 `tsconfig.json`
- [x] 7.5 创建路由配置（首页、搜索、详情、阅读器、个人中心）
- [x] 7.6 配置认证客户端（复用 better-auth）

## 8. Comic App - 首页和列表页

- [x] 8.1 创建首页组件（`src/views/Home.vue`），展示最新更新漫画
- [x] 8.2 实现分类筛选和状态筛选
- [x] 8.3 创建漫画卡片展示（封面 + 标题 + 作者）
- [x] 8.4 实现分页加载
- [x] 8.5 实现 R18 内容标识（红色 R18 徽章）
- [x] 8.6 实现响应式布局（移动端2列，桌面端5列）

## 9. Comic App - 搜索页

- [x] 9.1 创建搜索页组件（`src/views/Search.vue`）
- [x] 9.2 实现搜索输入框和搜索按钮
- [x] 9.3 调用 `/api/public/comics?search=` 接口
- [x] 9.4 显示搜索结果（复用漫画卡片展示）

## 10. Comic App - 详情页

- [x] 10.1 创建详情页组件（`src/views/ComicDetail.vue`）
- [x] 10.2 调用 `/api/public/comics/:slug` 接口获取漫画详情
- [x] 10.3 显示漫画封面、标题、作者、简介、标签
- [x] 10.4 显示章节列表（按 sortOrder 排序）
- [x] 10.5 实现 R18 权限验证（后端接口处理）
- [x] 10.6 章节列表可点击跳转到阅读器

## 11. Comic App - 阅读器

- [x] 11.1 创建阅读器组件（`src/views/Reader.vue`）
- [x] 11.2 调用 `/api/public/comics/:slug/chapters/:chapterId` 接口获取图片列表
- [x] 11.3 实现纵向滚动布局（所有图片垂直排列）
- [x] 11.4 实现图片懒加载（`loading="lazy"`）
- [x] 11.5 实现阅读进度保存（防抖1秒调用 `/api/public/progress/reading`）
- [x] 11.6 实现阅读进度恢复（打开章节时自动滚动到上次位置）
- [ ] 11.7 添加章节切换按钮（上一章、下一章）
- [x] 11.8 添加返回按钮
- [x] 11.9 实现响应式布局（全屏黑底，内容居中）

## 12. Comic App - 个人中心

- [x] 12.1 创建个人中心组件（`src/views/Profile.vue`）
- [ ] 12.2 实现书架标签（显示收藏的漫画）
- [x] 12.3 显示阅读历史
- [x] 12.4 调用进度接口获取用户的阅读记录
- [ ] 12.5 实现"继续阅读"功能（点击漫画跳转到最后阅读章节）

## 13. Movie App - 项目搭建

- [x] 13.1 创建 `apps/movie-app` 目录并初始化 Vite + Vue 3 + TypeScript 项目
- [x] 13.2 配置 Tailwind CSS 和响应式断点
- [x] 13.3 安装依赖：`vue-router`, `pinia`, `axios`, `xgplayer`
- [x] 13.4 配置 `vite.config.ts` 和 `tsconfig.json`
- [x] 13.5 创建路由配置（首页、搜索、详情、播放、个人中心）
- [x] 13.6 配置认证客户端（复用 better-auth）

## 14. Movie App - 首页和列表页

- [x] 14.1 创建首页组件（`src/views/Home.vue`），展示最新发布影片
- [x] 14.2 实现搜索和排序功能
- [x] 14.3 创建影片卡片展示（封面 + 番号 + 标题）
- [x] 14.4 实现分页加载
- [x] 14.5 实现 R18 内容标识（红色 R18 徽章）
- [x] 14.6 实现响应式布局

## 15. Movie App - 高级搜索页

- [x] 15.1 创建搜索页组件（`src/views/Search.vue`）
- [x] 15.2 实现番号/标题搜索输入框
- [x] 15.3 实现演员筛选输入框
- [x] 15.4 实现厂商筛选输入框
- [ ] 15.5 实现标签筛选（多选）
- [x] 15.6 实现组合搜索（调用 `/api/public/movies?actor=&genre=` 接口）
- [x] 15.7 显示搜索结果

## 16. Movie App - 详情页

- [x] 16.1 创建详情页组件（`src/views/MovieDetail.vue`）
- [x] 16.2 调用 `/api/public/movies/:code` 接口获取影片详情
- [x] 16.3 显示影片封面、番号、标题、时长、发布日期
- [x] 16.4 显示演员列表
- [x] 16.5 显示厂商、系列、标签
- [x] 16.6 显示播放源列表
- [x] 16.7 实现 R18 权限验证
- [x] 16.8 显示相关影片推荐（同演员或同系列）

## 17. Movie App - 播放页

- [x] 17.1 创建播放页组件（`src/views/Player.vue`）
- [x] 17.2 集成西瓜播放器（xgplayer）
- [x] 17.3 实现播放器初始化（传入播放源 URL）
- [ ] 17.4 实现播放源切换按钮（切换时保持进度）
- [x] 17.5 实现观看进度保存（防抖2秒调用 `/api/public/progress/watching`）
- [x] 17.6 实现观看进度恢复（打开影片时自动跳转）
- [x] 17.7 实现播放器控制（xgplayer 自带）
- [x] 17.8 实现响应式布局（全屏黑底）

## 18. Movie App - 个人中心

- [x] 18.1 创建个人中心组件（`src/views/Profile.vue`）
- [ ] 18.2 实现收藏标签（显示收藏的影片）
- [x] 18.3 显示观看历史
- [x] 18.4 调用进度接口获取用户的观看记录
- [ ] 18.5 实现"继续观看"功能（点击影片跳转到播放页）
- [ ] 18.6 实现收藏功能（详情页添加/取消收藏按钮）

## 19. Dashboard - R18 白名单管理界面

- [ ] 19.1 创建 `apps/dashboard/src/views/R18Whitelist.vue` 组件
- [ ] 19.2 调用 `GET /api/admin/r18-whitelist` 获取白名单用户列表
- [ ] 19.3 显示用户列表（用户名、邮箱、授权时间、授权管理员）
- [ ] 19.4 实现添加用户功能（输入邮箱或 ID，调用 POST 接口）
- [ ] 19.5 实现移除用户功能（点击"移除"按钮，调用 DELETE 接口）
- [ ] 19.6 添加二次确认对话框（移除用户时）
- [ ] 19.7 在 Dashboard 侧边栏添加"R18 白名单"菜单项

## 20. 未登录用户体验优化

- [ ] 20.1 在 Comic App 中实现未登录用户的本地进度存储（localStorage）
- [ ] 20.2 在 Movie App 中实现未登录用户的本地进度存储（localStorage）
- [ ] 20.3 实现登录后本地进度同步到云端
- [ ] 20.4 在个人中心页面添加"请先登录"提示（未登录用户访问时）

## 21. 测试与优化

- [ ] 21.1 测试 Comic App 的完整流程（浏览、搜索、详情、阅读、进度保存）
- [ ] 21.2 测试 Movie App 的完整流程（浏览、搜索、详情、播放、进度保存）
- [ ] 21.3 测试 R18 白名单管理功能（添加、移除、权限验证）
- [ ] 21.4 测试移动端响应式布局
- [ ] 21.5 测试图片懒加载性能
- [ ] 21.6 测试播放器性能和播放源切换
- [ ] 21.7 测试跨设备进度同步
- [ ] 21.8 检查 API 性能（列表查询 < 500ms，详情查询 < 200ms）

## 22. 部署与文档

- [ ] 22.1 部署 API Worker（包含新增的公开 API 和白名单 API）
- [ ] 22.2 部署 Comic App 到 Cloudflare Pages
- [ ] 22.3 部署 Movie App 到 Cloudflare Pages
- [ ] 22.4 部署 Dashboard（包含 R18 白名单管理界面）
- [ ] 22.5 更新 Gateway 配置（确保路由生效）
- [ ] 22.6 创建用户使用文档（如何登录、如何阅读/观看）
- [ ] 22.7 创建管理员文档（如何管理 R18 白名单）
