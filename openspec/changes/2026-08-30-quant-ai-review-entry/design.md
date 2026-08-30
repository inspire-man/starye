# 设计

## 事件桥接

`QuantDecisionRecommendation.vue` 新增 `requestAiReview` emit 和可选 `aiReviewGenerating` prop。组件只负责根据 `summary?.summary.decisionReview` 判断当前是否已有结构化复核，并在无复核时发出事件。

`App.vue` 将已有 `generateResearchSummary` 作为 `@request-ai-review` handler，同时把 `researchSummaryGenerating || researchSummaryLoading` 传入。调用仍使用 `latestResearchRun`、`researchSummaryRequestId` 和现有 API client，因此历史摘要解析、D1 持久化和 AI accepted 规则保持单一入口。

## 状态呈现

- 无结构化复核且未进行：显示“尚未进行 AI 决策复核”和“让 AI 复核”。
- 复核进行中：显示“AI 复核中”，按钮 disabled。
- 有结构化复核：保留现有推荐、置信度和 accepted 文案。

不新增一个独立的错误状态；AI 摘要组件继续承担配置/上游错误信息，决策卡保持确定性推荐可用。

## 验证

组件测试覆盖 emit、button disabled、AI accepted 展示和旧摘要无 decisionReview。通过 Quant 全量测试、type-check、build、Lint、OpenSpec strict、Gateway 页面及 390px 浏览器检查。
