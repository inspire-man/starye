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


class AdapterTest(unittest.TestCase):
    def test_returns_standardized_contract_without_dataframe(self) -> None:
        result = collect_evidence(BridgeRequest(ts_code="601899.SH"), FakeAkShare())
        payload = result.to_dict()
        self.assertEqual(payload["schema_version"], "quant-akshare-v1")
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["identity"], {"name": "紫金矿业"})
        self.assertEqual(payload["daily_bars"][0]["trade_date"], "20260825")
        self.assertEqual(payload["evidence"][0]["key"], "akshare-daily-sample")

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
        self.assertNotIn("stock_financial_analysis_indicator", result.source.endpoints)


if __name__ == "__main__":
    unittest.main()
