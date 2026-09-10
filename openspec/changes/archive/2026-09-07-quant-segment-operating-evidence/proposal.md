## Why

Quant 经营驱动上下文已经补齐合同负债、应收账款和存货，但分部收入与分部毛利仍显示为缺口。Eastmoney `BusinessAnalysis/PageAjax` 的 `zygcfx` 数据和 AkShare `stock_zygc_em` 封装都能返回同报告期的产品、行业或地区主营构成，适合补充可追溯的原始经营信息。

## What Changes

- 在财务报告快照中增加可选的 `businessSegments` 数组，记录同报告期的分类、分部名称、主营收入、收入比例和毛利率。
- Eastmoney financial provider 直接读取 `PageAjax.zygcfx`；AkShare bridge 读取 `stock_zygc_em`，按证券代码和报告期归一化并保留实际端点。
- provider chain 只在 fallback 支持分部数据时补充，保留 primary provider、supplemental provider 和旧 payload 兼容。
- 研究报告增加可选的分部收入/毛利 evidence；Quant 基本面详情展示报告期、分类、金额、比例和明确缺失状态。
- 更新知识目录，将 `segmentRevenue`、`segmentGrossMargin` 标记为已接入，订单金额、销量和实现价格继续保留为缺口。
- 不引入 D1 migration，不从收入推导销量、价格、订单或未来利润，不修改价值质量评分、候选信号、推荐和决策判断。

## Capabilities

### New Capabilities

- `quant-segment-operating-evidence`: 同报告期分部经营原始字段、来源回退、研究证据和展示边界。

### Modified Capabilities

- 无。现有评分和判断需求保持不变；本 change 只增加独立的可选证据。

## Impact

- 影响 `apps/api/src/domain/quant/provider.ts`、AkShare bridge adapter/normalizer、Quant API schema/parser、研究报告、知识目录和基本面详情组件。
- Eastmoney financial read 会增加一次可选主营构成请求；请求或字段异常只影响分部经营上下文。
- 分部行按报告期、证券代码、分类和名称去重并限制数量；非有限金额、比例和毛利率保持 `null`。
