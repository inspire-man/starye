## 设计

批量复制是当前批量 Markdown 下载的第二个本地出口。页面已经持有成功的 `QuantResearchRun` 和失败代码列表，因此复制只读取当前内存状态，不扩展 API、D1 或研究 runner。

### 内容边界

复用 `buildResearchBatchMarkdown(runs, failedTsCodes)` 生成剪贴板 payload。这样下载和复制共享报告字段白名单、去重、顺序和失败摘要，不维护两份内容拼装逻辑。`copyResearchReportMarkdown` 继续负责可注入的 `writeText` 边界，并将不支持、成功、失败转换为确定结果。

### 页面状态

批量复制使用独立于下载的 `copying/outcome/message` 状态。按钮只在批次满足现有 `comparisonResearchExportReady` 条件时可执行；点击期间禁用，成功或失败后恢复可操作。重新开始批量研究、重试失败项目或重新打开对比抽屉时清空旧复制反馈，并通过 request id 忽略过期 Promise 的结果。

### 布局与可访问性

复制按钮复用现有 `secondary-button` 和 `Copy` 图标，提供可见文本、`title` 和 `aria-label`。复制状态使用 `role="status"`；窄屏时批量操作区的按钮占满可用宽度并纵向排列，保留全局 `:focus-visible` 样式。

### 回滚

回滚时移除批量复制按钮、状态变量和对应样式；现有批量下载、研究状态和剪贴板适配器不受影响。
