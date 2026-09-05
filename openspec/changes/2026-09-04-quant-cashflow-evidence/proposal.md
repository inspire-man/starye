## Why

Quant 当前可以核对已实施现金分红和近 12 个月股息率，但还看不到分红所依赖的现金流和再投资压力。现金流量表已经提供了同一报告期的经营净现金流、购建长期资产支出、净利润和已分配股利，接通这些原始字段后，用户可以复核自由现金流与现金分红之间的关系，同时继续看到回购和股本变化尚在数据缺口中的事实。

## What Changes

- 新增 Eastmoney 现金流量表 provider，按报告期读取经营活动净现金流、购建固定资产/无形资产/其他长期资产支付的现金、净利润和已分配股利。
- 扩展股东回报结果的可选 `cashflowEvidence` 区域，返回最新报告期的原始金额、自由现金流、自由现金流对现金分红覆盖倍数，以及最近完整年度的分红支付率。
- 为现金流证据增加独立的 `ready`、`partial`、`insufficient_data`、`unavailable` 状态和字段级缺口；空值保持为 `null`，不把未接通的回购、股本变化或利息支出当成零。
- 扩展 Quant client、严格响应 schema 和分析抽屉，显示报告期、金额单位、覆盖倍数、年度支付率及来源/缺口说明。
- 研究报告复用同一股东回报结果，保留现有股息率证据、因子权重、价值质量分数和决策推荐口径。

## Capabilities

### New Capabilities

- `quant-shareholder-cashflow-evidence`: 提供带报告期、原始现金流字段和可解释缺口的股东回报现金流证据。

### Modified Capabilities

无。现有股东回报接口继续兼容历史结果，新增区域作为可选字段；价值质量和决策契约保持原口径。

## Non-goals

- 本轮范围之外的是回购公告抓取、股本变化时间序列和利息支出绝对值接入。
- `cashflowEvidence` 只做研究上下文，不参与 `value-quality` 分数、因子权重、推荐或买卖判断。
- 不新增 D1 表；数据按请求读取，仍以 provider 返回的报告期和来源状态为准。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、`shareholder-return.ts`、Quant market/research handlers、响应 schema 和 provider/domain/route 测试。
- Quant：`market` resource parser、共享 view model、股东回报详情组件和响应式样式。
- 数据源：复用 Eastmoney `xjllbDateAjaxNew`/`xjllbAjaxNew` 报表接口；不会把 token 或上游原始异常暴露给浏览器。
- 风险：报表接口可能返回空字段、公司类型差异或暂时不可用；每只股票保留局部状态，整批观察池读取继续隔离失败项。
