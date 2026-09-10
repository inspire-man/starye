## ADDED Requirements

### Requirement: Watchlist timing pool audit
Quant Overview MUST 允许对当前观察池标的运行历史时机样本审计。审计 MUST 复用已有日线读取和单票 `buildTimingHistory`，并按状态分别统计样本不足、区间重叠、相对基准有稳定支持和相对基准偏弱的标的数量。

#### Scenario: Run audit on watchlist
- **WHEN** 观察池有多只已同步日线的标的，用户点击运行审计
- **THEN** 页面展示每只标的的有效日线数、非重叠截点数、当前状态和当前状态区间结论
- **AND** 每个时机状态展示跨标的计数，不合并不同股票的收益率

#### Scenario: Source and sample gaps stay visible
- **WHEN** 某只标的日线请求失败，另一只有效日线少于 80 根
- **THEN** 前者显示来源失败，后者显示数据不足
- **AND** 其他标的仍可完成审计，失败项不得以零值补齐

### Requirement: Thresholds stay frozen
历史时机样本审计 MUST 只作为研究事实。无论某个状态出现跨标的稳定支持、偏弱、方向不一致或样本不足，页面 MUST 提示不调整状态阈值，且不得改变候选排序、价值质量、研究动作、AI 结果、决策就绪度或买卖判断。

#### Scenario: Consensus does not change formulas
- **WHEN** 至少 6 只标的在同一状态上显示相对基准有稳定支持，且没有标的显示相对基准偏弱
- **THEN** 页面仍显示阈值保持不变
- **AND** 现有状态分类规则和决策公式保持原值

### Requirement: Audit request lifecycle
观察池审计 MUST 使用显式运行动作和新的请求 generation。观察池在审计过程中变化后，旧 generation 的日线结果 MUST 被忽略。

#### Scenario: Watchlist changes during audit
- **WHEN** 第一轮审计尚未完成，用户增删观察池标的后再次运行审计
- **THEN** 第一轮响应到达后不覆盖第二轮结果
