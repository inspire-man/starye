# 提案：接入 AkShare 分红历史备用来源

## 背景

Quant 股东回报的实施分红目前依赖 Tushare 与 Eastmoney。部分证券会因 Tushare 配额、Eastmoney 上游错误或合法空历史而显示为部分可用/来源不可用；AkShare 的 `stock_history_dividend_detail` 已实测能够返回逐次公告、现金分红、实施进度和除权除息日期，可作为按股票查询的补充来源。

## 目标

- 在 AkShare bridge 中调用已验证的分红明细 endpoint，并标准化为现有 Quant 分红记录。
- 在 Tushare/Eastmoney 分红历史为空或发生可分类 provider 错误时最多调用一次 AkShare 回退。
- 现金分红按原始“每十股”字段转换为每股，公告、除权除息、派息日期和实施状态保留真实值；缺失字段继续为 `null`。
- 让 API、研究报告和 Quant 客户端展示实际命中的 `akshare` 来源及安全回退原因。

## 非目标

- 不改变股息率、近 12 个月窗口、分红年数、证据覆盖、价值质量或推荐公式。
- 不把预案、无现金分配或无有效实施日期的行当作已实施现金分红。
- 不新增 D1 表，不持久化 AkShare 原始分红明细。
- 不把当前失败的 `stock_dividend_cninfo` 上游作为第二条实现路径。

## 影响与风险

改动跨越 Python bridge、Quant dividend provider chain、API schema、研究来源和 Quant parser。`QuantDividendProvider` 与 `QuantDividendFetchResult` 是 HIGH 扇出接口，保留现有方法和返回字段，只扩展来源联合类型与可选 AkShare bridge 字段；分红公式继续只消费标准化 `QuantDividendRecord`。AkShare endpoint 按股票请求，失败只输出安全错误码，不输出上游响应或异常文本。

## 需求

1. Bridge MUST 只返回请求股票的分红明细，按现有字段归一化每股现金分红、实施状态和日期；空历史不得生成记录或零值。
2. Provider chain MUST 在主源空历史或可分类失败时最多调用一次 AkShare；AkShare 命中时 MUST 暴露 `provider=akshare`、`fallbackUsed=true` 和安全 `fallbackReason`。
3. API、研究报告和客户端 MUST 贯穿实际 `akshare` 来源，旧 bridge 响应缺少 `dividends` 时仍解析为空列表。
4. 两端均无有效记录时 MUST 保留现有数据不足边界；不得把预案或计划金额推导为已实施分红。
