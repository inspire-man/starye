import unittest

from quant_akshare_bridge.contracts import BridgeRequest
from quant_akshare_bridge.normalizer import akshare_symbol, build_evidence, normalize_business_segment_rows, normalize_capital_structure_rows, normalize_cashflow_rows, normalize_daily_rows, normalize_date, normalize_dividend_rows, normalize_financial_rows, normalize_identity_rows, normalize_profit_forecast_rows, normalize_repurchase_rows, normalize_ths_cashflow_rows, normalize_ts_code, validate_date_range


class NormalizerTest(unittest.TestCase):
    def test_normalizes_business_segment_rows_and_keeps_missing_gross_margin_null(self) -> None:
        rows, errors = normalize_business_segment_rows("601899.SH", [{
            "股票代码": "601899",
            "报告日期": "2026-06-30",
            "分类类型": "按产品分类",
            "主营构成": "冶炼产铜",
            "主营收入": 31427370000,
            "收入比例": 0.161848,
            "毛利率": float("nan"),
        }, {
            "股票代码": "000001",
            "报告日期": "2026-06-30",
            "分类类型": "按产品分类",
            "主营构成": "其他股票",
            "主营收入": 999,
        }])

        self.assertEqual({error.code for error in errors}, {
            "AKSHARE_SEGMENT_FIELD_INVALID",
            "AKSHARE_SEGMENT_ROW_MISMATCHED",
        })
        self.assertEqual(rows, [{
            "ts_code": "601899.SH",
            "report_date": "20260630",
            "category": "product",
            "name": "冶炼产铜",
            "revenue": 31427370000.0,
            "revenue_ratio": 0.161848,
            "gross_margin": None,
        }])

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

    def test_normalizes_identity_name_and_industry(self) -> None:
        self.assertEqual(normalize_identity_rows([
            {"item": "股票简称", "value": "平安银行"},
            {"item": "行业", "value": "银行"},
        ]), {"name": "平安银行", "industry": "银行"})

    def test_keeps_invalid_rows_as_classified_errors(self) -> None:
        bars, errors = normalize_daily_rows("601899.SH", [{"日期": "bad", "收盘": 1}])
        self.assertEqual(bars, [])
        self.assertEqual(errors[0].code, "AKSHARE_DAILY_ROW_INVALID")

    def test_rejects_invalid_calendar_dates_and_trailing_text(self) -> None:
        self.assertEqual(normalize_date("2026-08-25"), "20260825")
        self.assertEqual(normalize_date("2026-06-30 00:00:00"), "20260630")
        self.assertEqual(normalize_date("2026-06-30T00:00:00.000"), "20260630")
        with self.assertRaises(ValueError):
            normalize_date("2026-02-30")
        with self.assertRaises(ValueError):
            normalize_date("20260825-extra")

    def test_bounds_date_ranges(self) -> None:
        validate_date_range("20160101", "20260101")
        with self.assertRaisesRegex(ValueError, "10 years"):
            validate_date_range("20150101", "20260826")

    def test_normalizes_dividend_detail_and_converts_cash_per_ten_shares(self) -> None:
        rows, errors = normalize_dividend_rows("601899.SH", [
            {
                "公告日期": "2026-08-13",
                "派息": 4.2,
                "进度": "实施",
                "除权除息日": "2026-08-21",
                "红利发放日": "NaT",
            },
            {
                "公告日期": "2026-08-15",
                "派息": 2.49,
                "进度": "预案",
                "除权除息日": None,
                "红利发放日": None,
            },
        ])

        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["end_date"], "20260813")
        self.assertEqual(rows[0]["ann_date"], "20260813")
        self.assertEqual(rows[0]["cash_div"], 0.42)
        self.assertEqual(rows[0]["div_proc"], "实施")
        self.assertEqual(rows[0]["ex_date"], "20260821")
        self.assertIsNone(rows[0]["pay_date"])
        self.assertEqual(rows[1]["cash_div"], 0.249)

    def test_classifies_dividend_rows_without_an_event_date(self) -> None:
        rows, errors = normalize_dividend_rows("601899.SH", [{
            "公告日期": "NaT",
            "派息": 4.2,
            "进度": "实施",
            "除权除息日": None,
            "红利发放日": None,
        }])

        self.assertEqual(rows, [])
        self.assertEqual(errors[0].code, "AKSHARE_DIVIDEND_ROW_INVALID")

    def test_normalizes_repurchase_rows_and_filters_the_full_market_table(self) -> None:
        rows, errors = normalize_repurchase_rows("601899.SH", [
            {
                "股票代码": "601899",
                "计划回购金额区间-下限": 1500000000,
                "计划回购金额区间-上限": 2500000000,
                "回购起始时间": 1786665600000,
                "实施进度": "完成实施",
                "已回购股份数量": 77474592,
                "已回购金额": 2499754839.55,
                "最新公告日期": 1787011200000,
            },
            {
                "股票代码": "000001",
                "计划回购金额区间-下限": 10,
            },
        ])

        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["ts_code"], "601899.SH")
        self.assertEqual(rows[0]["announcement_date"], "20260818")
        self.assertEqual(rows[0]["start_date"], "20260814")
        self.assertEqual(rows[0]["repurchase_amount"], 2499754839.55)
        self.assertEqual(rows[0]["repurchase_shares"], 77474592.0)
        self.assertTrue(rows[0]["repurchase_code"].startswith("akshare:20260818:20260814:"))

    def test_keeps_null_amounts_for_pending_repurchase_rows_and_returns_empty_for_no_match(self) -> None:
        rows, errors = normalize_repurchase_rows("000001.SZ", [{
            "股票代码": "601899",
            "计划回购金额区间-下限": 600000000,
            "计划回购金额区间-上限": 1000000000,
            "回购起始时间": "2026-04-07",
            "实施进度": "董事会预案",
            "已回购股份数量": None,
            "已回购金额": None,
        }])

        self.assertEqual(rows, [])
        self.assertEqual(errors, [])

        rows, errors = normalize_repurchase_rows("601899.SH", [{
            "股票代码": "601899",
            "计划回购金额区间-下限": 600000000,
            "计划回购金额区间-上限": 1000000000,
            "回购起始时间": "2026-04-07",
            "实施进度": "董事会预案",
            "已回购股份数量": None,
            "已回购金额": None,
        }])
        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["repurchase_amount"], None)
        self.assertEqual(rows[0]["repurchase_shares"], None)

    def test_retains_repurchase_rows_with_invalid_optional_dates_as_classified_errors(self) -> None:
        rows, errors = normalize_repurchase_rows("601899.SH", [{
            "股票代码": "601899",
            "最新公告日期": "not-a-date",
            "计划回购金额区间-下限": 100,
            "计划回购金额区间-上限": 200,
            "实施进度": "实施中",
        }])

        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["announcement_date"])
        self.assertEqual(errors[0].code, "AKSHARE_REPURCHASE_DATE_INVALID")

    def test_normalizes_financial_aliases_and_bounds_rows(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [
            {"日期": "2026-06-30", "净资产收益率(%)": "12.5", "净利润同比增长率(%)": 8, "营业收入": 100, "净利润": 20},
            {"日期": "2025-12-31", "净资产收益率(%)": "11.5"},
        ], "2026-08-26T00:00:00Z")
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["roe"], 12.5)
        self.assertEqual(rows[0]["net_profit_yoy"], 8.0)
        self.assertEqual(rows[0]["revenue"], 100.0)
        self.assertEqual(rows[0]["net_profit"], 20.0)

    def test_normalizes_report_statement_aliases_without_deriving_ratios(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [{
            "REPORT_DATE": "2026-06-30",
            "REPORT_TYPE": "中报",
            "REPORT_DATE_NAME": "2026中报",
            "ORG_TYPE": "通用",
            "TOTAL_OPERATE_INCOME": 1000,
            "TOTAL_OPERATE_INCOME_YOY": 12,
            "PARENT_NETPROFIT": 200,
            "NETPROFIT": 220,
            "PARENT_NETPROFIT_YOY": 20,
            "DEDUCT_PARENT_NETPROFIT": 180,
            "DEDUCT_PARENT_NETPROFIT_YOY": 18,
            "TOTAL_LIABILITIES": 500,
            "ACCOUNTS_RECE": 120,
            "INVENTORY": 300,
            "CONTRACT_LIAB": 80,
        }], "2026-08-26T00:00:00Z", source="stock_profit_sheet_by_report_em")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["revenue"], 1000.0)
        self.assertEqual(rows[0]["revenue_yoy"], 12.0)
        self.assertEqual(rows[0]["net_profit"], 200.0)
        self.assertEqual(rows[0]["cashflow_net_profit"], 220.0)
        self.assertEqual(rows[0]["adjusted_net_profit"], 180.0)
        self.assertEqual(rows[0]["total_liability"], 500.0)
        self.assertEqual(rows[0]["accounts_receivable"], 120.0)
        self.assertEqual(rows[0]["inventory"], 300.0)
        self.assertEqual(rows[0]["contract_liabilities"], 80.0)
        self.assertIsNone(rows[0]["debt_asset_ratio"])

    def test_normalizes_expanded_interest_and_debt_fields(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [{
            "SECUCODE": "601899.SH",
            "REPORT_DATE": "2026-06-30",
            "FE_INTEREST_EXPENSE": 25,
            "SHORT_LOAN": 400,
            "LONG_LOAN": 500,
            "LEASE_LIAB": 100,
        }], "2026-08-26T00:00:00Z", source="stock_balance_sheet_by_report_em")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["interest_expense"], 25.0)
        self.assertEqual(rows[0]["interest_expense_source_field"], "FE_INTEREST_EXPENSE")
        self.assertEqual(rows[0]["interest_bearing_debt"], 1000.0)
        self.assertEqual(rows[0]["interest_bearing_debt_components"]["lease_liability"], 100.0)

    def test_normalizes_eastmoney_indicator_column_names(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [{
            "SECUCODE": "601899.SH",
            "REPORT_DATE": "2026-06-30 00:00:00",
            "TOTALOPERATEREVE": 1000,
            "TOTALOPERATEREVETZ": 12,
            "PARENTNETPROFIT": 200,
            "PARENTNETPROFITTZ": 20,
            "KCFJCXSYJLR": 180,
            "KCFJCXSYJLRTZ": 18,
            "ROEJQ": 16,
            "XSMLL": 28,
            "XSJLL": 12,
            "ZCFZL": 45,
            "JYXJLYYSR": 0.3,
            "MGJYXJJE": 1.2,
            "INTEREST_COVERAGE_RATIO": 8,
            "INTEREST_DEBT_RATIO": 30,
            "CASH_RATIO": 0.8,
            "LIABILITY": 500,
            "ROIC": 11,
        }], "2026-08-26T00:00:00Z", source="stock_financial_analysis_indicator_em")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["revenue"], 1000.0)
        self.assertEqual(rows[0]["revenue_yoy"], 12.0)
        self.assertEqual(rows[0]["adjusted_net_profit"], 180.0)
        self.assertEqual(rows[0]["roe"], 16.0)
        self.assertEqual(rows[0]["gross_margin"], 28.0)
        self.assertEqual(rows[0]["net_margin"], 12.0)
        self.assertEqual(rows[0]["total_liability"], 500.0)
        self.assertEqual(rows[0]["roic"], 11.0)

    def test_normalizes_eastmoney_cashflow_column_names(self) -> None:
        rows, errors = normalize_cashflow_rows("601899.SH", [{
            "SECUCODE": "601899.SH",
            "REPORT_DATE": "2026-06-30 00:00:00",
            "NETCASH_OPERATE": 1000,
            "CONSTRUCT_LONG_ASSET": 300,
            "NETPROFIT": 200,
        }], "2026-08-26T00:00:00Z", source="stock_cash_flow_sheet_by_quarterly_em")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["operating_cashflow"], 1000.0)
        self.assertEqual(rows[0]["capital_expenditure"], 300.0)
        self.assertEqual(rows[0]["net_profit"], 200.0)

    def test_normalizes_sina_report_date_and_statement_labels(self) -> None:
        financials, financial_errors = normalize_financial_rows("601899.SH", [{
            "报告日": "2026-06-30",
            "利息支出": 25,
            "短期借款": 400,
            "长期借款": 500,
            "租赁负债": 100,
        }], "2026-08-26T00:00:00Z", source="stock_financial_report_sina")
        cashflows, cashflow_errors = normalize_cashflow_rows("601899.SH", [{
            "报告日": "2026-06-30",
            "经营活动产生的现金流量净额": 1000,
            "购建固定资产、无形资产和其他长期资产所支付的现金": 300,
            "净利润": 200,
        }], "2026-08-26T00:00:00Z", source="stock_financial_report_sina")

        self.assertEqual(financial_errors, [])
        self.assertEqual(financials[0]["interest_expense"], 25.0)
        self.assertEqual(financials[0]["interest_bearing_debt"], 1000.0)
        self.assertEqual(cashflow_errors, [])
        self.assertEqual(cashflows[0]["operating_cashflow"], 1000.0)
        self.assertEqual(cashflows[0]["capital_expenditure"], 300.0)

    def test_rejects_financial_and_cashflow_rows_for_another_stock(self) -> None:
        financials, financial_errors = normalize_financial_rows("601899.SH", [{
            "SECURITY_CODE": "000001",
            "REPORT_DATE": "2026-06-30",
        }], "2026-08-26T00:00:00Z", source="statement")
        cashflows, cashflow_errors = normalize_cashflow_rows("601899.SH", [{
            "SECURITY_CODE": "000001",
            "REPORT_DATE": "2026-06-30",
        }], "2026-08-26T00:00:00Z", source="cashflow-source")

        self.assertEqual(financials, [])
        self.assertEqual(financial_errors[0].code, "AKSHARE_FINANCIAL_ROW_MISMATCHED")
        self.assertEqual(financial_errors[0].source, "statement")
        self.assertEqual(cashflows, [])
        self.assertEqual(cashflow_errors[0].code, "AKSHARE_CASHFLOW_ROW_MISMATCHED")
        self.assertEqual(cashflow_errors[0].source, "cashflow-source")

    def test_normalizes_cashflow_aliases_and_preserves_unverified_fields_as_null(self) -> None:
        rows, errors = normalize_cashflow_rows("601899.SH", [{
            "报告期": "2026-06-30",
            "公告日期": "2026-08-26",
            "经营活动产生的现金流量净额": "1000",
            "购建固定资产、无形资产和其他长期资产支付的现金": 300,
            "净利润": 200,
        }], "2026-08-26T00:00:00Z")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["operating_cashflow"], 1000.0)
        self.assertEqual(rows[0]["capital_expenditure"], 300.0)
        self.assertEqual(rows[0]["net_profit"], 200.0)
        self.assertIsNone(rows[0]["cash_dividends_paid"])

    def test_normalizes_cashflow_dividends_paid_without_deriving_the_value(self) -> None:
        rows, errors = normalize_cashflow_rows("601899.SH", [{
            "报告期": "2026-06-30",
            "经营活动产生的现金流量净额": 1000,
            "购建固定资产、无形资产和其他长期资产支付的现金": 300,
            "净利润": 200,
            "ASSIGN_DIVIDEND_PORFIT": 15826134692,
        }], "2026-09-07T00:00:00Z")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["cash_dividends_paid"], 15826134692.0)

        rows, errors = normalize_cashflow_rows("601899.SH", [{
            "报告期": "2026-06-30",
            "经营活动产生的现金流量净额": 1000,
            "购建固定资产、无形资产和其他长期资产支付的现金": 300,
            "净利润": 200,
            "ASSIGN_DIVIDEND_PORFIT": "NaN",
        }], "2026-09-07T00:00:00Z")

        self.assertEqual(errors, [])
        self.assertIsNone(rows[0]["cash_dividends_paid"])

    def test_normalizes_ths_cashflow_metrics_from_cumulative_value_only(self) -> None:
        rows, errors = normalize_ths_cashflow_rows("601899.SH", [
            {"report_date": "2026-06-30", "metric_name": "act_cash_flow_net", "value": "1000", "single": "600"},
            {"report_date": "2026-06-30", "metric_name": "pay_fixed_assets_etc_cash", "value": 300, "single": 180},
            {"report_date": "2026-06-30", "metric_name": "cash_net_profit", "value": "NaN", "single": 200},
            {"report_date": "2026-06-30", "metric_name": "pay_dividends_profits_interest_cash", "value": 120, "single": 80},
            {"report_date": "2026-06-30", "metric_name": "unknown_metric", "value": 999},
        ], "2026-09-07T00:00:00Z")

        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["operating_cashflow"], 1000.0)
        self.assertEqual(rows[0]["capital_expenditure"], 300.0)
        self.assertIsNone(rows[0]["net_profit"])
        self.assertEqual(rows[0]["cash_dividends_paid"], 120.0)

    def test_keeps_ths_cashflow_invalid_dates_as_safe_errors(self) -> None:
        rows, errors = normalize_ths_cashflow_rows("601899.SH", [
            {"report_date": "2026-02-30", "metric_name": "act_cash_flow_net", "value": 1000},
        ], "2026-09-07T00:00:00Z")

        self.assertEqual(rows, [])
        self.assertEqual(errors[0].code, "AKSHARE_CASHFLOW_ROW_INVALID")

    def test_normalizes_cninfo_company_capital_rows_and_filters_other_stocks(self) -> None:
        rows, errors = normalize_capital_structure_rows("601899.SH", [
            {"证券代码": "601899", "变动日期": "2025-12-18", "总股本": 2658973.314, "变动原因": "回购"},
            {"证券代码": "000001", "变动日期": "2025-12-18", "总股本": 10, "变动原因": "其他"},
            {"证券代码": "601899", "变动日期": "2025-12-19", "总股本": "NaN", "变动原因": ""},
        ])

        self.assertEqual(rows, [{
            "ts_code": "601899.SH",
            "report_date": "20251218",
            "total_shares": 26589733140.0,
            "change_reason": "回购",
        }])
        self.assertEqual(errors[0].code, "AKSHARE_CAPITAL_ROW_MISMATCHED")
        self.assertEqual(errors[1].code, "AKSHARE_CAPITAL_ROW_INVALID")

    def test_normalizes_ths_profit_forecast_eps_and_net_profit_with_explicit_units(self) -> None:
        eps_rows, eps_errors = normalize_profit_forecast_rows("601899.SH", [
            {"年度": "2026", "预测机构数": 23, "最小值": 2.38, "平均值": 3.07, "最大值": 3.46, "行业平均数": 2.06},
        ], source="stock_profit_forecast_ths", metric="eps")
        net_profit_rows, net_profit_errors = normalize_profit_forecast_rows("601899.SH", [
            {"年度": "2026", "预测机构数": 23, "最小值": 632.86, "平均值": 816.73, "最大值": 920.22},
        ], source="stock_profit_forecast_ths", metric="net_profit_100m")

        self.assertEqual(eps_errors, [])
        self.assertEqual(net_profit_errors, [])
        self.assertEqual(eps_rows[0]["forecast_eps_average"], 3.07)
        self.assertEqual(eps_rows[0]["analyst_count"], 23.0)
        self.assertEqual(eps_rows[0]["source"], "stock_profit_forecast_ths")
        self.assertEqual(net_profit_rows[0]["forecast_net_profit_100m_average"], 816.73)

    def test_normalizes_eastmoney_dynamic_profit_forecast_columns_and_filters_other_stocks(self) -> None:
        rows, errors = normalize_profit_forecast_rows("601899.SH", [
            {"代码": "601899", "2026预测每股收益": 3.10, "2027预测每股收益": 3.66},
            {"代码": "000001", "2026预测每股收益": 1.2},
        ], source="stock_profit_forecast_em", metric="eps")

        self.assertEqual(len(rows), 2)
        self.assertEqual([row["forecast_year"] for row in rows], ["2027", "2026"])
        self.assertEqual(rows[0]["forecast_eps_average"], 3.66)
        self.assertEqual(errors[0].code, "AKSHARE_PROFIT_FORECAST_ROW_MISMATCHED")

    def test_keeps_valid_financial_rows_when_one_row_has_an_invalid_date(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [
            {"日期": "2026-02-30", "净资产收益率(%)": "12.5"},
            {"日期": "2025-12-31", "净资产收益率(%)": "11.5"},
        ], "2026-08-26T00:00:00Z")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["report_date"], "20251231")

    def test_retains_valid_reports_when_optional_notice_date_is_invalid(self) -> None:
        rows, errors = normalize_financial_rows("601899.SH", [{
            "日期": "2026-06-30",
            "公告日期": "not-a-date",
            "净资产收益率(%)": "12.5",
        }], "2026-08-26T00:00:00Z")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["report_date"], "20260630")
        self.assertIsNone(rows[0]["notice_date"])
        self.assertEqual(errors[0].code, "AKSHARE_FINANCIAL_NOTICE_DATE_INVALID")

    def test_retains_valid_cashflows_when_optional_notice_date_is_invalid(self) -> None:
        rows, errors = normalize_cashflow_rows("601899.SH", [{
            "报告期": "2026-06-30",
            "公告日期": "not-a-date",
            "经营活动产生的现金流量净额": 1000,
        }], "2026-08-26T00:00:00Z")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["report_date"], "20260630")
        self.assertIsNone(rows[0]["notice_date"])
        self.assertEqual(errors[0].code, "AKSHARE_CASHFLOW_NOTICE_DATE_INVALID")

    def test_request_contract_is_explicit(self) -> None:
        request = BridgeRequest(ts_code="600089.SH", start_date="20260101", end_date="20260826")
        self.assertEqual(request.ts_code, "600089.SH")

    def test_builds_granular_factor_evidence_with_dates_and_thresholds(self) -> None:
        daily_bars = [{"trade_date": f"202608{index:02d}", "close": 100 + index} for index in range(1, 21)]
        financials = [{
            "report_date": "20260630",
            "roe": 12.5,
            "revenue_yoy": -4,
            "net_profit_yoy": -20,
            "gross_margin": 18,
            "net_margin": 8,
            "debt_asset_ratio": 68,
        }]

        items = {item.key: item for item in build_evidence("601899.SH", "2026-08-26T00:00:00Z", daily_bars, financials)}

        self.assertEqual(items["akshare-return20"].value, 18.81)
        self.assertEqual(items["akshare-return20"].status, "pass")
        self.assertEqual(items["akshare-return20"].observed_at, "20260820")
        self.assertEqual(items["akshare-roe"].status, "pass")
        self.assertEqual(items["akshare-revenue-yoy"].status, "caution")
        self.assertEqual(items["akshare-net-profit-yoy"].status, "fail")
        self.assertEqual(items["akshare-gross-margin"].status, "caution")
        self.assertEqual(items["akshare-net-margin"].status, "caution")
        self.assertEqual(items["akshare-debt-asset-ratio"].status, "caution")
        self.assertEqual(items["akshare-roe"].observed_at, "20260630")

    def test_marks_factor_values_missing_without_filling_zero(self) -> None:
        items = {item.key: item for item in build_evidence("601899.SH", "2026-08-26T00:00:00Z", [], [])}

        for key in ("akshare-return20", "akshare-roe", "akshare-revenue-yoy", "akshare-net-profit-yoy", "akshare-gross-margin", "akshare-net-margin", "akshare-debt-asset-ratio"):
            self.assertIsNone(items[key].value)
            self.assertEqual(items[key].status, "missing")


if __name__ == "__main__":
    unittest.main()
