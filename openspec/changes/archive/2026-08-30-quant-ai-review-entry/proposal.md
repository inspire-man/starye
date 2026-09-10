# Quant 决策卡 AI 复核入口

## 背景

研究详情的 AI 摘要区域位于证据列表之后，用户看到“尚未进行 AI 决策复核”时还需要继续寻找按钮。尤其是已经存在的历史研究报告，不会经过新报告自动复核流程，AI 对最终推荐的作用仍不明显。

## 目标

- 在简化决策卡的 AI 状态行提供直接的“让 AI 复核”入口。
- 入口 MUST 复用现有 `generateResearchSummary` 调用、持久化和证据校验流程。
- 复核进行中禁用重复点击，并让成功/失败状态继续由现有摘要区域展示。
- 已有摘要但缺少结构化 `decisionReview` 时同样能从决策卡重新触发复核。

## 非目标

- 不新增 API、数据库表或 AI 响应格式。
- 不在决策卡内重复实现 AI prompt、响应解析或 accepted 判定。
- 不在点击入口时自动提交用户问题、修改因子权重或改变价格区间。

## 影响

- `apps/quant-app/src/components/QuantDecisionRecommendation.vue`：增加 AI 复核按钮和进行中状态。
- `apps/quant-app/src/App.vue`：把现有摘要生成函数作为事件处理器传入推荐卡。
- 组件测试与 OpenSpec：覆盖无摘要、旧摘要、生成中、点击事件和窄屏布局。

## 风险

- 重复点击可能产生重复 AI 请求；按钮在加载/生成期间保持 disabled，父级仍使用 request id 防竞态。
- 用户可能把入口理解为 AI 直接作出买卖决定；入口文案和现有“证据复核”语义保持一致，最终推荐仍遵循 accepted 规则。

## 可验证约束

决策卡 SHALL 只发出 `requestAiReview` 事件，不直接访问 API；父组件收到事件后 SHALL 复用现有研究摘要生成函数。
