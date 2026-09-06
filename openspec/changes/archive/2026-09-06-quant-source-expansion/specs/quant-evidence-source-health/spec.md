## MODIFIED Requirements

### Requirement: 原始字段覆盖必须独立于阈值结果

Quant 因子数据健康 MUST 以适用 evidence 的有限原始 `value` 和来源健康判定字段是否已读取；`pass`、`caution` 和带有限值的 `fail` 都属于已读取字段。价值质量的 `factor.status`、同业可比样本数量、评分状态或阈值结果 MUST NOT 单独把已读取字段降级为 `partial`、`missing` 或 `unavailable`。阈值未通过 MUST 保留为失败证据和研究风险，但 MUST NOT 单独把字段标记为缺失、来源不可用或要求重试。

#### Scenario: 有值但未通过阈值

- **WHEN** 趋势 evidence 返回有限负收益，来源为本地 Quant 日线库，状态为 `fail`
- **THEN** 因子数据健康计入该字段的覆盖数量
- **AND** 页面继续显示失败证据和风险说明
- **AND** 页面不把该字段列为待补数据或来源重试项

#### Scenario: 字段完整但价值质量不可比

- **WHEN** 一个行业因子的所有适用 evidence 都有有限值，但价值质量因子因为同业样本不足而为 `partial`
- **THEN** 因子数据健康将该因子标记为字段完整
- **AND** 页面单独保留价值质量的不可比或样本不足说明
- **AND** 页面不为已返回字段提供补数据动作

#### Scenario: 没有原始值

- **WHEN** evidence 缺失、状态为 `missing` 或 `value` 为 `null`
- **THEN** 字段进入待补 evidence key
- **AND** 只有仍有其他可用字段时因子标记为 `partial`，全部缺失时标记为 `missing`
