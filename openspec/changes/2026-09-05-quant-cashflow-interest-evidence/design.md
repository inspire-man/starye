## Context

现有 `QuantCashflowProvider` 只读取 `xjllbAjaxNew`，现金流 evidence 已提供经营现金流、资本开支、自由现金流、同报告期分红覆盖和年度支付率。目标字段属于同一报告期的利润表和资产负债表，不扩展高扇出的 `QuantFinancialQualitySnapshot`，以降低既有财报、比较和 AI briefing 消费者的影响。

## Goals / Non-Goals

**Goals:**

- 以现金流报告期为锚点，合并三张公开报表的可核对字段。
- 保留利息来源字段和有息负债明细，支持明确的利息后自由现金流公式。
- 辅助来源失败时保留现金流核心结果，并在 API、研究报告和 UI 中显示缺口。

**Non-Goals:**

- 不修改 D1、既有财报 snapshot、value-quality 或决策契约。
- 不从利息覆盖倍数、带息负债率、总负债或 FCFF 反推绝对值。
- 不将不明确的交易性/衍生负债和长期应付款纳入有息负债合计。

## Decisions

1. **复用现金流 provider，按报告期合并辅助报表。** `fetchCashflowHistory` 先取得现金流报告期，再并行请求 `xjllbAjaxNew`、`lrbAjaxNew` 和 `zcfzbAjaxNew`，用规范化 `REPORT_DATE` 建立索引。这样详情页只增加一个 evidence 区域，避免新建跨层 provider 和 route。

2. **利息支出采用有明确页面语义的字段优先级。** 普通公司优先使用利润表“其中:利息费用”对应的 `FE_INTEREST_EXPENSE`；该字段为空时才采用金融类利润表的 `INTEREST_EXPENSE`。保留来源字段，避免两个口径相加。

3. **有息负债采用可解释行项目求和。** 只纳入短期借款、短期债券/融资负债、吸收存款及同业存放、拆入资金、央行借款、一年内到期非流动负债、长期借款、摊余成本金融负债、应付债券、永续债和租赁负债等明确融资项目；每个组件都在 payload 中保留 `null` 语义。衍生、交易性金融负债和长期应付款不纳入，避免把经营或公允价值项目当作有息债务。

4. **辅助请求使用 `Promise.allSettled`。** 现金流量表是核心来源，失败时保持现有整体 `unavailable`；利润表/资产负债表失败只清空对应辅助字段，并携带有限错误码。这样既保留自由现金流，也避免把辅助失败伪装成零。

5. **现金流 evidence 状态保持向后兼容。** `ready` 仍只由经营现金流和资本开支决定；利息后自由现金流和有息负债的可用性通过数值、组件和 `missingFields` 单独表达。研究报告新增 evidence 全部为 optional，因此硬证据评分、推荐和决策不变。

## Risks / Trade-offs

- [辅助报表报告期列表不同] -> 使用现金流报告的日期窗口并按规范化日期匹配；无同日记录时保留 `null`。
- [金融公司字段语义不同] -> 使用 `FE_INTEREST_EXPENSE`/`INTEREST_EXPENSE` 明确优先级并输出来源字段，不做相加。
- [债务行项目并非所有公司都返回] -> 逐组件保留 `null`，总额只汇总有限值，缺口进入 evidence。
- [请求数量增加] -> 三个 data 请求与现金流并行，仍由每只股票既有批量并发上限控制；不增加新的批量 worker。
- [共享 parser 扇出] -> parser 只增加向后兼容字段和固定组件默认值，补充旧 payload、坏结构与局部缺口测试。
