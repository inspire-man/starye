import type { Database } from '@starye/db'
import type { QuantCapitalStructureProvider, QuantCapitalStructureReport, QuantCashflowProvider, QuantCashflowReport, QuantDividendFetchResult, QuantDividendProvider, QuantDividendRecord, QuantRepurchaseProvider, QuantRepurchaseReport } from '../provider'
import type { DailyBar } from '../types'
import { describe, expect, it, vi } from 'vitest'
import { buildShareholderReturnResult, readQuantShareholderReturn } from '../shareholder-return'

const repositoryMocks = vi.hoisted(() => ({
  getQuantWatchlistItem: vi.fn(),
  listQuantDailyBars: vi.fn(),
  listQuantWatchlist: vi.fn(),
}))

vi.mock('../repository', () => repositoryMocks)

function bars(close: number): DailyBar[] {
  return [{
    tsCode: '601899.SH',
    tradeDate: '20260824',
    open: close,
    high: close,
    low: close,
    close,
    preClose: close,
    change: 0,
    pctChg: 0,
    volume: 1000,
    amount: 10000,
  }]
}

function dividend(values: Partial<QuantDividendRecord> = {}): QuantDividendRecord {
  return {
    tsCode: '601899.SH',
    endDate: '20260331',
    annDate: '20260711',
    divProc: '实施',
    cashDiv: 0.42,
    exDate: '20260821',
    payDate: '20260821',
    ...values,
  }
}

function cashflow(values: Partial<QuantCashflowReport> = {}): QuantCashflowReport {
  return {
    tsCode: '601899.SH',
    reportDate: '2026-06-30',
    reportType: '中报',
    reportDateName: '2026中报',
    noticeDate: '2026-08-22',
    operatingCashflow: 100,
    capitalExpenditure: 30,
    netProfit: 80,
    cashDividendsPaid: 20,
    interestExpense: 10,
    interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
    interestExpenseProviderErrorCode: null,
    interestBearingDebt: 200,
    interestBearingDebtComponents: {
      shortLoan: 100,
      shortBondPayable: null,
      shortFinancePayable: null,
      acceptDepositInterbank: null,
      borrowFund: null,
      loanPbc: null,
      currentMaturityDebt: 20,
      amortizedCostFinancialLiability: null,
      longLoan: 50,
      amortizedCostNoncurrentFinancialLiability: null,
      bondPayable: 20,
      perpetualBond: null,
      perpetualBondPayable: null,
      leaseLiability: 10,
    },
    interestBearingDebtProviderErrorCode: null,
    ...values,
  }
}

function repurchase(values: Partial<QuantRepurchaseReport> = {}): QuantRepurchaseReport {
  return {
    tsCode: '601899.SH',
    repurchaseCode: 'plan-1',
    announcementDate: '2026-04-15',
    startDate: '2026-03-20',
    endDate: '2027-03-20',
    finishDate: '2026-04-14',
    progress: '006',
    plannedAmountLower: 150,
    plannedAmountUpper: 250,
    repurchaseAmount: 200,
    repurchaseShares: 1000,
    ...values,
  }
}

describe('quant shareholder return formula', () => {
  it('uses implemented dividends in the trailing yield calculation', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend(), dividend({ endDate: '20251231', cashDiv: 0.38, exDate: '20260626', payDate: '20260626' })],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      status: 'ready',
      trailingCashDividendPerShare: 0.8,
      trailingDividendYield: 2.32,
      dividendYears: 2,
      distributions: expect.arrayContaining([
        expect.objectContaining({ endDate: '20260331', cashDividendPerShare: 0.42 }),
      ]),
    })
  })

  it('does not use proposals or fabricate a yield without a local price', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend({ divProc: '预案', cashDiv: 0 })],
      dailyBars: [],
      dividendErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.status).toBe('insufficient_data')
    expect(result.trailingCashDividendPerShare).toBeNull()
    expect(result.trailingDividendYield).toBeNull()
    expect(result.missingFields).toEqual(expect.arrayContaining(['已实施现金分红记录', '近 12 个月已实施现金分红', '观察池最新正收盘价']))
  })

  it('keeps provider failure partial and leaves values null', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [],
      dailyBars: bars(34.54),
      dividendErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      status: 'partial',
      trailingCashDividendPerShare: null,
      trailingDividendYield: null,
    })
    expect(result.missingFields[0]).toContain('QUANT_PROVIDER_CONFIGURATION')
  })

  it('returns actual provider and fallback metadata without changing the dividend formula', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      dividendProvider: 'eastmoney',
      providerChain: ['tushare', 'eastmoney'],
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_QUOTA',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      provider: 'eastmoney',
      providerChain: ['tushare', 'eastmoney'],
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_QUOTA',
      providerErrorCode: null,
      trailingCashDividendPerShare: 0.42,
    })
  })

  it('builds period-bound free cashflow and selects the latest complete annual payout ratio', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowErrorCode: null,
      cashflowReports: [
        cashflow(),
        cashflow({
          reportDate: '2025-12-31',
          reportType: '年报',
          reportDateName: '2025年报',
          noticeDate: '2026-03-21',
          operatingCashflow: 200,
          capitalExpenditure: 50,
          netProfit: 200,
          cashDividendsPaid: 50,
        }),
      ],
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.cashflowEvidence).toMatchObject({
      formulaVersion: 'shareholder-cashflow-v2',
      status: 'ready',
      provider: 'eastmoney',
      reportDate: '2026-06-30',
      operatingCashflow: 100,
      capitalExpenditure: 30,
      freeCashflow: 70,
      cashDividendsPaid: 20,
      freeCashflowCoverage: 3.5,
      interestExpense: 10,
      interestBearingDebt: 200,
      freeCashflowAfterInterest: 60,
      payoutRatio: 25,
      payoutRatioReportDate: '2025-12-31',
    })
    expect(result.cashflowEvidence?.missingFields).not.toContain('回购金额（当前数据源未接通）')
    expect(result.cashflowEvidence?.history).toEqual([
      expect.objectContaining({
        reportDate: '2026-06-30',
        freeCashflow: 70,
        freeCashflowCoverage: 3.5,
        freeCashflowAfterInterest: 60,
        payoutRatio: null,
      }),
      expect.objectContaining({
        reportDate: '2025-12-31',
        freeCashflow: 150,
        freeCashflowCoverage: 3,
        freeCashflowAfterInterest: 140,
        payoutRatio: 25,
      }),
    ])
    expect(result.cashflowEvidence?.historySummary).toMatchObject({
      formulaVersion: 'shareholder-cashflow-history-v1',
      status: 'ready',
      periodCount: 2,
      coreReadyPeriodCount: 2,
      positiveFreeCashflowPeriods: 2,
      positiveFreeCashflowAfterInterestPeriods: 2,
      coveredDividendPeriods: 2,
      payoutRatioPeriodCount: 1,
      latestReportDate: '2026-06-30',
    })
  })

  it('sorts, deduplicates, and bounds the cashflow history by report period', () => {
    const reportDates = [
      '2024-12-31',
      '2025-03-31',
      '2025-06-30',
      '2025-09-30',
      '2025-12-31',
      '2026-03-31',
      '2026-06-30',
      '2026-09-30',
      '2026-12-31',
      '2027-03-31',
    ]
    const reports = reportDates.map((reportDate, index) => cashflow({
      reportDate,
      operatingCashflow: 100 + index,
      capitalExpenditure: 20,
    }))
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [...reports].reverse().concat(cashflow({ reportDate: '2026-06-30', operatingCashflow: 999 })),
      cashflowErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.cashflowEvidence?.history?.map(item => item.reportDate)).toEqual([
      '2027-03-31',
      '2026-12-31',
      '2026-09-30',
      '2026-06-30',
      '2026-03-31',
      '2025-12-31',
      '2025-09-30',
      '2025-06-30',
    ])
    expect(result.cashflowEvidence?.history?.find(item => item.reportDate === '2026-06-30')?.operatingCashflow).toBe(999)
    expect(result.cashflowEvidence?.historySummary).toMatchObject({ periodCount: 8, coreReadyPeriodCount: 8, status: 'ready' })
  })

  it('preserves null cashflow fields and marks provider failure without affecting dividends', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [cashflow({ operatingCashflow: null, capitalExpenditure: null })],
      cashflowErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({ status: 'ready', trailingDividendYield: 1.22 })
    expect(result.cashflowEvidence).toMatchObject({ status: 'partial', freeCashflow: null })
    expect(result.cashflowEvidence?.historySummary).toMatchObject({ status: 'partial', periodCount: 1, coreReadyPeriodCount: 0 })

    const unavailable = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [],
      cashflowErrorCode: 'QUANT_PROVIDER_TIMEOUT',
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(unavailable.cashflowEvidence).toMatchObject({ status: 'unavailable', providerErrorCode: 'QUANT_PROVIDER_TIMEOUT' })
    expect(unavailable.cashflowEvidence?.historySummary).toMatchObject({ status: 'unavailable', periodCount: 0 })
    expect(unavailable.trailingDividendYield).toBe(1.22)
  })

  it('keeps core cashflow coverage when interest and debt sources are unavailable', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [cashflow({
        interestExpense: null,
        interestExpenseSourceField: null,
        interestExpenseProviderErrorCode: 'QUANT_PROVIDER_TIMEOUT',
        interestBearingDebt: null,
        interestBearingDebtProviderErrorCode: 'QUANT_PROVIDER_INVALID_RESPONSE',
      })],
      cashflowErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.cashflowEvidence).toMatchObject({
      status: 'ready',
      freeCashflow: 70,
      freeCashflowAfterInterest: null,
      interestExpense: null,
      interestBearingDebt: null,
    })
    expect(result.cashflowEvidence?.missingFields).toEqual(expect.arrayContaining([
      '利息支出',
      '利息支出来源暂不可用（QUANT_PROVIDER_TIMEOUT）',
      '有息负债',
      '有息负债来源暂不可用（QUANT_PROVIDER_INVALID_RESPONSE）',
    ]))
  })

  it('starts dividend and cashflow reads together for one stock', async () => {
    repositoryMocks.getQuantWatchlistItem.mockResolvedValue({ tsCode: '601899.SH', name: '紫金矿业' })
    repositoryMocks.listQuantDailyBars.mockResolvedValue(bars(34.54))

    let resolveDividend!: (value: QuantDividendFetchResult) => void
    let resolveCashflow!: (value: readonly QuantCashflowReport[]) => void
    const dividendProvider: QuantDividendProvider = {
      name: 'eastmoney',
      isConfigured: true,
      providerChain: ['eastmoney'],
      fetchDividends: vi.fn(() => new Promise<QuantDividendFetchResult>((resolve) => {
        resolveDividend = resolve
      })),
    }
    const cashflowProvider: QuantCashflowProvider = {
      name: 'eastmoney',
      isConfigured: true,
      fetchCashflowHistory: vi.fn(() => new Promise<readonly QuantCashflowReport[]>((resolve) => {
        resolveCashflow = resolve
      })),
    }

    const resultPromise = readQuantShareholderReturn(
      {} as Database,
      'user-1',
      '601899.SH',
      dividendProvider,
      cashflowProvider,
      () => new Date('2026-08-25T00:00:00.000Z'),
    )

    await vi.waitFor(() => {
      expect(dividendProvider.fetchDividends).toHaveBeenCalledOnce()
      expect(cashflowProvider.fetchCashflowHistory).toHaveBeenCalledOnce()
    })

    resolveDividend({ records: [], provider: 'eastmoney', fallbackUsed: false, fallbackReason: null })
    resolveCashflow([])
    await expect(resultPromise).resolves.toMatchObject({
      tsCode: '601899.SH',
      status: 'partial',
      cashflowEvidence: { status: 'insufficient_data', historySummary: { status: 'insufficient_data', periodCount: 0 } },
    })
  })

  it('builds adjacent share changes and counts only retired buyback shares', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      capitalStructureProvider: 'eastmoney',
      capitalStructureReports: [
        { tsCode: '601899.SH', reportDate: '2026-03-31', totalShares: 1200, changeReason: '债转股上市' },
        { tsCode: '601899.SH', reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购' },
        { tsCode: '601899.SH', reportDate: '2025-12-15', totalShares: 1150, changeReason: '自主行权' },
      ],
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.capitalStructureEvidence).toMatchObject({
      formulaVersion: 'shareholder-capital-v1',
      status: 'ready',
      latestReportDate: '2026-03-31',
      latestTotalShares: 1200,
      previousTotalShares: 1100,
      sharesOutstandingChange: 100,
      sharesOutstandingChangeRatio: 9.09,
      repurchaseSharesRetired: 50,
    })
    expect(result.capitalStructureEvidence?.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ reportDate: '2025-12-18', sharesOutstandingChange: -50, changeReason: '回购' }),
    ]))

    const buyback = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [],
      dailyBars: [],
      dividendErrorCode: null,
      capitalStructureProvider: 'eastmoney',
      capitalStructureReports: [
        { tsCode: '601899.SH', reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购' },
        { tsCode: '601899.SH', reportDate: '2025-12-15', totalShares: 1150, changeReason: '自主行权' },
      ],
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(buyback.capitalStructureEvidence?.repurchaseSharesRetired).toBe(50)
  })

  it('keeps capital provider failure isolated from dividend and cashflow evidence', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [cashflow()],
      cashflowErrorCode: null,
      capitalStructureProvider: 'eastmoney',
      capitalStructureReports: [],
      capitalStructureErrorCode: 'QUANT_PROVIDER_TIMEOUT',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({ status: 'ready', trailingDividendYield: 1.22 })
    expect(result.cashflowEvidence).toMatchObject({ status: 'ready', freeCashflow: 70 })
    expect(result.capitalStructureEvidence).toMatchObject({ status: 'unavailable', providerErrorCode: 'QUANT_PROVIDER_TIMEOUT' })
  })

  it('sums executed repurchase amounts while preserving plan ranges and pending amounts', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      repurchaseProvider: 'eastmoney',
      repurchaseReports: [
        repurchase({ repurchaseCode: 'plan-2', announcementDate: '2026-04-15', repurchaseAmount: 200, plannedAmountLower: 150, plannedAmountUpper: 250 }),
        repurchase({ repurchaseCode: 'plan-1', announcementDate: '2025-04-11', repurchaseAmount: null, plannedAmountLower: 60, plannedAmountUpper: 100, progress: '004' }),
      ],
      repurchaseErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.repurchaseEvidence).toMatchObject({
      formulaVersion: 'shareholder-repurchase-v1',
      status: 'ready',
      provider: 'eastmoney',
      latestAnnouncementDate: '2026-04-15',
      latestProgress: '006',
      repurchaseAmount: 200,
      plannedAmountLower: 210,
      plannedAmountUpper: 350,
      records: expect.arrayContaining([
        expect.objectContaining({ repurchaseCode: 'plan-1', repurchaseAmount: null, progress: '004' }),
      ]),
    })

    const pending = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [],
      dailyBars: [],
      dividendErrorCode: null,
      repurchaseProvider: 'eastmoney',
      repurchaseReports: [repurchase({ repurchaseAmount: null })],
      repurchaseErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(pending.repurchaseEvidence).toMatchObject({ status: 'partial', repurchaseAmount: null })
    expect(pending.repurchaseEvidence?.missingFields).toContain('已实施回购金额')
  })

  it('keeps repurchase provider failure isolated from the other evidence areas', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      cashflowProvider: 'eastmoney',
      cashflowReports: [cashflow()],
      cashflowErrorCode: null,
      capitalStructureProvider: 'eastmoney',
      capitalStructureReports: [
        { tsCode: '601899.SH', reportDate: '2026-03-31', totalShares: 1200, changeReason: '债转股上市' },
        { tsCode: '601899.SH', reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购' },
        { tsCode: '601899.SH', reportDate: '2025-12-15', totalShares: 1150, changeReason: '自主行权' },
      ],
      capitalStructureErrorCode: null,
      repurchaseProvider: 'eastmoney',
      repurchaseReports: [],
      repurchaseErrorCode: 'QUANT_PROVIDER_TIMEOUT',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({ status: 'ready', trailingDividendYield: 1.22 })
    expect(result.cashflowEvidence).toMatchObject({ status: 'ready', freeCashflow: 70 })
    expect(result.capitalStructureEvidence).toMatchObject({ status: 'ready', repurchaseSharesRetired: 50 })
    expect(result.repurchaseEvidence).toMatchObject({ status: 'unavailable', providerErrorCode: 'QUANT_PROVIDER_TIMEOUT' })
  })

  it('starts the capital provider with the other shareholder sources', async () => {
    repositoryMocks.getQuantWatchlistItem.mockResolvedValue({ tsCode: '601899.SH', name: '紫金矿业' })
    repositoryMocks.listQuantDailyBars.mockResolvedValue(bars(34.54))

    let resolveDividend!: (value: QuantDividendFetchResult) => void
    let resolveCashflow!: (value: readonly QuantCashflowReport[]) => void
    let resolveCapital!: (value: readonly QuantCapitalStructureReport[]) => void
    let resolveRepurchase!: (value: readonly QuantRepurchaseReport[]) => void
    const dividendProvider: QuantDividendProvider = {
      name: 'eastmoney',
      isConfigured: true,
      providerChain: ['eastmoney'],
      fetchDividends: vi.fn(() => new Promise<QuantDividendFetchResult>((resolve) => {
        resolveDividend = resolve
      })),
    }
    const cashflowProvider: QuantCashflowProvider = {
      name: 'eastmoney',
      isConfigured: true,
      fetchCashflowHistory: vi.fn(() => new Promise<readonly QuantCashflowReport[]>((resolve) => {
        resolveCashflow = resolve
      })),
    }
    const capitalProvider: QuantCapitalStructureProvider = {
      name: 'eastmoney',
      isConfigured: true,
      fetchCapitalStructureHistory: vi.fn(() => new Promise<readonly QuantCapitalStructureReport[]>((resolve) => {
        resolveCapital = resolve
      })),
    }
    const repurchaseProvider: QuantRepurchaseProvider = {
      name: 'eastmoney',
      isConfigured: true,
      fetchRepurchaseHistory: vi.fn(() => new Promise<readonly QuantRepurchaseReport[]>((resolve) => {
        resolveRepurchase = resolve
      })),
    }

    const resultPromise = readQuantShareholderReturn(
      {} as Database,
      'user-1',
      '601899.SH',
      dividendProvider,
      cashflowProvider,
      capitalProvider,
      repurchaseProvider,
      () => new Date('2026-08-25T00:00:00.000Z'),
    )

    await vi.waitFor(() => {
      expect(dividendProvider.fetchDividends).toHaveBeenCalledOnce()
      expect(cashflowProvider.fetchCashflowHistory).toHaveBeenCalledOnce()
      expect(capitalProvider.fetchCapitalStructureHistory).toHaveBeenCalledOnce()
      expect(repurchaseProvider.fetchRepurchaseHistory).toHaveBeenCalledOnce()
    })

    resolveDividend({ records: [], provider: 'eastmoney', fallbackUsed: false, fallbackReason: null })
    resolveCashflow([])
    resolveCapital([])
    resolveRepurchase([])
    await expect(resultPromise).resolves.toMatchObject({
      capitalStructureEvidence: { status: 'insufficient_data' },
      repurchaseEvidence: { status: 'insufficient_data' },
    })
  })
})
