## Purpose

为量化候选补充可复核的时间维度，让用户能区分一次性命中、持续确认和信号减弱，并沿用已保存快照形成轻量证据链。

## ADDED Requirements

### Requirement: Historical signal summary

候选接口 MUST 基于最近有效候选快照，为观察池中的每只股票返回快照样本数、出现次数、出现比例、最新分数、前次可比较分数、相邻分数变化和样本首末分数变化。样本不足时对应数值 MUST 保持 `null`，不得以零代替缺失。

#### Scenario: Repeated candidate signal

- **WHEN** 股票在最近 5 次快照中的 4 次出现，最新分数为 4，前次分数为 3
- **THEN** 接口返回样本数 5、出现次数 4、出现比例 0.8、相邻分数变化 1 和首末分数变化值

#### Scenario: No historical snapshots

- **WHEN** 观察池尚未生成有效快照
- **THEN** 接口返回样本数 0、出现次数 0、出现比例 `null`、分数变化 `null`，并标记历史不足

### Requirement: Signal persistence state

系统 MUST 根据最新快照与紧邻前一快照的候选存在性和分数变化返回稳定状态：最新出现而前次不存在时为首次出现，连续出现且分数未下降时为持续确认，连续出现且分数下降时为信号减弱；最新快照不存在该股票时为不在最新快照；可比较快照少于两次时为历史不足。

#### Scenario: State classification

- **WHEN** 股票连续出现在两次快照且最新分数低于前次分数
- **THEN** 状态为信号减弱，且接口保留负的相邻分数变化

#### Scenario: Newly appearing signal

- **WHEN** 股票出现在最新快照但不在紧邻前一快照
- **THEN** 状态为首次出现，不把更早的历史样本误报为连续确认

### Requirement: Factor persistence and evidence chain

候选接口 MUST 返回固定因子集合在最近快照样本中的出现次数和比例，并返回最近不超过 5 条快照证据；每条证据 MUST 包含快照标识、生成时间、是否出现、分数和当期命中因子。证据链 MUST 使用服务端已保存快照，不能由前端自行推算历史。

#### Scenario: Explain repeated factors

- **WHEN** `ma20` 在最近 5 次快照中 4 次命中
- **THEN** 对应因子证据返回出现次数 4、比例 0.8，详情页能显示该统计

#### Scenario: Pending current stock

- **WHEN** 股票已经在观察池但尚未进入最新快照
- **THEN** 状态为不在最新快照，证据链显示其未出现，页面提示先更新数据

### Requirement: Beginner-readable presentation

候选研究页面 MUST 在表格中展示信号持续状态和出现次数；分析详情抽屉 MUST 展示状态、分数变化、因子持续统计和快照证据链，并明确这些数据只描述当前观察池样本，不代表买入或卖出指令。

#### Scenario: Review candidate persistence

- **WHEN** 用户打开候选研究并选择一只股票的分析详情
- **THEN** 用户能看到“首次出现”“持续确认”“信号减弱”或“历史不足”等状态、样本口径和可追溯快照记录
