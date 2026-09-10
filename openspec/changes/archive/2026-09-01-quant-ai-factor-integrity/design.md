## 设计概览

复用现有 `QuantResearchReport.factorModel` 和 `QuantAiSummary.factorReviews`，不引入新的持久化实体。摘要请求的因子对象增加证据归属字段；服务端在计算 AI 决策接受状态时只统计权重大于 0、状态为 ready、至少引用一条 pass/caution evidence 且置信度合格的因子复核。

## 接受规则

- 因子总权重按报告快照计算，避免使用当前用户配置替换历史报告配置。
- `factorReviewCoverage` 使用已接受因子的权重占比，只有达到 100% 才能让 AI 决策进入 accepted。
- 没有因子模型的历史报告继续支持普通摘要；带有因子模型但缺少复核字段的摘要可读取，结构化 AI 决策标记为复核不完整。
- 确定性报告和价格区间不受 AI 复核失败或拒绝影响。

## 界面

`QuantAiResearchSummary` 以报告中的有权重因子为主列表，合并 AI 返回的复核。每行同时显示确定性状态、权重、证据/缺口和 AI 状态；缺少 AI 复核时保留摘要内容和确定性结论。

## 验证

补充摘要事实包字段、遗漏因子拒绝、缺失证据不计入、决策助手覆盖门槛和组件缺口展示测试；运行 API/Quant 全量测试、类型检查、lint、构建及 OpenSpec strict。
