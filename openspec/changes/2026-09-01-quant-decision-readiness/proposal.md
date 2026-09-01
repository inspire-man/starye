## Why

研究详情已经同时显示确定性推荐、数据覆盖和 AI 复核，但用户仍需要自己判断这些字段能否支持当前决策。尤其是 AI 尚未复核、只覆盖部分因子或最终复核被拒绝时，页面没有一个直接的“现在能不能参考”结论。

## What Changes

- 增加一个只读的判断就绪度纯函数，汇总报告数据完整性、AI 因子纳入情况、结构化 AI 复核和价格条件。
- 在简化推荐区域展示“可参考 / 仅供参考 / 暂不可用”状态、三项检查和仍需核对的因子。
- 继续保留确定性推荐、AI 最终纳入规则、因子权重和参考价格区间，不用就绪度改写任何结论。
- 对旧摘要缺少 `factorImpact`、无 AI 复核和数据缺口保持明确降级。

## Capabilities

### New Capabilities

- `quant-decision-readiness`：面向用户的确定性数据与 AI 复核就绪度解释。

### Modified Capabilities

- 无。

## Impact

- `apps/quant-app/src/lib/decision-readiness.ts`：新增纯函数和类型。
- `apps/quant-app/src/components/QuantDecisionRecommendation.vue`：展示就绪度状态、检查和未完成因子。
- 测试：新增纯函数和组件回归，覆盖完整、AI 部分覆盖、数据阻断、旧摘要和 390px 文案换行。

## Non-goals

- 不新增 API、D1 字段或 AI 请求，不改变既有研究摘要和决策助手快照。
- 不把就绪度当作买入/卖出指令，不生成目标价或未来收益预测。
- 不改变确定性推荐、AI 最终纳入门槛、因子权重、证据分数或参考价格区间。

## 可验证约束

判断就绪度 MUST 只使用当前报告、已解析的 AI 摘要和已存在的行情值；数据缺口 MUST 输出“暂不可用”，AI 未达到纳入条件 MUST 输出“仅供参考”，只有数据检查和 AI 纳入检查均通过时才输出“可参考”。
