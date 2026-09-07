# Quant AkShare Bridge

独立运行的 Python 数据 bridge。Worker 通过 `POST /v1/evidence` 获取标准化 JSON，不直接依赖 AkShare 或 pandas。

## Local run

Python 3.11+ is recommended. Install the bridge package and start the service:

```powershell
python -m pip install -e .
$env:QUANT_AKSHARE_BRIDGE_TOKEN = 'local-token'
python -m quant_akshare_bridge.server
```

The default listener is `http://127.0.0.1:8091`. Configure `QUANT_AKSHARE_BRIDGE_URL` and `QUANT_AKSHARE_BRIDGE_TOKEN` in the API Worker to consume it.

## Contract

- `GET /health` returns service and contract status without requiring the token.
- `POST /v1/evidence` requires `Authorization: Bearer <token>`.
- The request accepts `ts_code`, optional `start_date`/`end_date`, `include_financials`, `include_capital_structures`, and `include_profit_forecasts`.
- The response is `quant-akshare-v1`; missing upstream fields stay `null` and provider failures are classified in `errors`. Newer bridge builds may add `cashflows`, `capital_structures`, `profit_forecasts`, `repurchases`, and `dividends` without breaking older Worker clients.
- Daily data uses `stock_zh_a_hist` first, then Tencent `stock_zh_a_hist_tx` and Sina `stock_zh_a_daily`; identity data falls back from `stock_individual_info_em` to `stock_info_a_code_name`. Financial data uses `stock_financial_analysis_indicator` first, then `stock_financial_analysis_indicator_em`, report/quarterly/yearly statement endpoints, and `stock_financial_report_sina` only when target fields are missing; cashflow data tries the report, quarterly, yearly, and Sina statement endpoints in order. Same-period rows are merged with the first non-null value winning, while endpoint failures and unresolved fields remain classified in `errors`.
- `status` describes unresolved data gaps. A failed endpoint that was replaced successfully by another source remains in `errors` for diagnosis but does not downgrade an otherwise complete response to `partial`.
- Dividend history uses `stock_history_dividend_detail`; its `派息` field is converted from per-ten-share to per-share cash and its `进度` field remains available for the Worker to select implemented distributions.
- Cashflow history preserves the statement's `ASSIGN_DIVIDEND_PORFIT` value as `cash_dividends_paid` when present; missing values remain `null`.
- Cashflow history uses `stock_financial_cash_new_ths` as a last source for report-period `act_cash_flow_net`, `pay_fixed_assets_etc_cash`, `cash_net_profit`, and `pay_dividends_profits_interest_cash`; the cumulative `value` column is used and quarterly `single` values are ignored.
- When a cashflow row has no `net_profit`, a same-report-date normalized profit statement value may fill that field; no cashflow formula is used to infer it.
- Company capital history uses `stock_share_change_cninfo` for `变动日期`, `总股本`, and `变动原因`; shareholder holding-change endpoints are not treated as company capital events.
- Working-capital context maps same-period balance-sheet `应收账款`, `存货`, and `合同负债` to `accounts_receivable`, `inventory`, and `contract_liabilities` in yuan; missing fields remain `null` and do not infer orders, volume, price, or profit.
- Business segment context maps `stock_zygc_em` product, industry, and region rows to same-period `business_segments` with raw revenue, revenue ratio, and source-reported gross margin; non-finite fields remain `null` and do not infer orders, volume, or realized price.
- Profit forecast history uses `stock_profit_forecast_ths` for annual EPS and annual net-profit forecast ranges in `100m CNY`; Eastmoney `stock_profit_forecast_em` is a short-lived full-market fallback for EPS only. Forecast values remain separate from actual financial statements.
- To enable it in the API, configure both `QUANT_AKSHARE_BRIDGE_URL` and `QUANT_AKSHARE_BRIDGE_TOKEN`; an unconfigured bridge is skipped and does not replace the existing Eastmoney/Tushare result.

The service does not log request bodies, tokens, API keys, or upstream stack traces.
