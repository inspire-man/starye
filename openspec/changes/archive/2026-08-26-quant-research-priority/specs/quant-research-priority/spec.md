# Quant 研究优先级

## ADDED Requirements

### Requirement: Explainable priority result

系统 MUST 根据候选项、研究标记、复查日期和可用价值质量结果，返回优先级等级、0-100 优先级分、下一步研究动作、触发原因和分项依据。

优先级计算 MUST 只使用当前候选已经存在的字段。价值质量映射未加载时，系统 MUST 跳过价值质量项，而不是把未加载解释为低分。

#### Scenario: Data gap comes first

- **WHEN** 股票尚未完成日线同步或候选质量不是 `ready`
- **THEN** 研究动作显示为“补齐数据”，优先级为最高等级，并说明缺失字段或尚未同步

#### Scenario: Review due is actionable

- **WHEN** 股票已设置逾期或今日复查日期，且没有数据缺口
- **THEN** 研究动作显示为“优先复查”，原因包含复查状态，排序优先于普通观察

#### Scenario: Value quality is not loaded

- **WHEN** 价值质量结果尚未返回
- **THEN** 候选仍可按技术、风险和复查信息排序，原因不得声称价值质量低

### Requirement: Risk and persistence evidence

系统 MUST 将短线回撤、连续上涨和异常放量作为风险核对依据；候选信号持续性为“信号减弱”时 MUST 增加风险原因，持续确认或首次出现时 MUST 保留对应解释。

#### Scenario: Risk check outranks ordinary research

- **WHEN** 股票数据完整但触发至少一个短线风险条件
- **THEN** 研究动作显示为“核对风险”，排序优先于普通“继续研究”

#### Scenario: Weakening persistence is visible

- **WHEN** 候选最新快照仍有信号但相邻分数下降
- **THEN** 优先级原因包含“信号减弱”，并保留相邻分数变化作为解释证据

### Requirement: User marker semantics

系统 MUST 保留“重点关注”“暂缓”“已排除”研究标记的语义。重点关注在同一行动层级内提升排序，暂缓和已排除降低排序；标记调整不得掩盖待补数据。

#### Scenario: Priority marker is a tie-breaker

- **WHEN** 两只股票拥有相同的数据、复查和风险行动
- **THEN** “重点关注”股票排在未标记股票前，并显示该标记为排序依据

### Requirement: Beginner-readable queue

候选研究页 MUST 显示队列统计，包括最高优先级、待补数据、待复查和风险核对数量；表格 MUST 显示动作、优先级或可读原因。

页面 MUST 说明优先级是研究顺序，不是买卖指令；该说明可通过信息图标 tooltip 提供，不在首页重复占据主要内容。

#### Scenario: Empty and incomplete states

- **WHEN** 没有候选或全部候选数据不足
- **THEN** 页面显示可操作的空状态或补数据动作，不显示伪造的分数和结论
