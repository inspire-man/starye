# 设计

## 数据流

1. `_collect_cashflows` 继续按现有 Eastmoney 报告期、季度、年度和 Sina 顺序请求现金流表。
2. 标准端点没有达到两期 `operating_cashflow + capital_expenditure + net_profit` 覆盖时，请求 `stock_financial_cash_new_ths(symbol=code)` 的默认最新报告期视图。
3. `normalize_ths_cashflow_rows` 按 `report_date` 聚合同花顺长表，只读取 `value` 累计报告期列：
   - `act_cash_flow_net` → `operating_cashflow`
   - `pay_fixed_assets_etc_cash` → `capital_expenditure`
   - `cash_net_profit` → `net_profit`
   - `pay_dividends_profits_interest_cash` → `cash_dividends_paid`
4. 同报告期利润表已经有 `net_profit` 而现金流行为空时，由 `_enrich_cashflow_rows` 补入；该值仍是来源原始字段，不由经营现金流或其他字段计算。
5. API 继续解析现有 `cashflows` payload，现金流 provider chain 继续以报告期逐字段合并，并保留 `provider`、`supplementalProvider`、`fallbackUsed` 和错误码。

## 状态边界

- 同花顺端点失败、没有已知指标或日期无效时写入安全 bridge error；不返回上游异常文本。
- 标准端点已有有效值时优先保留标准端点值，备用源只补 `null` 字段。
- `single` 是季度单期值，不作为当前累计口径的替代值。
- 现金分红、自由现金流、利息后自由现金流、覆盖倍数、年度支付率和推荐公式不变。

## 测试策略

- normalizer 覆盖长表聚合、已知指标、未知指标、`NaN`/空值和 `single` 不越界。
- adapter 覆盖标准端点补净利润、同花顺备用端点、端点失败诊断和既有来源优先级。
- API bridge/provider 回归旧 payload、逐字段合并和来源元数据。
