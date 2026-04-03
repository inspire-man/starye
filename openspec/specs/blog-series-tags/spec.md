## ADDED Requirements

### Requirement: posts 表支持系列与标签字段

`posts` 表 MUST 新增以下字段以支持内容组织能力：
- `tags`：`text (mode: 'json')`，存储 `string[]`，默认 `null`
- `series`：`text`，系列标识符（kebab-case，如 `ts-fullstack-ai-chronicle`），默认 `null`
- `series_order`：`integer`，文章在系列中的排序序号（从 1 开始），默认 `null`
- `content_format`：`text DEFAULT 'html'`，内容格式标识（`'html'` | `'markdown'`），用于兼容存量数据

#### Scenario: 新建带系列信息的文章
- **WHEN** 管理员通过 `POST /api/posts` 提交包含 `{ series: "ts-fullstack-ai-chronicle", seriesOrder: 1, tags: ["cloudflare", "typescript"] }` 的请求
- **THEN** 数据库中该文章记录 SHALL 包含正确的 series、seriesOrder、tags 字段值

#### Scenario: 不指定系列时文章可正常创建
- **WHEN** 管理员通过 `POST /api/posts` 提交不含 series 相关字段的请求
- **THEN** 文章 SHALL 成功创建，series、seriesOrder、tags 均为 null

---

### Requirement: 文章列表 API 支持系列与标签过滤

`GET /api/posts` MUST 支持以下可选查询参数：
- `series`：按系列标识符精确过滤（`WHERE series = :series`）
- `tag`：按单个标签包含过滤（`JSON_EACH` 展开后匹配）
- `q`：按标题与摘要的模糊搜索（`LIKE %q%`）

同一请求中多个过滤参数 SHALL 以 AND 逻辑组合。

#### Scenario: 按系列过滤文章
- **WHEN** 客户端请求 `GET /api/posts?series=ts-fullstack-ai-chronicle`
- **THEN** 响应 data 数组 SHALL 仅包含 `series = 'ts-fullstack-ai-chronicle'` 的文章，且按 `seriesOrder` 升序排列

#### Scenario: 按标签过滤文章
- **WHEN** 客户端请求 `GET /api/posts?tag=cloudflare`
- **THEN** 响应 data 数组 SHALL 仅包含 `tags` JSON 数组中包含 `"cloudflare"` 的文章

#### Scenario: 关键词搜索文章
- **WHEN** 客户端请求 `GET /api/posts?q=爬虫`
- **THEN** 响应 data 数组 SHALL 包含标题或摘要中含有「爬虫」的已发布文章

#### Scenario: 无匹配结果时返回空数组
- **WHEN** 过滤条件无匹配文章
- **THEN** 响应 SHALL 为 `{ data: [], meta: { total: 0, ... } }`，HTTP 状态码为 200

---

### Requirement: 文章列表页展示系列与标签筛选器

Blog 客户端首页（`apps/blog/app/pages/index.vue`）MUST 在文章网格上方展示筛选区域：
- 显示当前所有已发布文章涉及的**系列 chip 列表**（点击激活/取消过滤）
- 显示常用**标签 chip 列表**（点击激活/取消过滤）
- 激活态 chip 样式与非激活态有明显视觉区分

#### Scenario: 点击系列 chip 过滤文章
- **WHEN** 用户点击「TypeScript 全栈 AI 实录」系列 chip
- **THEN** 文章列表 SHALL 仅展示该系列文章，URL 查询参数更新为 `?series=ts-fullstack-ai-chronicle`

#### Scenario: 再次点击同一 chip 取消过滤
- **WHEN** 用户再次点击已激活的系列 chip
- **THEN** 过滤 SHALL 取消，文章列表恢复展示所有已发布文章

---

### Requirement: 系列聚合页

Blog 客户端 MUST 提供 `/series/:name` 路由，展示指定系列下所有已发布文章。

#### Scenario: 访问系列聚合页
- **WHEN** 用户访问 `/series/ts-fullstack-ai-chronicle`
- **THEN** 页面 SHALL 按 `seriesOrder` 升序展示该系列所有已发布文章，并显示系列名称与文章总数

#### Scenario: 访问不存在的系列
- **WHEN** 用户访问 `/series/nonexistent-series`
- **THEN** 页面 SHALL 展示「暂无文章」提示，HTTP 状态码为 200（不应 404）

---

### Requirement: 标签聚合页

Blog 客户端 MUST 提供 `/tags/:tag` 路由，展示包含指定标签的所有已发布文章。

#### Scenario: 访问标签聚合页
- **WHEN** 用户访问 `/tags/cloudflare`
- **THEN** 页面 SHALL 展示所有 tags 包含 `cloudflare` 的已发布文章，并显示标签名与文章数量
