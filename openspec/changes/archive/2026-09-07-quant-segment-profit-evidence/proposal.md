## Why

上一项分部经营证据已接入同报告期主营收入、收入比例和源站毛利率，但 Eastmoney/AkShare 的同一 `zygcfx` 行还稳定提供主营成本、成本比例、主营利润和利润比例。当前详情页无法区分“源站未披露毛利率”和“没有任何分部盈利原始字段”，导致经营驱动上下文仍显示部分可用。

本 change 补齐可验证的分部成本与利润原始字段，继续把订单金额、销量、实现价格保留为独立缺口。这样可以扩展来源覆盖，又不会把收入比例或利润结果错误解释成量价数据。

## What Changes

- 在 API financial snapshot、schema、AkShare bridge contract 和 Quant view model 中增加可选的分部成本、成本比例、主营利润、利润比例字段。
- Eastmoney `BusinessAnalysis/PageAjax.zygcfx` 与 AkShare `stock_zygc_em` 读取同报告期匹配字段，保留 endpoint/source provenance、nullable 非有限值和安全错误状态。
- 研究报告增加独立的可选分部成本与分部利润 evidence；不进入价值质量评分、候选信号、确定性推荐、AI 决策投影或结果判断。
- Quant 基本面详情展示成本、成本比例、主营利润和利润比例，并明确区分源站缺失与来源不可用。
- 知识目录将分部成本和分部利润标记为经营驱动已接入字段，继续标记订单金额、销量和实现价格为缺口。
- 增加 Eastmoney/AkShare 真实字段样本、legacy payload、API/Quant/bridge 回归测试。

## Capabilities

### New Capabilities

- `quant-segment-profit-evidence`: 同报告期分部成本、成本比例、主营利润、利润比例的来源、契约、研究证据和展示边界。

### Modified Capabilities

- 无。上一项分部字段契约保持兼容，本 change 只增加可选字段和对应边界。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、`akshare-bridge.ts`、`research-report.ts`、`schemas/quant.ts` 及相关测试。
- Bridge：`apps/quant-akshare-bridge/` 的 normalizer、adapter、contract、测试和 README。
- Quant：financial resource parser、view model、基本面详情、知识目录及 UI 测试。
- 不涉及 D1 schema/migration；持久化研究报告和旧 bridge/API payload 必须继续可读。
- 风险集中在 HIGH fan-out 的 `QuantFinancialQualitySnapshot`；通过全量 API/Quant 测试、bridge 测试、Gateway 和合并后 Actions 验证。
