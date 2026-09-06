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
- The request accepts `ts_code`, optional `start_date`/`end_date`, and `include_financials`.
- The response is `quant-akshare-v1`; missing upstream fields stay `null` and provider failures are classified in `errors`. Newer bridge builds may add `cashflows` without breaking older Worker clients.
- Daily data uses `stock_zh_a_hist` first, then Tencent `stock_zh_a_hist_tx` and Sina `stock_zh_a_daily`; identity data falls back from `stock_individual_info_em` to `stock_info_a_code_name`. Financial data uses `stock_financial_analysis_indicator` first, then `stock_financial_analysis_indicator_em`, report/quarterly/yearly statement endpoints, and `stock_financial_report_sina` only when target fields are missing; cashflow data tries the report, quarterly, yearly, and Sina statement endpoints in order. Same-period rows are merged with the first non-null value winning, while endpoint failures and unresolved fields remain classified in `errors`.
- `status` describes unresolved data gaps. A failed endpoint that was replaced successfully by another source remains in `errors` for diagnosis but does not downgrade an otherwise complete response to `partial`.
- To enable it in the API, configure both `QUANT_AKSHARE_BRIDGE_URL` and `QUANT_AKSHARE_BRIDGE_TOKEN`; an unconfigured bridge is skipped and does not replace the existing Eastmoney/Tushare result.

The service does not log request bodies, tokens, API keys, or upstream stack traces.
