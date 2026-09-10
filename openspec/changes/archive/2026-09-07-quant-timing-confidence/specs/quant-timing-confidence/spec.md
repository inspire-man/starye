## ADDED Requirements

### Requirement: Baseline interval assessment

历史时机回看 MUST 对每个状态比较状态上涨比例 Wilson 95% 区间与全体基准 Wilson 95% 区间，并输出区间结论。状态样本少于 6 个 MUST 输出样本不足；状态区间与基准区间重叠 MUST 输出区间重叠；只有状态区间完全高于或低于基准区间时，才输出相对基准有稳定支持或相对基准偏弱。

#### Scenario: Insufficient state sample

- **WHEN** 当前状态样本少于 6 个
- **THEN** 页面显示样本不足，不生成方向性区间结论

#### Scenario: Overlapping intervals

- **WHEN** 当前状态与全体基准的 Wilson 95% 区间存在重叠
- **THEN** 页面显示区间重叠，保留真实上涨比例和 lift

#### Scenario: Separated intervals

- **WHEN** 当前状态 Wilson 95% 区间完全高于或完全低于全体基准区间
- **THEN** 页面显示对应的稳定支持或相对偏弱结论

### Requirement: Independent research semantics

可信度结论 MUST 只影响历史研究事实展示，不得改变状态阈值、候选排序、价值质量、研究动作、AI 结果、决策就绪度或买卖判断。不同股票的区间 MUST 独立计算，不得合并样本。

#### Scenario: Keep research semantics independent

- **WHEN** 某个状态显示相对基准有稳定支持或相对基准偏弱
- **THEN** 候选排序、研究动作和其他研究结论保持原值，页面只增加历史区间事实
