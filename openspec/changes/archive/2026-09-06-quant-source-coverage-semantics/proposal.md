## Why

来源覆盖审计发现两类会误导研究判断的问题：Eastmoney 回购接口对“该股票没有回购记录”返回合法空结果，但当前被当成来源不可用；银行和保险财报的通用指标被标记为行业不适用，却仍被判断就绪度计为缺失。两者都会让用户误以为需要继续补来源或阻断当前证据链。

## What Changes

- 将 Eastmoney 回购接口的合法空响应规范化为空历史，回购证据显示为数据不足；真正的超时、坏响应和上游错误继续显示为来源不可用。
- 判断就绪度只统计适用且必需的原始 evidence，银行/保险通用指标的 `not_applicable` 字段不再制造数据完整性阻断。
- 保留现有回购、分红、现金流、股本证据的独立状态和来源错误，不使用零值或推算值填充空记录。
- 补充 provider、domain 和客户端就绪度回归测试，并通过 Gateway 验证银行/保险详情的真实展示。

## Capabilities

### New Capabilities

<!-- None. This change tightens an existing evidence-health contract. -->

### Modified Capabilities

- `quant-evidence-source-health`: 完善空回购报告与行业不适用字段在数据健康和判断就绪度中的状态边界。

## Impact

- API：`apps/api/src/domain/quant/provider.ts` 及 provider 测试。
- Quant：`apps/quant-app/src/lib/decision-readiness.ts` 及客户端测试。
- 不改变 D1 schema、API 路径、认证边界、价值质量评分、因子权重或推荐公式。
- 风险主要是 provider 响应分类和判断就绪度展示变化；回购仍是 optional evidence，不会阻断其他股东回报区域。
