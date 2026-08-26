from __future__ import annotations

import math
import re
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta
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


def normalize_daily_rows(ts_code: str, raw: Any, limit: int = 120) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        try:
            trade_date = normalize_date(_field(row, "日期", "交易日期", "trade_date"), "trade_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_DAILY_ROW_INVALID", "daily row has an invalid trade date", "stock_zh_a_hist"))
            continue
        close = _number(_field(row, "收盘", "close"))
        open_price = _number(_field(row, "开盘", "open"))
        high = _number(_field(row, "最高", "high"))
        low = _number(_field(row, "最低", "low"))
        if not trade_date or close is None or open_price is None or high is None or low is None:
            errors.append(BridgeError("AKSHARE_DAILY_ROW_INVALID", "daily row is missing required fields", "stock_zh_a_hist"))
            continue
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


def normalize_identity_rows(raw: Any) -> dict[str, Any]:
    name_keys = {"公司简称", "股票简称", "名称", "name"}
    for row in _rows(raw):
        item = str(_field(row, "item", "项目", "字段") or "")
        if item in name_keys:
            value = _field(row, "value", "值", "内容", "name")
            if value is not None and str(value).strip():
                return {"name": str(value).strip()}
    return {}


def normalize_financial_rows(ts_code: str, raw: Any, observed_at: str, limit: int = 4) -> tuple[list[dict[str, Any]], list[BridgeError]]:
    normalized_code = normalize_ts_code(ts_code)
    errors: list[BridgeError] = []
    result: list[dict[str, Any]] = []
    for row in _rows(raw):
        try:
            report_date = normalize_date(_field(row, "日期", "报告期", "REPORT_DATE", "report_date"), "report_date")
        except ValueError:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ROW_INVALID", "financial row has an invalid report date", "stock_financial_analysis_indicator"))
            continue
        if not report_date:
            errors.append(BridgeError("AKSHARE_FINANCIAL_ROW_INVALID", "financial row has no report date", "stock_financial_analysis_indicator"))
            continue
        result.append({
            "ts_code": normalized_code,
            "observed_at": observed_at,
            "report_date": report_date,
            "roe": _number(_field(row, "净资产收益率(%)", "净资产收益率", "ROE", "roe")),
            "revenue_yoy": _number(_field(row, "营业总收入同比增长率(%)", "营业收入同比增长率", "revenue_yoy")),
            "net_profit_yoy": _number(_field(row, "净利润同比增长率(%)", "净利润同比", "net_profit_yoy")),
            "gross_margin": _number(_field(row, "销售毛利率(%)", "毛利率", "gross_margin")),
            "net_margin": _number(_field(row, "销售净利率(%)", "净利率", "net_margin")),
            "debt_asset_ratio": _number(_field(row, "资产负债率(%)", "资产负债率", "debt_asset_ratio")),
        })
    deduplicated = {row["report_date"]: row for row in result}
    ordered = sorted(deduplicated.values(), key=lambda item: item["report_date"], reverse=True)
    return ordered[:max(1, min(limit, 12))], errors


def build_evidence(
    ts_code: str,
    observed_at: str,
    daily_bars: list[dict[str, Any]],
    financials: list[dict[str, Any]],
) -> list[BridgeEvidence]:
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
