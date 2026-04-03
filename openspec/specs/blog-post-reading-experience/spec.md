## ADDED Requirements

### Requirement: 服务端 TOC 提取

`getPostBySlug` service MUST 在返回文章数据时，通过 HTMLRewriter 解析 `content` 字段（HTML），提取所有 `h2`、`h3` 标题，生成 `toc` 数组随文章数据一同返回。

`toc` 数组结构：
```typescript
type TocItem = { id: string; text: string; level: 2 | 3 }
```

其中 `id` 由标题文字 slugify 生成（转小写、空格替换为 `-`、移除非字母数字字符），并同步注入回 HTML 的标题标签（`<h2 id="heading-id">`），使 Blog 前端 TOC 锚点可正常跳转。

#### Scenario: 文章含 h2/h3 标题时返回 TOC
- **WHEN** 客户端请求 `GET /api/posts/:slug`，该文章 HTML content 含有 `<h2>` 和 `<h3>` 标签
- **THEN** 响应 `data.toc` SHALL 为非空数组，每项包含正确的 `id`、`text`、`level`

#### Scenario: 文章无标题时 TOC 为空数组
- **WHEN** 文章 HTML content 不含任何 `<h2>`/`<h3>` 标签
- **THEN** 响应 `data.toc` SHALL 为 `[]`

#### Scenario: TOC id 注入回 HTML
- **WHEN** 文章含有 `<h2>快速开始</h2>`
- **THEN** 响应 `data.content` 中对应标签 SHALL 变为 `<h2 id="快速开始">快速开始</h2>`（或等价 slugified id）

---

### Requirement: 文章详情页展示侧边 TOC

Blog 客户端文章详情页（`[slug].vue`）MUST 在 `md:` 断点以上宽度展示右侧固定（sticky）TOC 导航栏，展示来自 API 的 `toc` 数组。

#### Scenario: 宽屏下展示 TOC
- **WHEN** 用户在宽度 ≥ 768px 的屏幕上访问含 TOC 的文章
- **THEN** 右侧 SHALL 出现 sticky TOC，列出所有 h2/h3 标题，点击标题锚点平滑滚动至对应章节

#### Scenario: 移动端隐藏 TOC
- **WHEN** 用户在宽度 < 768px 的屏幕上访问文章
- **THEN** TOC 侧边栏 SHALL 不显示（`hidden md:block`）

#### Scenario: 无 TOC 内容时不渲染 TOC 区域
- **WHEN** 文章 `toc` 数组为空
- **THEN** TOC 区域 SHALL 不渲染，文章内容占据全部宽度

---

### Requirement: 文章详情页展示阅读时间与字数

Blog 客户端文章详情页 MUST 在文章 header 区域展示预估阅读时间与字数统计。

计算规则：
- 字数 = HTML content strip 标签后的纯文本字符数
- 阅读时间 = `Math.ceil(字数 / 400)` 分钟（中文阅读速度约 400 字/分钟）
- 计算 SHALL 在客户端完成（无需 API 支持）

#### Scenario: 正常文章展示阅读时间
- **WHEN** 用户访问一篇 1200 字的文章
- **THEN** 页面 SHALL 显示「约 3 分钟阅读」及「1200 字」

---

### Requirement: 文章详情页展示上/下篇导航

Blog 客户端文章详情页 MUST 在文章底部展示上一篇与下一篇链接。

`GET /api/posts/:slug/adjacent` 接口返回：
```typescript
interface AdjacentPosts {
  prev: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
}
```

导航逻辑（由 API 实现）：
- 若文章属于某系列（`series` 非 null）：按 `seriesOrder` 查询同系列上/下篇
- 若文章不属于任何系列：按全局 `createdAt` 时序查询相邻文章（仅已发布）

#### Scenario: 系列中间篇展示上下篇
- **WHEN** 用户访问系列第 3 篇文章
- **THEN** 底部 SHALL 同时展示「上一篇」（第 2 篇）和「下一篇」（第 4 篇）的标题与链接

#### Scenario: 系列首篇不展示上一篇
- **WHEN** 用户访问系列第 1 篇文章
- **THEN** 底部 `prev` SHALL 为 null，不渲染上一篇链接

#### Scenario: 非系列文章按时序导航
- **WHEN** 用户访问一篇无系列归属的独立文章
- **THEN** 底部 SHALL 展示按 `createdAt` 时序排列的相邻文章链接

---

### Requirement: Blog 前端兼容 Markdown 与 HTML 双格式内容

Blog 客户端 MUST 根据 API 返回的 `contentFormat` 字段决定渲染方式：
- `contentFormat === 'html'`（或未来新文章默认值）：直接 `v-html` 渲染
- `contentFormat === 'markdown'` 或 `null`（存量文章）：使用 `markdown-it` 渲染后 `v-html`

#### Scenario: HTML 格式文章直接渲染
- **WHEN** API 返回 `contentFormat: 'html'` 的文章
- **THEN** Blog 前端 SHALL 直接将 `content` 注入 `v-html`，不经过 markdown-it 处理

#### Scenario: Markdown 格式存量文章兼容渲染
- **WHEN** API 返回 `contentFormat: null` 或 `contentFormat: 'markdown'` 的文章
- **THEN** Blog 前端 SHALL 使用 markdown-it 将 `content` 转换后再注入 `v-html`
