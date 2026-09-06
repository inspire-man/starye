from __future__ import annotations

import importlib.util
import threading
import time
from typing import Any

from .contracts import BridgeError, BridgeRequest, BridgeResponse, BridgeSource, observed_now
from .normalizer import FORMULA_VERSION, _merge_debt_components, akshare_symbol, build_evidence, normalize_capital_structure_rows, normalize_cashflow_rows, normalize_daily_rows, normalize_date, normalize_dividend_rows, normalize_financial_rows, normalize_identity_rows, normalize_profit_forecast_rows, normalize_repurchase_rows, normalize_ths_cashflow_rows, normalize_ts_code, validate_date_range


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


def _tx_symbol(ts_code: str) -> str:
    return _sina_symbol(ts_code)


FINANCIAL_PROFIT_FIELDS = (
    "revenue",
    "revenue_yoy",
    "net_profit",
    "net_profit_yoy",
    "adjusted_net_profit",
    "adjusted_net_profit_yoy",
    "interest_expense",
    "interest_expense_source_field",
)
FINANCIAL_CASHFLOW_FIELDS = ("cashflow_net_profit",)
FINANCIAL_BALANCE_FIELDS = ("total_liability", "interest_bearing_debt")
FINANCIAL_METADATA_FIELDS = ("notice_date", "report_type", "report_date_name", "industry")
FINANCIAL_COMPONENT_FIELDS = ("interest_bearing_debt_components",)
CASHFLOW_REQUIRED_FIELDS = ("operating_cashflow", "capital_expenditure", "net_profit")
REPURCHASE_CACHE_TTL_SECONDS = 60.0
PROFIT_FORECAST_CACHE_TTL_SECONDS = 60.0
_repurchase_cache_lock = threading.Lock()
_repurchase_cache: tuple[float, Any] | None = None
_profit_forecast_cache_lock = threading.Lock()
_profit_forecast_cache: tuple[float, Any] | None = None


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
        for field in (*FINANCIAL_PROFIT_FIELDS, *FINANCIAL_CASHFLOW_FIELDS, *FINANCIAL_BALANCE_FIELDS, *FINANCIAL_METADATA_FIELDS):
            if existing.get(field) is None and row.get(field) is not None:
                existing[field] = row[field]
        existing[FINANCIAL_COMPONENT_FIELDS[0]] = _merge_debt_components(
            existing.get(FINANCIAL_COMPONENT_FIELDS[0]),
            row.get(FINANCIAL_COMPONENT_FIELDS[0]),
        )
    ordered = sorted(merged_by_date.values(), key=lambda row: row["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))]


def _merge_daily_rows(
    primary_rows: list[dict[str, Any]],
    supplemental_rows: list[dict[str, Any]],
    limit: int = 250,
) -> list[dict[str, Any]]:
    merged_by_date = {row["trade_date"]: dict(row) for row in primary_rows}
    for row in supplemental_rows:
        existing = merged_by_date.get(row["trade_date"])
        if existing is None:
            merged_by_date[row["trade_date"]] = dict(row)
            continue
        for field in ("open", "high", "low", "close", "pre_close", "change", "pct_chg", "volume", "amount"):
            if existing.get(field) is None and row.get(field) is not None:
                existing[field] = row[field]
    ordered = sorted(merged_by_date.values(), key=lambda row: row["trade_date"])
    return ordered[-max(1, min(limit, 250)) :]


def _has_unresolved_gaps(
    request: BridgeRequest,
    daily_bars: list[dict[str, Any]],
    identity: dict[str, Any],
    financials: list[dict[str, Any]],
    cashflows: list[dict[str, Any]],
    errors: list[BridgeError],
) -> bool:
    if not daily_bars or not identity:
        return True
    if request.include_financials and (not financials or not cashflows):
        return True
    return any(error.code in {
        "AKSHARE_DAILY_UNAVAILABLE",
        "AKSHARE_IDENTITY_UNAVAILABLE",
        "AKSHARE_FINANCIAL_FIELDS_UNAVAILABLE",
        "AKSHARE_CASHFLOW_UNAVAILABLE",
        "AKSHARE_CASHFLOW_FIELDS_UNAVAILABLE",
    } for error in errors)


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

    indicator_endpoint = "stock_financial_analysis_indicator_em"
    if _financial_rows_need(financials, (*FINANCIAL_PROFIT_FIELDS, *FINANCIAL_BALANCE_FIELDS)):
        indicator = getattr(api, indicator_endpoint, None)
        if callable(indicator):
            attempted.append(indicator_endpoint)
            try:
                rows, row_errors = normalize_financial_rows(
                    ts_code,
                    indicator(symbol=ts_code),
                    observed_at,
                    source=indicator_endpoint,
                )
                errors.extend(row_errors)
                if not rows:
                    errors.append(BridgeError("AKSHARE_FINANCIAL_STATEMENT_EMPTY", "AkShare financial indicator is empty", indicator_endpoint))
                financials = _merge_financial_rows(financials, rows)
            except Exception:
                errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_FAILED", "AkShare financial indicator endpoint failed", indicator_endpoint))

    statement_groups = (
        (
            FINANCIAL_PROFIT_FIELDS,
            (
                ("stock_profit_sheet_by_report_em", lambda method: method(symbol=_market_symbol(ts_code))),
                ("stock_profit_sheet_by_quarterly_em", lambda method: method(symbol=_market_symbol(ts_code))),
                ("stock_profit_sheet_by_yearly_em", lambda method: method(symbol=_market_symbol(ts_code))),
                ("stock_financial_report_sina", lambda method: method(stock=_sina_symbol(ts_code), symbol="利润表")),
            ),
        ),
        (
            FINANCIAL_BALANCE_FIELDS,
            (
                ("stock_balance_sheet_by_report_em", lambda method: method(symbol=_market_symbol(ts_code))),
                ("stock_balance_sheet_by_yearly_em", lambda method: method(symbol=_market_symbol(ts_code))),
                ("stock_financial_report_sina", lambda method: method(stock=_sina_symbol(ts_code), symbol="资产负债表")),
            ),
        ),
    )

    for fields, candidates in statement_groups:
        if not _financial_rows_need(financials, fields):
            continue
        callable_endpoint = False
        for endpoint, invoke in candidates:
            method = getattr(api, endpoint, None)
            if not callable(method):
                continue
            callable_endpoint = True
            attempted.append(endpoint)
            try:
                rows, row_errors = normalize_financial_rows(
                    ts_code,
                    invoke(method),
                    observed_at,
                    source=endpoint,
                )
                errors.extend(row_errors)
                if not rows:
                    errors.append(BridgeError("AKSHARE_FINANCIAL_STATEMENT_EMPTY", "AkShare financial statement is empty", endpoint))
                financials = _merge_financial_rows(financials, rows)
                if not _financial_rows_need(financials, fields):
                    break
            except Exception:
                errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_FAILED", "AkShare financial statement endpoint failed", endpoint))
        if _financial_rows_need(financials, fields):
            if not callable_endpoint:
                errors.append(BridgeError("AKSHARE_FINANCIAL_ENDPOINT_UNAVAILABLE", "AkShare financial statement sources are unavailable", candidates[0][0]))
            else:
                errors.append(BridgeError("AKSHARE_FINANCIAL_FIELDS_UNAVAILABLE", "AkShare financial statement fields remain unavailable", "financial"))
    return financials, errors, attempted


def _enrich_cashflow_rows(cashflows: list[dict[str, Any]], financials: list[dict[str, Any]]) -> list[dict[str, Any]]:
    financial_by_date = {row["report_date"]: row for row in financials}
    result: list[dict[str, Any]] = []
    for cashflow in cashflows:
        financial = financial_by_date.get(cashflow["report_date"])
        if financial is None:
            result.append(cashflow)
            continue
        merged = dict(cashflow)
        if merged.get("net_profit") is None and financial.get("cashflow_net_profit") is not None:
            merged["net_profit"] = financial["cashflow_net_profit"]
        for field in ("interest_expense", "interest_expense_source_field", "interest_bearing_debt"):
            if merged.get(field) is None and financial.get(field) is not None:
                merged[field] = financial[field]
        primary_components = merged.get("interest_bearing_debt_components") or {}
        financial_components = financial.get("interest_bearing_debt_components") or {}
        merged["interest_bearing_debt_components"] = _merge_debt_components(primary_components, financial_components)
        if merged.get("interest_bearing_debt") is None:
            values = [value for value in merged["interest_bearing_debt_components"].values() if value is not None]
            if values:
                merged["interest_bearing_debt"] = sum(values)
        result.append(merged)
    return result


def _merge_cashflow_rows(
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
        for field in (
            "notice_date",
            "report_type",
            "report_date_name",
            "operating_cashflow",
            "capital_expenditure",
            "net_profit",
            "cash_dividends_paid",
            "interest_expense",
            "interest_expense_source_field",
            "interest_bearing_debt",
        ):
            if existing.get(field) is None and row.get(field) is not None:
                existing[field] = row[field]
        existing["interest_bearing_debt_components"] = _merge_debt_components(
            existing.get("interest_bearing_debt_components"),
            row.get("interest_bearing_debt_components"),
        )
    ordered = sorted(merged_by_date.values(), key=lambda row: row["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))]


def _cashflow_has_history_coverage(rows: list[dict[str, Any]]) -> bool:
    return sum(
        all(row.get(field) is not None for field in CASHFLOW_REQUIRED_FIELDS)
        for row in rows
    ) >= 2


def _collect_cashflows(api: Any, ts_code: str, observed_at: str, financials: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    errors: list[BridgeError] = []
    attempted: list[str] = []
    cashflows: list[dict[str, Any]] = []
    candidates = [
        ("stock_cash_flow_sheet_by_report_em", lambda method: method(symbol=_market_symbol(ts_code))),
        ("stock_cash_flow_sheet_by_quarterly_em", lambda method: method(symbol=_market_symbol(ts_code))),
        ("stock_cash_flow_sheet_by_yearly_em", lambda method: method(symbol=_market_symbol(ts_code))),
        ("stock_financial_report_sina", lambda method: method(stock=_sina_symbol(ts_code), symbol="现金流量表")),
        ("stock_financial_cash_new_ths", lambda method: method(symbol=akshare_symbol(ts_code))),
    ]
    for endpoint, invoke in candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            continue
        attempted.append(endpoint)
        try:
            raw = invoke(method)
            normalize = normalize_ths_cashflow_rows if endpoint == "stock_financial_cash_new_ths" else normalize_cashflow_rows
            rows, row_errors = normalize(ts_code, raw, observed_at, source=endpoint)
            errors.extend(row_errors)
            if rows:
                cashflows = _merge_cashflow_rows(cashflows, _enrich_cashflow_rows(rows, financials))
                if _cashflow_has_history_coverage(cashflows):
                    break
        except Exception:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ENDPOINT_FAILED", "AkShare cashflow endpoint failed", endpoint))
    if not cashflows:
        errors.append(BridgeError("AKSHARE_CASHFLOW_UNAVAILABLE", "AkShare cashflow data is unavailable", attempted[-1] if attempted else "cashflow"))
    elif not any(all(row.get(field) is not None for field in CASHFLOW_REQUIRED_FIELDS) for row in cashflows):
        errors.append(BridgeError("AKSHARE_CASHFLOW_FIELDS_UNAVAILABLE", "AkShare cashflow fields remain unavailable", "cashflow"))
    return cashflows, errors, attempted


def _collect_repurchases(api: Any, ts_code: str, use_cache: bool = False) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    endpoint = "stock_repurchase_em"
    method = getattr(api, endpoint, None)
    if not callable(method):
        return [], [BridgeError("AKSHARE_REPURCHASE_ENDPOINT_UNAVAILABLE", "AkShare repurchase endpoint is unavailable", endpoint)], []
    try:
        if use_cache:
            global _repurchase_cache
            now = time.monotonic()
            with _repurchase_cache_lock:
                if _repurchase_cache is not None and now - _repurchase_cache[0] < REPURCHASE_CACHE_TTL_SECONDS:
                    raw = _repurchase_cache[1]
                else:
                    raw = method()
                    _repurchase_cache = (time.monotonic(), raw)
        else:
            raw = method()
        rows, row_errors = normalize_repurchase_rows(ts_code, raw, source=endpoint)
        return rows, row_errors, [endpoint]
    except Exception:
        return [], [BridgeError("AKSHARE_REPURCHASE_ENDPOINT_FAILED", "AkShare repurchase endpoint failed", endpoint)], [endpoint]


def _collect_dividends(api: Any, ts_code: str) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    endpoint = "stock_history_dividend_detail"
    method = getattr(api, endpoint, None)
    if not callable(method):
        return [], [BridgeError("AKSHARE_DIVIDEND_ENDPOINT_UNAVAILABLE", "AkShare dividend endpoint is unavailable", endpoint)], []
    try:
        rows, row_errors = normalize_dividend_rows(
            ts_code,
            method(symbol=akshare_symbol(ts_code)),
            source=endpoint,
        )
        return rows, row_errors, [endpoint]
    except Exception:
        return [], [BridgeError("AKSHARE_DIVIDEND_ENDPOINT_FAILED", "AkShare dividend endpoint failed", endpoint)], [endpoint]


def _collect_capital_structures(api: Any, ts_code: str, start_date: str, end_date: str) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    endpoint = "stock_share_change_cninfo"
    method = getattr(api, endpoint, None)
    if not callable(method):
        return [], [BridgeError("AKSHARE_CAPITAL_ENDPOINT_UNAVAILABLE", "AkShare capital structure endpoint is unavailable", endpoint)], []
    try:
        rows, row_errors = normalize_capital_structure_rows(
            ts_code,
            method(symbol=akshare_symbol(ts_code), start_date=start_date, end_date=end_date),
            source=endpoint,
        )
        return rows, row_errors, [endpoint]
    except Exception:
        return [], [BridgeError("AKSHARE_CAPITAL_ENDPOINT_FAILED", "AkShare capital structure endpoint failed", endpoint)], [endpoint]


def _merge_profit_forecast_rows(primary_rows: list[dict[str, Any]], supplemental_rows: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    merged_by_year = {row["forecast_year"]: dict(row) for row in primary_rows}
    for row in supplemental_rows:
        existing = merged_by_year.get(row["forecast_year"])
        if existing is None:
            merged_by_year[row["forecast_year"]] = dict(row)
            continue
        for field in (
            "forecast_eps_low",
            "forecast_eps_average",
            "forecast_eps_high",
            "analyst_count",
            "industry_average_eps",
            "forecast_net_profit_100m_low",
            "forecast_net_profit_100m_average",
            "forecast_net_profit_100m_high",
        ):
            if existing.get(field) is None and row.get(field) is not None:
                existing[field] = row[field]
    ordered = sorted(merged_by_year.values(), key=lambda item: item["forecast_year"], reverse=True)
    return ordered[:max(1, min(limit, 12))]


def _collect_profit_forecasts(api: Any, ts_code: str, use_cache: bool = False) -> tuple[list[dict[str, Any]], list[BridgeError], list[str]]:
    errors: list[BridgeError] = []
    attempted: list[str] = []
    eps_rows: list[dict[str, Any]] = []
    net_profit_rows: list[dict[str, Any]] = []

    ths_endpoint = "stock_profit_forecast_ths"
    ths = getattr(api, ths_endpoint, None)
    if callable(ths):
        attempted.append(ths_endpoint)
        try:
            eps_rows, row_errors = normalize_profit_forecast_rows(
                ts_code,
                ths(symbol=akshare_symbol(ts_code), indicator="预测年报每股收益"),
                source=ths_endpoint,
                metric="eps",
            )
            errors.extend(row_errors)
            if not eps_rows:
                errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_EMPTY", "AkShare EPS forecast is empty", ths_endpoint))
            try:
                net_profit_rows, net_profit_errors = normalize_profit_forecast_rows(
                    ts_code,
                    ths(symbol=akshare_symbol(ts_code), indicator="预测年报净利润"),
                    source=ths_endpoint,
                    metric="net_profit_100m",
                )
                errors.extend(net_profit_errors)
            except Exception:
                errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ENDPOINT_FAILED", "AkShare net profit forecast endpoint failed", ths_endpoint))
        except Exception:
            errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ENDPOINT_FAILED", "AkShare profit forecast endpoint failed", ths_endpoint))

    if not eps_rows:
        em_endpoint = "stock_profit_forecast_em"
        em = getattr(api, em_endpoint, None)
        if callable(em):
            attempted.append(em_endpoint)
            try:
                global _profit_forecast_cache
                if use_cache:
                    now = time.monotonic()
                    with _profit_forecast_cache_lock:
                        if _profit_forecast_cache is not None and now - _profit_forecast_cache[0] < PROFIT_FORECAST_CACHE_TTL_SECONDS:
                            raw = _profit_forecast_cache[1]
                        else:
                            raw = em(symbol="")
                            _profit_forecast_cache = (time.monotonic(), raw)
                else:
                    raw = em(symbol="")
                eps_rows, row_errors = normalize_profit_forecast_rows(ts_code, raw, source=em_endpoint, metric="eps")
                errors.extend(row_errors)
                if not eps_rows:
                    errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_EMPTY", "AkShare Eastmoney profit forecast is empty", em_endpoint))
            except Exception:
                errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ENDPOINT_FAILED", "AkShare Eastmoney profit forecast endpoint failed", em_endpoint))

    rows = _merge_profit_forecast_rows(eps_rows, net_profit_rows)
    if not rows:
        errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_UNAVAILABLE", "AkShare profit forecast data is unavailable", attempted[-1] if attempted else "profit_forecast"))
    return rows, errors, attempted


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
    capital_structures: list[dict[str, Any]] = []
    profit_forecasts: list[dict[str, Any]] = []
    repurchases: list[dict[str, Any]] = []
    dividends: list[dict[str, Any]] = []
    identity: dict[str, Any] = {}
    daily_endpoints: list[str] = []
    identity_endpoints: list[str] = []
    financial_endpoints: list[str] = []
    cashflow_endpoints: list[str] = []
    capital_endpoints: list[str] = []
    profit_forecast_endpoints: list[str] = []
    repurchase_endpoints: list[str] = []
    dividend_endpoints: list[str] = []

    from datetime import date, timedelta

    end_date = end_date or date.today().strftime("%Y%m%d")
    daily_start_date = start_date or (date.today() - timedelta(days=365 * 5)).strftime("%Y%m%d")
    daily_end_date = end_date or date.today().strftime("%Y%m%d")
    capital_start_date = start_date or (date.today() - timedelta(days=365 * 10)).strftime("%Y%m%d")
    capital_end_date = end_date or date.today().strftime("%Y%m%d")
    daily_candidates = [
        ("stock_zh_a_hist", lambda method: method(symbol=symbol, period="daily", start_date=daily_start_date, end_date=daily_end_date, adjust="")),
        ("stock_zh_a_hist_tx", lambda method: method(symbol=_tx_symbol(ts_code), start_date=daily_start_date, end_date=daily_end_date, adjust="")),
        ("stock_zh_a_daily", lambda method: method(symbol=_sina_symbol(ts_code), start_date=daily_start_date, end_date=daily_end_date, adjust="")),
    ]
    for endpoint, invoke in daily_candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            continue
        daily_endpoints.append(endpoint)
        try:
            raw_daily = invoke(method)
            rows, row_errors = normalize_daily_rows(ts_code, raw_daily, source=endpoint)
            errors.extend(row_errors)
            if rows:
                daily_bars = _merge_daily_rows(daily_bars, rows)
                if len(daily_bars) >= 20:
                    break
        except Exception:
            errors.append(BridgeError("AKSHARE_DAILY_ENDPOINT_FAILED", "AkShare daily endpoint failed", endpoint))
    if not daily_bars:
        errors.append(BridgeError("AKSHARE_DAILY_UNAVAILABLE", "AkShare daily data is unavailable", daily_endpoints[-1] if daily_endpoints else "daily"))

    identity_candidates = [
        ("stock_individual_info_em", lambda method: method(symbol=symbol)),
        ("stock_info_a_code_name", lambda method: method()),
    ]
    for endpoint, invoke in identity_candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            continue
        identity_endpoints.append(endpoint)
        try:
            normalized_identity = normalize_identity_rows(invoke(method), ts_code)
            for key, value in normalized_identity.items():
                identity.setdefault(key, value)
            if identity.get("name"):
                break
        except Exception:
            errors.append(BridgeError("AKSHARE_IDENTITY_ENDPOINT_FAILED", "AkShare identity endpoint failed", endpoint))
    if not identity:
        errors.append(BridgeError("AKSHARE_IDENTITY_UNAVAILABLE", "AkShare stock identity is unavailable", identity_endpoints[-1] if identity_endpoints else "identity"))

    if request.include_financials:
        financials, financial_errors, financial_endpoints = _collect_financials(api, ts_code, observed_at)
        errors.extend(financial_errors)

        cashflows, cashflow_errors, cashflow_endpoints = _collect_cashflows(api, ts_code, observed_at, financials)
        errors.extend(cashflow_errors)

    repurchases, repurchase_errors, repurchase_endpoints = _collect_repurchases(api, ts_code, use_cache=client is None)
    errors.extend(repurchase_errors)

    dividends, dividend_errors, dividend_endpoints = _collect_dividends(api, ts_code)
    errors.extend(dividend_errors)

    if request.include_capital_structures:
        capital_structures, capital_errors, capital_endpoints = _collect_capital_structures(api, ts_code, capital_start_date, capital_end_date)
        errors.extend(capital_errors)

    if request.include_profit_forecasts:
        profit_forecasts, profit_forecast_errors, profit_forecast_endpoints = _collect_profit_forecasts(api, ts_code, use_cache=client is None)
        errors.extend(profit_forecast_errors)

    evidence = build_evidence(ts_code, observed_at, daily_bars, financials, cashflows)
    has_data = bool(daily_bars or identity or financials or cashflows or capital_structures or profit_forecasts)
    status = "ready" if has_data and not _has_unresolved_gaps(request, daily_bars, identity, financials, cashflows, errors) else "partial" if has_data else "unavailable"
    return BridgeResponse(
        ts_code=ts_code,
        observed_at=observed_at,
        status=status,
        source=BridgeSource(
            adapter="akshare-adapter-v1",
            endpoints=list(dict.fromkeys([
                *daily_endpoints,
                *identity_endpoints,
                *financial_endpoints,
                *cashflow_endpoints,
                *capital_endpoints,
                *profit_forecast_endpoints,
                *repurchase_endpoints,
                *dividend_endpoints,
            ])),
            formula_version=FORMULA_VERSION,
        ),
        identity=identity,
        daily_bars=daily_bars,
        financials=financials,
        cashflows=cashflows,
        capital_structures=capital_structures,
        profit_forecasts=profit_forecasts,
        repurchases=repurchases,
        dividends=dividends,
        evidence=evidence,
        errors=errors,
    )
