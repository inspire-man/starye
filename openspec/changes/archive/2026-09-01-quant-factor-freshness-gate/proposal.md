## Why

Quant 当前能展示因子字段是否完整，也能在页面总览中提示数据新鲜度，但 AI 复核的服务端接受规则还没有按因子逐项检查观察时间。用户因此可能看到某个因子已经被 AI 解释，却无法快速判断该因子的证据是否仍处于可用于当前判断的时间窗口。

## What Changes

- 为每个正权重因子计算独立的新鲜度状态、最旧观察时间、数据年龄和适用更新时间窗口。
- 在研究摘要和今日决策助手的因子影响审计中返回新鲜度信息，并明确哪些因子阻断 AI 进入最终判断。
- AI 仍可在因子过期或时间未知时返回解释，但服务端不得把该因子标记为已纳入；所有正权重因子未达到当前新鲜度线时，最终判断保留确定性结果。
- 在 Quant 因子数据健康界面逐项显示新鲜度和下一步动作，保持字段完整性、来源状态、信号分数和 AI 影响彼此独立。
- 历史响应缺少新鲜度字段时继续可读，并以未知状态呈现，不伪造当前新鲜度。

## Capabilities

### New Capabilities

- `quant-factor-freshness-gate`: 因子证据新鲜度、AI 纳入闸门和可审计展示。

### Modified Capabilities

- 无。

## Impact

- `apps/api/src/domain/quant/factor-freshness.ts`：新增按因子周期计算新鲜度的服务端纯函数。
- `apps/api/src/domain/quant/ai-summary.ts`、`decision-assistant.ts`：复用新鲜度闸门计算 AI 因子接受状态和最终纳入范围。
- `apps/quant-app/src/lib/quant-types.ts`、`api-client.ts`：扩展可选因子新鲜度响应解析。
- `apps/quant-app/src/lib/quant-factor-freshness.ts`、`quant-factor-data-health.ts`、`QuantDecisionRecommendation.vue`：展示逐因子新鲜度和阻断原因。
- API/Quant 单元测试、组件测试、构建和 Gateway 页面回归；不新增 D1 表、迁移或外部依赖。

## Risk

- 新鲜度周期若过严，会让正常的周末或季度财报被误判为不可用；通过按因子类型设置版本化周期、展示年龄与窗口并保留 `aging` 状态降低误判。
- 历史旧响应缺少新字段；客户端将其作为未知并保留原有结果，避免把缺失信息当作最新。
