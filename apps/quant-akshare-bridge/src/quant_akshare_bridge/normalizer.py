from __future__ import annotations

import math
import re
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta, timezone
from typing import Any

from .contracts import BridgeEvidence, BridgeError

FORMULA_VERSION = "akshare-adapter-v1"
TS_CODE_PATTERN = re.compile(r"^(?P<code>\d{6})\.(?P<market>SH|SZ|BJ)$", re.IGNORECASE)
MAX_DATE_RANGE_DAYS = 3653


def normalize_ts_code(value: str) -> str:
    normalized = value.strip().upper()
    if not TS_CODE_PATTERN.fullmatch(normalized):
        raise ValueError("ts_code must be a six-digit SH, SZ, or BJ code")
    return normalized


def akshare_symbol(ts_code: str) -> str:
    return normalize_ts_code(ts_code).split(".", 1)[0]


def normalize_date(value: str | None, field: str = "date") -> str | None:
    if value is None or not str(value).strip():
        return None
    raw = str(value).strip()
    if re.fullmatch(r"\d{8}", raw):
        normalized = raw
    elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        normalized = raw.replace("-", "")
    elif re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)", raw):
        try:
            datetime.fromisoformat(raw.replace(" ", "T"))
        except ValueError as error:
            raise ValueError(f"{field} must be a valid calendar date") from error
        normalized = raw[:10].replace("-", "")
    else:
        raise ValueError(f"{field} must be YYYYMMDD")
    try:
        datetime.strptime(normalized, "%Y%m%d")
    except ValueError as error:
        raise ValueError(f"{field} must be a valid calendar date") from error
    return normalized


def validate_date_range(start_date: str | None, end_date: str | None) -> None:
    if not start_date or not end_date:
        return
    start = datetime.strptime(start_date, "%Y%m%d")
    end = datetime.strptime(end_date, "%Y%m%d")
    if start > end:
        raise ValueError("start_date must not be after end_date")
    if end - start > timedelta(days=MAX_DATE_RANGE_DAYS):
        raise ValueError("date range must not exceed 10 years")


def _rows(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if hasattr(value, "to_dict"):
        value = value.to_dict(orient="records")
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes, Mapping)):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, Mapping):
            result.append({str(key): raw for key, raw in item.items()})
    return result


def _field(row: Mapping[str, Any], *names: str) -> Any:
    for name in names:
        if name in row:
            return row[name]
    return None


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _text(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return None
    text = str(value).strip()
    return text if text and text.lower() not in {"nan", "nat", "<na>"} else None


def _optional_date(
    value: Any,
    field: str,
    errors: list[BridgeError],
    error_code: str,
    source: str,
) -> str | None:
    try:
        return normalize_date(value, field)
    except ValueError:
        errors.append(BridgeError(error_code, f"{field} is invalid; the report row was retained", source))
        return None


def _repurchase_date(
    value: Any,
    field: str,
    errors: list[BridgeError],
    source: str,
) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = float(value)
        if not math.isfinite(numeric):
            return None
        try:
            return datetime.fromtimestamp(numeric / 1000, tz=timezone.utc).strftime("%Y%m%d")
        except (OverflowError, OSError, ValueError):
            pass
    return _optional_date(value, field, errors, "AKSHARE_REPURCHASE_DATE_INVALID", source)


def _dividend_date(
    value: Any,
    field: str,
    errors: list[BridgeError],
    source: str,
) -> str | None:
    if _text(value) is None:
        return None
    return _optional_date(value, field, errors, "AKSHARE_DIVIDEND_DATE_INVALID", source)


DEBT_COMPONENT_ALIASES = {
    "short_loan": ("SHORT_LOAN", "shortLoan", "short_loan", "短期借款"),
    "short_bond_payable": ("SHORT_BOND_PAYABLE", "shortBondPayable", "short_bond_payable", "应付短期债券"),
    "short_finance_payable": ("SHORT_FIN_PAYABLE", "shortFinancePayable", "short_finance_payable"),
    "accept_deposit_interbank": ("ACCEPT_DEPOSIT_INTERBANK", "acceptDepositInterbank", "accept_deposit_interbank", "吸收存款及同业存放"),
    "borrow_fund": ("BORROW_FUND", "borrowFund", "borrow_fund", "拆入资金"),
    "loan_pbc": ("LOAN_PBC", "loanPbc", "loan_pbc", "向中央银行借款"),
    "current_maturity_debt": ("NONCURRENT_LIAB_1YEAR", "currentMaturityDebt", "current_maturity_debt", "一年内到期的非流动负债"),
    "amortized_cost_financial_liability": ("AMORTIZE_COST_FINLIAB", "amortizedCostFinancialLiability", "amortized_cost_financial_liability"),
    "long_loan": ("LONG_LOAN", "longLoan", "long_loan", "长期借款"),
    "amortized_cost_noncurrent_financial_liability": ("AMORTIZE_COST_NCFINLIAB", "amortizedCostNoncurrentFinancialLiability", "amortized_cost_noncurrent_financial_liability"),
    "bond_payable": ("BOND_PAYABLE", "bondPayable", "bond_payable", "应付债券"),
    "perpetual_bond": ("PERPETUAL_BOND", "perpetualBond", "perpetual_bond", "永续债"),
    "perpetual_bond_payable": ("PERPETUAL_BOND_PAYBALE", "perpetualBondPayable", "perpetual_bond_payable", "应付债券：永续债"),
    "lease_liability": ("LEASE_LIAB", "leaseLiability", "lease_liability", "租赁负债"),
}


def _row_code(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    raw = str(value).strip().upper()
    if not raw or raw == "NAN":
        return None
    if "." in raw:
        raw = raw.split(".", 1)[0]
    if len(raw) == 8 and raw[:2] in {"SH", "SZ", "BJ"}:
        raw = raw[2:]
    return raw.zfill(6) if raw.isdigit() else raw


def _row_matches_ts_code(row: Mapping[str, Any], normalized_code: str) -> bool:
    returned = _row_code(_field(row, "ts_code", "tsCode", "SECUCODE", "SECURITY_CODE", "security_code"))
    return returned is None or returned == normalized_code.split(".", 1)[0]


def _interest_expense(row: Mapping[str, Any]) -> tuple[float | None, str | None]:
    finance_expense_interest = _number(_field(row, "FE_INTEREST_EXPENSE", "利息支出", "利息费用"))
    if finance_expense_interest is not None:
        return finance_expense_interest, "FE_INTEREST_EXPENSE"
    income_statement_interest = _number(_field(row, "INTEREST_EXPENSE", "interestExpense", "interest_expense"))
    return income_statement_interest, "INTEREST_EXPENSE" if income_statement_interest is not None else None


def _debt_components(row: Mapping[str, Any]) -> dict[str, float | None]:
    return {key: _number(_field(row, *aliases)) for key, aliases in DEBT_COMPONENT_ALIASES.items()}


def _debt_total(components: Mapping[str, float | None], row: Mapping[str, Any]) -> float | None:
    explicit = _number(_field(row, "interest_bearing_debt", "interestBearingDebt"))
    if explicit is not None:
        return explicit
    values = [value for value in components.values() if value is not None]
    return sum(values) if values else None


def _merge_debt_components(primary: Mapping[str, Any] | None, supplement: Mapping[str, Any] | None) -> dict[str, float | None]:
    primary_values = primary or {}
    supplement_values = supplement or {}
    return {
        key: _number(primary_values.get(key)) if _number(primary_values.get(key)) is not None else _number(supplement_values.get(key))
        for key in DEBT_COMPONENT_ALIASES
    }


def normalize_daily_rows(
    ts_code: str,
    raw: Any,
    limit: int = 120,
    source: str = "stock_zh_a_hist",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        try:
            trade_date = normalize_date(_field(row, "日期", "交易日期", "date", "trade_date"), "trade_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_DAILY_ROW_INVALID", "daily row has an invalid trade date", source))
            continue
        close = _number(_field(row, "收盘", "close"))
        open_price = _number(_field(row, "开盘", "open"))
        high = _number(_field(row, "最高", "high"))
        low = _number(_field(row, "最低", "low"))
        if not trade_date or close is None or open_price is None or high is None or low is None:
            errors.append(BridgeError("AKSHARE_DAILY_ROW_INVALID", "daily row is missing required fields", source))
            continue
        interest_expense, interest_expense_source_field = _interest_expense(row)
        interest_bearing_debt_components = _debt_components(row)
        result.append({
            "ts_code": normalized_code,
            "trade_date": trade_date,
            "open": open_price,
            "high": high,
            "low": low,
            "close": close,
            "pre_close": _number(_field(row, "昨收", "pre_close")),
            "change": _number(_field(row, "涨跌额", "change")),
            "pct_chg": _number(_field(row, "涨跌幅", "pct_chg")),
            "volume": _number(_field(row, "成交量", "vol", "volume")),
            "amount": _number(_field(row, "成交额", "amount")),
        })
    deduplicated = {f"{row['ts_code']}:{row['trade_date']}": row for row in result}
    ordered = sorted(deduplicated.values(), key=lambda item: item["trade_date"])
    return ordered[-max(1, min(limit, 250)) :], errors


def normalize_identity_rows(raw: Any, ts_code: str | None = None) -> dict[str, Any]:
    name_keys = {"公司简称", "股票简称", "名称", "name"}
    industry_keys = {"行业", "所属行业", "industry"}
    result: dict[str, Any] = {}
    normalized_code = normalize_ts_code(ts_code).split(".", 1)[0] if ts_code else None
    for row in _rows(raw):
        if normalized_code:
            returned_code = _field(row, "ts_code", "tsCode", "SECUCODE", "SECURITY_CODE", "security_code", "代码", "code")
            if returned_code is not None and _row_code(returned_code) != normalized_code:
                continue
        item = str(_field(row, "item", "项目", "字段") or "")
        if item in name_keys and "name" not in result:
            value = _field(row, "value", "值", "内容", "name")
            if value is not None and str(value).strip():
                result["name"] = str(value).strip()
        elif item in industry_keys and "industry" not in result:
            value = _field(row, "value", "值", "内容", "industry")
            if value is not None and str(value).strip():
                result["industry"] = str(value).strip()
        if "name" not in result:
            value = _field(row, "名称", "name", "SECURITY_NAME_ABBR")
            if value is not None and str(value).strip():
                result["name"] = str(value).strip()
        if "industry" not in result:
            value = _field(row, "行业", "所属行业", "industry")
            if value is not None and str(value).strip():
                result["industry"] = str(value).strip()
    return result


def normalize_financial_rows(
    ts_code: str,
    raw: Any,
    observed_at: str,
    limit: int = 4,
    source: str = "stock_financial_analysis_indicator",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        if not _row_matches_ts_code(row, normalized_code):
            errors.append(BridgeError("AKSHARE_FINANCIAL_ROW_MISMATCHED", "financial row code does not match the requested stock", source))
            continue
        try:
            report_date = normalize_date(_field(row, "日期", "报告期", "报告日", "REPORT_DATE", "report_date"), "report_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ROW_INVALID", "financial row has an invalid report date", source))
            continue
        if not report_date:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ROW_INVALID", "financial row has no report date", source))
            continue
        interest_expense, interest_expense_source_field = _interest_expense(row)
        interest_bearing_debt_components = _debt_components(row)
        notice_date = _optional_date(
            _field(row, "公告日期", "公告日", "NOTICE_DATE", "notice_date"),
            "notice_date",
            errors,
            "AKSHARE_FINANCIAL_NOTICE_DATE_INVALID",
            source,
        )
        cashflow_net_profit = _field(row, "现金流量表净利润", "NETPROFIT", "cashflow_net_profit")
        if cashflow_net_profit is None and source == "stock_financial_report_sina":
            cashflow_net_profit = _field(row, "净利润")
        result.append({
            "ts_code": normalized_code,
            "observed_at": observed_at,
            "report_date": report_date,
            "notice_date": notice_date,
            "report_type": str(_field(row, "报告类型", "REPORT_TYPE", "report_type") or "").strip() or None,
            "report_date_name": str(_field(row, "报告期名称", "REPORT_DATE_NAME", "report_date_name") or "").strip() or None,
            "industry": str(_field(row, "行业", "所属行业", "ORG_TYPE", "industry") or "").strip() or None,
            "interest_expense": interest_expense,
            "interest_expense_source_field": interest_expense_source_field,
            "interest_bearing_debt": _debt_total(interest_bearing_debt_components, row),
            "interest_bearing_debt_components": interest_bearing_debt_components,
            "accounts_receivable": _number(_field(row, "应收账款", "应收账款(合计)", "ACCOUNTS_RECE", "accounts_receivable")),
            "inventory": _number(_field(row, "存货", "INVENTORY", "inventory")),
            "contract_liabilities": _number(_field(row, "合同负债", "CONTRACT_LIAB", "contract_liabilities")),
            "revenue": _number(_field(row, "营业总收入", "营业收入", "营业总收入(元)", "TOTAL_OPERATE_INCOME", "TOTALOPERATEREVE", "OPERATE_INCOME", "revenue")),
            "roe": _number(_field(row, "净资产收益率(%)", "净资产收益率", "ROE", "ROEJQ", "roe")),
            "revenue_yoy": _number(_field(row, "营业总收入同比增长率(%)", "营业收入同比增长率", "TOTAL_OPERATE_INCOME_YOY", "TOTALOPERATEREVETZ", "OPERATE_INCOME_YOY", "revenue_yoy")),
            "net_profit": _number(_field(row, "净利润", "归母净利润", "归属母公司股东的净利润", "PARENT_NETPROFIT", "NETPROFIT", "net_profit")),
            "cashflow_net_profit": _number(cashflow_net_profit),
            "net_profit_yoy": _number(_field(row, "净利润同比增长率(%)", "净利润同比", "PARENT_NETPROFIT_YOY", "PARENTNETPROFITTZ", "NETPROFIT_YOY", "net_profit_yoy")),
            "adjusted_net_profit": _number(_field(row, "扣非净利润", "扣除非经常性损益后的净利润", "DEDUCT_PARENT_NETPROFIT", "KCFJCXSYJLR", "adjusted_net_profit")),
            "adjusted_net_profit_yoy": _number(_field(row, "扣非净利润同比增长率(%)", "扣非净利润同比", "DEDUCT_PARENT_NETPROFIT_YOY", "KCFJCXSYJLRTZ", "adjusted_net_profit_yoy")),
            "gross_margin": _number(_field(row, "销售毛利率(%)", "毛利率", "XSMLL", "gross_margin")),
            "net_margin": _number(_field(row, "销售净利率(%)", "净利率", "XSJLL", "net_margin")),
            "debt_asset_ratio": _number(_field(row, "资产负债率(%)", "资产负债率", "DEBT_ASSET_RATIO", "ZCFZL", "debt_asset_ratio")),
            "operating_cashflow_to_revenue": _number(_field(row, "经营现金流/营业收入", "经营活动现金流量净额/营业收入", "经营现金流与营业收入比", "ocf_to_or", "JYXJLYYSR", "operating_cashflow_to_revenue")),
            "operating_cashflow_per_share": _number(_field(row, "每股经营现金流", "每股经营现金流量净额", "经营现金流/股", "ocfps", "MGJYXJJE", "operating_cashflow_per_share")),
            "cash_ratio": _number(_field(row, "现金比率", "现金流量比率", "CASH_RATIO", "cash_ratio")),
            "interest_coverage": _number(_field(row, "利息保障倍数", "利息覆盖倍数", "INTEREST_COVERAGE_RATIO", "interest_coverage")),
            "interest_bearing_debt_ratio": _number(_field(row, "带息负债率", "带息负债比率", "INTEREST_DEBT_RATIO", "interest_bearing_debt_ratio")),
            "total_liability": _number(_field(row, "负债合计", "负债总额", "TOTAL_LIABILITIES", "LIABILITY", "total_liability")),
            "roic": _number(_field(row, "投入资本回报率", "ROIC", "roic")),
        })
    deduplicated = {row["report_date"]: row for row in result}
    ordered = sorted(deduplicated.values(), key=lambda item: item["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))], errors


def normalize_cashflow_rows(
    ts_code: str,
    raw: Any,
    observed_at: str,
    limit: int = 8,
    source: str = "cashflow",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        if not _row_matches_ts_code(row, normalized_code):
            errors.append(BridgeError("AKSHARE_CASHFLOW_ROW_MISMATCHED", "cashflow row code does not match the requested stock", source))
            continue
        try:
            report_date = normalize_date(_field(row, "报告期", "报告日期", "报告日", "日期", "REPORT_DATE", "report_date", "截止日期"), "report_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ROW_INVALID", "cashflow row has an invalid date", source))
            continue
        if not report_date:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ROW_INVALID", "cashflow row has no report date", source))
            continue
        notice_date = _optional_date(
            _field(row, "公告日期", "公告日", "NOTICE_DATE", "notice_date"),
            "notice_date",
            errors,
            "AKSHARE_CASHFLOW_NOTICE_DATE_INVALID",
            source,
        )
        interest_expense, interest_expense_source_field = _interest_expense(row)
        interest_bearing_debt_components = _debt_components(row)
        result.append({
            "ts_code": normalized_code,
            "observed_at": observed_at,
            "report_date": report_date,
            "notice_date": notice_date,
            "operating_cashflow": _number(_field(row, "经营活动产生的现金流量净额", "经营活动现金流量净额", "经营活动产生的现金流量净额(元)", "n_cashflow_act", "NETCASH_OPERATE", "operating_cashflow")),
            "capital_expenditure": _number(_field(row, "购建固定资产、无形资产和其他长期资产支付的现金", "购建固定资产、无形资产和其他长期资产所支付的现金", "购建长期资产支出", "c_pay_acq_const_fiolta", "CONSTRUCT_LONG_ASSET", "capital_expenditure")),
            "net_profit": _number(_field(row, "净利润", "NETPROFIT", "net_profit")),
            "cash_dividends_paid": _number(_field(row, "分配股利、利润或偿付利息支付的现金", "分配股利、利润或偿付利息支付的现金(元)", "ASSIGN_DIVIDEND_PORFIT", "assign_dividend_porfit", "cash_dividends_paid")),
            "interest_expense": interest_expense,
            "interest_expense_source_field": interest_expense_source_field,
            "interest_bearing_debt": _debt_total(interest_bearing_debt_components, row),
            "interest_bearing_debt_components": interest_bearing_debt_components,
        })
    deduplicated = {row["report_date"]: row for row in result}
    ordered = sorted(deduplicated.values(), key=lambda item: item["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))], errors


THS_CASHFLOW_METRIC_FIELDS = {
    "act_cash_flow_net": "operating_cashflow",
    "operating_cash_flow_net": "operating_cashflow",
    "pay_fixed_assets_etc_cash": "capital_expenditure",
    "construct_long_asset": "capital_expenditure",
    "cash_net_profit": "net_profit",
    "pay_dividends_profits_interest_cash": "cash_dividends_paid",
    "assign_dividend_porfit": "cash_dividends_paid",
}


def normalize_ths_cashflow_rows(
    ts_code: str,
    raw: Any,
    observed_at: str,
    limit: int = 8,
    source: str = "stock_financial_cash_new_ths",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    grouped: dict[str, dict[str, Any]] = {}
    for row in _rows(raw):
        metric_name = _text(_field(row, "metric_name", "metricName", "指标名称"))
        target_field = THS_CASHFLOW_METRIC_FIELDS.get(metric_name.casefold() if metric_name else "")
        if target_field is None:
            continue
        try:
            report_date = normalize_date(_field(row, "report_date", "REPORT_DATE", "报告期", "报告日期"), "report_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ROW_INVALID", "cashflow row has an invalid date", source))
            continue
        if not report_date:
            errors.append(BridgeError("AKSHARE_CASHFLOW_ROW_INVALID", "cashflow row has no report date", source))
            continue
        normalized = grouped.setdefault(report_date, {
            "ts_code": normalized_code,
            "report_date": report_date,
        })
        value = _number(_field(row, "value", "VALUE"))
        if normalized.get(target_field) is None and value is not None:
            normalized[target_field] = value
    if not grouped:
        return [], errors
    normalized_rows, normalize_errors = normalize_cashflow_rows(normalized_code, grouped.values(), observed_at, limit=limit, source=source)
    return normalized_rows, [*errors, *normalize_errors]


def normalize_capital_structure_rows(
    ts_code: str,
    raw: Any,
    limit: int = 20,
    source: str = "stock_share_change_cninfo",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        returned_code = _field(row, "证券代码", "SECCODE", "SECURITY_CODE", "security_code", "ts_code")
        if returned_code is not None and _row_code(returned_code) != normalized_code.split(".", 1)[0]:
            errors.append(BridgeError("AKSHARE_CAPITAL_ROW_MISMATCHED", "capital structure row code does not match the requested stock", source))
            continue
        try:
            report_date = normalize_date(_field(row, "变动日期", "VARYDATE", "REPORT_DATE", "report_date"), "capital structure report date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_CAPITAL_ROW_INVALID", "capital structure row has an invalid date", source))
            continue
        if not report_date:
            errors.append(BridgeError("AKSHARE_CAPITAL_ROW_INVALID", "capital structure row has no report date", source))
            continue
        raw_total_shares = _number(_field(row, "总股本", "F003N", "TOTAL_SHARES", "total_shares"))
        total_shares = round(raw_total_shares * 10_000, 0) if raw_total_shares is not None else None
        if total_shares is not None and not math.isfinite(total_shares):
            total_shares = None
        change_reason = _text(_field(row, "变动原因", "F002V", "CHANGE_REASON", "change_reason"))
        if total_shares is None and change_reason is None:
            errors.append(BridgeError("AKSHARE_CAPITAL_ROW_INVALID", "capital structure row has no usable fields", source))
            continue
        result.append({
            "ts_code": normalized_code,
            "report_date": report_date,
            "total_shares": total_shares,
            "change_reason": change_reason,
        })
    deduplicated = {
        f"{row['report_date']}:{row['total_shares']}:{row['change_reason']}": row
        for row in result
    }
    ordered = sorted(deduplicated.values(), key=lambda item: item["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 20))], errors


def _forecast_year(value: Any) -> str | None:
    text = _text(value)
    if not text:
        return None
    match = re.search(r"(?<!\d)(20\d{2})(?!\d)", text)
    return match.group(1) if match else None


def _forecast_year_columns(row: Mapping[str, Any]) -> list[tuple[str, str]]:
    columns: list[tuple[str, str]] = []
    for key in row:
        match = re.search(r"(?<!\d)(20\d{2})[^\d]*预测每股收益", key)
        if match:
            columns.append((match.group(1), key))
    return columns


def normalize_profit_forecast_rows(
    ts_code: str,
    raw: Any,
    limit: int = 8,
    source: str = "stock_profit_forecast_ths",
    metric: str = "eps",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    requested_code = normalized_code.split(".", 1)[0]
    for row in _rows(raw):
        returned_code = _field(row, "代码", "证券代码", "SECURITY_CODE", "security_code", "ts_code")
        if returned_code is not None and _row_code(returned_code) != requested_code:
            errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ROW_MISMATCHED", "profit forecast row code does not match the requested stock", source))
            continue

        direct_year = _forecast_year(_field(row, "年度", "预测年度", "forecast_year", "year"))
        year_columns = _forecast_year_columns(row) if direct_year is None else [(direct_year, "")]
        if not year_columns:
            errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ROW_INVALID", "profit forecast row has no forecast year", source))
            continue

        for forecast_year, dynamic_key in year_columns:
            if metric == "net_profit_100m":
                average = _number(_field(row, "均值", "平均值", "预测年报净利润", "forecast_net_profit_100m_average"))
                low = _number(_field(row, "最小值", "forecast_net_profit_100m_low"))
                high = _number(_field(row, "最大值", "forecast_net_profit_100m_high"))
                if average is None and low is None and high is None:
                    errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ROW_INVALID", "profit forecast row has no usable net profit value", source))
                    continue
                result.append({
                    "ts_code": normalized_code,
                    "source": source,
                    "forecast_year": forecast_year,
                    "forecast_net_profit_100m_low": low,
                    "forecast_net_profit_100m_average": average,
                    "forecast_net_profit_100m_high": high,
                })
                continue

            average = _number(row.get(dynamic_key)) if dynamic_key else _number(_field(row, "均值", "平均值", "预测每股收益", "forecast_eps_average"))
            low = _number(_field(row, "最小值", "forecast_eps_low"))
            high = _number(_field(row, "最大值", "forecast_eps_high"))
            analyst_count = _number(_field(row, "预测机构数", "机构数", "研报数", "analyst_count"))
            industry_average = _number(_field(row, "行业平均值", "行业平均数", "industry_average_eps"))
            if average is None and low is None and high is None:
                errors.append(BridgeError("AKSHARE_PROFIT_FORECAST_ROW_INVALID", "profit forecast row has no usable EPS value", source))
                continue
            result.append({
                "ts_code": normalized_code,
                "source": source,
                "forecast_year": forecast_year,
                "forecast_eps_low": low,
                "forecast_eps_average": average,
                "forecast_eps_high": high,
                "analyst_count": analyst_count,
                "industry_average_eps": industry_average,
            })

    deduplicated: dict[str, dict[str, Any]] = {}
    for row in result:
        key = f"{row['forecast_year']}"
        existing = deduplicated.get(key)
        if existing is None:
            deduplicated[key] = row
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
    ordered = sorted(deduplicated.values(), key=lambda item: item["forecast_year"], reverse=True)
    return ordered[:max(1, min(limit, 12))], errors


def normalize_repurchase_rows(
    ts_code: str,
    raw: Any,
    limit: int = 12,
    source: str = "stock_repurchase_em",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    requested_code = normalized_code.split(".", 1)[0]
    for row in _rows(raw):
        returned_code = _row_code(_field(row, "股票代码", "SECURITY_CODE", "security_code", "ts_code", "tsCode", "代码", "code"))
        if returned_code != requested_code:
            continue
        announcement_date = _repurchase_date(
            _field(row, "最新公告日期", "公告日期", "NOTICE_DATE", "notice_date", "UPD", "announcement_date"),
            "announcement_date",
            errors,
            source,
        )
        start_date = _repurchase_date(
            _field(row, "回购起始时间", "回购开始时间", "REPURSTARTDATE", "start_date", "startDate"),
            "start_date",
            errors,
            source,
        )
        end_date = _repurchase_date(
            _field(row, "回购结束时间", "回购终止时间", "REPURENDDATE", "end_date", "endDate"),
            "end_date",
            errors,
            source,
        )
        finish_date = _repurchase_date(
            _field(row, "完成日期", "实施完成日期", "FINISHDATE", "finish_date", "finishDate"),
            "finish_date",
            errors,
            source,
        )
        progress = _field(row, "实施进度", "回购实施进度", "REPURPROGRESS", "progress")
        progress_text = _text(progress)
        planned_amount_lower = _number(_field(
            row,
            "计划回购金额区间-下限",
            "计划回购金额下限",
            "REPURAMOUNTLOWER",
            "planned_amount_lower",
        ))
        planned_amount_upper = _number(_field(
            row,
            "计划回购金额区间-上限",
            "计划回购金额上限",
            "REPURAMOUNTLIMIT",
            "planned_amount_upper",
        ))
        repurchase_amount = _number(_field(row, "已回购金额", "REPURAMOUNT", "repurchase_amount", "repurchaseAmount"))
        repurchase_shares = _number(_field(row, "已回购股份数量", "已回购股份数", "REPURNUM", "repurchase_shares", "repurchaseShares"))
        if not any(value is not None for value in (
            announcement_date,
            start_date,
            end_date,
            finish_date,
            progress_text,
            planned_amount_lower,
            planned_amount_upper,
            repurchase_amount,
            repurchase_shares,
        )):
            errors.append(BridgeError("AKSHARE_REPURCHASE_ROW_INVALID", "repurchase row has no usable fields", source))
            continue
        identity = [
            announcement_date or "",
            start_date or "",
            str(planned_amount_lower) if planned_amount_lower is not None else "",
            str(planned_amount_upper) if planned_amount_upper is not None else "",
        ]
        result.append({
            "ts_code": normalized_code,
            "repurchase_code": f"akshare:{':'.join(identity)}" if any(identity) else None,
            "announcement_date": announcement_date,
            "start_date": start_date,
            "end_date": end_date,
            "finish_date": finish_date,
            "progress": progress_text,
            "planned_amount_lower": planned_amount_lower,
            "planned_amount_upper": planned_amount_upper,
            "repurchase_amount": repurchase_amount,
            "repurchase_shares": repurchase_shares,
        })
    deduplicated = {
        row["repurchase_code"] or f"{row['announcement_date']}:{row['start_date']}:{row['planned_amount_lower']}:{row['planned_amount_upper']}": row
        for row in result
    }
    ordered = sorted(
        deduplicated.values(),
        key=lambda item: f"{item['announcement_date'] or ''}:{item['start_date'] or ''}",
        reverse=True,
    )
    return ordered[:max(1, min(limit, 20))], errors


def normalize_dividend_rows(
    ts_code: str,
    raw: Any,
    limit: int = 60,
    source: str = "stock_history_dividend_detail",
) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        announcement_date = _dividend_date(
            _field(row, "公告日期", "ANN_DATE", "ann_date", "announcement_date"),
            "ann_date",
            errors,
            source,
        )
        ex_date = _dividend_date(
            _field(row, "除权除息日", "EX_DATE", "ex_date", "exDate"),
            "ex_date",
            errors,
            source,
        )
        pay_date = _dividend_date(
            _field(row, "红利发放日", "PAY_DATE", "pay_date", "payDate"),
            "pay_date",
            errors,
            source,
        )
        event_date = announcement_date or ex_date or pay_date
        if event_date is None:
            errors.append(BridgeError("AKSHARE_DIVIDEND_ROW_INVALID", "dividend row has no usable event date", source))
            continue
        cash_per_ten_shares = _number(_field(row, "派息", "CASH_DIV_PER_TEN", "cash_div_per_ten", "cash_div"))
        cash_div = round(cash_per_ten_shares / 10, 6) if cash_per_ten_shares is not None else None
        result.append({
            "ts_code": normalized_code,
            "end_date": event_date,
            "ann_date": announcement_date,
            "div_proc": _text(_field(row, "进度", "DIV_PROC", "div_proc", "progress")),
            "cash_div": cash_div,
            "ex_date": ex_date,
            "pay_date": pay_date,
        })
    deduplicated = {
        f"{row['end_date']}:{row['ann_date'] or ''}:{row['div_proc'] or ''}:{row['ex_date'] or ''}:{row['pay_date'] or ''}": row
        for row in result
    }
    ordered = sorted(
        deduplicated.values(),
        key=lambda item: f"{item['pay_date'] or item['ex_date'] or item['ann_date'] or item['end_date']}",
        reverse=True,
    )
    return ordered[:max(1, min(limit, 60))], errors


def build_evidence(
    ts_code: str,
    observed_at: str,
    daily_bars: list[dict[str, Any]],
    financials: list[dict[str, Any]],
    cashflows: list[dict[str, Any]] | None = None,
) -> list[BridgeEvidence]:
    cashflow_rows = cashflows or []
    latest_date = daily_bars[-1]["trade_date"] if daily_bars else None
    return20: float | None = None
    if len(daily_bars) >= 20:
        base_close = _number(daily_bars[-20].get("close"))
        latest_close = _number(daily_bars[-1].get("close"))
        if base_close is not None and base_close > 0 and latest_close is not None:
            return20 = round((latest_close / base_close - 1) * 100, 2)

    def value_status(value: float | None, passes: Any, cautions: Any) -> str:
        if value is None:
            return "missing"
        if passes(value):
            return "pass"
        if cautions(value):
            return "caution"
        return "fail"

    daily_return_status = value_status(return20, lambda value: value >= 0, lambda value: value >= -10)
    daily_return_detail = {
        "pass": "最近 20 个交易日收盘价保持正向变化",
        "caution": "最近 20 个交易日收盘价小幅回落，需结合趋势结构复核",
        "fail": "最近 20 个交易日收盘价明显回落",
        "missing": "有效日线少于 20 根，暂不计算区间收益",
    }[daily_return_status]

    latest_financial = financials[0] if financials else {}
    financial_date = latest_financial.get("report_date") if isinstance(latest_financial.get("report_date"), str) else None

    def financial_factor(
        key: str,
        label: str,
        field: str,
        threshold: str,
        passes: Any,
        cautions: Any,
        pass_detail: str,
        caution_detail: str,
        fail_detail: str,
        missing_detail: str,
    ) -> BridgeEvidence:
        value = _number(latest_financial.get(field))
        status = value_status(value, passes, cautions)
        detail = {
            "pass": pass_detail,
            "caution": caution_detail,
            "fail": fail_detail,
            "missing": missing_detail,
        }[status]
        return BridgeEvidence(
            key=key,
            dimension="quality",
            label=label,
            status=status,
            value=value,
            threshold=threshold,
            source="AkShare stock_financial_analysis_indicator",
            observed_at=financial_date,
            formula_version=FORMULA_VERSION,
            detail=detail,
        )

    return [
        BridgeEvidence(
            key="akshare-daily-sample",
            dimension="trend",
            label="AkShare 日线样本",
            status="pass" if len(daily_bars) >= 60 else "caution" if daily_bars else "missing",
            value=float(len(daily_bars)),
            threshold="至少 60 根有效日线",
            source="AkShare stock_zh_a_hist",
            observed_at=latest_date,
            formula_version=FORMULA_VERSION,
            detail="AkShare bridge 已返回标准化日线" if daily_bars else "AkShare 未返回有效日线",
        ),
        BridgeEvidence(
            key="akshare-return20",
            dimension="trend",
            label="AkShare 20 日收益",
            status=daily_return_status,
            value=return20,
            threshold="不低于 0%；-10% 至 0% 为观察区",
            source="AkShare stock_zh_a_hist",
            observed_at=latest_date,
            formula_version=FORMULA_VERSION,
            detail=daily_return_detail,
        ),
        BridgeEvidence(
            key="akshare-financial-sample",
            dimension="quality",
            label="AkShare 财报样本",
            status="pass" if len(financials) >= 2 else "caution" if financials else "missing",
            value=float(len(financials)),
            threshold="至少 2 期标准化财务记录",
            source="AkShare stock_financial_analysis_indicator",
            observed_at=observed_at,
            formula_version=FORMULA_VERSION,
            detail="可用于交叉核对财报方向" if financials else "AkShare 未返回有效财务记录",
        ),
        BridgeEvidence(
            key="akshare-cashflow-sample",
            dimension="shareholder-return",
            label="AkShare 现金流样本",
            status="pass" if len(cashflow_rows) >= 2 else "caution" if cashflow_rows else "missing",
            value=float(len(cashflow_rows)),
            threshold="至少 2 期标准化现金流记录",
            source="AkShare cashflow endpoint",
            observed_at=cashflow_rows[0].get("report_date") if cashflow_rows else None,
            formula_version=FORMULA_VERSION,
            detail="可用于补充自由现金流核心字段" if cashflow_rows else "AkShare 未返回有效现金流记录",
        ),
        financial_factor(
            "akshare-roe",
            "AkShare ROE",
            "roe",
            "至少 10%；行业与多期持续性需另行核对",
            lambda value: value >= 10,
            lambda value: value >= 0,
            "ROE 达到基础价值研究门槛",
            "ROE 为正但低于 10%，需要结合行业比较",
            "ROE 为负，需要核对盈利质量",
            "未返回 ROE",
        ),
        financial_factor(
            "akshare-revenue-yoy",
            "AkShare 营收同比",
            "revenue_yoy",
            "不低于 0%；-10% 至 0% 为观察区",
            lambda value: value >= 0,
            lambda value: value >= -10,
            "营收同比保持正增长",
            "营收同比小幅回落，需要结合行业周期核对",
            "营收同比明显下降",
            "未返回营收同比",
        ),
        financial_factor(
            "akshare-net-profit-yoy",
            "AkShare 净利润同比",
            "net_profit_yoy",
            "不低于 0%；-10% 至 0% 为观察区",
            lambda value: value >= 0,
            lambda value: value >= -10,
            "净利润同比保持正增长",
            "净利润同比小幅回落，需要结合利润质量核对",
            "净利润同比明显下降",
            "未返回净利润同比",
        ),
        financial_factor(
            "akshare-gross-margin",
            "AkShare 毛利率",
            "gross_margin",
            "至少 20%；行业比较优先",
            lambda value: value >= 20,
            lambda value: value >= 0,
            "毛利率达到通用研究参考线",
            "毛利率为正但低于通用参考线，需结合行业比较",
            "毛利率为负，需要核对收入与成本口径",
            "未返回毛利率",
        ),
        financial_factor(
            "akshare-net-margin",
            "AkShare 净利率",
            "net_margin",
            "至少 10%；行业比较优先",
            lambda value: value >= 10,
            lambda value: value >= 0,
            "净利率达到通用研究参考线",
            "净利率为正但低于通用参考线，需结合行业比较",
            "净利率为负，需要核对盈利质量",
            "未返回净利率",
        ),
        financial_factor(
            "akshare-debt-asset-ratio",
            "AkShare 资产负债率",
            "debt_asset_ratio",
            "不高于 60%；60% 至 75% 为观察区",
            lambda value: value <= 60,
            lambda value: value <= 75,
            "资产负债率处于通用研究参考区间",
            "资产负债率偏高，需要结合行业资本结构核对",
            "资产负债率较高，需优先核对偿债压力",
            "未返回资产负债率",
        ),
    ]
