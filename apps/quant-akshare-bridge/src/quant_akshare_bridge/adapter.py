from __future__ import annotations

import importlib.util
from typing import Any

from .contracts import BridgeError, BridgeRequest, BridgeResponse, BridgeSource, observed_now
from .normalizer import FORMULA_VERSION, akshare_symbol, build_evidence, normalize_cashflow_rows, normalize_daily_rows, normalize_date, normalize_financial_rows, normalize_identity_rows, normalize_ts_code, validate_date_range


def akshare_available() -> bool:
    return importlib.util.find_spec("akshare") is not None


def _client() -> Any:
    try:
        import akshare as client
    except ImportError as error:
        raise RuntimeError("AKSHARE_NOT_INSTALLED") from error
    return client


def _market_symbol(ts_code: str) -> str:
    code, market = ts_code.split(".", 1)
    return f"{market}{code}"


def _sina_symbol(ts_code: str) -> str:
    code, market = ts_code.split(".", 1)
    return f"{market.lower()}{code}"


FINANCIAL_PROFIT_FIELDS = (
    "revenue",
    "revenue_yoy",
    "net_profit",
    "net_profit_yoy",
    "adjusted_net_profit",
    "adjusted_net_profit_yoy",
)
FINANCIAL_BALANCE_FIELDS = ("total_liability",)
FINANCIAL_METADATA_FIELDS = ("notice_date", "report_type", "report_date_name", "industry")


def _financial_rows_need(rows: list[dict[str, Any]], fields: tuple[str, ...]) -> bool:
    return not rows or any(row.get(field) is None for row in rows for field in fields)


def _merge_financial_rows(
    primary_rows: list[dict[str, Any]],
    supplemental_rows: list[dict[str, Any]],
    limit: int = 12,
) -> list[dict[str, Any]]:
    merged_by_date = {row["report_date"]: dict(row) for row in primary_rows}
    for row in supplemental_rows:
        existing = merged_by_date.get(row["report_date"])
        if existing is None:
            merged_by_date[row["report_date"]] = dict(row)
            continue
        for field in (*FINANCIAL_PROFIT_FIELDS, *FINANCIAL_BALANCE_FIELDS, *FINANCIAL_METADATA_FIELDS):
            if existing.get(field) is None and row.get(field) is not None:
                existing[field] = row[field]
    ordered = sorted(merged_by_date.values(), key=lambda row: row["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))]


def _collect_financials(api: Any, ts_code: str, observed_at: str) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    errors: list[BridgeError] = []
    attempted: list[str] = []
    financials: list[dict[str, Any]] = []
    primary_endpoint = "stock_financial_analysis_indicator"
    primary = getattr(api, primary_endpoint, None)
    if callable(primary):
        attempted.append(primary_endpoint)
        try:
            financials, row_errors = normalize_financial_rows(
                ts_code,
                primary(symbol=akshare_symbol(ts_code)),
                observed_at,
                source=primary_endpoint,
            )
            errors.extend(row_errors)
            if not financials:
                errors.append(BridgeError("AKSHARE_FINANCIAL_EMPTY", "AkShare financial data is empty", primary_endpoint))
        except Exception:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_FAILED", "AkShare financial endpoint failed", primary_endpoint))
    else:
        errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_UNAVAILABLE", "AkShare financial endpoint is unavailable", primary_endpoint))

    candidates = []
    if _financial_rows_need(financials, FINANCIAL_PROFIT_FIELDS):
        candidates.append(("stock_profit_sheet_by_report_em", FINANCIAL_PROFIT_FIELDS))
    if _financial_rows_need(financials, FINANCIAL_BALANCE_FIELDS):
        candidates.append(("stock_balance_sheet_by_report_em", FINANCIAL_BALANCE_FIELDS))

    for endpoint, _fields in candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_UNAVAILABLE", "AkShare financial statement endpoint is unavailable", endpoint))
            continue
        attempted.append(endpoint)
        try:
            rows, row_errors = normalize_financial_rows(
                ts_code,
                method(symbol=_market_symbol(ts_code)),
                observed_at,
                source=endpoint,
            )
            errors.extend(row_errors)
            if not rows:
                errors.append(BridgeError("AKSHARE_FINANCIAL_STATEMENT_EMPTY", "AkShare financial statement is empty", endpoint))
            financials = _merge_financial_rows(financials, rows)
        except Exception:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_FAILED", "AkShare financial statement endpoint failed", endpoint))
    return financials, errors, attempted


def _collect_cashflows(api: Any, ts_code: str, observed_at: str) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    errors: list[BridgeError] = []
    attempted: list[str] = []
    candidates = [
        ("stock_cash_flow_sheet_by_report_em", lambda method: method(symbol=_market_symbol(ts_code))),
        ("stock_financial_report_sina", lambda method: method(stock=_sina_symbol(ts_code), symbol="现金流量表")),
    ]
    for endpoint, invoke in candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            continue
        attempted.append(endpoint)
        try:
            raw = invoke(method)
            rows, row_errors = normalize_cashflow_rows(ts_code, raw, observed_at)
            errors.extend(row_errors)
            if rows:
                return rows, errors, attempted
        except Exception:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ENDPOINT_FAILED", "AkShare cashflow endpoint failed", endpoint))
    if not attempted:
        errors.append(BridgeError("AKSHARE_CASHFLOW_UNAVAILABLE", "AkShare cashflow data is unavailable", "cashflow"))
    elif not any(error.source == "cashflow" for error in errors):
        errors.append(BridgeError("AKSHARE_CASHFLOW_UNAVAILABLE", "AkShare cashflow data is unavailable", attempted[-1]))
    return [], errors, attempted


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
    cashflows: list[dict[str, Any]] = []
    identity: dict[str, Any] = {}
    financial_endpoints: list[str] = []
    cashflow_endpoints: list[str] = []

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
        financials, financial_errors, financial_endpoints = _collect_financials(api, ts_code, observed_at)
        errors.extend(financial_errors)

        cashflows, cashflow_errors, cashflow_endpoints = _collect_cashflows(api, ts_code, observed_at)
        errors.extend(cashflow_errors)

    evidence = build_evidence(ts_code, observed_at, daily_bars, financials, cashflows)
    has_data = bool(daily_bars or identity or financials or cashflows)
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
                *financial_endpoints,
                *cashflow_endpoints,
            ],
            formula_version=FORMULA_VERSION,
        ),
        identity=identity,
        daily_bars=daily_bars,
        financials=financials,
        cashflows=cashflows,
        evidence=evidence,
        errors=errors,
    )
