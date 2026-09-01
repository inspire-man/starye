## Why

Quant 已经按五个因子计算确定性评分，但 AI 摘要事实包没有完整携带因子与 evidence key 的映射，且摘要解析允许省略 `factorReviews` 后继续评估 AI 决策。这会让用户看到“AI 已复核”，却无法确认每个因子是否有数据支撑。

## What Changes

- 将每个因子的 evidence key、缺失 evidence key、来源和状态加入摘要 AI 的事实包。
- 要求 AI 决策复核覆盖全部有权重因子，并引用对应因子的可用证据；覆盖不足时保留确定性推荐。
- 统一摘要 AI 与今日决策助手的因子覆盖门槛，避免 AI 在因子复核不完整时改变最终动作。
- 在研究摘要界面逐项展示因子状态、权重、证据覆盖、缺口和 AI 纳入状态。
- 保留已有研究报告、AI 摘要和决策快照格式，不新增数据库表。

## Capabilities

### New Capabilities

- `quant-ai-factor-integrity`: 因子证据映射、AI 复核覆盖闸门和界面可见性。

### Modified Capabilities

- 无。

## Impact

- `apps/api/src/domain/quant/ai-summary.ts`：摘要事实包和 AI 决策复核接受规则。
- `apps/api/src/domain/quant/decision-assistant.ts`：今日决策助手的因子覆盖接受规则。
- `apps/quant-app/src/components/QuantAiResearchSummary.vue`：因子完整性和 AI 纳入状态展示。
- API/Quant 单元测试和组件测试；不涉及 D1 schema 或外部依赖。

## Risk

- 更严格的覆盖门槛会让部分历史或数据不足报告保持确定性结论，AI 仍可提供解释但不会改变最终动作。
- 旧摘要可能缺少因子复核字段；解析需要继续读取并明确标记为未完成，而不是误判为已接受。
