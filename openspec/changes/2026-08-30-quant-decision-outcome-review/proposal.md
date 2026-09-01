# Quant 决策结果回看

## Why

决策记录已经保存了用户当时的行动、价格和研究快照，但当前历史列表只能回看文字，用户仍需要自己比较后续价格变化。增加一个轻量的结果回看层，可以把记录变成可核对的反馈，同时保持“记录价差”和“实际收益”边界清晰。

## What Changes

- 在决策记录下增加结果回看区域，比较“计划买入/已持有”记录与之后的决策记录或最新日线。
- 展示已观察价差、与“已卖出”配对的样本、仍等待后续价格的样本。
- 对无价格、日期无效、同日或逆序数据采用缺失/待观察状态，不生成虚假结果。
- 明确声明结果不包含成交价、数量、费用、分红和税费，不等同实际收益。

## Capabilities

### New Capabilities

- `quant-decision-outcome-review`: 基于已保存决策快照和最新日线的可复核价格观察。

### Modified Capabilities

- 无。

## Impact

- `apps/quant-app/src/lib/decision-outcome.ts`：新增纯函数，排序记录并计算后续价格变化。
- `apps/quant-app/src/components/QuantDecisionOutcome.vue`：新增结果回看展示和响应式状态。
- `apps/quant-app/src/components/QuantDecisionJournal.vue`、`apps/quant-app/src/App.vue`：传递最新日线并挂载结果区域。
- 不新增 API、D1 表或实际交易语义；风险集中在时间排序、重复样本和窄屏展示。

## 可验证约束

结果回看 MUST 只使用用户可见的决策记录快照和最新日线；任何价差 MUST 标记为价格观察，不得标记为实际收益或收益承诺。
