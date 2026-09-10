## Purpose

把本地日线中的均线偏离、阶段回撤和波动率整理为可复核的中长线时机窗口，降低初学者理解多项技术证据的成本。

## ADDED Requirements

### Requirement: Timing window formula

系统 MUST 基于按交易日排序的本地日线计算以下字段：最新收盘价相对最近 20 根收盘最高价的回撤、最新收盘价相对最近 20 根收盘均值的 MA20 偏离、最新收盘价相对最近 60 根收盘均值的 MA60 偏离，以及最近 20 个收盘收益的总体标准差。对应历史窗口不足或价格分母无效时，字段 MUST 保持 `null`。

#### Scenario: Complete timing sample

- **WHEN** 股票有至少 60 根有效收盘价
- **THEN** 系统返回 20 日回撤、MA20 偏离、MA60 偏离和 20 日波动率，并使用最新收盘价作为计算终点

#### Scenario: Incomplete timing sample

- **WHEN** 股票只有 20 根有效收盘价
- **THEN** 系统保留 MA20 偏离和 20 日回撤，MA60 偏离与 20 日波动率返回 `null`，状态保持数据不足或仅展示可用证据

### Requirement: Explainable state classification

系统 MUST 按固定优先级返回时机窗口状态：历史不足时为数据不足；MA20 偏离不高于 -3%、MA60 偏离不高于 -5% 或 60 日回撤不高于 -15% 时为趋势走弱；MA20 偏离不低于 8% 或近 5 日收益不低于 5% 且距 20 日高点回撤小于 2% 时为短线偏热；20 日高点回撤不高于 -3%、MA20 偏离不低于 -2% 且 MA60 偏离不低于 0% 时为回撤观察；其余可比较样本为结构平稳。

#### Scenario: Pullback observation

- **WHEN** 价格较 20 日高点回撤至少 3%，仍在 MA20 附近且位于 MA60 之上
- **THEN** 状态为回撤观察，并提示核对回撤原因与基本面变化

#### Scenario: Extended short-term move

- **WHEN** 价格高于 MA20 至少 8%，或近 5 日上涨至少 5% 且接近 20 日高点
- **THEN** 状态为短线偏热，并提示观察波动收敛，不把短期强势当作长期价值结论

#### Scenario: Weak structure

- **WHEN** 价格明显低于 MA20/MA60，或 60 日回撤达到 -15%
- **THEN** 状态为趋势走弱，并提示重新核对基本面和数据时点

### Requirement: Evidence presentation

详情抽屉 MUST 展示时机状态、四项计算字段的可用值、阈值和来源口径；缺失字段 MUST 标记为数据不足。页面 MUST 明确该窗口只描述当前单只股票的本地日线结构，状态用于研究排序与复查，不构成买入或卖出指令。

#### Scenario: Review a timing window

- **WHEN** 用户打开一只股票的分析详情
- **THEN** 用户能在同一面板看到结构状态、回撤、均线偏离、波动率和对应阈值证据
