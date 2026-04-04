## ADDED Requirements

### Requirement: 代码高亮
Blog 文章详情页中的代码块 MUST 支持语法高亮，使用 Shiki 引擎。高亮 MUST 在 SSR 阶段完成（避免客户端闪烁）SHALL。

#### Scenario: 含代码块的文章正确高亮
- **WHEN** 用户访问包含 TypeScript 代码块的文章详情页
- **THEN** 代码块以带颜色主题的语法高亮渲染，页面加载时无未高亮 → 高亮的闪烁

#### Scenario: 多语言代码块
- **WHEN** 文章中包含 TypeScript、CSS、Shell 等多种语言的代码块
- **THEN** 每种语言 MUST 使用正确的语法高亮规则

### Requirement: 代码块复制按钮
每个代码块右上角 MUST 显示复制按钮。点击后 MUST 将代码内容复制到剪贴板并显示"已复制"反馈 SHALL。

#### Scenario: 复制代码到剪贴板
- **WHEN** 用户点击代码块右上角的复制按钮
- **THEN** 代码文本被复制到系统剪贴板，按钮显示"已复制"状态约 2 秒后恢复

### Requirement: 搜索功能
Blog MUST 提供文章搜索功能，支持按标题和内容全文搜索 SHALL。

#### Scenario: 关键词搜索
- **WHEN** 用户在搜索框输入关键词并提交
- **THEN** 展示匹配的文章列表（标题或内容包含关键词），支持高亮匹配片段

#### Scenario: 无结果提示
- **WHEN** 搜索关键词无匹配结果
- **THEN** 显示"未找到相关文章"提示

### Requirement: 归档页
Blog MUST 提供 `/archive` 页面，按时间线展示所有已发布文章 SHALL。

#### Scenario: 时间线展示
- **WHEN** 用户访问 `/archive`
- **THEN** 文章按年月分组，每组内按发布日期降序排列，显示标题、日期和标签

### Requirement: RSS Feed
Blog MUST 提供 `/feed.xml` 路由，输出标准 RSS 2.0 XML SHALL。

#### Scenario: RSS 订阅
- **WHEN** RSS 阅读器请求 `/feed.xml`
- **THEN** 返回有效的 RSS 2.0 XML，包含最近 20 篇文章的标题、链接、摘要和发布日期

### Requirement: 阅读进度条
文章详情页 MUST 在页面顶部显示阅读进度条，随滚动位置实时更新 SHALL。

#### Scenario: 滚动进度可视化
- **WHEN** 用户在文章详情页向下滚动
- **THEN** 页面顶部固定的进度条宽度从 0% 增长到 100%，反映当前阅读位置

### Requirement: SEO Open Graph 完善
所有 Blog 页面 MUST 设置完整的 Open Graph 和 Twitter Card meta 标签 SHALL。

#### Scenario: 文章分享预览
- **WHEN** 用户将文章链接分享到 Twitter 或其他社交平台
- **THEN** 平台展示文章标题、摘要和封面图（如有）作为卡片预览
