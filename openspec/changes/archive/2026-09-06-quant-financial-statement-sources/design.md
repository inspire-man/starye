## 实现边界

`collect_evidence` 先读取现有 `stock_financial_analysis_indicator`。对每个已标准化报告，若目标字段仍为空，按需调用 `stock_profit_sheet_by_report_em` 和 `stock_balance_sheet_by_report_em`，再以报告期为键合并；现有指标记录始终优先。

利润表与资产负债表复用财报 normalizer 的日期、代码和有限数值校验。normalizer 使用 Eastmoney 大写列名、中文列名和 snake_case alias，但不从总资产、权益或同比字段推导缺失比率。

bridge response 继续使用 `quant-akshare-v1`，只扩展 `financials` 已有记录的可选字段和 `source.endpoints`/`errors` 内容。API、D1 和 Quant transport contract 不增加新持久化字段；现有 AkShare provider 会自然消费合并后的 financials。

## 失败策略

- 主指标已有完整目标字段：不调用利润表或资产负债表端点。
- 主指标部分返回：新端点只填同报告期的 `null` 字段，主记录值和行业信息优先。
- 新端点缺失、空集合、超时或坏行：保留其他端点的记录，并增加稳定错误；不填 0、不跨期合并。
- 主指标无有效报告：允许报表端点形成 AkShare fallback 记录，但仍保留主端点错误。
