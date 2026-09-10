## 方案

### Formatter

- 新增 `buildCandidateAiBriefingMarkdown(briefing, candidateCount)`，只读取已解析的候选简报字段和候选数量。
- 输出固定分节：简报元数据、整体概览、重点候选、下一步核对、引用候选代码和口径说明。
- 使用明确字段白名单、空值语义和稳定日期文件名 `quant-candidate-briefing-YYYY-MM-DD.md`；未知属性不参与序列化。

### Quant 页面

- 简报成功态在标题操作区显示 `导出 Markdown` 和 `复制 Markdown`。
- 导出通过 `Blob`、`URL.createObjectURL` 和临时下载链接完成，不调用 API。
- 复制复用 `copyResearchReportMarkdown`，显示复制中、成功、剪贴板不可用和写入失败状态；候选刷新时清空状态。
- 操作按钮使用现有 Lucide 图标、`focus-visible` 样式和 390px 窄屏布局。

### 验证

- formatter 测试验证完整、空值、换行和敏感字段边界。
- 组件测试验证成功态显示操作、事件、复制中禁用和复制结果消息。
- 运行 Quant test/type-check/build、OpenSpec strict、GitNexus detect_changes、`git diff --check`，并经 Gateway 检查成功态和 idle 态无控制台错误。
