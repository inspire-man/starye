## Why

当前 `value-quality-v1` 已经把估值、盈利质量、增长和趋势放进同一个研究评分，但资产负债表韧性仍停留在知识库的“部分接通”状态。对于中长线价值投资，利息覆盖、现金比率、带息负债率和经营现金流连续性决定公司能否熬过周期，现有 Eastmoney 财务响应已经具备这些字段，适合在当前数据边界内继续完善。

## What Changes

- 将价值质量公式升级为 `value-quality-v2`，增加“资产负债表韧性”维度，并把趋势权重降为辅助项。
- 在增长维度加入跨报告的经营现金流连续性，避免单期利润增长掩盖现金流反复。
- 根据利息覆盖、现金比率、带息负债率和现金流连续性增加可解释的风险扣分；缺失数据继续保留为缺失，不用零值填充。
- 将知识库中的“逆境韧性”因子标记为已进入价值质量评分，并同步 API client、工作台公式说明和测试。

## Capabilities

### New Capabilities

- `quant-resilience-factors`：描述价值质量 v2 的韧性因子、评分权重、缺失语义和风险扣分规则。

### Modified Capabilities

- 无。

## Impact

- API Quant domain：`value-quality` 公式、结果维度和风险提示；不新增数据库表、不新增上游接口。
- Quant client/workbench：识别 `resilience` 维度并展示新的权重和公式版本。
- Investment knowledge：同步字段接通状态和当前评分维度。
- 验证：覆盖公式边界、空值、风险阈值、client parser、API 集成响应和 Quant 构建。
