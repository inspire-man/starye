from __future__ import annotations

import importlib.util
from typing import Any

from .contracts import BridgeError, BridgeRequest, BridgeResponse, BridgeSource, observed_now
from .normalizer import FORMULA_VERSION, _merge_debt_components, akshare_symbol, build_evidence, normalize_cashflow_rows, normalize_daily_rows, normalize_date, normalize_financial_rows, normalize_identity_rows, normalize_ts_code, validate_date_range


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
FINANCIAL_BALANCE_FIELDS = ("total_liability", "interest_bearing_debt")
FINANCIAL_METADATA_FIELDS = ("notice_date", "report_type", "report_date_name", "industry")
FINANCIAL_COMPONENT_FIELDS = ("interest_bearing_debt_components",)
CASHFLOW_REQUIRED_FIELDS = ("operating_cashflow", "capital_expenditure", "net_profit")


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
    ]
    for endpoint, invoke in candidates:
        method = getattr(api, endpoint, None)
        if not callable(method):
            continue
        attempted.append(endpoint)
        try:
            raw = invoke(method)
            rows, row_errors = normalize_cashflow_rows(ts_code, raw, observed_at, source=endpoint)
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
    daily_endpoints: list[str] = []
    identity_endpoints: list[str] = []
    financial_endpoints: list[str] = []
    cashflow_endpoints: list[str] = []

    from datetime import date, timedelta

    end_date = end_date or date.today().strftime("%Y%m%d")
    start_date = start_date or (date.today() - timedelta(days=365 * 5)).strftime("%Y%m%d")
    daily_candidates = [
        ("stock_zh_a_hist", lambda method: method(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="")),
        ("stock_zh_a_hist_tx", lambda method: method(symbol=_tx_symbol(ts_code), start_date=start_date, end_date=end_date, adjust="")),
        ("stock_zh_a_daily", lambda method: method(symbol=_sina_symbol(ts_code), start_date=start_date, end_date=end_date, adjust="")),
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

    evidence = build_evidence(ts_code, observed_at, daily_bars, financials, cashflows)
    has_data = bool(daily_bars or identity or financials or cashflows)
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
            ])),
            formula_version=FORMULA_VERSION,
        ),
        identity=identity,
        daily_bars=daily_bars,
        financials=financials,
        cashflows=cashflows,
        evidence=evidence,
        errors=errors,
    )
