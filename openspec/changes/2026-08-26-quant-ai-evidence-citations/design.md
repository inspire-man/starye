## Context

PR #17 已将 AkShare 因子纳入研究报告并按维度展示；`QuantAiResearchSummary` 已通过 `citedEvidenceKeys` 将摘要与当前报告关联，但引用目前只显示标签。此次只增强现有 Vue 组件，不扩展 API、D1 或 bridge contract。

## Goals / Non-Goals

**Goals:**

- 复用当前 `QuantResearchReport` 的 evidence 对象作为唯一 citation source。
- 在摘要面板顶部显示确定性结论，在下方显示引用证据详情。
- 用组件内的小型格式化函数处理百分比、倍数、样本数和缺失值，并保持与研究报告行一致。

**Non-Goals:**

- 不让前端重新计算因子，不从 AI 文本中解析数值。
- 不修改摘要接口、数据库结构或模型验证规则。

## Decisions

### 1. Citation 由 key 映射到 report evidence

组件继续以 `Map(report.evidence)` 查找引用。找到时直接读取报告的 `value`、`status`、`threshold`、`source`、`observedAt` 和 `formulaVersion`；找不到时渲染独立的 unavailable 行。

### 2. 结论与解释分层

使用紧凑的 deterministic strip 展示“状态 / 研究动作 / 分数”，AI overview 和支持点/留意项继续作为解释内容。这样摘要生成失败时，报告边界仍然完整。

### 3. 保持一套数值格式

沿用研究报告的 key 语义：样本显示“根/期”，成交量比显示“倍”，连续天数显示“天”，趋势/质量/股息和 AkShare 指标显示百分比，其他估值显示普通数值。缺失始终显示 `--`。

### 4. 移动端改为两层布局

桌面保留 label/value 的紧凑双列，来源和口径作为 metadata；移动端把 metadata 放到下一行，来源长文本使用省略或换行边界，避免影响数值读取。

## Risks / Trade-offs

- [历史 key 不存在] -> 显示 key 和“当前报告未找到”，不填充值。
- [组件信息增加] -> 仅在已有摘要面板内部增加层次，使用紧凑间距和可扫描字段。
- [格式化规则重复] -> 保持 key 规则与 App.vue 对齐，并用组件测试覆盖关键样本。

## Migration Plan

1. 仅部署 Quant Pages 静态资源，不需要 API 或 D1 migration。
2. 旧摘要 JSON 按现有 parser 读取；未知 key 使用新的缺失 citation 状态。
3. 通过 Gateway 打开分析详情，验证成功、空、错误和窄屏布局。
