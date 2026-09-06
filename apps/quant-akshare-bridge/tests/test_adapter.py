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
        self.assertIn("stock_cash_flow_sheet_by_report_em", payload["source"]["endpoints"])

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
                }]

        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), SinaCashflowAkShare())
        self.assertEqual(result.cashflows[0]["capital_expenditure"], 300.0)
        self.assertIn("stock_financial_report_sina", result.source.endpoints)


if __name__ == "__main__":
    unittest.main()
