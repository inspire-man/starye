## Purpose

为 Quant 研究报告提供一套来源透明、权重明确、缺失数据可见的简化决策投影，并让 AI 基于已保存报告参与最终推荐复核。

## ADDED Requirements

### Requirement: Report exposes factor provenance and weights

每份新生成的 Quant 研究报告 MUST 返回版本化的因子模型。模型 MUST 为每个因子提供稳定 key、显示名称、权重、获取渠道、有效状态和关联 evidence key；所有权重 MUST 为有限非负数，且总权重为 1。

#### Scenario: Complete factor model

- **WHEN** 用户生成一份研究报告
- **THEN** 报告返回趋势、估值、盈利质量、股东回报和风险因子及其来源、权重和证据引用
- **AND** 报告明确股息率来自实施分红记录与本地最新收盘价，而不是用默认零值代替

#### Scenario: Missing factor input

- **WHEN** 某个因子所需字段或来源请求失败
- **THEN** 该因子状态为 `missing` 或 `unavailable`，覆盖度下降，并列出缺失字段或来源错误
- **AND** 因子模型不使用猜测值、上一快照值或零值补齐

### Requirement: Deterministic recommendation projection

研究报告 MUST 返回 `bullish`、`bearish` 或 `watch` 之一的确定性推荐、数据覆盖度、置信度（数据不足时为 `null`）、失效条件和证据 key。覆盖度低于 80% 或关键因子缺失时 MUST 推荐 `watch`，不得给出参考价格区间。

#### Scenario: Evidence supports a bullish projection

- **WHEN** 关键因子有效、覆盖度至少 80%、正向因子得分达到看多门槛且风险因子未触发否决
- **THEN** 报告返回 `bullish` 和有限置信度
- **AND** 报告仍标记为研究参考，不表述为收益保证

#### Scenario: Evidence supports a bearish projection

- **WHEN** 关键因子有效、覆盖度至少 80% 且风险或基本面负向证据达到看空门槛
- **THEN** 报告返回 `bearish` 和有限置信度

#### Scenario: Insufficient evidence

- **WHEN** 股息率、趋势窗口、估值或财务等关键因子缺失，或覆盖度低于 80%
- **THEN** 报告返回 `watch`，置信度为 `null`
- **AND** 买入区间和卖出区间均为 `null`

### Requirement: Reference price ranges are traceable

当确定性推荐不是 `watch` 且日线窗口足够时，报告 MUST 返回参考买入区间和卖出区间。每个区间 MUST 包含有限的 `low`、`high`、币种单位、公式版本、来源、观察时间和 evidence key；区间仅由已保存日线/报告数据计算，不得由 AI 生成。

#### Scenario: Price ranges with a valid trend window

- **WHEN** 最新收盘价、MA20 和至少 60 根有效日线均存在，且推荐为 `bullish` 或 `bearish`
- **THEN** API 返回 `low <= high` 的参考买入区间和卖出区间，并标明公式与本地日线来源

#### Scenario: Price range data unavailable

- **WHEN** 最新收盘价、MA20 或 60 日窗口缺失
- **THEN** 两个价格区间均为 `null`
- **AND** 推荐卡显示数据待补，而不是显示 `0` 或沿用上一价格

### Requirement: AI decision review is evidence-grounded

现有研究摘要生成 MUST 同时返回结构化 AI 决策复核，包括推荐、0-100 置信度、简短理由、失效条件和 evidence key。服务端 MUST 只接受当前报告中的 evidence key；AI 不得输出或覆盖参考价格。

#### Scenario: Valid AI review changes the final recommendation

- **WHEN** AI 返回合法推荐、置信度至少 60 且引用至少一个当前报告 evidence key
- **THEN** 摘要响应标记 AI 复核有效，最终推荐使用 AI 推荐，并保留确定性推荐供比较

#### Scenario: Invalid or low-confidence AI review

- **WHEN** AI 返回未知 evidence key、非法推荐、越界置信度或置信度低于 60
- **THEN** 服务端返回结构化 AI 错误，或将复核标记为不可用
- **AND** 页面继续使用确定性推荐，不改变报告和价格区间

#### Scenario: Historical summary without a decision review

- **WHEN** 读取旧版 `research-summary-v1` 摘要
- **THEN** API 保留原摘要内容并将 AI 决策复核标记为空
- **AND** 新生成摘要使用新版本字段，不回写历史研究报告

### Requirement: Simplified recommendation presentation

Quant 分析详情 MUST 在报告证据展开前突出显示看多、看空或观望、确定性/AI 来源、数据覆盖度和参考买入/卖出区间。缺失区间显示“暂无参考区间”；用户仍 MUST 能展开查看因子来源、权重、原始证据和失效条件。

#### Scenario: Recommendation card on desktop and mobile

- **WHEN** 用户在桌面或 390px 宽度查看已生成报告
- **THEN** 推荐卡的结论、区间、覆盖度和 AI 复核状态均可读且不发生横向溢出
- **AND** 因子明细不挤占首屏结论
