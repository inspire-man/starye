## Why

博客模块（`apps/blog`）目前仅有基础的文章列表与详情页，缺少标签、系列分组、代码高亮、TOC、上下篇导航等技术博客的核心体验。同时后台编辑器仅为纯文本 textarea，内容创作效率低。需要从功能框架到内容生产完成整体充实，使博客具备作为技术系列连载的能力。

## What Changes

- `packages/db`：`posts` 表 MUST 新增 `tags`（JSON）、`series`（text）、`seriesOrder`（int）、`contentFormat`（'html' | 'markdown'）字段，并生成 migration
- `apps/api`：文章列表接口 MUST 支持 `?series=&tag=&q=` 过滤与搜索；新增 `GET /posts/:slug/adjacent` 上下篇接口；创建/更新接口支持新字段；API 返回时 SHALL 预处理 HTML content 提取 TOC 结构（`toc: {id, text, level}[]`）
- `apps/blog`（主）：
  - **BREAKING**：移除 `markdown-it` 依赖，改为直接渲染 wangEditor 输出的 HTML（通过 `v-html` + Tailwind Typography prose 样式）
  - 新增系列文章页 `/series/:name`、标签聚合页 `/tags/:tag`
  - 文章详情页 MUST 展示阅读时间、字数、侧边 TOC、上/下篇导航
  - 文章列表页支持系列/标签筛选 chip + Load More 分页
  - 导航栏增加「系列」入口
- `apps/dashboard`（辅）：
  - PostEditor MUST 使用 wangEditor v5（`@wangeditor/editor-for-vue`）替换原 textarea
  - 编辑器支持图片上传对接 `/api/upload`
  - 新增 tags chip 输入、series 选择器、seriesOrder 数字输入
- **文章内容**（功能框架完成后）：基于 `DEVLOG.md` 与未来 spec 产出，逐篇创作「TypeScript 全栈项目 AI 实录」系列文章

## Capabilities

### New Capabilities

- `blog-series-tags`：博客文章系列与标签体系——schema 扩展、API 过滤、系列页/标签页前端展示
- `blog-post-reading-experience`：文章阅读体验强化——服务端 TOC 提取、阅读时间、上下篇导航
- `blog-wangeditor-integration`：wangEditor v5 富文本编辑器集成——Dashboard PostEditor 替换与图片上传对接
- `blog-article-series-content`：「TypeScript 全栈项目 AI 实录」系列文章内容——基于 DEVLOG 与 spec 的真实技术沉淀

### Modified Capabilities

（无）

## Impact

- `packages/db`：schema 变更 + 新 migration 文件
- `apps/api/src/routes/posts`：service + handler + index 均有改动
- `apps/blog/app/pages`：`index.vue`、`[slug].vue` 改动；新增 `series/[name].vue`、`tags/[tag].vue`
- `apps/blog/app/layouts/default.vue`：导航栏改动
- `apps/blog/nuxt.config.ts`：移除 `markdown-it`，无需额外依赖
- `apps/dashboard/src/views/PostEditor.vue`：引入 `@wangeditor/editor-for-vue`
- 新增依赖：`@wangeditor/editor`、`@wangeditor/editor-for-vue`（dashboard）；`cheerio` 或 Web 标准 DOMParser（api，用于 TOC 提取）
