import unittest

from quant_akshare_bridge.contracts import BridgeRequest
from quant_akshare_bridge.normalizer import akshare_symbol, normalize_daily_rows, normalize_date, normalize_financial_rows, normalize_ts_code


class NormalizerTest(unittest.TestCase):
    def test_normalizes_codes_and_daily_aliases(self) -> None:
        self.assertEqual(normalize_ts_code("601899.sh"), "601899.SH")
        self.assertEqual(akshare_symbol("601899.SH"), "601899")
        bars, errors = normalize_daily_rows("601899.SH", [{
            "日期": "2026-08-25",
            "开盘": "10.0",
            "收盘": 10.5,
            "最高": 11,
            "最低": 9.8,
            "成交量": 1000,
            "成交额": 10000,
            "涨跌幅": 1.2,
        }])
        self.assertEqual(errors, [])
        self.assertEqual(bars[0]["trade_date"], "20260825")
        self.assertEqual(bars[0]["close"], 10.5)
        self.assertIsNone(bars[0]["pre_close"])

    def test_keeps_invalid_rows_as_classified_errors(self) -> None:
        bars, errors = normalize_daily_rows("601899.SH", [{"日期": "bad", "收盘": 1}])
        self.assertEqual(bars, [])
        self.assertEqual(errors[0].code, "AKSHARE_DAILY_ROW_INVALID")

    def test_rejects_invalid_calendar_dates_and_trailing_text(self) -> None:
        self.assertEqual(normalize_date("2026-08-25"), "20260825")
        with self.assertRaises(ValueError):
            normalize_date("2026-02-30")
        with self.assertRaises(ValueError):
            normalize_date("20260825-extra")

    def test_normalizes_financial_aliases_and_bounds_rows(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [
            {"日期": "2026-06-30", "净资产收益率(%)": "12.5", "净利润同比增长率(%)": 8},
            {"日期": "2025-12-31", "净资产收益率(%)": "11.5"},
        ], "2026-08-26T00:00:00Z")
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["roe"], 12.5)
        self.assertEqual(rows[0]["net_profit_yoy"], 8.0)

    def test_keeps_valid_financial_rows_when_one_row_has_an_invalid_date(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [
            {"日期": "2026-02-30", "净资产收益率(%)": "12.5"},
            {"日期": "2025-12-31", "净资产收益率(%)": "11.5"},
        ], "2026-08-26T00:00:00Z")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["report_date"], "20251231")
        self.assertEqual(errors[0].code, "AKSHARE_FINANCIAL_ROW_INVALID")

    def test_request_contract_is_explicit(self) -> None:
        request = BridgeRequest(ts_code="600089.SH", start_date="20260101", end_date="20260826")
        self.assertEqual(request.ts_code, "600089.SH")


if __name__ == "__main__":
    unittest.main()
