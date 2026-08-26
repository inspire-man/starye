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
- The response is `quant-akshare-v1`; missing upstream fields stay `null` and provider failures are classified in `errors`.

The service does not log request bodies, tokens, API keys, or upstream stack traces.
