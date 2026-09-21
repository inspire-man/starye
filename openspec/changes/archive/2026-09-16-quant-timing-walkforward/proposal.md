# 时机判断时序外核对

留一状态校准仍使用全部历史窗口。本 change 增加 walk-forward：每个截点只用更早样本做方向判断，再用该截点随后 20 日收益核对。样本不足保持 missing。不改 MA/回撤阈值，不写入买卖建议。

## Goals

- 研究报告增加 optional 时序外核对证据。
- 当前状态的时序外方向样本至少 6 才给出 supported/weaker/indeterminate。
- 必选覆盖度、研究动作和确定性推荐不变。

## Non-goals

- 不调整 MA20/MA60/回撤阈值。
- 不改 timing-history-edge 与 timing-history-calibration 的现有规则。
- 不把核对结果写入候选排序或买卖建议。
