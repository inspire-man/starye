## Context

本 change 只修正来源状态和就绪度边界。当前 Eastmoney 回购 provider 已能解析有效计划，但对 `code=9201`、`success=false`、`result=null` 的合法空响应直接抛出 `INVALID_RESPONSE`；Quant 详情因此显示“回购源暂不可用”。同时，研究报告把银行/保险通用指标保留为 `not_applicable`，而客户端就绪度只按 `status=missing` 计数，漏掉了适用性过滤。

## Goals / Non-Goals

**Goals:**

- 区分空历史、部分记录和 provider 故障。
- 让客户端判断就绪度与研究报告的适用性边界一致。
- 保留来源错误、刷新动作和 optional evidence 的独立性。

**Non-Goals:**

- 本 change 不新增 D1 表、API 路径或新的外部 token。
- 本 change 不把回购金额从计划区间推算出来，也不把没有记录解释成“已实施金额为零”。
- 本 change 不把 ROE、PEG 等阈值注意或失败改写成数据缺失；AkShare 回购 endpoint 扩展保留为后续来源覆盖审计项。

## Decisions

1. **在 Eastmoney provider 边界识别空响应。** 只有 `code=9201`/明确空 result 的结构化响应返回 `[]`；其他非成功响应继续沿用安全 provider 错误映射。这样 domain 可以按既有 `insufficient_data` 分支工作。
2. **在 readiness 边界过滤适用性。** `requiredEvidence` 同时排除 optional evidence 和 `applicability=not_applicable`，不改变报告、因子模型或推荐结果。
3. **不添加零值 fallback。** 空回购历史保留记录、金额和计划区间为缺失，避免把“无记录”误读成“无成本回购”。

## Risks / Trade-offs

- [空响应识别依赖 Eastmoney 稳定错误码] → 仅对已知 `9201`/空 result 放行，未知结构仍按 invalid response 处理，并保留 provider 测试。
- [就绪度阻断减少后用户可能忽略行业口径] → 详情仍展示行业专用指标和 not-applicable 说明；AI、价格和数据时效检查继续独立生效。
