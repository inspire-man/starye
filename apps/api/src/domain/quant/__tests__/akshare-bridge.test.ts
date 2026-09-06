import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { createQuantAkshareBridge, createQuantAkshareCapitalStructureProvider, createQuantAkshareCashflowProvider, createQuantAkshareDividendProvider, createQuantAkshareFinancialProvider, createQuantAkshareRepurchaseProvider, QuantAkshareBridgeError } from '../akshare-bridge'
import { createQuantCapitalStructureProviderChain, createQuantCashflowProviderChain, createQuantFinancialProviderChain } from '../provider'

const reportEvidence: QuantResearchReport = {
  reportVersion: 'research-report-v2',
  tsCode: '601899.SH',
  name: '紫金矿业',
  generatedAt: '2026-08-26T00:00:00.000Z',
  sourceSnapshotId: null,
  status: 'partial',
  action: 'wait-confirmation',
  score: 70,
  headline: '等待确认',
  strengths: [],
  risks: [],
  gaps: [],
  nextActions: [],
  evidence: [{
    key: 'trend-sample',
    dimension: 'trend',
    label: '日线样本',
    status: 'pass',
    value: 80,
    threshold: '至少 60 根',
    source: '本地',
    observedAt: '20260825',
    formulaVersion: 'v1',
    detail: 'ok',
  }],
  sources: [],
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'quant-akshare-v1',
    provider: 'akshare',
    request_id: 'request-1',
    ts_code: '601899.SH',
    observed_at: '2026-08-26T00:00:00.000Z',
    status: 'ready',
    source: { adapter: 'akshare-adapter-v1', endpoints: ['stock_zh_a_hist'], formula_version: 'akshare-adapter-v1' },
    identity: { name: '紫金矿业' },
    daily_bars: [],
    financials: [],
    evidence: [{
      key: 'akshare-daily-sample',
      dimension: 'trend',
      label: 'AkShare 日线样本',
      status: 'pass',
      value: 120,
      threshold: '至少 60 根有效日线',
      source: 'AkShare stock_zh_a_hist',
      observed_at: '20260825',
      formula_version: 'akshare-adapter-v1',
      detail: 'ok',
    }],
    errors: [],
    ...overrides,
  }
}

describe('akShare bridge client', () => {
  it('fails closed when the bridge is not configured', async () => {
    const client = createQuantAkshareBridge()
    expect(client.isConfigured).toBe(false)
    await expect(client.fetchEvidence({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'CONFIGURATION', status: 503 })
  })

  it('validates and normalizes the versioned bridge response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 }))
    const client = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test/', token: 'secret-token', fetchImpl })
    const result = await client.fetchEvidence({ tsCode: '601899.SH' })
    expect(result).toMatchObject({ schemaVersion: 'quant-akshare-v1', tsCode: '601899.SH', status: 'ready' })
    expect(result.source).toMatchObject({ id: 'akshare-bridge', formulaVersion: 'akshare-adapter-v1' })
    expect(result.evidence[0]).toMatchObject({ key: 'akshare-daily-sample', value: 120 })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ include_profit_forecasts: true })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://bridge.example.test/v1/evidence')
    expect(fetchImpl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer secret-token' }),
    }))
  })

  it('rejects a mismatched stock code or malformed evidence', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({ ts_code: '600089.SH' })), { status: 200 }))
    const client = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })
    await expect(client.fetchEvidence({ tsCode: '601899.SH' })).rejects.toBeInstanceOf(QuantAkshareBridgeError)
  })

  it('keeps the report evidence type available to callers without sending it to the bridge', () => {
    expect(reportEvidence.evidence[0]?.key).toBe('trend-sample')
  })

  it('maps expanded financial and cashflow rows into provider contracts', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload({
      identity: { name: '平安银行', industry: '银行' },
      financials: [{
        ts_code: '601899.SH',
        report_date: '20260630',
        revenue: 1000,
        revenue_yoy: 12.5,
        net_profit: 200,
        gross_margin: 28,
        roe: 16,
        accounts_receivable: 120,
        inventory: 300,
        contract_liabilities: 80,
      }],
      errors: [{ code: 'AKSHARE_FINANCIAL_ENDPOINT_FAILED', message: 'endpoint failed', source: 'stock_balance_sheet_by_report_em' }],
      cashflows: [{
        ts_code: '601899.SH',
        report_date: '20260630',
        operating_cashflow: 300,
        capital_expenditure: 80,
        net_profit: 200,
        cash_dividends_paid: 15826134692,
        interest_expense: 25,
        interest_expense_source_field: 'FE_INTEREST_EXPENSE',
        interest_bearing_debt: 1000,
        interest_bearing_debt_components: {
          short_loan: 400,
          long_loan: 500,
          lease_liability: 100,
        },
      }],
    })), { status: 200 })))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })

    const financialSnapshot = await createQuantAkshareFinancialProvider(bridge).fetchFinancialQuality({ tsCode: '601899.SH' })
    expect(financialSnapshot).toMatchObject({
      provider: 'akshare',
      reportDate: '2026-06-30',
      revenue: 1000,
      revenueYoY: 12.5,
      netProfit: 200,
      grossMargin: 28,
      roe: 16,
      accountsReceivable: 120,
      inventory: 300,
      contractLiabilities: 80,
      industry: 'bank',
    })
    expect(financialSnapshot).not.toHaveProperty('workingCapitalErrorCode')
    await expect(createQuantAkshareCashflowProvider(bridge).fetchCashflowHistory({ tsCode: '601899.SH' })).resolves.toMatchObject([{
      provider: 'akshare',
      reportDate: '2026-06-30',
      operatingCashflow: 300,
      capitalExpenditure: 80,
      netProfit: 200,
      cashDividendsPaid: 15826134692,
      interestExpense: 25,
      interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
      interestBearingDebt: 1000,
      interestBearingDebtComponents: expect.objectContaining({ shortLoan: 400, longLoan: 500, leaseLiability: 100 }),
    }])
  })

  it('maps optional AkShare repurchase rows and keeps legacy bridge payloads valid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
      repurchases: [{
        ts_code: '601899.SH',
        repurchase_code: 'akshare:20260818:20260814:1500000000:2500000000',
        announcement_date: '20260818',
        start_date: '20260814',
        end_date: null,
        finish_date: null,
        progress: '完成实施',
        planned_amount_lower: 1500000000,
        planned_amount_upper: 2500000000,
        repurchase_amount: 2499754839.55,
        repurchase_shares: 77474592,
      }],
    })), { status: 200 }))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })

    await expect(createQuantAkshareRepurchaseProvider(bridge).fetchRepurchaseHistory({ tsCode: '601899.SH', limit: 12 })).resolves.toEqual([{
      tsCode: '601899.SH',
      repurchaseCode: 'akshare:20260818:20260814:1500000000:2500000000',
      announcementDate: '2026-08-18',
      startDate: '2026-08-14',
      endDate: null,
      finishDate: null,
      progress: '完成实施',
      plannedAmountLower: 1500000000,
      plannedAmountUpper: 2500000000,
      repurchaseAmount: 2499754839.55,
      repurchaseShares: 77474592,
      provider: 'akshare',
    }])
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ include_financials: false, include_profit_forecasts: false })

    const legacyBridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })),
    })
    await expect(createQuantAkshareRepurchaseProvider(legacyBridge).fetchRepurchaseHistory({ tsCode: '601899.SH' })).resolves.toEqual([])
  })

  it('maps optional AkShare company capital rows and keeps legacy bridge payloads valid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
      capital_structures: [{
        ts_code: '601899.SH',
        report_date: '20251218',
        total_shares: 26589733140,
        change_reason: '回购',
      }],
    })), { status: 200 }))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })

    await expect(createQuantAkshareCapitalStructureProvider(bridge).fetchCapitalStructureHistory({ tsCode: '601899.SH' })).resolves.toEqual([{
      tsCode: '601899.SH',
      reportDate: '2025-12-18',
      totalShares: 26589733140,
      changeReason: '回购',
      provider: 'akshare',
    }])

    const legacyBridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })),
    })
    await expect(createQuantAkshareCapitalStructureProvider(legacyBridge).fetchCapitalStructureHistory({ tsCode: '601899.SH' })).resolves.toEqual([])
  })

  it('falls back from an empty Eastmoney capital history to AkShare with actual provenance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
      capital_structures: [{ ts_code: '601899.SH', report_date: '20251218', total_shares: 26589733140, change_reason: '回购' }],
    })), { status: 200 }))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })
    const primary = {
      name: 'eastmoney' as const,
      isConfigured: true,
      fetchCapitalStructureHistory: vi.fn().mockResolvedValue([]),
    }

    await expect(createQuantCapitalStructureProviderChain(primary, createQuantAkshareCapitalStructureProvider(bridge)).fetchCapitalStructureHistory({ tsCode: '601899.SH' })).resolves.toMatchObject([{
      reportDate: '2025-12-18',
      provider: 'akshare',
    }])
  })

  it('maps optional AkShare profit forecasts and preserves legacy payloads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
      profit_forecasts: [{
        ts_code: '601899.SH',
        source: 'stock_profit_forecast_ths',
        forecast_year: '2026',
        forecast_eps_low: 2.38,
        forecast_eps_average: 3.07,
        forecast_eps_high: 3.46,
        analyst_count: 23,
        industry_average_eps: 2.06,
        forecast_net_profit_100m_low: 632.86,
        forecast_net_profit_100m_average: 816.73,
        forecast_net_profit_100m_high: 920.22,
      }],
    })), { status: 200 }))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })

    await expect(bridge.fetchEvidence({ tsCode: '601899.SH' })).resolves.toMatchObject({
      profitForecasts: [{
        tsCode: '601899.SH',
        forecastYear: '2026',
        source: 'stock_profit_forecast_ths',
        forecastEpsAverage: 3.07,
        forecastNetProfit100mAverage: 816.73,
      }],
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ include_profit_forecasts: true })

    const legacyBridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })),
    })
    await expect(legacyBridge.fetchEvidence({ tsCode: '601899.SH' })).resolves.toMatchObject({ profitForecasts: [] })
  })

  it('surfaces a repurchase endpoint error instead of treating it as an empty history', async () => {
    const bridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
        errors: [{ code: 'AKSHARE_REPURCHASE_ENDPOINT_FAILED', message: 'endpoint failed' }],
      })), { status: 200 })),
    })

    await expect(createQuantAkshareRepurchaseProvider(bridge).fetchRepurchaseHistory({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  it('maps optional AkShare dividend rows and keeps legacy bridge payloads valid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
      dividends: [{
        ts_code: '601899.SH',
        end_date: '2026-08-13',
        ann_date: '2026-08-13',
        div_proc: '实施',
        cash_div: 0.42,
        ex_date: '2026-08-21',
        pay_date: null,
      }],
    })), { status: 200 }))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })

    await expect(createQuantAkshareDividendProvider(bridge).fetchDividends({ tsCode: '601899.SH' })).resolves.toEqual({
      records: [{
        tsCode: '601899.SH',
        endDate: '2026-08-13',
        annDate: '2026-08-13',
        divProc: '实施',
        cashDiv: 0.42,
        exDate: '2026-08-21',
        payDate: null,
      }],
      provider: 'akshare',
      fallbackUsed: false,
      fallbackReason: null,
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ include_financials: false })

    const legacyBridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })),
    })
    await expect(createQuantAkshareDividendProvider(legacyBridge).fetchDividends({ tsCode: '601899.SH' })).resolves.toMatchObject({ records: [] })
  })

  it('surfaces a dividend endpoint error instead of treating it as an empty history', async () => {
    const bridge = createQuantAkshareBridge({
      baseUrl: 'https://bridge.example.test',
      token: 'secret-token',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({
        errors: [{ code: 'AKSHARE_DIVIDEND_ENDPOINT_FAILED', message: 'endpoint failed' }],
      })), { status: 200 })),
    })

    await expect(createQuantAkshareDividendProvider(bridge).fetchDividends({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  it('supplements same-period working-capital fields and keeps the primary report', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload({
      financials: [{
        ts_code: '601899.SH',
        report_date: '20260630',
        gross_margin: 28,
        accounts_receivable: 120,
        inventory: 300,
        contract_liabilities: 80,
      }],
      cashflows: [{
        ts_code: '601899.SH',
        report_date: '20260630',
        operating_cashflow: 300,
        capital_expenditure: 80,
        net_profit: 200,
        interest_expense: 25,
        interest_expense_source_field: 'FE_INTEREST_EXPENSE',
        interest_bearing_debt: 1000,
        interest_bearing_debt_components: { short_loan: 400 },
      }],
    })), { status: 200 })))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })
    const akshareFinancial = createQuantAkshareFinancialProvider(bridge)
    const akshareCashflow = createQuantAkshareCashflowProvider(bridge)
    const primaryFinancial = {
      name: 'eastmoney' as const,
      isConfigured: true,
      fetchFinancialQuality: vi.fn(),
      fetchFinancialQualityHistory: vi.fn().mockResolvedValue([{
        tsCode: '601899.SH',
        observedAt: '2026-09-06T00:00:00.000Z',
        reportDate: '2026-06-30',
        reportType: '中报',
        reportDateName: '2026中报',
        noticeDate: null,
        revenue: null,
        revenueYoY: null,
        netProfit: null,
        netProfitYoY: null,
        adjustedNetProfit: null,
        adjustedNetProfitYoY: null,
        accountsReceivable: null,
        inventory: null,
        contractLiabilities: null,
        roe: null,
        grossMargin: null,
        netMargin: null,
        debtAssetRatio: null,
        operatingCashflowToRevenue: null,
        operatingCashflowPerShare: null,
        fcffBack: null,
        fcffForward: null,
        interestCoverage: null,
        interestBearingDebtRatio: null,
        cashRatio: null,
        totalLiability: null,
        roic: null,
        workingCapitalErrorCode: 'QUANT_PROVIDER_UPSTREAM',
        provider: 'eastmoney' as const,
      }]),
    }
    const primaryCashflow = {
      name: 'eastmoney' as const,
      isConfigured: true,
      fetchCashflowHistory: vi.fn().mockResolvedValue([{
        tsCode: '601899.SH',
        reportDate: '2026-06-30',
        reportType: '中报',
        reportDateName: '2026中报',
        noticeDate: null,
        operatingCashflow: null,
        capitalExpenditure: null,
        netProfit: null,
        cashDividendsPaid: null,
        interestExpense: 10,
        interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
        interestExpenseProviderErrorCode: null,
        interestBearingDebt: 900,
        interestBearingDebtComponents: {
          shortLoan: 300,
          shortBondPayable: null,
          shortFinancePayable: null,
          acceptDepositInterbank: null,
          borrowFund: null,
          loanPbc: null,
          currentMaturityDebt: null,
          amortizedCostFinancialLiability: null,
          longLoan: null,
          amortizedCostNoncurrentFinancialLiability: null,
          bondPayable: null,
          perpetualBond: null,
          perpetualBondPayable: null,
          leaseLiability: null,
        },
        interestBearingDebtProviderErrorCode: null,
        provider: 'eastmoney' as const,
      }]),
    }

    const financialResult = await createQuantFinancialProviderChain(primaryFinancial, akshareFinancial).fetchFinancialQuality({ tsCode: '601899.SH' })
    expect(financialResult.provider).toBe('eastmoney')
    expect(financialResult.supplementalProvider).toBe('akshare')
    expect(financialResult.supplementUsed).toBe(true)
    expect(financialResult.grossMargin).toBe(28)
    expect(financialResult).toMatchObject({
      accountsReceivable: 120,
      inventory: 300,
      contractLiabilities: 80,
    })
    expect(financialResult.workingCapitalErrorCode).toBeNull()

    const legacyPrimaryFinancial = {
      ...primaryFinancial,
      fetchFinancialQualityHistory: vi.fn().mockResolvedValue([{
        ...financialResult,
        revenue: 1000,
        revenueYoY: 10,
        netProfit: 200,
        netProfitYoY: 10,
        adjustedNetProfit: 190,
        adjustedNetProfitYoY: 9,
        roe: 12,
        grossMargin: 28,
        netMargin: 20,
        debtAssetRatio: 50,
        operatingCashflowToRevenue: 30,
        operatingCashflowPerShare: 1,
        fcffBack: 100,
        fcffForward: 100,
        interestCoverage: 5,
        interestBearingDebtRatio: 20,
        cashRatio: 1,
        totalLiability: 500,
        roic: 10,
        accountsReceivable: undefined,
        inventory: undefined,
        contractLiabilities: undefined,
        supplementalProvider: undefined,
        supplementUsed: undefined,
      }]),
    }
    await expect(createQuantFinancialProviderChain(legacyPrimaryFinancial, akshareFinancial).fetchFinancialQuality({ tsCode: '601899.SH' })).resolves.toMatchObject({
      accountsReceivable: 120,
      inventory: 300,
      contractLiabilities: 80,
      supplementalProvider: 'akshare',
      supplementUsed: true,
    })
    const cashflowResult = await createQuantCashflowProviderChain(primaryCashflow, akshareCashflow).fetchCashflowHistory({ tsCode: '601899.SH' })
    expect(cashflowResult[0]).toMatchObject({
      provider: 'eastmoney',
      supplementalProvider: 'akshare',
      supplementUsed: true,
      operatingCashflow: 300,
      capitalExpenditure: 80,
      netProfit: 200,
      interestExpense: 10,
      interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
      interestBearingDebt: 900,
      interestBearingDebtComponents: expect.objectContaining({ shortLoan: 300 }),
    })
  })

  it('keeps unmatched AkShare periods as independent reports without supplement metadata', async () => {
    const bridgePayload = payload({
      financials: [{ ts_code: '601899.SH', report_date: '20260930', gross_margin: 31 }],
      cashflows: [{ ts_code: '601899.SH', report_date: '20260930', operating_cashflow: 420, capital_expenditure: 90 }],
    })
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(bridgePayload), { status: 200 })))
    const bridge = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })
    const akshareFinancial = createQuantAkshareFinancialProvider(bridge)
    const akshareCashflow = createQuantAkshareCashflowProvider(bridge)
    const primaryFinancial = {
      name: 'eastmoney' as const,
      isConfigured: true,
      fetchFinancialQuality: vi.fn(),
      fetchFinancialQualityHistory: vi.fn().mockResolvedValue([{
        tsCode: '601899.SH',
        observedAt: '2026-09-06T00:00:00.000Z',
        reportDate: '2026-06-30',
        reportType: '中报',
        reportDateName: '2026中报',
        noticeDate: null,
        revenue: 100,
        revenueYoY: null,
        netProfit: 20,
        netProfitYoY: null,
        adjustedNetProfit: null,
        adjustedNetProfitYoY: null,
        roe: 12,
        grossMargin: null,
        netMargin: null,
        debtAssetRatio: null,
        operatingCashflowToRevenue: null,
        operatingCashflowPerShare: null,
        fcffBack: null,
        fcffForward: null,
        interestCoverage: null,
        interestBearingDebtRatio: null,
        cashRatio: null,
        totalLiability: null,
        roic: null,
        provider: 'eastmoney' as const,
      }]),
    }
    const primaryCashflow = {
      name: 'eastmoney' as const,
      isConfigured: true,
      fetchCashflowHistory: vi.fn().mockResolvedValue([{
        tsCode: '601899.SH',
        reportDate: '2026-06-30',
        reportType: '中报',
        reportDateName: '2026中报',
        noticeDate: null,
        operatingCashflow: 300,
        capitalExpenditure: 80,
        netProfit: null,
        cashDividendsPaid: null,
        interestExpense: null,
        interestExpenseSourceField: null,
        interestExpenseProviderErrorCode: null,
        interestBearingDebt: null,
        interestBearingDebtComponents: {
          shortLoan: null,
          shortBondPayable: null,
          shortFinancePayable: null,
          acceptDepositInterbank: null,
          borrowFund: null,
          loanPbc: null,
          currentMaturityDebt: null,
          amortizedCostFinancialLiability: null,
          longLoan: null,
          amortizedCostNoncurrentFinancialLiability: null,
          bondPayable: null,
          perpetualBond: null,
          perpetualBondPayable: null,
          leaseLiability: null,
        },
        interestBearingDebtProviderErrorCode: null,
        provider: 'eastmoney' as const,
      }]),
    }

    const financialReports = await createQuantFinancialProviderChain(primaryFinancial, akshareFinancial).fetchFinancialQualityHistory({ tsCode: '601899.SH', limit: 4 })
    const cashflowReports = await createQuantCashflowProviderChain(primaryCashflow, akshareCashflow).fetchCashflowHistory({ tsCode: '601899.SH', limit: 8 })

    expect(financialReports).toEqual(expect.arrayContaining([
      expect.objectContaining({ reportDate: '2026-06-30', provider: 'eastmoney' }),
      expect.objectContaining({ reportDate: '2026-09-30', provider: 'akshare' }),
    ]))
    expect(financialReports.find(report => report.reportDate === '2026-09-30')).not.toHaveProperty('supplementalProvider')
    expect(financialReports.find(report => report.reportDate === '2026-09-30')).not.toHaveProperty('supplementUsed')
    expect(cashflowReports).toEqual(expect.arrayContaining([
      expect.objectContaining({ reportDate: '2026-06-30', provider: 'eastmoney' }),
      expect.objectContaining({ reportDate: '2026-09-30', provider: 'akshare' }),
    ]))
    expect(cashflowReports.find(report => report.reportDate === '2026-09-30')).not.toHaveProperty('supplementalProvider')
    expect(cashflowReports.find(report => report.reportDate === '2026-09-30')).not.toHaveProperty('supplementUsed')
  })
})
