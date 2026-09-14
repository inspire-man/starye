# 时机历史对照校准

timing-history-edge 用全样本基准，当前状态自己的样本也在基准里，容易变成区间重叠。对照校准改为当前状态 vs 其他状态，样本不足保持 missing。不改 MA/回撤阈值，不写入买卖建议。

## Goals

- 研究报告增加 optional 时机校准证据。
- 当前状态和其他状态样本都至少 6 才给出 supported/weaker/indeterminate。
- 必选覆盖度、研究动作和确定性推荐不变。

## Non-goals

- 不调整 MA20/MA60/回撤阈值。
- 不把校准结果写入候选排序或买卖建议。
- 不改现有 timing-history-edge 的全样本规则。
