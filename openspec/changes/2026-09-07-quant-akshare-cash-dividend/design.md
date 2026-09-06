# 设计：AkShare 同报告期现金分红字段

## 数据流

`POST /v1/evidence` 的 `stock_cash_flow_sheet_by_report_em` 结果继续进入 `normalize_cashflow_rows`。normalizer 将原始 `ASSIGN_DIVIDEND_PORFIT` 以及同义中文列转换为已有 snake_case `cash_dividends_paid`；API `normalizeBridgeCashflowReport` 再读取该字段并填充 `QuantCashflowReport.cashDividendsPaid`。

## 字段与边界

- 有限数值直接保留为 `cash_dividends_paid`，不做单位换算或派息日推导。
- `NaN`、`<NA>`、空文本和缺失字段统一为 `null`。
- 原始列本身是现金流表的分配股利、利润或偿付利息项目，当前 Quant 合同与 Eastmoney provider 使用同一字段口径；本 change 只补 AkShare 原始覆盖，不重定义口径。
- endpoint、报告期、错误分类和其他现金流字段行为保持原样。

## 验证

- Python normalizer/adapter 测试覆盖 uppercase、中文别名、缺失和非有限值。
- API bridge/provider 测试覆盖 `cashDividendsPaid` 的传输与旧 payload 兼容。
- 现金流/股东回报已有公式测试继续通过，确保覆盖倍数和支付率只消费现有字段。
- 运行 bridge/API/Quant 定向测试、root lint/type-check、Quant build、OpenSpec strict、GitNexus detect changes，并经 Gateway 验证匿名边界。
