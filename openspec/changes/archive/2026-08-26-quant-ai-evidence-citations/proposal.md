## Why

当前 AI 研究摘要已经保存了引用的 evidence key，但 Quant 抽屉只显示证据名称标签，用户还要回到上方长列表才能找到具体数值、阈值和来源。对金融初学者而言，“AI 为什么这样解释”仍缺少就地可核验的证据落点。

## What Changes

- 在 AI 摘要面板中明确展示确定性报告的状态、研究动作和分数，说明 AI 解释不改变这些权威结论。
- 将引用证据从标签升级为可读的证据行，展示数值、状态、阈值、来源、观测日期和公式版本。
- 对历史摘要引用的未知 key 保留可见的缺失状态，避免前端静默丢弃引用；当前报告中不存在的 key 不显示虚构数值。
- 在窄屏布局中保持引用信息可读，避免来源和长阈值挤压数值列。

## Capabilities

### New Capabilities

- `quant-ai-evidence-citations`: 在 AI 解释旁就地呈现确定性结论与逐条证据引用。

### Modified Capabilities

## Impact

- `apps/quant-app/src/components/QuantAiResearchSummary.vue`：扩展摘要和引用证据展示。
- `apps/quant-app/src/lib/quant-types.ts`：复用已有报告和摘要类型，不改变 API 字段。
- `apps/quant-app/src/lib/__test__/api-client.test.ts` 或新增组件测试：覆盖引用证据解析和未知 key 状态。
- 不涉及 API、D1、bridge 或 AI provider contract；历史摘要响应保持兼容。

## Goals / Non-Goals

**Goals:**

- 用户在阅读 AI 摘要时可以直接核对引用证据的值、门槛、来源和日期。
- 状态、动作和分数始终来自确定性报告，AI 只作为解释层。
- 旧摘要和新报告均有诚实的空、缺失和错误展示。

**Non-Goals:**

- 不改变 AI 生成 prompt、摘要 JSON schema、研究评分或动作规则。
- 不把引用证据转换为买入、卖出、目标价或收益预测建议。

## Risks

- 引用 key 在历史报告与当前报告之间不一致；通过“引用未在当前报告中找到”状态显式提示。
- 来源名称或阈值较长导致布局挤压；使用响应式堆叠和稳定的数值区域。
- 摘要引用过多降低扫描效率；沿用服务端引用数量上限，并保持紧凑证据行。
