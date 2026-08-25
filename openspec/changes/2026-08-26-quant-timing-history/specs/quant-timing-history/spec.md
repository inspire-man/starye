## Purpose

把当前时机状态放回同一只股票的本地历史日线中复核，帮助用户理解状态对应的历史结果边界。

## ADDED Requirements

### Requirement: Historical timing replay

系统 MUST 按交易日排序并使用有效收盘价重放历史时机状态。每个截点 MUST 至少拥有 60 根截点前的有效收盘价和 20 根截点后的有效收盘价；分类状态只能读取截点及之前的数据，未来 20 根收盘价只能用于计算结果，不得影响状态。

#### Scenario: Complete local sample

- **WHEN** 股票有 120 根有效日线
- **THEN** 系统至少返回一组可回看的历史截点，并为每个截点记录状态和未来 20 个有效交易日收益

#### Scenario: Insufficient local sample

- **WHEN** 股票少于 80 根有效日线
- **THEN** 系统返回数据不足，不生成任何状态收益统计

### Requirement: State outcome aggregation

系统 MUST 按结构平稳、回撤观察、短线偏热和趋势走弱分别聚合样本数、未来 20 日上涨比例、平均收益、中位数收益、最好收益和最差收益。没有样本的状态字段 MUST 保持 `null`，不得用零填充。

#### Scenario: Compare state evidence

- **WHEN** 历史截点包含多个可比较状态
- **THEN** 用户能看到当前状态对应的样本数、上涨比例、平均收益和中位数收益，并能识别最好/最差结果范围

#### Scenario: No look-ahead

- **WHEN** 只改变截点之后的价格
- **THEN** 该截点的状态不改变，但未来收益统计可以改变

### Requirement: Explainable presentation

详情抽屉 MUST 展示历史回看使用的有效日线范围、可回看截点数、当前状态和状态桶统计。页面 MUST 明确该结果是当前股票的本地历史样本，不代表未来收益或买卖指令。

#### Scenario: Review historical evidence

- **WHEN** 用户打开已有日线的股票详情
- **THEN** 用户能在时机窗口附近看到当前状态的历史样本结果和其他状态的紧凑对照
