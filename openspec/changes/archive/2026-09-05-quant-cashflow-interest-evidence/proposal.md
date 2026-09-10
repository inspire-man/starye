## Why

Quant 当前已经能用现金流量表复核自由现金流和同报告期分红覆盖，但还不能把再投资后的现金流与利息负担、债务规模放在同一报告期核对。Eastmoney 已公开提供利润表中的利息费用和资产负债表中的借款、债券、租赁等行项目，适合补齐“现金流 - 资本开支 - 利息支出，结合有息负债观察安全边际”的证据链。

## What Changes

- 扩展现有 Eastmoney 现金流 provider，按报告期合并现金流量表、利润表和资产负债表。
- 为现金流报告保留利息支出来源字段、有息负债明细及透明的有息负债合计；报告期不一致或来源缺失时保持 `null`。
- 扩展 `cashflowEvidence`，增加利息后自由现金流、利息支出、有息负债和来源缺口；已有自由现金流、分红覆盖和支付率继续按原公式工作。
- 研究报告增加可选的利息支出、有息负债和利息后自由现金流 evidence；投资知识目录把该因子的四个原始字段标记为可用。
- Quant 详情页显示新增金额和报告期，并区分现金流核心字段完整与利息/债务字段缺口。
- 保持价值质量分、因子权重、研究动作、推荐和决策助手输入不变。

## Capabilities

### New Capabilities

- `quant-shareholder-interest-evidence`: 提供按报告期对齐的利息支出、有息负债及利息后自由现金流证据。

### Modified Capabilities

无。现有股东回报接口以可选字段扩展，历史结果继续可读取。

## Non-Goals

- 不扩展 `QuantFinancialQualitySnapshot`，避免触及多个财报消费者和既有评分契约。
- 不把衍生金融负债、交易性金融负债或长期应付款推断为有息负债；只使用明确的借款、融资负债、债券、租赁和一年内到期非流动负债行项目。
- 不新增 D1 表，不把新增 evidence 纳入价值质量、研究动作或买卖判断。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、`shareholder-return.ts`、研究报告、响应 schema 及定向测试。
- Quant：market parser/view model、股东回报详情页及组件测试。
- 数据源：Eastmoney `xjllbAjaxNew`、`lrbAjaxNew`、`zcfzbAjaxNew`；现金流报告作为主记录，利润表/资产负债表按 `REPORT_DATE` 对齐。
- 风险：金融类公司可能只返回 `INTEREST_EXPENSE`，部分公司缺少债务行项目；辅助报表失败时必须保留现金流核心值，并展示安全错误码和字段缺口。
