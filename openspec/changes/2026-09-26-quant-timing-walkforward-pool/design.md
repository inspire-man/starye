# 设计

## 公式

- `walkForwardTimingCalibration` 按锚点日期排序后，只累计目标状态自己的更早截点。
- 更早样本少于 6，或上涨比例 Wilson 95% 区间覆盖 50%，不形成方向判断。
- 区间完全高于 50% 记为上涨判断，完全低于 50% 记为下跌判断。随后收益严格同向才算一致；收益为 0 不算一致。
- 方向样本至少 6 后，再用一致率的 Wilson 区间对照 50%。证据保持 optional，公式版本为 `timing-history-walkforward-v2`。
- 客户端保留一份相同实现，供尚未写入报告的日线直接计算。不新增共享包。

## 观察池与详情

- 每只已评估标的按四个状态分别计算时序外结果。样本内 `consensus` 仍只看当前桶的区间结论。
- 来源失败和数据不足不补零，也不进入时序外计数。
- 状态卡和标的行并列展示时序外事实。详情页只展示当前状态。
- `thresholdAdvice` 继续固定为 `hold-thresholds`。

## 验证

- API timing-history 与 research-report 定向测试。
- Quant timing-history、timing-history-pool、详情和观察池组件测试。
- API 与 Quant 的定向 type-check 不单列；跟随上述 vitest。
