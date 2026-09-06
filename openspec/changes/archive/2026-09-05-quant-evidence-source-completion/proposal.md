## Why

Quant 当前把“字段有值但未达到研究阈值”和“字段没有返回”混在一起，导致有效的趋势数据被提示为需要重试；股东回报使用回退源成功时，来源名称中的“主源失败”又会把结果误判为来源不可用。与此同时，Eastmoney 行情接口对部分股票不返回 PEG，但每日估值明细接口已经提供了可核对的 PEG；部分保险股的现金流日期接口返回 `null`，应表示报告不足，而不是 provider 故障。

## What Changes

- 修正因子数据健康：原始数值存在即计入字段覆盖，阈值未通过继续作为风险证据展示，不触发补数或来源重试。
- 修正来源状态判定：存在明确回退链时标记为 `fallback`；只有没有可用回退的失败才标记为 `unavailable`。
- 扩展 Eastmoney 估值读取：主行情接口缺少字段时读取每日估值明细，按目标代码校验后只补充主接口的 `null` 字段，PEG 使用真实返回值，仍缺失时保留 `null`。
- 将 Eastmoney 现金流日期接口的合法 `null` 响应归类为空报告历史，让页面显示“报告不足”并保留其他证据。
- 读取 Eastmoney 财报中的银行/保险专用指标；通用毛利率、资产负债率、利息覆盖和现金比率等不适用字段标记为行业不适用，不再触发补数动作。
- 将负 PEG 保留为源站返回但不可比的原始事实，不按缺失字段刷新，也不从增长率推算替代值。
- 扩展 Tushare `fina_indicator` 和 `cashflow` 为可选财报/现金流回退源；仅按同报告期补充空字段，并在结果中保留实际来源和回退原因。
- 补充 provider、数据健康和 Quant 页面回归测试，验证来源状态、字段覆盖和缺失边界。

## Capabilities

### New Capabilities

- `quant-evidence-source-health`：定义原始证据覆盖、阈值结果、来源回退和 provider 空数据的独立状态。

### Modified Capabilities

- `quant-valuation-resilience`：估值回退从“主接口失败时回退”扩展为“主接口字段缺失时按字段补充”，并保持严格代码匹配与空值边界。

## Impact

- `apps/quant-app/src/lib/quant-factor-data-health.ts` 与 `QuantFactorDataHealth.vue`：健康状态和刷新动作的派生规则。
- `apps/api/src/domain/quant/provider.ts`：Eastmoney 估值明细补充、现金流空响应解析、行业专用财报字段和 Tushare 财报/现金流回退 provider。
- `apps/api/src/domain/quant/research-report.ts`、`decision-recommendation.ts`、`value-quality.ts`：行业不适用字段与专用指标的独立证据口径。
- `apps/quant-app/src/lib/__test__/quant-factor-data-health.test.ts`、`apps/api/src/domain/quant/__tests__/provider.test.ts`：回归覆盖。
- 不新增 D1 表、密钥或后台任务；不改变确定性评分、推荐、AI 纳入和参考价格的计算口径。

## Risks

- Eastmoney 每日估值明细字段可能随上游变化；响应必须继续经过结构、证券代码和有限数值校验，字段缺失时保留 `null`。
- 估值完整度提升会让新生成报告的证据覆盖变化；已有研究快照不回写，用户刷新后才生成新快照。
- Tushare 财报和现金流接口需要服务端 token 与对应积分；未配置或配额不足时保留 Eastmoney 的原始结果和明确来源状态，不阻塞已有研究流程。
- Tushare 现金流接口没有把“分配股利、利润或偿付利息”拆成单一现金股利，因此这类字段继续保持 `null`，不以混合金额替代。
