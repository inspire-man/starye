## ADDED Requirements

### Requirement: Historical comparison summary

候选对比抽屉 MUST 对每个选中标的独立读取已有日线并展示历史时机回看摘要。摘要 MUST 包含有效日线数、非重叠截点数、当前状态、全体上涨比例、当前状态样本数、样本等级、状态上涨比例和相对全体 lift。

#### Scenario: Compare target stocks

- **WHEN** 用户选中 `600089.SH` 与 `601899.SH` 并打开候选对比
- **THEN** 对比表在各自列中展示两只股票独立的历史回看数据，不合并样本或生成排名

#### Scenario: Insufficient history

- **WHEN** 某个候选少于 80 根有效日线
- **THEN** 该候选历史回看显示数据不足，其他候选仍可正常显示

#### Scenario: Small state sample

- **WHEN** 当前状态样本少于 6 个
- **THEN** 该列显示样本不足，保留真实样本数和结果，不显示准确率结论

### Requirement: Comparison request lifecycle

比较抽屉 MUST 在每次打开时建立新的请求 generation。关闭抽屉或重新打开新的候选集合后，旧 generation 的日线结果 MUST 被忽略，不得写入当前比较范围。

#### Scenario: Stale daily response

- **WHEN** 第一组候选的日线请求尚未完成，用户关闭抽屉并打开第二组候选
- **THEN** 第一组响应到达后不改变第二组比较表的日线摘要

### Requirement: Independent research semantics

历史比较摘要 MUST 只作为研究事实展示，不得改变候选排序、价值质量、研究动作、AI 结果、决策就绪度或买卖判断。缺失来源和加载状态 MUST 保持可见，不得以零值补齐。

#### Scenario: Research semantics remain independent

- **WHEN** 历史摘要显示某个状态相对全体基准更高或更低
- **THEN** 候选排序、研究动作和其他研究结论保持原值，比较表只展示该历史事实
