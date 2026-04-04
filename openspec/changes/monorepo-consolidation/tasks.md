<!-- 双线并行：Track A（基建线）按 A0→A1→A2→A3 顺序执行；Track B1（Blog）与 Track A 并行；Track B2（Comic App）在 A2 完成后启动 -->

## 0. 前置准备 — 主题统一 (A0)

- [x] 0.1 修改 `apps/dashboard/src/style.css`：添加 `@import "@starye/ui/globals.css"` 和 `@import "tailwindcss"`，添加 `@theme` 块引用 shadcn/ui 变量。验证：Dashboard 页面正常渲染
- [x] 0.2 修改 `apps/movie-app/src/style.css`：添加 `@import "@starye/ui/globals.css"`，添加 `:root` 覆盖 `--primary: 199 89% 48%`（天蓝），添加 `@theme` 块。删除 `apps/movie-app/tailwind.config.js`。验证：Movie App 品牌色保持天蓝
- [x] 0.3 修改 `apps/comic-app/src/style.css`：添加 `@import "@starye/ui/globals.css"`，添加 `:root` 覆盖 `--primary: 25 95% 53%`（橙色），添加 `@theme` 块。删除 `apps/comic-app/tailwind.config.js`。验证：Comic App 品牌色保持橙色
- [x] 0.4 删除 `apps/dashboard/src/styles/theme.css`，清理 Dashboard 中对该文件的引用。验证：Dashboard 无导入错误
- [x] 0.5 清理 Blog 和 Auth app 的 CSS：Blog `main.css` 已是干净状态；Auth `main.css` 从 160 行重复内容精简为仅 `@import "@starye/ui/globals.css"`。验证：Blog 和 Auth 样式无变化

## 1. UI 组件提取 (A1)

- [x] 1.1 提取 Pagination 组件：从 Dashboard 复制到 `packages/ui/src/components/Pagination.vue`，将 `<style scoped>` 硬编码 CSS 重写为 Tailwind class（使用 bg-primary、text-foreground 等语义化 token）。验证：组件在 storybook 或测试页中正确渲染
- [x] 1.2 提取 DataTable 组件：保持泛型 `<T extends { id: string }>`，样式重写为 Tailwind class。验证：传入 columns + data props 后表格正确渲染
- [x] 1.3 提取 ConfirmDialog 组件：样式重写为 Tailwind class，保持 Teleport 行为。验证：打开/关闭/确认/取消行为正常
- [x] 1.4 提取 FilterPanel 组件：样式重写为 Tailwind class，保持 text/select/checkbox/dateRange 筛选器类型。验证：各类型筛选器正确渲染和交互
- [x] 1.5 合并 Toast 组件：合并 Dashboard 和 Movie App 的 Toast 实现，统一 API（success/error/warning/info），样式重写为 Tailwind class。同时提取 ToastContainer。验证：四种类型 Toast 正确显示和自动消失
- [x] 1.6 提取 ErrorDisplay 组件：样式重写为 Tailwind class。验证：传入 error 对象后正确显示错误信息和重试按钮
- [x] 1.7 提取 SkeletonCard 和 SkeletonTable 组件：保持 shimmer 动画，样式重写为 Tailwind class。验证：骨架屏动画流畅
- [x] 1.8 提取 composable：将 useToast、usePagination、useFilters 移入 `packages/ui/src/composables/`。验证：导入路径 `@starye/ui` 可用
- [x] 1.9 更新 `packages/ui/src/index.ts` 导出所有新组件和 composable。验证：`import { Pagination, useToast } from '@starye/ui'` 可正确解析
- [x] 1.10 迁移 Dashboard 引用：将 Dashboard 中 19 个 view/component 文件的导入路径从 `@/components/X` 改为 `@starye/ui`。删除 Dashboard 本地已迁移的组件文件。验证：Dashboard 功能不变，lint 通过

## 2. Hono RPC 全量迁移 (A2)

- [x] 2.1 API 端类型审计：检查 `apps/api/src/index.ts` 的链式路由，确认所有 handler 返回类型不含 `any`。修复发现的类型问题。验证：`tsc --noEmit` 通过且无 any 返回（已修复 packages/db 声明文件过时问题）
- [x] 2.2 Dashboard RPC 迁移：重写 `apps/dashboard/src/lib/api.ts`，用 `hc<AppType>()` 替代 `fetchApi`，删除手写类型定义。逐一更新 19 个 view 文件的 API 调用。Auth 调用保留 Better Auth 客户端。验证：Dashboard 所有页面功能正常
- [x] 2.3 Movie App RPC 迁移：新建 `apps/movie-app/src/lib/api-client.ts` 使用 `hc<AppType>()`。更新 10 个 view/component 文件的 API 调用。Auth 调用改用原生 fetch。删除 `api.ts`、`types.ts`。从 package.json 移除 axios。验证：Movie App 所有页面功能正常
- [x] 2.4 Comic App RPC 迁移：新建 `apps/comic-app/src/lib/api-client.ts` 使用 `hc<AppType>()`。更新 5 个 view 文件的 API 调用。Auth 调用改用原生 fetch。删除 `api.ts`、`types.ts`。从 package.json 移除 axios。验证：Comic App 所有页面功能正常
- [x] 2.5 Blog RPC 迁移：将 4 个页面的 `useFetch('/api/...')` 替换为 `useAsyncData(() => client.api....$get().then(r => r.json()))`。验证：Blog 页面数据加载正常
- [x] 2.6 添加 hono 依赖到 movie-app 和 comic-app 的 package.json，运行 `pnpm install`。确认 axios 已完全移除。验证：`pnpm ls axios` 在 movie-app 和 comic-app 中无结果

## 3. Blog 阅读体验增强 (B1) — 与 Track A 并行

- [x] 3.1 集成 Shiki 代码高亮：安装 `shiki` 和 `@shikijs/markdown-it`，新建 `app/plugins/shiki.ts` 初始化高亮器并通过 `useMarkdown()` composable 集成到 markdown-it，HTML 格式内容通过 `highlightHtmlContent()` 处理。验证：含代码块的文章页面展示语法高亮且无闪烁
- [x] 3.2 实现代码块复制按钮：在 `[slug].vue` 的 `onMounted` 和 `watch(renderedContent)` 中动态注入复制按钮，点击后调用 `navigator.clipboard.writeText()`，2 秒后切换回复制图标。验证：点击复制按钮后剪贴板内容为代码文本
- [x] 3.3 实现搜索功能：新增 `app/pages/search.vue`，通过 `useAsyncData` + `$fetch('/api/posts?search=keyword')` 实现防抖搜索（400ms），URL query 同步。验证：输入关键词后展示匹配文章列表
- [x] 3.4 实现归档页：新增 `app/pages/archive.vue`，获取所有文章并按年→月分组展示时间线。验证：文章按时间线正确分组和排序
- [x] 3.5 实现 RSS Feed：新增 `server/routes/feed.xml.ts` Nitro server route，输出 RSS 2.0 XML，设置正确 Content-Type 和 Cache-Control。验证：RSS 阅读器可正确解析 feed
- [x] 3.6 实现阅读进度条：在 `[slug].vue` 顶部添加固定高度进度条，通过 `scroll` 事件计算文章区域滚动百分比更新 width。验证：滚动页面时进度条从 0% 到 100% 平滑变化
- [x] 3.7 完善 SEO meta：在 `[slug].vue` 使用 `useSeoMeta()` 设置 og:title、og:description、og:image、twitter:card 等标签，同时完善归档和搜索页面的 title/description。验证：使用 Open Graph 调试工具检查 meta 标签正确

## 4. Comic App 功能补齐 (B2) — 在 A2 完成后启动

- [x] 4.1 收藏系统：新增 `src/composables/useFavorites.ts` 和 `src/views/Favorites.vue`，在 `api-client.ts` 添加 `favoritesApi`，在 ComicDetail 添加收藏按钮，操作结果通过 Toast 反馈。路由添加 `/favorites` 条目（requiresAuth）。验证：收藏/取消收藏/查看收藏列表功能正常
- [x] 4.2 搜索增强：重写 `Search.vue`，接入 `/api/public/comics?search=keyword`，使用 `@starye/ui` 的 Pagination 组件分页，UI 升级为语义化 Tailwind token。验证：搜索结果正确且支持分页
- [x] 4.3 Toast 替换 alert：将 `router.ts` 中的 `alert('请先登录...')` 替换为 `warning()` from `@starye/ui`，在 `App.vue` 添加 `ToastContainer`。验证：未登录提示和操作反馈使用 Toast 而非浏览器原生 alert
- [x] 4.4 移动端适配：重写 Header（添加汉堡菜单、移动端导航）、Home、ComicDetail 使用 sm:/md: 响应式 class，灰色硬编码全替换为 Tailwind 语义化 token（text-foreground、bg-muted 等）。验证：在 375px 宽度下无水平溢出，漫画卡片和阅读器图片正确适配

## 5. 关键路径测试覆盖 (A3) — 在 Track A 和 B 稳定后

- [x] 5.1 Gateway 路由单元测试：新建 `apps/gateway/src/__tests__/routing.test.ts`，mock fetch 函数，测试所有路径匹配规则（/api、/dashboard、/movie、/comic、/auth、默认）、路径重写逻辑、本地/生产环境检测。验证：测试全部通过
- [x] 5.2 Gateway 代理头部测试：测试 X-Forwarded-Host、X-Forwarded-Proto、X-Real-IP 设置正确。验证：测试全部通过
- [x] 5.3 Auth flow E2E 测试：新建 `apps/dashboard/e2e/auth-flow.spec.ts`，使用 Playwright 测试未登录跳转、权限不足拒绝、资源级权限检查。验证：测试全部通过
