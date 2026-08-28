## 设计

批量导出是当前批次状态的本地投影。`buildResearchBatchMarkdown` 接收成功的 `QuantResearchRun[]` 和失败股票代码，先生成批次摘要，再逐项调用 `buildResearchReportMarkdown`，因此单报告和批量报告共享同一字段白名单与缺失值语义。

### 状态边界

页面从 `comparisonResearchStates` 派生成功运行和失败代码。只有成功数量大于零、且 `pending` 与 `running` 数量都为零时，导出按钮可执行；批次运行期间按钮保持禁用或隐藏。重新启动批次、重试失败项或重新打开对比抽屉时清空上次导出提示。

### 文件生成

导出动作在 Vue 组件中创建 Markdown Blob、对象 URL 和临时 anchor，文件名由成功运行中第一份可用报告日期生成。下载内容不经 API，也不写入 D1；部分失败信息只包含数量和股票代码，不包含错误对象原文。

### 布局与可访问性

批次操作区复用现有 `primary-button`、`secondary-button` 和 `Download` 图标。导出按钮使用可见文本和 `aria-label`，状态反馈使用 `role="status"`。窄屏时批量研究与批量导出操作垂直排列，长状态文本允许换行。

### 回滚

回滚时移除批量 formatter、导出按钮和状态样式；单报告下载、复制、研究运行历史及批次查看/重试流程保持原样。
