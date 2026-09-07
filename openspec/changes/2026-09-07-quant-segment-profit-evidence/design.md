## Context

本 change 延续 `2026-09-07-quant-segment-operating-evidence` 的可选 `businessSegments` 结构。真实 `601899.SH` 的 `zygcfx` 行已证明 Eastmoney/AkShare 同时返回 `MAIN_BUSINESS_COST`、`MBC_RATIO`、`MAIN_BUSINESS_RPOFIT` 和 `MBR_RATIO`，但这些列可能为空。实现需跨 API、Python bridge、Quant parser/UI 和研究报告保持同一 nullable 口径。

## Goals / Non-Goals

**Goals:**

- 以 `cost`、`costRatio`、`profit`、`profitRatio` 扩展现有分部 row，保持旧 row 可读。
- 真实保留 Eastmoney/AkShare 原始字段和 source/error provenance。
- 让研究报告与详情页分别表达成本、利润的可用性，且保留订单/量价缺口。

**Non-Goals:**

- 不从收入、比例或成本推导毛利率、销量、实现价格或订单金额。
- 不修改 D1 schema、价值质量评分、candidate signal、recommendation、decision 或 outcome 逻辑。
- 不接入没有稳定结构化字段的订单、销量、实现价格来源。

## Decisions

1. **扩展现有 segment row 而不是新建第二个 endpoint contract。** 成本和利润与收入处于同一 `zygcfx` 行，放在同一 row 能保持证券、报告期、分类和名称的一致性；旧 payload 省略新属性即可兼容。
2. **四个数值字段独立 nullable。** Eastmoney 和 bridge 使用现有有限数值 helper；空字符串、NaN、Infinity 和非法值转换为 `null`，不做交叉字段推导。
3. **继续使用 optional research evidence。** 每个 segment 增加 cost/profit 独立 evidence key，沿用现有 `operating-driver-segment-*` 命名；evidence 只用于审计和研究上下文。
4. **详情表增加原始列并保持移动端可扫描。** 复用现有横向滚动容器和固定 grid track，所有缺失列显示 `--`，来源错误单独显示，不用 0 占位。

## Risks / Trade-offs

- [HIGH] `QuantFinancialQualitySnapshot` 被多个 Quant domain 和 route handler 依赖 -> 新字段保持 optional，并运行 API/Quant 全量测试与 type-check。
- [Risk] 不同报告分部列的空值率不同 -> 每列单独展示状态，测试混合值，不把行整体标成完整。
- [Risk] 研究报告 evidence 数量增加 -> 使用 optional 标记和独立 key，验证评分、候选和决策快照输出不变。

## Migration Plan

1. 先更新 API/bridge/parser/UI 契约和回归 fixture，再接入研究 evidence。
2. 用真实 `601899.SH` 同报告期样本验证四列的原始值或 `null`。
3. 合并后通过 Gateway、CI 和 Quant deployment 验证；无 D1 migration，回滚为恢复上一提交即可。
