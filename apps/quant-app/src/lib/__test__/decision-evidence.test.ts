import type { CandidateItem, QuantFinancialQualitySnapshot, QuantShareholderReturnItem, QuantValuationComparison, QuantValuationSnapshot, QuantValueQualityItem } from '../quant-types'
import type { TrendStructure } from '../trend-analysis'
import { describe, expect, it } from 'vitest'
import { buildDecisionEvidence } from '../decision-evidence'

const candidate: CandidateItem = {
  id: 'candidate-1',
  tsCode: '601899.SH',
  factorVersion: 'momentum-v1',
  name: '紫金矿业',
  score: 4,
  close: 34.54,
  changePercent: 1.2,
  ma5: 34.2,
  ma20: 33.4,
  return20: 0.08,
  newHigh20: false,
  upStreak: 2,
  volumeRatio: 1.3,
  relativeStrength: 0.8,
  signals: ['ma20', 'new_high_20', 'volume_ratio', 'relative_strength'],
  missingFactors: [],
  quality: 'ready',
}

const trend: TrendStructure = {
  return5: 0.03,
  return20: 0.08,
  return60: 0.18,
  ma20Gap: 0.04,
  drawdown60: -0.03,
  availableBars: 80,
  tone: 'positive',
  conclusion: '多周期偏强，价格站在 20 日均线之上',
}

const valuation: QuantValuationSnapshot = {
  tsCode: '601899.SH',
  observedAt: '2026-08-25T00:00:00.000Z',
  dynamicPe: 11,
  peTtm: 12,
  peStatic: 13,
  pb: 1.8,
  ps: 2,
  peg: 0.8,
  marketCap: 100000000000,
}

const valuationComparison: QuantValuationComparison = {
  target: valuation,
  peers: [],
  sampleCount: 5,
  availableSampleCount: 5,
  ttmPeSampleCount: 5,
  pbSampleCount: 5,
  ttmPeHigherThanPercent: 40,
  pbHigherThanPercent: 50,
}

const financial: QuantFinancialQualitySnapshot = {
  tsCode: '601899.SH',
  observedAt: '2026-08-25T00:00:00.000Z',
  reportDate: '2026-06-30',
  reportType: '中报',
  reportDateName: '2026中报',
  noticeDate: '2026-08-20',
  revenue: 100,
  revenueYoY: 10,
  netProfit: 20,
  netProfitYoY: 12,
  adjustedNetProfit: 19,
  adjustedNetProfitYoY: 11,
  roe: 18,
  grossMargin: 30,
  netMargin: 20,
  debtAssetRatio: 40,
  operatingCashflowToRevenue: 0.2,
  operatingCashflowPerShare: 1,
  fcffBack: 2,
  fcffForward: 3,
  interestCoverage: 10,
  interestBearingDebtRatio: 20,
  cashRatio: 0.8,
  totalLiability: 40,
  roic: 12,
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
  observedAt: '2026-08-25T00:00:00.000Z',
  latestClose: 34.54,
  trailingCashDividendPerShare: 0.42,
  trailingDividendYield: 1.22,
  dividendYears: 4,
  distributions: [],
  missingFields: [],
}

const valueQuality: QuantValueQualityItem = {
  tsCode: '601899.SH',
  name: '紫金矿业',
  formulaVersion: 'value-quality-v2',
  status: 'ready',
  score: 78,
  observedAt: '2026-08-25T00:00:00.000Z',
  valuationObservedAt: '2026-08-25T00:00:00.000Z',
  financialObservedAt: '2026-08-25T00:00:00.000Z',
  financialReportDate: '2026-06-30',
  financialNoticeDate: '2026-08-20',
  valuationStatus: 'ready',
  financialStatus: 'ready',
  dailyStatus: 'ready',
  dimensions: [],
  riskDeduction: 0,
  riskNotes: [],
  missingFields: [],
}

function input(overrides: Partial<Parameters<typeof buildDecisionEvidence>[0]> = {}) {
  return {
    candidate,
    trend,
    latestTradeDate: '20260825',
    valuation,
    valuationComparison,
    financial,
    financialHistory: { tsCode: '601899.SH', observedAt: '2026-08-25T00:00:00.000Z', reports: [financial, financial] },
    valueQuality,
    shareholderReturn,
    ...overrides,
  }
}

describe('decision evidence', () => {
  it('produces a quantitative research window with traceable evidence', () => {
    const result = buildDecisionEvidence(input())
    expect(result).toMatchObject({
      formulaVersion: 'decision-evidence-v1',
      action: 'research-window',
      gateScore: 100,
      failedCount: 0,
      missingCount: 0,
    })
    expect(result?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trend-ma20', numericValue: 0.04, source: '本地 Quant 日线库', status: 'pass' }),
      expect.objectContaining({ key: 'valuation-pe', numericValue: 40, threshold: '高于样本 ≤ 67%', status: 'pass' }),
      expect.objectContaining({ key: 'quality-cashflow', numericValue: 0.2, value: '20.00%', status: 'pass' }),
    ]))
  })

  it('downgrades to waiting or reassessment when evidence fails', () => {
    const result = buildDecisionEvidence(input({
      trend: { ...trend, ma20Gap: -0.04, drawdown60: -0.2 },
      valuationComparison: { ...valuationComparison, ttmPeHigherThanPercent: 80 },
      financial: { ...financial, netProfitYoY: 12, operatingCashflowToRevenue: -0.2 },
    }))
    expect(result?.action).toBe('reassess')
    expect(result?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'trend-ma20', status: 'fail' }),
      expect.objectContaining({ key: 'valuation-pe', status: 'fail' }),
      expect.objectContaining({ key: 'quality-cashflow', status: 'fail' }),
    ]))
    expect(result?.reassessmentConditions.length).toBeGreaterThan(0)
  })

  it('does not turn missing data into a positive timing conclusion', () => {
    const result = buildDecisionEvidence(input({
      candidate: { ...candidate, pendingSync: true, pendingReason: '请先更新' },
      trend: { ...trend, availableBars: 0 },
      valuation: null,
      valuationComparison: null,
      financial: null,
      financialHistory: null,
      valueQuality: null,
      shareholderReturn: null,
    }))
    expect(result).toMatchObject({ action: 'complete-data', gateScore: null, missingCount: 1 })
    expect(result?.headline).toContain('不完整')
    expect(result?.evidence[0]).toMatchObject({ status: 'missing', numericValue: null, detail: '请先更新' })
  })
})
