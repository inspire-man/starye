## Context

`apps/blog` 目前是一个 Nuxt 4 应用，具备基础的文章列表与详情页，使用 `markdown-it` 将 DB 中存储的 Markdown 文本渲染为 HTML。后台编辑器（`apps/dashboard/PostEditor.vue`）为纯 textarea，无预览能力。`packages/db` 的 `posts` 表仅有最基础字段，不支持标签/系列概念。

本次变更跨越 4 层（db / api / blog / dashboard），引入外部编辑器依赖（wangEditor v5），并涉及内容格式从 Markdown 到 HTML 的迁移，需要提前明确技术决策。

## Goals / Non-Goals

**Goals:**
- 博客支持「系列」与「标签」体系，读者可按系列/标签筛选文章
- 文章详情页提供良好的阅读体验（TOC、阅读时间、上下篇导航）
- Dashboard 编辑器升级为 wangEditor v5 富文本所见即所得
- 为「TypeScript 全栈项目 AI 实录」系列文章提供完整的发布能力

**Non-Goals:**
- 评论系统
- 文章全文搜索（Orama 索引化，留作后续）
- RSS Feed 生成
- 多作者权限分级

## Decisions

### 决策 1：内容格式从 Markdown 切换到 HTML

**选择**：DB `content` 字段改存 wangEditor 输出的 HTML；新增 `contentFormat text DEFAULT 'html'` 字段区分存量数据。

**理由**：wangEditor v5 原生输出 HTML，无官方 Markdown 模式。若强行在服务端将 HTML 转回 Markdown 再存储，会引入额外的转换复杂度和信息损失。存量文章极少，迁移成本可接受。

**替代方案**：引入 `@wangeditor/plugin-md`（Markdown 源码模式）。评估后发现该插件为纯 Markdown textarea 增强，与现有方案相比无明显优势，且 wangEditor 的核心价值在于 WYSIWYG，放弃反而失去意义。

**存量兼容**：Blog 前端根据 `contentFormat` 字段决定渲染逻辑——`'html'` 直接 `v-html`，`'markdown'` 走 `markdown-it`（保留依赖至所有文章迁移完成后再移除）。

---

### 决策 2：TOC 在服务端提取（方案 B）

**选择**：`getPostBySlug` service 在返回文章数据时，使用 **HTMLRewriter**（Cloudflare Workers 原生 API）解析 `content` HTML，提取 `h2`/`h3` 标签，生成 `toc: { id: string, text: string, level: 2|3 }[]` 数组随文章数据一同下发。

**理由**：
- Cloudflare Workers 环境无 Node.js DOM 模块，但 HTMLRewriter 是原生支持的高性能流式 HTML 解析 API，无需额外依赖。
- TOC 数据在 Nuxt SSR 阶段可用，SEO 友好（侧边目录在服务端渲染完成）。
- 避免在客户端 `onMounted` 时 DOM 查询，减少 hydration 时序问题。

**替代方案**：客户端 JS 解析 DOM（`querySelectorAll('h2, h3')`）。缺点：SSR 无 TOC，初次渲染侧边栏为空，体验割裂。

**实现要点**：HTMLRewriter 为流式 API，需在 service 中包装为 `Promise<TocItem[]>` 供同步调用链使用。标题 `id` 由标题文字 slugify 生成（`text.toLowerCase().replace(/\s+/g, '-')`），同时注入回 HTML（`<h2 id="xxx">`），Blog 前端通过锚点 `href="#xxx"` 实现 TOC 跳转。

---

### 决策 3：`tags` 与 `series` 使用 JSON 字段而非关联表

**选择**：`tags text (mode: 'json')` 存储 `string[]`，`series text`、`seriesOrder integer` 直接挂在 `posts` 表上。

**理由**：与项目中 `comics.genres` 的处理方式完全一致，避免 JOIN 开销，D1 免费额度友好。个人博客标签总量有限，不需要独立标签表的规范化能力。

---

### 决策 4：wangEditor 图片上传对接 `/api/upload`

**选择**：在 Dashboard `PostEditor.vue` 中配置 wangEditor 的 `uploadImage` 自定义插入逻辑：上传时调用 `/api/upload`（已有接口，返回 R2 CDN URL），将 URL 注入编辑器。

**实现要点**：wangEditor 支持 `customUpload` 回调，可拦截文件选择事件，调用自有上传接口后再调用 `insertFn(url, alt, href)` 注入图片。

---

### 决策 5：`seriesOrder` 字段用于上/下篇导航

`GET /posts/:slug/adjacent` 接口通过以下逻辑实现：
1. 查询当前文章的 `series` 与 `seriesOrder`。
2. 在同 `series` 中查询 `seriesOrder = current - 1`（上一篇）与 `seriesOrder = current + 1`（下一篇）。
3. 若无 `series` 归属，则按全局 `createdAt` 时序查询上下篇。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| HTMLRewriter 流式 API 与 Drizzle 同步查询链集成复杂 | 封装独立 `extractToc(html: string): Promise<TocItem[]>` 工具函数，单元测试覆盖 |
| wangEditor 输出的 HTML 样式与 Tailwind Typography prose 不完全兼容 | 通过 `prose` 全局 CSS 覆盖补丁修复，验收时逐类标签检查 |
| 存量 Markdown 文章 `contentFormat` 为 null/undefined 时判断分支丢失 | Blog 前端防御性处理：`!contentFormat || contentFormat === 'markdown'` 均走 markdown-it 路径 |
| wangEditor `@wangeditor/editor-for-vue` 在 Vite SSR 场景的 hydration 问题 | Dashboard 为纯 SPA（Vite，无 SSR），无此风险 |
| D1 `tags` JSON 字段的过滤查询无法使用索引 | 个人博客数据量极小（<1000 篇），全表扫描可接受；若未来增量，可改为 SQLite FTS5 |

## Migration Plan

1. **packages/db**：修改 schema，生成 migration SQL（`pnpm --filter db generate`）
2. **本地验证**：`pnpm --filter api dev`，确认 D1 local migration 正确应用
3. **存量文章处理**：现有文章 `contentFormat` 默认为 `null`，Blog 前端兼容逻辑直接处理，无需数据迁移脚本
4. **生产部署顺序**：先 `d1 migrations apply --remote`，后部署 API Worker，最后部署 Blog（Cloudflare Pages）
5. **回滚**：所有字段均为 nullable 或有默认值，回滚旧代码不会破坏存量数据

## Open Questions

- `tags` 过滤是否需要精确匹配（`tags = '["cloudflare"]'`）还是包含匹配（`JSON_EACH` + `LIKE`）？当前倾向后者，但 D1 对 `json_each` 的支持需要验证。
- wangEditor 代码块是否使用 highlight.js 的语言自动检测，或由作者手动选择语言？当前倾向手动选择（wangEditor 内置语言选择菜单）。
