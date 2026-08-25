## Why

当前 Quant 工作台已经能用估值、盈利、增长和趋势缩小研究范围，但中长线价值投资还缺少两个容易被误读的依据：公司经营现金流和负债韧性，以及股东实际收到的现金分红。现有知识目录已经把这些列为部分接通因子，现在有必要把可验证的数据展示出来，同时明确资本开支、回购和分红支付率仍未接通，避免把缺失字段当成零值。

## What Changes

- 扩展 Eastmoney 财务报告对象，解析报告源已有的经营现金流/股、FCFF、利息覆盖率、带息负债率、现金比率和负债规模。
- 新增受保护的 `GET /api/quant/shareholder-returns` 批量接口，使用服务端 Tushare token 读取分红实施记录，并结合观察池已存日线计算近 12 个月现金股息率。
- 对每只观察池股票返回数据状态、分红年度数、近 12 个月每股现金分红、股息率、实施记录和缺失字段；上游权限、token 或单只股票失败时按股票降级，不阻断整批结果。
- 在 Quant 分析抽屉增加“现金流韧性”和“股东回报”区域，使用容易理解的标签、报告期和数据来源提示；这些上下文数据不改变现有 `value-quality-v1` 总分。
- 将资本开支逐项数据、回购金额、分红支付率保留为明确的数据缺口，不接入未经验证的估算。

## Capabilities

### New Capabilities

- `quant-shareholder-returns`: 提供分红实施记录、近 12 个月现金股息率和现金流韧性上下文的受保护 Quant 接口及分析抽屉展示。

### Modified Capabilities

无。现有 `quant-value-selection` 的评分维度、权重和 `value-quality-v1` 公式保持不变。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、新的股东回报 domain service、`apps/api/src/routes/quant/index.ts` 及契约/集成测试。
- Quant：财务对象解析、API client 类型归一化、分析抽屉和响应式样式。
- 数据源：Eastmoney 复用现有财报接口；Tushare 仅使用服务端 `dividend` 接口，token 不进入响应或前端。
- 数据库：不新增表或迁移；分红为按需读取，日线价格使用现有 `quant_daily_bar` 权威本地数据。
- 风险：Tushare 分红接口可能因权限、网络或记录状态不可用；接口必须返回可解释的 `partial`/`insufficient_data`，不生成虚假股息率。
