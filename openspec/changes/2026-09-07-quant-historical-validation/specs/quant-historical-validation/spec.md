## ADDED Requirements

### Requirement: Historical data coverage

Quant 日线同步 MUST 默认覆盖约 730 个自然日，并在单只股票上最多保留 520 根有效日线。日线读取接口和支持历史 K 线的 provider MUST 接受不超过 520 的读取上限；超出上限 MUST 被限制在 520 内，不得返回超出范围的数据。

#### Scenario: Refresh historical coverage

- **WHEN** 用户通过已有 Quant 日线更新动作刷新观察池
- **THEN** 系统请求包含约两年的历史范围，并将返回的日线按交易日写入既有共享日线事实

#### Scenario: Provider returns more rows

- **WHEN** provider 返回超过 520 根日期范围内的日线
- **THEN** 同步层只保留最近 520 根，且不删除数据库中其他股票的日线

### Requirement: Non-overlapping timing replay

历史时机回看 MUST 每隔 20 个有效交易日取一个截点。截点状态 MUST 只读取截点之前的最多 60 根有效收盘价，未来 20 根有效收盘价只能用于结果计算；有效未来窗口之间 MUST 不重叠。

#### Scenario: Complete long sample

- **WHEN** 股票有 520 根有效日线
- **THEN** 系统返回多个非重叠历史截点，并为每个截点记录状态和未来 20 日收益

#### Scenario: No look-ahead

- **WHEN** 只改变某个截点之后的收盘价
- **THEN** 该截点的状态保持不变，只有受影响的未来收益结果变化

### Requirement: Baseline and uncertainty

历史回看 MUST 计算全体有效截点的上涨比例、平均收益和中位数收益作为基准。每个状态 MUST 计算相对全体基准的上涨比例差和收益差，并提供方向比例的 Wilson 95% 区间。没有样本的状态字段 MUST 保持 `null`。

#### Scenario: Compare state against baseline

- **WHEN** 至少有两个状态包含有效样本
- **THEN** 用户可以区分某状态结果与全体样本基准的差异，而不是只看到单独的上涨比例

#### Scenario: Small sample

- **WHEN** 某状态样本少于 6 个
- **THEN** 页面标记样本不足，不显示可据此判断的结论

### Requirement: Explainable presentation

详情页 MUST 展示数据范围、有效日线数、非重叠采样口径、全体基准、当前状态样本等级和四状态对照。页面 MUST 明确历史结果不代表预测准确率、未来收益或买卖指令。

#### Scenario: Validate target stocks

- **WHEN** 用户打开 `600089.SH` 或 `601899.SH` 的详情
- **THEN** 页面展示已保存旧日线的历史回看结果，并能看到样本量、基准差值和数据范围
