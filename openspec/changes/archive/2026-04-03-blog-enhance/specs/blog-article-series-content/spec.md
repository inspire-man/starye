## ADDED Requirements

### Requirement: 「TypeScript 全栈项目 AI 实录」系列文章发布

功能框架完成后，MUST 通过 Dashboard 编辑器逐篇创作并发布「TypeScript 全栈项目 AI 实录」系列文章，每篇文章 SHALL 包含真实代码示例、根因分析与可复用的经验总结。

系列 slug：`ts-fullstack-ai-chronicle`

初始发布批次（#00～#05），素材来源为 `DEVLOG.md`：

| seriesOrder | 文章标题 | 核心主题 |
|-------------|----------|----------|
| 0 | 用 AI 辅助构建个人技术全栈：项目启动日志 | 架构决策、技术选型 |
| 1 | Cloudflare D1 迁移的隐藏陷阱：代码部署≠数据库变更 | D1 migrations apply |
| 2 | 拒绝 Puppeteer 黑盒：如何编写可测试的爬虫代码 | HappyDOM、Vitest、纯函数解析 |
| 3 | R18 鉴权三角难题：Session、Cookie 与 Nuxt SSR | better-auth、credentials、SSR cookie 转发 |
| 4 | Monorepo i18n 架构：一个翻译包服务所有应用 | @starye/locales、vue-i18n、@nuxtjs/i18n |
| 5 | Cloudflare Workers 互调陷阱：Host 头的隐藏坑 | Gateway、fetch、Host header |

持续更新批次（#06+），来源为已完成的 `openspec/specs/` 功能：

| seriesOrder | 文章标题 | 对应 spec |
|-------------|----------|-----------|
| 6 | Hono RPC：端到端类型推导的正确姿势 | hono-rpc-typing |
| 7 | Cloudflare Workers 测试基础设施建设 | api-testing-infrastructure |
| 8 | 自动生成 OpenAPI 文档：Hono 的最佳实践 | openapi-generation |

#### Scenario: 系列文章在 Blog 系列聚合页完整展示
- **WHEN** 用户访问 `/series/ts-fullstack-ai-chronicle`
- **THEN** 页面 SHALL 按 seriesOrder 升序展示所有已发布文章，最终达到 6 篇初始文章

#### Scenario: 每篇文章包含系列导航
- **WHEN** 用户阅读系列第 2 篇文章
- **THEN** 文章底部 SHALL 展示「上一篇：D1 迁移踩坑」和「下一篇：R18 鉴权三角难题」的导航链接

---

### Requirement: 文章内容质量标准

每篇系列文章 MUST 满足以下内容标准：
- 字数不少于 1500 字
- 包含至少 2 个代码示例（wangEditor 代码块，指定语言）
- 包含「背景」「问题现象」「根因分析」「解决方案」「经验总结」等逻辑结构（作为 h2 标题）
- 经验总结部分 SHALL 提供可直接复用的 checklist 或最佳实践列表

#### Scenario: 文章结构符合标准
- **WHEN** 一篇系列文章通过 Dashboard 发布
- **THEN** 文章 TOC SHALL 包含「背景」「根因分析」「解决方案」「经验总结」等标题，读者可通过侧边 TOC 快速导航

---

### Requirement: 文章标签与系列元数据完整

每篇系列文章发布时 MUST 正确填写以下元数据：
- `series: 'ts-fullstack-ai-chronicle'`
- `seriesOrder`：对应序号
- `tags`：至少包含 2 个相关技术标签（如 `["cloudflare", "d1", "drizzle"]`）
- `coverImage`：可选，若提供则为与文章主题相关的技术图片 URL
- `excerpt`：不超过 120 字的文章摘要

#### Scenario: 文章列表页展示完整卡片信息
- **WHEN** 系列文章发布后，用户访问 Blog 首页
- **THEN** 对应 PostCard SHALL 展示标题、摘要、作者、发布时间，若有 coverImage 则显示封面图
