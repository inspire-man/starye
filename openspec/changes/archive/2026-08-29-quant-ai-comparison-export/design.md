# 设计

## Formatter

新增 `buildResearchComparisonMarkdown` 与 `buildResearchComparisonFilename`。formatter 接收一个 `QuantResearchComparison`，按固定顺序输出元数据、概览、共同点、关键差异、风险、下一步核对、引用证据和口径说明，只读取类型中允许的字段；不遍历或序列化未知对象字段。

## 页面状态

`App.vue` 增加对比结果导出/复制的独立状态：

- 成功态结果内部显示导出和复制按钮。
- AI 重新生成时沿用既有加载态，导出/复制不显示；结果存在但正在加载时不允许使用旧结果操作。
- 导出使用 Markdown Blob、临时 anchor 和已有日期文件名 builder。
- 复制复用 `copyResearchReportMarkdown`，区分 copied、unavailable 和 failed。
- 对比结果 ref 变化时同步清理 transfer message，并递增复制 request id；候选切换、关闭抽屉、重算和错误重试均不会留下旧反馈。

## 布局与可访问性

操作使用带 `Download`/`Copy` 图标的可见文本按钮、`aria-label` 和 `title`。成功/失败反馈使用 `role="status"`，剪贴板错误使用危险样式。桌面端操作与模型元数据同一结果头部排列，窄屏端切换为单列并允许按钮占满可用宽度；长 AI 文案使用 `overflow-wrap: anywhere`。

## 验证

1. formatter 测试确认完整字段、稳定顺序、空数组和额外字段隔离。
2. Quant type-check、全量测试、lint、build 和 OpenSpec strict 通过。
3. Gateway 页面确认已有对比助手空/加载/错误状态未受影响，并在可用成功结果 fixture 下检查导出/复制控件和 390px 无横向溢出。
