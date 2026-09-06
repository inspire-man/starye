import unittest

from quant_akshare_bridge.adapter import collect_evidence
from quant_akshare_bridge.contracts import BridgeRequest


class FakeAkShare:
    def stock_zh_a_hist(self, **_kwargs):
        return [{
            "日期": "2026-08-25",
            "开盘": "10",
            "收盘": "10.5",
            "最高": "11",
            "最低": "9.8",
            "成交量": "1000",
        }]

    def stock_individual_info_em(self, **_kwargs):
        return [{"item": "股票简称", "value": "紫金矿业"}]

    def stock_financial_analysis_indicator(self, **_kwargs):
        return [{"日期": "2026-06-30", "净资产收益率(%)": "12.5"}]

    def stock_profit_sheet_by_report_em(self, **_kwargs):
        return [{
            "REPORT_DATE": "2026-06-30",
            "TOTAL_OPERATE_INCOME": 1000,
            "TOTAL_OPERATE_INCOME_YOY": 12,
            "PARENT_NETPROFIT": 200,
            "PARENT_NETPROFIT_YOY": 20,
            "DEDUCT_PARENT_NETPROFIT": 180,
            "DEDUCT_PARENT_NETPROFIT_YOY": 18,
            "FE_INTEREST_EXPENSE": 25,
        }]

    def stock_balance_sheet_by_report_em(self, **_kwargs):
        return [{
            "REPORT_DATE": "2026-06-30",
            "TOTAL_LIABILITIES": 500,
            "SHORT_LOAN": 400,
            "LONG_LOAN": 500,
            "LEASE_LIAB": 100,
        }]

    def stock_cash_flow_sheet_by_report_em(self, **_kwargs):
        return [{
            "报告期": "2026-06-30",
            "经营活动产生的现金流量净额": 1000,
            "购建固定资产、无形资产和其他长期资产支付的现金": 300,
            "净利润": 200,
        }]


class AdapterTest(unittest.TestCase):
    def test_returns_standardized_contract_without_dataframe(self) -> None:
        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), FakeAkShare())
        payload = result.to_dict()
        self.assertEqual(payload["schema_version"], "quant-akshare-v1")
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["identity"], {"name": "紫金矿业"})
        self.assertEqual(payload["daily_bars"][0]["trade_date"], "20260825")
        self.assertEqual(payload["evidence"][0]["key"], "akshare-daily-sample")
        self.assertIn("akshare-roe", {item["key"] for item in payload["evidence"]})
        self.assertIn("akshare-return20", {item["key"] for item in payload["evidence"]})
        self.assertEqual(payload["cashflows"][0]["operating_cashflow"], 1000.0)
        self.assertEqual(payload["cashflows"][0]["interest_expense"], 25.0)
        self.assertEqual(payload["cashflows"][0]["interest_expense_source_field"], "FE_INTEREST_EXPENSE")
        self.assertEqual(payload["cashflows"][0]["interest_bearing_debt"], 1000.0)
        self.assertEqual(payload["cashflows"][0]["interest_bearing_debt_components"]["short_loan"], 400.0)
        self.assertIn("stock_cash_flow_sheet_by_report_em", payload["source"]["endpoints"])
        self.assertEqual(payload["financials"][0]["revenue"], 1000.0)
        self.assertEqual(payload["financials"][0]["net_profit"], 200.0)
        self.assertEqual(payload["financials"][0]["total_liability"], 500.0)
        self.assertIn("stock_profit_sheet_by_report_em", payload["source"]["endpoints"])
        self.assertIn("stock_balance_sheet_by_report_em", payload["source"]["endpoints"])

    def test_marks_provider_failure_as_unavailable(self) -> None:
        class BrokenAkShare:
            def stock_zh_a_hist(self, **_kwargs):
                raise RuntimeError("upstream")

            def stock_individual_info_em(self, **_kwargs):
                raise RuntimeError("upstream")

            def stock_financial_analysis_indicator(self, **_kwargs):
                raise RuntimeError("upstream")

        result = collect_evidence(BridgeRequest(ts_code="600089.SH"), BrokenAkShare())
        self.assertEqual(result.status, "unavailable")
        self.assertTrue(result.errors)
        self.assertNotIn("upstream", result.to_dict())

    def test_omits_financial_endpoint_when_not_requested(self) -> None:
        class DailyOnlyAkShare(FakeAkShare):
            def stock_financial_analysis_indicator(self, **_kwargs):
                raise AssertionError("financial endpoint should not be called")

        result = collect_evidence(BridgeRequest(ts_code="601899.SH", include_financials=False), DailyOnlyAkShare())
        self.assertEqual(result.financials, [])
        self.assertEqual(result.cashflows, [])
        self.assertNotIn("stock_financial_analysis_indicator", result.source.endpoints)

    def test_uses_sina_cashflow_endpoint_when_report_endpoint_is_missing(self) -> None:
        class SinaCashflowAkShare(FakeAkShare):
            def stock_cash_flow_sheet_by_report_em(self, **_kwargs):
                raise AssertionError("report endpoint should not be called")

            def stock_financial_report_sina(self, **_kwargs):
                return [{
                    "报告期": "2026-06-30",
                    "经营活动产生的现金流量净额": 1000,
                    "购建固定资产、无形资产和其他长期资产支付的现金": 300,
                    "净利润": 200,
                }]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), SinaCashflowAkShare())
        self.assertEqual(result.status, "ready")
        self.assertEqual(result.cashflows[0]["capital_expenditure"], 300.0)
        self.assertIn("stock_financial_report_sina", result.source.endpoints)

    def test_skips_statement_endpoints_when_financial_targets_are_complete(self) -> None:
        class CompleteFinancialAkShare(FakeAkShare):
            def stock_financial_analysis_indicator(self, **_kwargs):
                return [{
                    "日期": "2026-06-30",
                    "营业总收入": 1000,
                    "营业总收入同比增长率(%)": 12,
                    "净利润": 200,
                    "净利润同比增长率(%)": 20,
                    "扣非净利润": 180,
                    "扣非净利润同比增长率(%)": 18,
                    "负债合计": 500,
                    "FE_INTEREST_EXPENSE": 25,
                    "interest_bearing_debt": 500,
                }]

            def stock_profit_sheet_by_report_em(self, **_kwargs):
                raise AssertionError("profit statement should not be called")

            def stock_balance_sheet_by_report_em(self, **_kwargs):
                raise AssertionError("balance sheet should not be called")

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), CompleteFinancialAkShare())

        self.assertNotIn("stock_profit_sheet_by_report_em", result.source.endpoints)
        self.assertNotIn("stock_balance_sheet_by_report_em", result.source.endpoints)

    def test_keeps_profit_statement_data_when_balance_statement_fails(self) -> None:
        class BrokenBalanceAkShare(FakeAkShare):
            def stock_balance_sheet_by_report_em(self, **_kwargs):
                raise RuntimeError("upstream")

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), BrokenBalanceAkShare())

        self.assertEqual(result.financials[0]["revenue"], 1000.0)
        self.assertIsNone(result.financials[0]["total_liability"])
        self.assertEqual(result.status, "partial")
        self.assertTrue(any(error.code == "AKSHARE_FINANCIAL_ENDPOINT_FAILED" and error.source == "stock_balance_sheet_by_report_em" for error in result.errors))

    def test_uses_quarterly_cashflow_source_after_report_source_fails(self) -> None:
        class QuarterlyCashflowAkShare(FakeAkShare):
            def stock_cash_flow_sheet_by_report_em(self, **_kwargs):
                raise RuntimeError("report endpoint")

            def stock_cash_flow_sheet_by_quarterly_em(self, **_kwargs):
                return [
                    {
                        "SECUCODE": "601899.SH",
                        "REPORT_DATE": "2026-06-30",
                        "NETCASH_OPERATE": 1000,
                        "CONSTRUCT_LONG_ASSET": 300,
                        "NETPROFIT": 200,
                    },
                    {
                        "SECUCODE": "601899.SH",
                        "REPORT_DATE": "2025-12-31",
                        "NETCASH_OPERATE": 900,
                        "CONSTRUCT_LONG_ASSET": 250,
                        "NETPROFIT": 180,
                    },
                ]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), QuarterlyCashflowAkShare())

        self.assertEqual(len(result.cashflows), 2)
        self.assertEqual(result.status, "ready")
        self.assertEqual(result.cashflows[0]["operating_cashflow"], 1000.0)
        self.assertIn("stock_cash_flow_sheet_by_quarterly_em", result.source.endpoints)
        self.assertTrue(any(error.code == "AKSHARE_CASHFLOW_ENDPOINT_FAILED" and error.source == "stock_cash_flow_sheet_by_report_em" for error in result.errors))

    def test_uses_tencent_daily_source_after_eastmoney_source_fails(self) -> None:
        class TencentDailyAkShare(FakeAkShare):
            def stock_zh_a_hist(self, **_kwargs):
                raise RuntimeError("Eastmoney daily endpoint")

            def stock_zh_a_hist_tx(self, **_kwargs):
                return [{
                    "date": f"2026-08-{index:02d}",
                    "open": 10,
                    "close": 10.5,
                    "high": 11,
                    "low": 9.8,
                    "volume": 1000,
                    "amount": 10000,
                } for index in range(1, 21)]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), TencentDailyAkShare())

        self.assertEqual(len(result.daily_bars), 20)
        self.assertEqual(result.status, "ready")
        self.assertEqual(result.daily_bars[-1]["trade_date"], "20260820")
        self.assertIn("stock_zh_a_hist_tx", result.source.endpoints)
        self.assertTrue(any(error.code == "AKSHARE_DAILY_ENDPOINT_FAILED" and error.source == "stock_zh_a_hist" for error in result.errors))

    def test_uses_code_name_source_after_individual_info_fails(self) -> None:
        class CodeNameAkShare(FakeAkShare):
            def stock_individual_info_em(self, **_kwargs):
                raise RuntimeError("individual info endpoint")

            def stock_info_a_code_name(self, **_kwargs):
                return [
                    {"code": "000001", "name": "错误样本"},
                    {"code": "601899", "name": "紫金矿业"},
                ]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), CodeNameAkShare())

        self.assertEqual(result.identity, {"name": "紫金矿业"})
        self.assertEqual(result.status, "ready")
        self.assertIn("stock_info_a_code_name", result.source.endpoints)
        self.assertTrue(any(error.code == "AKSHARE_IDENTITY_ENDPOINT_FAILED" and error.source == "stock_individual_info_em" for error in result.errors))

    def test_uses_yearly_statement_sources_after_report_sources_fail(self) -> None:
        class YearlyStatementAkShare(FakeAkShare):
            def stock_profit_sheet_by_report_em(self, **_kwargs):
                raise RuntimeError("profit report endpoint")

            def stock_profit_sheet_by_yearly_em(self, **_kwargs):
                return [{
                    "SECUCODE": "601899.SH",
                    "REPORT_DATE": "2026-06-30",
                    "TOTAL_OPERATE_INCOME": 1000,
                    "TOTAL_OPERATE_INCOME_YOY": 12,
                    "PARENT_NETPROFIT": 200,
                    "PARENT_NETPROFIT_YOY": 20,
                    "DEDUCT_PARENT_NETPROFIT": 180,
                    "DEDUCT_PARENT_NETPROFIT_YOY": 18,
                    "FE_INTEREST_EXPENSE": 25,
                }]

            def stock_balance_sheet_by_report_em(self, **_kwargs):
                raise RuntimeError("balance report endpoint")

            def stock_balance_sheet_by_yearly_em(self, **_kwargs):
                return [{
                    "SECUCODE": "601899.SH",
                    "REPORT_DATE": "2026-06-30",
                    "TOTAL_LIABILITIES": 500,
                    "SHORT_LOAN": 400,
                    "LONG_LOAN": 500,
                }]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), YearlyStatementAkShare())

        self.assertEqual(result.financials[0]["interest_expense"], 25.0)
        self.assertEqual(result.financials[0]["interest_bearing_debt"], 900.0)
        self.assertEqual(result.status, "ready")
        self.assertIn("stock_profit_sheet_by_yearly_em", result.source.endpoints)
        self.assertIn("stock_balance_sheet_by_yearly_em", result.source.endpoints)



if __name__ == "__main__":
    unittest.main()
