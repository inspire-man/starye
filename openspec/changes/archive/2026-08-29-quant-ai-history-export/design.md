# 设计：历史 AI 候选会话导出

## 数据与序列化

在现有 `candidate-briefing-export.ts` 中抽取简报正文 section builder，保持现有当前简报导出输出不变，并新增：

- `buildCandidateAiSessionMarkdown(session)`：按照固定顺序输出会话 ID、快照 ID、快照时间、日期范围、scopeKey、provider/model、候选代码、历史简报和历史追问。
- `buildCandidateAiSessionFilename(session)`：从 `snapshotGeneratedAt`、`updatedAt`、`createdAt` 依次选择日期，并把会话 ID 归一化为文件名安全片段。

历史简报复用现有字段序列化逻辑；历史追问只输出版本、问题、回答、生成时间和引用候选代码。未知运行时字段不会被枚举输出。

## 组件交互

`QuantAiCandidateBriefing` 继续拥有选中的历史会话，因此导出和复制动作在组件内直接消费 `selectedHistorySession`。这避免向 `App.vue` 暴露历史详情对象，也不改变现有 `focusCandidate`、删除和当前简报导出事件。

- 详情标题旁放置两个原生按钮：导出和复制。
- 导出使用 Blob 与临时 anchor，完成后释放 object URL。
- 复制复用 `copyResearchReportMarkdown` 的三态结果，并使用 request id 防止切换会话后的旧结果覆盖当前状态。
- 当前会话详情关闭、切换、删除或 scope 重置时，清理复制状态。

## 状态与边界

- 无选中历史会话时不显示操作按钮。
- 复制中禁用复制按钮，导出中禁用导出按钮。
- `navigator.clipboard` 缺失显示“当前浏览器不支持剪贴板写入”；写入 reject 显示失败并允许再次点击。
- 没有历史简报或追问时分别输出明确的空状态，不丢失会话元数据。
- 操作区、问题回答和引用代码使用现有换行 hook，在 390px 宽度下不产生横向溢出。

## 验证

- 导出 builder 单测覆盖完整会话、空内容、非法日期和 allowlist。
- 组件单测覆盖导出按钮、复制成功/不支持/失败状态和选中会话竞态。
- 运行 Quant 测试、type-check、lint、build、OpenSpec strict 验证和 Gateway 桌面/390px 检查。
