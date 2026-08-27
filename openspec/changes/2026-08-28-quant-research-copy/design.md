## 设计

复制是当前已生成 Markdown 的另一个本地出口。报告内容继续由 `buildResearchReportMarkdown` 统一生成，复制和下载不会各自维护字段白名单，避免两种出口出现内容漂移。

### 剪贴板边界

`copyResearchReportMarkdown` 接受 Markdown 字符串和一个可注入的 `writeText` 实现，返回成功或失败结果。Vue 组件只负责读取 `navigator.clipboard`、传入当前报告 Markdown 和展示状态；没有可用剪贴板时直接返回失败，不引入隐藏的旧式写入 fallback。

### 页面状态

报告操作区新增复制按钮。按钮只在 `latestResearchReport` 存在时渲染；点击期间按钮禁用并显示进行中状态，Promise 成功后显示短暂成功提示，失败后显示失败提示并恢复可重试状态。复制不改变 `researchRuns`、`researchAiSummary` 或任何服务端数据。

### 布局与可访问性

复制按钮复用现有 `secondary-button` 和 `Copy` 图标，保留可见文本、`title` 与 `aria-label`。操作区允许在窄屏换行，状态提示使用 `role="status"`，不把结果塞进固定宽度按钮。

### 回滚

回滚时移除复制按钮、剪贴板适配器和状态样式；已有 Markdown 下载和服务端研究历史不受影响。
