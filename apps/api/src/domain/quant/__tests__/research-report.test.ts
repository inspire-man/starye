import type { QuantAkshareBridgeResult } from '../akshare-bridge'
import type { QuantFinancialQualitySnapshot, QuantValuationSnapshot } from '../provider'
import type { QuantShareholderReturnItem } from '../shareholder-return'
import type { DailyBar, MomentumCandidate } from '../types'
import { describe, expect, it } from 'vitest'
import { buildQuantResearchReport } from '../research-report'

function bars(count: number): DailyBar[] {
  return Array.from({ length: count }, (_, index) => ({
    tsCode: '601899.SH',
    tradeDate: `2026${String(Math.floor(index / 30) + 1).padStart(2, '0')}${String((index % 30) + 1).padStart(2, '0')}`,
    open: 10 + index,
    high: 11 + index,
    low: 9 + index,
    close: 10 + index,
    preClose: index ? 9 + index : null,
    change: 1,
    pctChg: 10,
    volume: 1000,
    amount: 10000,
  }))
}

const candidate: MomentumCandidate = {
  tsCode: '601899.SH',
  factorVersion: 'momentum-v1',
  factors: {
    ma5: 100,
    ma20: 80,
    isNewHigh20: true,
    consecutiveUpDays: 2,
    volumeRatio: 1.1,
    return20: 0.08,
    relativeStrength: 1,
  },
  matchedFactors: ['ma20'],
  missingFactors: [],
  dataQuality: 'ready',
  score: 4,
}

const valuation: QuantValuationSnapshot = {
  tsCode: '601899.SH',
  observedAt: '2026-08-26T00:00:00.000Z',
  dynamicPe: null,
  peTtm: 12,
  peStatic: null,
  pb: 1.4,
  ps: 1,
  peg: 1.2,
  marketCap: null,
}

const financial: QuantFinancialQualitySnapshot = {
  tsCode: '601899.SH',
  observedAt: '2026-08-26T00:00:00.000Z',
  reportDate: '2026-06-30',
  reportType: '中报',
  reportDateName: '2026中报',
  noticeDate: '2026-08-26',
  revenue: null,
  revenueYoY: 12,
  netProfit: null,
  netProfitYoY: 15,
  adjustedNetProfit: null,
  adjustedNetProfitYoY: 13,
  roe: 18,
  grossMargin: 30,
  netMargin: 12,
  debtAssetRatio: 42,
  operatingCashflowToRevenue: 0.08,
  operatingCashflowPerShare: null,
  fcffBack: null,
  fcffForward: null,
  interestCoverage: 12,
  interestBearingDebtRatio: 20,
  cashRatio: 1.2,
  totalLiability: null,
  roic: 10,
}

const shareholderReturn: QuantShareholderReturnItem = {
  tsCode: '601899.SH',
  name: '紫金矿业',
  formulaVersion: 'shareholder-return-v1',
  status: 'ready',
  provider: 'tushare',
  providerChain: ['tushare', 'eastmoney'],
  fallbackUsed: false,
  fallbackReason: null,
  providerErrorCode: null,
  observedAt: '2026-08-26T00:00:00.000Z',
  latestClose: 110,
  trailingCashDividendPerShare: 1,
  trailingDividendYield: 0.91,
  dividendYears: 4,
  distributions: [],
  missingFields: [],
}

const akshare: QuantAkshareBridgeResult = {
  schemaVersion: 'quant-akshare-v1',
  provider: 'akshare',
  requestId: 'bridge-1',
  tsCode: '601899.SH',
  observedAt: '2026-08-26T00:00:00.000Z',
  status: 'ready',
  source: {
    id: 'akshare-bridge',
    name: 'AkShare bridge · akshare-adapter-v1',
    observedAt: '2026-08-26T00:00:00.000Z',
    formulaVersion: 'akshare-adapter-v1',
  },
  identity: { name: '紫金矿业' },
  dailyBars: [],
  financials: [],
  evidence: [{
    key: 'akshare-roe',
    dimension: 'quality',
    label: 'AkShare ROE',
    status: 'pass',
    value: 18,
    threshold: '至少 10%',
    source: 'AkShare stock_financial_analysis_indicator',
    observedAt: '20260630',
    formulaVersion: 'akshare-adapter-v1',
    detail: 'ROE 达到基础价值研究门槛',
  }, {
    key: 'akshare-net-profit-yoy',
    dimension: 'quality',
    label: 'AkShare 净利润同比',
    status: 'pass',
    value: 15,
    threshold: '不低于 0%',
    source: 'AkShare stock_financial_analysis_indicator',
    observedAt: '20251231',
    formulaVersion: 'akshare-adapter-v1',
    detail: '净利润同比保持正增长',
  }],
  errors: [],
}

describe('quant research report', () => {
  it('builds a versioned report with source and threshold metadata', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-1',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial, { ...financial, reportDate: '2025-12-31' }],
      shareholderReturn,
    })

    expect(report).toMatchObject({
      reportVersion: 'research-report-v2',
      tsCode: '601899.SH',
      sourceSnapshotId: 'snapshot-1',
      status: 'ready',
      action: 'research-window',
      score: 100,
    })
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'valuation-pe', value: 12, source: 'Eastmoney 估值', formulaVersion: 'eastmoney-valuation-v1' }),
      expect.objectContaining({ key: 'valuation-ps', value: 1 }),
      expect.objectContaining({ key: 'valuation-peg', value: 1.2 }),
      expect.objectContaining({ key: 'quality-revenue-growth', value: 12 }),
      expect.objectContaining({ key: 'quality-adjusted-profit', value: 13 }),
      expect.objectContaining({ key: 'quality-gross-margin', value: 30 }),
      expect.objectContaining({ key: 'quality-net-margin', value: 12 }),
      expect.objectContaining({ key: 'quality-debt-asset', value: 42 }),
      expect.objectContaining({ key: 'quality-roe', status: 'pass', threshold: '至少 10%' }),
      expect.objectContaining({ key: 'shareholder-yield', status: 'pass', optional: true }),
    ]))
    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'local-daily-bars' }),
      expect.objectContaining({ id: 'eastmoney-financial' }),
    ]))
  })

  it('keeps the actual Eastmoney fallback source in evidence and factor provenance', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-fallback',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial, { ...financial, reportDate: '2025-12-31' }],
      shareholderReturn: {
        ...shareholderReturn,
        provider: 'eastmoney',
        providerChain: ['tushare', 'eastmoney'],
        fallbackUsed: true,
        fallbackReason: 'QUANT_PROVIDER_QUOTA',
      },
    })

    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'shareholder-yield',
        source: expect.stringContaining('Eastmoney'),
        detail: expect.stringContaining('QUANT_PROVIDER_QUOTA'),
      }),
    ]))
    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eastmoney-dividend', name: expect.stringContaining('回退链') }),
    ]))
    expect(report.factorModel?.factors.find(factor => factor.key === 'shareholder-return')).toMatchObject({
      sourceId: 'eastmoney-dividend',
      source: expect.stringContaining('Eastmoney'),
    })
  })

  it('fails closed on missing data and highlights risk before research timing', () => {
    const report = buildQuantResearchReport({
      tsCode: '600089.SH',
      name: '特变电工',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: null,
      candidate: {
        ...candidate,
        tsCode: '600089.SH',
        factors: { ...candidate.factors, ma20: null, return20: -0.2, volumeRatio: 4, consecutiveUpDays: 8 },
      },
      dailyBars: bars(8),
      valuation: null,
      financialReports: [],
      shareholderReturn: null,
      valuationErrorCode: 'QUANT_PROVIDER_TIMEOUT',
      financialErrorCode: 'QUANT_PROVIDER_UPSTREAM',
    })

    expect(report).toMatchObject({ status: 'insufficient_data', action: 'complete-data', score: 0 })
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trend-sample', status: 'missing', value: 8 }),
      expect.objectContaining({ key: 'valuation-pe', status: 'missing', detail: expect.stringContaining('TIMEOUT') }),
      expect.objectContaining({ key: 'risk-volume', status: 'fail', value: 4 }),
    ]))
    expect(report.gaps.length).toBeGreaterThan(0)
    expect(report.risks.length).toBeGreaterThan(0)
  })

  it('keeps newly mapped valuation and financial evidence missing instead of zero-filling it', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-partial',
      candidate,
      dailyBars: bars(80),
      valuation: { ...valuation, peg: null },
      financialReports: [{ ...financial, grossMargin: null, debtAssetRatio: null }],
      shareholderReturn,
    })

    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'valuation-peg', value: null, status: 'missing' }),
      expect.objectContaining({ key: 'quality-gross-margin', value: null, status: 'missing' }),
      expect.objectContaining({ key: 'quality-debt-asset', value: null, status: 'missing' }),
    ]))
    expect(report.factorModel?.factors.find(factor => factor.key === 'valuation')).toMatchObject({ status: 'ready', missingEvidenceKeys: ['valuation-peg'] })
    expect(report.factorModel?.factors.find(factor => factor.key === 'quality')).toMatchObject({ status: 'partial', missingEvidenceKeys: ['quality-gross-margin', 'quality-debt-asset'] })
    expect(report.decision?.recommendation).toBe('watch')
  })

  it('keeps AkShare factors optional and makes cross-source differences explicit', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-1',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial, { ...financial, reportDate: '2025-12-31' }],
      shareholderReturn,
      akshare,
    })

    expect(report).toMatchObject({ action: 'research-window', score: 100, status: 'ready' })
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'akshare-roe', optional: true, status: 'pass', detail: expect.stringContaining('同期值接近') }),
      expect.objectContaining({ key: 'akshare-net-profit-yoy', optional: true, status: 'caution', detail: expect.stringContaining('报告期不同') }),
    ]))
  })

  it('keeps cashflow evidence optional while exposing its source and formulas', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-cashflow',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial],
      shareholderReturn: {
        ...shareholderReturn,
        cashflowEvidence: {
          formulaVersion: 'shareholder-cashflow-v2',
          status: 'ready',
          provider: 'eastmoney',
          providerErrorCode: null,
          observedAt: '2026-08-26T00:00:00.000Z',
          reportDate: '2026-06-30',
          reportType: '中报',
          reportDateName: '2026中报',
          noticeDate: '2026-08-22',
          operatingCashflow: 100,
          capitalExpenditure: 30,
          netProfit: 80,
          cashDividendsPaid: 20,
          freeCashflow: 70,
          freeCashflowCoverage: 3.5,
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
          freeCashflowAfterInterest: 60,
          payoutRatio: 25,
          payoutRatioReportDate: '2025-12-31',
          missingFields: [],
          historySummary: {
            formulaVersion: 'shareholder-cashflow-history-v1',
            status: 'ready',
            periodCount: 2,
            coreReadyPeriodCount: 2,
            positiveFreeCashflowPeriods: 2,
            positiveFreeCashflowAfterInterestPeriods: 2,
            coveredDividendPeriods: 2,
            payoutRatioPeriodCount: 1,
            latestReportDate: '2026-06-30',
            missingFields: [],
          },
        },
      },
    })

    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eastmoney-cashflow', formulaVersion: 'shareholder-cashflow-v2' }),
    ]))
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'shareholder-free-cashflow', value: 70, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-cashflow-coverage', value: 3.5, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-interest-expense', value: 10, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-interest-bearing-debt', value: 200, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-free-cashflow-after-interest', value: 60, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-payout-ratio', value: 25, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-cashflow-history', value: 2, optional: true, status: 'pass', formulaVersion: 'shareholder-cashflow-history-v1' }),
    ]))
    expect(report.factorModel?.factors.find(factor => factor.key === 'shareholder-return')?.evidenceKeys).toEqual(['shareholder-yield'])
  })

  it('keeps capital structure evidence optional and separate from scoring', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-capital',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial],
      shareholderReturn: {
        ...shareholderReturn,
        capitalStructureEvidence: {
          formulaVersion: 'shareholder-capital-v1',
          status: 'ready',
          provider: 'eastmoney',
          providerErrorCode: null,
          observedAt: '2026-08-26T00:00:00.000Z',
          latestReportDate: '2026-03-31',
          latestTotalShares: 1200,
          latestChangeReason: '债转股上市',
          previousReportDate: '2025-12-18',
          previousTotalShares: 1100,
          sharesOutstandingChange: 100,
          sharesOutstandingChangeRatio: 9.09,
          repurchaseSharesRetired: 50,
          changes: [
            { reportDate: '2026-03-31', totalShares: 1200, changeReason: '债转股上市', sharesOutstandingChange: 100, sharesOutstandingChangeRatio: 9.09 },
            { reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购', sharesOutstandingChange: -50, sharesOutstandingChangeRatio: -4.35 },
          ],
          missingFields: [],
        },
      },
    })

    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eastmoney-capital-structure', formulaVersion: 'shareholder-capital-v1' }),
    ]))
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'shareholder-shares-outstanding-change', value: 100, optional: true, status: 'pass' }),
      expect.objectContaining({ key: 'shareholder-repurchase-shares', value: 50, optional: true, status: 'pass' }),
    ]))
    expect(report.factorModel?.factors.find(factor => factor.key === 'shareholder-return')?.evidenceKeys).toEqual(['shareholder-yield'])
  })

  it('keeps executed repurchase amount optional and separate from scoring', () => {
    const report = buildQuantResearchReport({
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: new Date('2026-08-26T00:00:00.000Z'),
      sourceSnapshotId: 'snapshot-repurchase',
      candidate,
      dailyBars: bars(80),
      valuation,
      financialReports: [financial],
      shareholderReturn: {
        ...shareholderReturn,
        repurchaseEvidence: {
          formulaVersion: 'shareholder-repurchase-v1',
          status: 'ready',
          provider: 'eastmoney',
          providerErrorCode: null,
          observedAt: '2026-08-26T00:00:00.000Z',
          latestAnnouncementDate: '2026-04-15',
          latestProgress: '006',
          repurchaseAmount: 2499754839.55,
          plannedAmountLower: 1500000000,
          plannedAmountUpper: 2500000000,
          records: [],
          missingFields: [],
        },
      },
    })

    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eastmoney-repurchase', formulaVersion: 'shareholder-repurchase-v1' }),
    ]))
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'shareholder-repurchase-amount', value: 2499754839.55, optional: true, status: 'pass' }),
    ]))
    expect(report.factorModel?.factors.find(factor => factor.key === 'shareholder-return')?.evidenceKeys).toEqual(['shareholder-yield'])
  })
})
