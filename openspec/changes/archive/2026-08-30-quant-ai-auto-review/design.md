# 设计

## 请求流程

1. `generateResearchReport` 成功创建新报告后调用 `loadResearchSummary(run.id, { autoGenerate: true })`。
2. `loadResearchSummary` 先调用 `getResearchSummaries`；存在摘要时直接结束，保持历史和重试幂等性。
3. 没有摘要时读取 `getAiConfig`，通过纯函数判断模型和凭据是否可用。
4. 配置可用则切换到生成状态并调用现有 `generateResearchSummary`；未配置则结束为无摘要状态。
5. 每一步都复用 `researchSummaryRequestId`，股票切换或新请求开始后，过期响应不得写回当前详情。

## 状态边界

- `researchSummaryLoading`：读取已保存摘要或读取配置。
- `researchSummaryGenerating`：自动或手动调用 AI 生成接口。
- `researchSummaryError`：AI 配置读取或上游生成失败；不清空确定性报告。
- 已保存摘要优先级高于自动触发；自动范围只由新报告生成调用方显式打开。

## 复用与验证

`isQuantAiAutoReviewReady` 作为无副作用纯函数放在 Quant lib 中，避免把 provider 判断复制到页面组件，并用 Vitest 覆盖 null、空模型、普通 provider 无 key、普通 provider 有 key 和 Ollama 无 key。摘要组件测试覆盖生成中与无摘要文案。完整 Quant 测试、类型检查、构建、OpenSpec strict 和 Gateway/browser 回归作为交付门槛。
