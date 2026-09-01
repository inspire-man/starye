## Why

Quant 已能校验 AI 是否覆盖全部有权重因子，但用户仍难以看出确定性分数由哪些因子构成，以及 AI 复核究竟以多大权重影响最终判断。只有把两条链路并排展示，才能在使用推荐时快速区分原始模型、AI 复核和数据缺口。

## What Changes

- 服务端根据研究报告快照和已保存的 AI 因子复核计算可审计的因子影响摘要。
- 每个因子展示确定性分数贡献、配置权重、AI 复核立场、复核置信度和实际计入的 AI 权重。
- 汇总展示 AI 已复核权重以及支持、注意、反对的加权分布。
- AI 影响摘要不允许改写确定性因子分数、确定性推荐或价格区间；历史摘要缺少该字段时由服务端重新计算。

## Capabilities

### New Capabilities

- `quant-ai-factor-impact`: 因子确定性贡献与 AI 加权影响审计。

### Modified Capabilities

- 无。

## Impact

- `apps/api/src/domain/quant/ai-summary.ts`：计算因子影响摘要并复用现有 AI 接受规则。
- `apps/api/src/routes/quant/index.ts`：在研究摘要响应中返回服务端计算的影响摘要。
- `apps/quant-app/src/lib/quant-types.ts`、`api-client.ts`：解析可选的新响应字段并兼容历史摘要。
- `apps/quant-app/src/components/QuantAiResearchSummary.vue`：展示因子贡献与 AI 加权影响。
- API/Quant 测试；不涉及 D1 schema 或外部依赖。

## Risk

- 修改共享研究摘要类型会影响多个 Quant 消费者，因此字段保持可选，并以旧响应兼容为验收条件。
- 影响摘要是服务端从已保存事实重新计算的审计视图，不把 AI 自报的权重或分数当作事实。
