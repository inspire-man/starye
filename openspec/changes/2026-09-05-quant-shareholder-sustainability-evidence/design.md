## 设计边界

现金流量表仍是历史序列的主记录。现有 provider 已经返回按 `REPORT_DATE` 排序的多期 `QuantCashflowReport`，本 change 只在 shareholder-return domain 中把这些报告转成前端可读的历史证据，不增加新的上游请求和持久化表。

## 数据模型

`cashflowEvidence.history` 为最多 8 条的 `QuantShareholderCashflowHistoryItem[]`，每条包含报告元数据、现金流核心值、辅助利息/有息负债值、同报告期计算值、来源错误码和字段缺口。每期使用自身报告的值计算：

`freeCashflow = operatingCashflow - capitalExpenditure`

`freeCashflowAfterInterest = freeCashflow - interestExpense`

`freeCashflowCoverage = freeCashflow / cashDividendsPaid`

年度 `payoutRatio` 只在报告期为自然年末、净利润为正且现金股利值可靠时计算。历史项的任何输入缺失都保留为 `null`。

`historySummary` 只描述证据覆盖：报告期数量、现金流核心完整期数、正自由现金流期数、正利息后自由现金流期数、现金分红覆盖期数、可计算支付率期数、最新报告期和缺口列表。summary 的 `status` 表示历史资料覆盖程度，不代表现金流质量或投资结论。

## 最新字段兼容

现有 `cashflowEvidence` 的顶层字段继续映射最新报告。新的 history 与 summary 由同一批报告生成；空历史或旧 payload 使用空数组和可推导的缺省 summary。`QuantShareholderCashflowEvidence`、响应 schema 和 client parser 对新增字段采用兼容读取，旧报告保持现有展示。

## 研究报告与 UI

研究报告保留一条 optional `shareholder-cashflow-history` evidence，记录历史期数和覆盖摘要，供历史报告与 AI 解释使用；optional evidence 不计入硬证据分数和 factor model。详情区域在最新现金流卡片下方展示历史行，使用报告期作为稳定 key，缺失值显示为 `--`，并明确这是覆盖统计和研究核对。

## 验证重点

- provider 返回的历史报告按报告期去重、倒序和上限裁剪。
- 单期、两期、部分辅助字段和 provider 失败分别产生稳定状态。
- legacy payload 不含 history/summary 时 parser 不抛错。
- 新增 evidence 不改变现有 `status`、`action`、factor coverage、recommendation 和 decision assistant 输入。
