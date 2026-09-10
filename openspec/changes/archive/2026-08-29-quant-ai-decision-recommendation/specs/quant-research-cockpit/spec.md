## MODIFIED Requirements

### Requirement: Candidate decision card

候选决策卡在已有信号覆盖与数据状态之上，MUST 优先展示最新研究报告的简化推荐、数据覆盖度、参考买入区间和卖出区间；AI 复核存在时 MUST 同时标注其来源和置信度。报告不存在或数据不足时，卡片 MUST 显示观望/待补数据状态，不得生成价格。

#### Scenario: Report-backed recommendation

- **WHEN** 用户打开已有研究报告的股票详情
- **THEN** 卡片显示看多、看空或观望、参考价格区间和 AI/确定性来源
- **AND** 用户仍可进入报告证据区域查看因子来源和权重

#### Scenario: Candidate with complete data

- **WHEN** 用户打开最新候选中的股票
- **THEN** 决策卡显示该股票的命中规则、`return20`、数据质量和可核对的技术/估值/财务提示
- **AND** 决策卡不把信号分描述为收益概率或直接交易指令

#### Scenario: Stock outside the latest candidate snapshot

- **WHEN** 用户从观察池打开一只不在最新候选快照中的股票
- **THEN** 抽屉显示“当前快照未覆盖”状态
- **AND** 仍可继续查看日线、估值和财务数据

#### Scenario: No report or incomplete report

- **WHEN** 当前股票还没有研究报告，或报告缺少关键因子
- **THEN** 卡片显示“先生成报告”或“观望 / 数据待补”
- **AND** 买入价与卖出价显示暂无参考区间

#### Scenario: Narrow layout

- **WHEN** 视口宽度为 390px
- **THEN** 推荐标签、两个价格区间、覆盖度和复核状态纵向或网格换行展示，文本不溢出或重叠
