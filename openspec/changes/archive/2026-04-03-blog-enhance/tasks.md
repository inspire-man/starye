## 1. 数据库 Schema 扩展

- [x] 1.1 在 `packages/db/src/schema.ts` 的 `posts` 表中新增 `tags`（JSON）、`series`（text）、`seriesOrder`（integer）、`contentFormat`（text, default 'html'）字段
- [x] 1.2 运行 `pnpm --filter db generate` 生成 migration SQL 文件，检查生成内容正确
- [x] 1.3 运行 `pnpm --filter api dev` 验证本地 D1 migration 自动应用无报错
- [x] 1.4 更新 `packages/db/src/schema.ts` 中 `Post` 类型导出，确保 TypeScript 类型同步

## 2. API 扩展：posts service 与 handler

- [x] 2.1 在 `post.service.ts` 中封装 `extractTocFromHtml(html: string, env: Env): Promise<TocItem[]>` 工具函数，使用 HTMLRewriter 提取 h2/h3 并注入 id 属性
- [x] 2.2 更新 `getPostBySlug` 返回值，附加 `toc` 字段（对 `contentFormat === 'html'` 的文章执行 TOC 提取）
- [x] 2.3 新增 `getAdjacentPosts({ db, slug }): Promise<{ prev, next }>` service 函数，按系列 seriesOrder 或全局 createdAt 时序查询上下篇
- [x] 2.4 更新 `getPosts` service，支持 `series`、`tag`、`q` 过滤参数（`q` 对 title 和 excerpt 做 LIKE 搜索，`tag` 用 `LIKE '%"tag"%'` 匹配 JSON 字段）
- [x] 2.5 更新 `createPost` / `updatePost` service，接收 `tags`、`series`、`seriesOrder`、`contentFormat` 字段
- [x] 2.6 在 `posts.handler.ts` 中新增 `getAdjacentPostsHandler`，并在 `posts/index.ts` 注册路由 `GET /:slug/adjacent`（公开访问）
- [x] 2.7 更新 `getPostList` handler，将 query 参数 `series`、`tag`、`q` 传入 service
- [x] 2.8 运行现有 post service/handler 测试，确保无回归（`pnpm --filter api test`）

## 3. Blog 客户端：列表页与筛选

- [x] 3.1 在 `apps/blog/app/pages/index.vue` 中新增 API 调用获取可用系列列表（复用 `GET /api/posts` 聚合系列字段，或单独维护本地聚合逻辑）
- [x] 3.2 在列表页文章网格上方渲染系列筛选 chip 区域（激活/非激活态样式区分）
- [x] 3.3 实现 chip 点击切换过滤逻辑（更新 URL query `?series=` + 重新 fetch 文章列表）
- [x] 3.4 在列表页底部增加「Load More」分页按钮（通过 `page` 参数递增加载）
- [x] 3.5 更新 `apps/blog/app/types.ts` 中 `Post` 接口，新增 `tags`、`series`、`seriesOrder`、`contentFormat`、`toc` 字段

## 4. Blog 客户端：系列页与标签页

- [x] 4.1 新建 `apps/blog/app/pages/series/[name].vue`，调用 `GET /api/posts?series=:name` 获取系列文章，按 `seriesOrder` 展示，页面标题为系列名
- [x] 4.2 新建 `apps/blog/app/pages/tags/[tag].vue`，调用 `GET /api/posts?tag=:tag` 获取文章列表
- [x] 4.3 在 `apps/blog/app/layouts/default.vue` 导航栏增加「系列」入口，链接至系列聚合页（或以下拉菜单展示系列列表）

## 5. Blog 客户端：文章详情页增强

- [x] 5.1 更新 `apps/blog/app/pages/[slug].vue`，根据 `contentFormat` 字段选择渲染路径（'html' 直接 v-html；'markdown'/null 走 markdown-it）
- [x] 5.2 在文章 header 区域增加阅读时间与字数统计显示（客户端计算，strip HTML tags 后统计）
- [x] 5.3 在宽屏布局下增加右侧 sticky TOC 侧边栏，渲染来自 API 的 `toc` 数组，点击标题锚点平滑滚动
- [x] 5.4 在文章底部增加上/下篇导航区域，调用 `GET /api/posts/:slug/adjacent` 获取数据并渲染
- [x] 5.5 验证 prose 样式（Tailwind Typography）与 wangEditor 输出 HTML 的兼容性，补充必要的 CSS 覆盖

## 6. Dashboard：PostEditor 接入 wangEditor v5

- [x] 6.1 在 `apps/dashboard` 中安装依赖：`pnpm --filter dashboard add @wangeditor/editor @wangeditor/editor-for-vue`
- [x] 6.2 重写 `apps/dashboard/src/views/PostEditor.vue`，使用 `<Editor>` + `<Toolbar>` 组件替换原 content textarea，绑定 `form.content`
- [x] 6.3 实现编辑器 `customUpload` 图片上传回调：调用 `POST /api/upload`（FormData），成功后调用 `insertFn(url)` 插入图片
- [x] 6.4 实现组件卸载时调用 `editor.destroy()` 防止内存泄漏（`onBeforeUnmount`）
- [x] 6.5 在 PostEditor 元数据区域新增 tags chip 输入组件（支持回车/逗号确认、× 删除）
- [x] 6.6 在 PostEditor 元数据区域新增 `series` 文本输入与 `seriesOrder` 数字输入
- [x] 6.7 更新 PostEditor 的 `save()` 方法，在请求体中包含 `tags`、`series`、`seriesOrder`、`contentFormat: 'html'`
- [x] 6.8 验证：新建一篇测试文章（含代码块、图片、系列信息），保存后在 Blog 前端正确渲染

## 7. 文章内容创作：「TypeScript 全栈项目 AI 实录」系列

- [x] 7.1 撰写并发布 #00《用 AI 辅助构建个人技术全栈：项目启动日志》（架构决策、技术选型，约 1500 字）
- [x] 7.2 撰写并发布 #01《Cloudflare D1 迁移的隐藏陷阱：代码部署≠数据库变更》（来自 DEVLOG 2026-01-08，约 2000 字）
- [x] 7.3 撰写并发布 #02《拒绝 Puppeteer 黑盒：如何编写可测试的爬虫代码》（来自 DEVLOG 2026-01-08，约 2500 字）
- [x] 7.4 撰写并发布 #03《R18 鉴权三角难题：Session、Cookie 与 Nuxt SSR》（来自 DEVLOG 2026-01-08，约 2000 字）
- [x] 7.5 撰写并发布 #04《Monorepo i18n 架构：一个翻译包如何服务所有应用》（来自 DEVLOG 2026-01-08 + 01-26，约 1800 字）
- [x] 7.6 撰写并发布 #05《Cloudflare Workers 互调陷阱：Host 头的隐藏坑》（来自 DEVLOG 2026-01-26，约 1500 字）

## 9. wangEditor 代码质量修正（对照官方文档）

- [x] 9.1 修正 `PostEditor.vue` 模板事件名称：`@on-created` → `@onCreated`（官方 Vue3 用法为 camelCase prop 形式）
- [x] 9.2 移除多余的 `handleChange` 函数及 `@on-change` 绑定（`v-model` 已负责内容同步，双写会导致响应式循环风险）
- [x] 9.3 移除 `fetchPost` 中多余的 `editorRef.value?.setHtml()`（`v-model` 会自动将 `form.content` 变更同步到编辑器）
- [x] 9.4 移除 `save()` 中冗余的 `form.value.content = editorRef.value.getHtml()`（`v-model` 已保持同步）
- [x] 9.5 按官方 TypeScript 文档新增 `src/types/wangeditor-custom.d.ts`，扩展 `SlateText` / `SlateElement` 类型

## 10. Blog 接入 Hono RPC 类型安全 composable

- [x] 10.1 在 `apps/blog/package.json` 中添加 `hono` 和 `@starye/api-types: workspace:*` 依赖
- [x] 10.2 创建 `apps/blog/app/composables/useApiClient.ts`，封装 `hc<AppType>()` 客户端，支持 `useAsyncData` 与 `useFetch` 两种调用模式

## 12. 测试：单元测试与 E2E 测试

- [x] 12.1 更新 `apps/api/src/test/helpers.ts` — `MockPost`/`createMockPost` 补充 `tags/series/seriesOrder/contentFormat` 字段，`createMockDb` 新增 `posts` 查询方法
- [x] 12.2 新建 `apps/api/src/routes/posts/__tests__/services/post.service.extend.test.ts` — 覆盖 `extractTocFromHtml`（7 个 case）/ `getPosts` 新过滤参数 / `getAdjacentPosts`（系列模式+全局模式）/ `getPostBySlug` TOC 提取
- [x] 12.3 新建 `apps/api/src/routes/posts/__tests__/handlers/posts.extend.handler.test.ts` — 覆盖 `getPostList` series/tag/q 参数透传（4 个 case）/ `getAdjacentPostsHandler`（3 个 case）
- [x] 12.4 新建 `apps/api/src/routes/posts/__tests__/e2e/posts-api.e2e.test.ts` — 全链路 Handler 测试：series 过滤 / tag 过滤 / q 搜索 / adjacent / HTML 文章 TOC + 草稿 403
- [x] 12.5 新建 `apps/dashboard/src/views/__test__/PostEditor.test.ts` — mock wangEditor / tags CRUD（4 个 case）/ 新字段填充 / 保存 payload 校验（共 6 个 case，全部通过）
- [x] 12.6 安装 `@playwright/test` devDependency，新建 `apps/blog/playwright.config.ts`，新增 `test:e2e` 脚本
- [x] 12.7 新建 `apps/blog/e2e/blog-features.spec.ts` — 首页系列 chip / 系列页 / 标签页 / 文章详情 TOC + 上下篇（使用 `page.route()` mock API）
- [x] 12.8 验证：API 187 测试全通过（25 文件），Dashboard 95 测试全通过（8 文件）

## 13. 生产部署

- [x] 13.1 运行 `pnpm --filter api exec wrangler d1 migrations apply starye-db --remote` 应用远端 D1 migration
- [x] 13.2 部署 API Worker（`pnpm --filter api deploy`）
- [x] 13.3 部署 Blog（Cloudflare Pages，触发 CI 或手动 `pnpm --filter blog build`）
- [x] 13.4 部署 Dashboard（Cloudflare Pages）
- [x] 13.5 访问生产 Blog 验证：系列页、文章详情 TOC、wangEditor 发布的文章渲染正确
