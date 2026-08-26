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
  peg: null,
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
  observedAt: '2026-08-26T00:00:00.000Z',
  latestClose: 110,
  trailingCashDividendPerShare: 1,
  trailingDividendYield: 0.91,
  dividendYears: 4,
  distributions: [],
  missingFields: [],
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
      reportVersion: 'research-report-v1',
      tsCode: '601899.SH',
      sourceSnapshotId: 'snapshot-1',
      status: 'ready',
      action: 'research-window',
      score: 100,
    })
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'valuation-pe', value: 12, source: 'Eastmoney 估值', formulaVersion: 'eastmoney-valuation-v1' }),
      expect.objectContaining({ key: 'quality-roe', status: 'pass', threshold: '至少 10%' }),
      expect.objectContaining({ key: 'shareholder-yield', status: 'pass', optional: true }),
    ]))
    expect(report.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'local-daily-bars' }),
      expect.objectContaining({ id: 'eastmoney-financial' }),
    ]))
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
})
