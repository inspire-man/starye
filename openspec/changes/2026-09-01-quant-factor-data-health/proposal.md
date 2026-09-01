## Why

候选页和研究详情已经能显示价值质量、因子分数与“证据不可用”，但用户仍需要展开多个区域才能知道具体缺少哪些原始字段、数据来自哪个 provider、最近观察时间是什么，以及当前来源是否发生回退。缺口不够具体时，用户容易把“暂无数据”误解为低分或把回退数据当成主来源。

## What Changes

- 新增只读的因子数据健康派生模型，按正权重因子汇总 evidence key、原始状态、来源、观察时间和缺失字段。
- 将“字段完整性”和“来源回退/来源不可用”分开显示，保留 `ready`、`partial`、`missing`、`unavailable` 语义。
- 在简化推荐区域增加因子数据健康区，展示可用权重、逐项因子状态、证据计数、缺口和下一步补齐动作。
- 保持现有因子分数、权重、确定性推荐、AI 复核和价格区间不变；历史报告缺少可选字段时按缺口展示。

## Capabilities

### New Capabilities

- `quant-factor-data-health`：研究详情中的因子原始数据覆盖与来源健康解释。

### Modified Capabilities

- 无。

## Impact

- `apps/quant-app/src/lib/quant-factor-data-health.ts`：新增版本化纯函数和数据健康类型。
- `apps/quant-app/src/components/QuantDecisionRecommendation.vue`：增加因子数据健康摘要和逐项补齐指引。
- 测试：覆盖完整、部分、缺失、来源回退、来源不可用和 390px 长字段换行。

## Non-goals

- 不新增 API、D1 表、provider 请求、缓存或自动补数任务。
- 不用数据健康状态修改因子分数、因子权重、研究推荐、AI 最终判断或参考价格。
- 不把证据状态推导为收益预测、买卖指令或“数据好坏”的投资结论。

## 可验证约束

因子数据健康 MUST 只使用报告快照中的原始因子和 evidence；缺少或失败字段 MUST 保持缺口状态，来源回退 MUST 单独标记；页面 MUST 展示可核对的来源、观察时间和下一步动作。
