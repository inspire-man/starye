from __future__ import annotations

from typing import Any

from .contracts import BridgeError, BridgeRequest, BridgeResponse, BridgeSource, observed_now
from .normalizer import FORMULA_VERSION, akshare_symbol, build_evidence, normalize_daily_rows, normalize_date, normalize_financial_rows, normalize_identity_rows, normalize_ts_code, validate_date_range


def akshare_available() -> bool:
    try:
        import akshare  # noqa: F401
    except ImportError:
        return False
    return True


def _client() -> Any:
    try:
        import akshare as client
    except ImportError as error:
        raise RuntimeError("AKSHARE_NOT_INSTALLED") from error
    return client


def collect_evidence(request: BridgeRequest, client: Any | None = None) -> BridgeResponse:
    ts_code = normalize_ts_code(request.ts_code)
    start_date = normalize_date(request.start_date, "start_date")
    end_date = normalize_date(request.end_date, "end_date")
    validate_date_range(start_date, end_date)
    symbol = akshare_symbol(ts_code)
    observed_at = observed_now()
    api = client or _client()
    errors: list[BridgeError] = []
    daily_bars: list[dict[str, Any]] = []
    financials: list[dict[str, Any]] = []
    identity: dict[str, Any] = {}

    from datetime import date, timedelta

    end_date = end_date or date.today().strftime("%Y%m%d")
    start_date = start_date or (date.today() - timedelta(days=365 * 5)).strftime("%Y%m%d")
    try:
        raw_daily = api.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="")
        daily_bars, row_errors = normalize_daily_rows(ts_code, raw_daily)
        errors.extend(row_errors)
    except Exception:
        errors.append(BridgeError("AKSHARE_DAILY_UNAVAILABLE", "AkShare daily data is unavailable", "stock_zh_a_hist"))

    try:
        identity = normalize_identity_rows(api.stock_individual_info_em(symbol=symbol))
    except Exception:
        errors.append(BridgeError("AKSHARE_IDENTITY_UNAVAILABLE", "AkShare stock identity is unavailable", "stock_individual_info_em"))

    if request.include_financials:
        try:
            raw_financials = api.stock_financial_analysis_indicator(symbol=symbol)
            financials, row_errors = normalize_financial_rows(ts_code, raw_financials, observed_at)
            errors.extend(row_errors)
        except Exception:
            errors.append(BridgeError("AKSHARE_FINANCIAL_UNAVAILABLE", "AkShare financial data is unavailable", "stock_financial_analysis_indicator"))

    evidence = build_evidence(ts_code, observed_at, daily_bars, financials)
    has_data = bool(daily_bars or identity or financials)
    status = "ready" if has_data and not errors else "partial" if has_data else "unavailable"
    return BridgeResponse(
        ts_code=ts_code,
        observed_at=observed_at,
        status=status,
        source=BridgeSource(
            adapter="akshare-adapter-v1",
            endpoints=[
                "stock_zh_a_hist",
                "stock_individual_info_em",
                *(["stock_financial_analysis_indicator"] if request.include_financials else []),
            ],
            formula_version=FORMULA_VERSION,
        ),
        identity=identity,
        daily_bars=daily_bars,
        financials=financials,
        evidence=evidence,
        errors=errors,
    )
