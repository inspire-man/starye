import type { QuantFinancialQualitySnapshot, QuantValuationSnapshot } from '../provider'
import type { DailyBar, MomentumCandidate } from '../types'
import { describe, expect, it } from 'vitest'
import { buildValueQualityBatch, buildValueQualityResult } from '../value-quality'

function valuation(tsCode: string, values: Partial<QuantValuationSnapshot> = {}): QuantValuationSnapshot {
  return {
    tsCode,
    observedAt: '2026-08-25T00:00:00.000Z',
    dynamicPe: null,
    peTtm: 12,
    peStatic: null,
    pb: 1.2,
    ps: 1,
    peg: 0.8,
    marketCap: 100,
    ...values,
  }
}

function report(tsCode: string, reportDate: string, values: Partial<QuantFinancialQualitySnapshot> = {}): QuantFinancialQualitySnapshot {
  return {
    tsCode,
    observedAt: '2026-08-25T00:00:00.000Z',
    reportDate,
    reportType: '年报',
    reportDateName: null,
    noticeDate: '2026-04-01',
    revenue: 100,
    revenueYoY: 10,
    netProfit: 20,
    netProfitYoY: 12,
    adjustedNetProfit: 18,
    adjustedNetProfitYoY: 10,
    roe: 12,
    grossMargin: 25,
    netMargin: 10,
    debtAssetRatio: 45,
    operatingCashflowToRevenue: 8,
    operatingCashflowPerShare: null,
    fcffBack: null,
    fcffForward: null,
    interestCoverage: 10,
    interestBearingDebtRatio: 25,
    cashRatio: 1.2,
    totalLiability: null,
    roic: 9,
    ...values,
  }
}

function bars(tsCode: string, count = 80, multiplier = 1): DailyBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = (100 + index * multiplier)
    return {
      tsCode,
      tradeDate: `2026${String(Math.floor(index / 30) + 1).padStart(2, '0')}${String(index % 30 + 1).padStart(2, '0')}`,
      open: close,
      high: close,
      low: close,
      close,
      preClose: index === 0 ? null : close - multiplier,
      change: index === 0 ? null : multiplier,
      pctChg: index === 0 ? null : multiplier / (close - multiplier) * 100,
      volume: 1000,
      amount: 10000,
    }
  })
}

function candidate(tsCode: string): MomentumCandidate {
  return {
    tsCode,
    factorVersion: 'momentum-v1',
    factors: {
      ma5: 100,
      ma20: 95,
      isNewHigh20: true,
      consecutiveUpDays: 2,
      volumeRatio: 1.2,
      return20: 0.05,
      relativeStrength: 0.5,
    },
    matchedFactors: ['ma20'],
    missingFactors: [],
    dataQuality: 'ready',
    score: 1,
  }
}

function input(tsCode: string, overrides: Partial<Parameters<typeof buildValueQualityResult>[0]> = {}) {
  return {
    tsCode,
    name: tsCode,
    valuation: valuation(tsCode),
    financialReports: [report(tsCode, '2026-03-31'), report(tsCode, '2025-12-31', { netProfitYoY: 8 })],
    dailyBars: bars(tsCode),
    candidate: candidate(tsCode),
    valuationErrorCode: null,
    financialErrorCode: null,
    observedAt: '2026-08-25T00:00:00.000Z',
    ...overrides,
  }
}

describe('quant value quality formula', () => {
  it('uses favorable peer-relative directions and keeps a complete score bounded', () => {
    const cheaper = input('000001.SZ', { valuation: valuation('000001.SZ', { peTtm: 8, pb: 0.8 }) })
    const expensive = input('000002.SZ', { valuation: valuation('000002.SZ', { peTtm: 24, pb: 2.4 }) })
    const result = buildValueQualityBatch([cheaper, expensive], '2026-08-25T00:00:00.000Z')
    const cheaperResult = result.items[0]!
    const expensiveResult = result.items[1]!
    const cheaperPe = cheaperResult.dimensions[0]!.metrics.find(metric => metric.key === 'pe_ttm')!
    const expensivePe = expensiveResult.dimensions[0]!.metrics.find(metric => metric.key === 'pe_ttm')!

    expect(cheaperResult.status).toBe('ready')
    expect(cheaperResult.score).toBeGreaterThanOrEqual(0)
    expect(cheaperResult.score).toBeLessThanOrEqual(100)
    expect(cheaperPe.favorablePercentile).toBeGreaterThan(expensivePe.favorablePercentile ?? -1)
    expect(result.readyCount).toBe(2)
  })

  it('excludes negative valuation metrics and refuses a fabricated total score', () => {
    const result = buildValueQualityResult(input('000001.SZ', {
      valuation: valuation('000001.SZ', { peTtm: -5, pb: null, ps: null, peg: null }),
    }), [input('000001.SZ', {
      valuation: valuation('000001.SZ', { peTtm: -5, pb: null, ps: null, peg: null }),
    }), input('000002.SZ')])
    const valuationDimension = result.dimensions.find(dimension => dimension.key === 'valuation')!

    expect(result.status).toBe('insufficient_data')
    expect(result.score).toBeNull()
    expect(valuationDimension.metrics.every(metric => metric.value === null || metric.key === 'pe_ttm')).toBe(true)
    expect(result.missingFields).toContain('估值可比指标不足（至少需要 2 项正值）')
  })

  it('deducts for profit and cash-flow divergence and short-term acceleration', () => {
    const result = buildValueQualityResult(input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { operatingCashflowToRevenue: -4 }), report('000001.SZ', '2025-12-31', { netProfitYoY: 8 })],
      candidate: {
        ...candidate('000001.SZ'),
        factors: { ...candidate('000001.SZ').factors, return20: 0.3, consecutiveUpDays: 6, volumeRatio: 2.2 },
      },
    }), [input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { operatingCashflowToRevenue: -4 }), report('000001.SZ', '2025-12-31', { netProfitYoY: 8 })],
      candidate: {
        ...candidate('000001.SZ'),
        factors: { ...candidate('000001.SZ').factors, return20: 0.3, consecutiveUpDays: 6, volumeRatio: 2.2 },
      },
    }), input('000002.SZ')])

    expect(result.riskDeduction).toBeGreaterThanOrEqual(5)
    expect(result.riskNotes).toContain('净利润增长与经营现金流方向不一致')
    expect(result.riskNotes).toContain('短期上涨或放量偏快，避免把强势当成价值')
  })

  it('adds resilience scoring and absolute debt-risk thresholds', () => {
    const result = buildValueQualityResult(input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', {
        interestCoverage: 2.5,
        interestBearingDebtRatio: 55,
        cashRatio: 0.4,
        operatingCashflowToRevenue: -4,
      }), report('000001.SZ', '2025-12-31', { operatingCashflowToRevenue: 8 })],
    }), [input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', {
        interestCoverage: 2.5,
        interestBearingDebtRatio: 55,
        cashRatio: 0.4,
        operatingCashflowToRevenue: -4,
      }), report('000001.SZ', '2025-12-31', { operatingCashflowToRevenue: 8 })],
    }), input('000002.SZ')])

    const resilience = result.dimensions.find(dimension => dimension.key === 'resilience')!
    const continuity = result.dimensions.find(dimension => dimension.key === 'growth')!.metrics.find(metric => metric.key === 'cashflow_continuity')!

    expect(result.formulaVersion).toBe('value-quality-v2')
    expect(resilience.maxScore).toBe(15)
    expect(resilience.status).toBe('ready')
    expect(continuity.value).toBe(0.5)
    expect(result.riskDeduction).toBeGreaterThanOrEqual(8)
    expect(result.riskDeduction).toBeLessThanOrEqual(10)
    expect(result.riskNotes).toContain('经营现金流连续性不高于 50%，利润质量需要复核')
    expect(result.riskNotes).toEqual(expect.arrayContaining([
      '利息覆盖低于 5 倍，先核对偿债能力',
      '现金比率低于 0.5，短期流动性偏紧',
      '带息负债率高于 50%，债务结构需要复核',
    ]))
  })

  it('ranks stronger resilience values more favorably inside the watchlist', () => {
    const stronger = input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { interestCoverage: 20, cashRatio: 2, interestBearingDebtRatio: 15 }), report('000001.SZ', '2025-12-31')],
    })
    const weaker = input('000002.SZ', {
      financialReports: [report('000002.SZ', '2026-03-31', { interestCoverage: 3, cashRatio: 0.6, interestBearingDebtRatio: 55 }), report('000002.SZ', '2025-12-31')],
    })
    const result = buildValueQualityBatch([stronger, weaker], '2026-08-25T00:00:00.000Z')
    const strongerDimension = result.items[0]!.dimensions.find(dimension => dimension.key === 'resilience')!
    const weakerDimension = result.items[1]!.dimensions.find(dimension => dimension.key === 'resilience')!

    for (const key of ['interest_coverage', 'cash_ratio', 'interest_bearing_debt_ratio']) {
      const strongerMetric = strongerDimension.metrics.find(metric => metric.key === key)!
      const weakerMetric = weakerDimension.metrics.find(metric => metric.key === key)!
      expect(strongerMetric.favorablePercentile).toBeGreaterThan(weakerMetric.favorablePercentile ?? -1)
    }
  })

  it('requires at least two resilience metrics before marking the result complete', () => {
    const result = buildValueQualityResult(input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { cashRatio: null, interestBearingDebtRatio: null }), report('000001.SZ', '2025-12-31')],
    }), [input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { cashRatio: null, interestBearingDebtRatio: null }), report('000001.SZ', '2025-12-31')],
    }), input('000002.SZ')])

    expect(result.score).toBeNull()
    expect(result.status).toBe('insufficient_data')
    expect(result.missingFields).toContain('资产负债表韧性指标不足（至少需要 2 项）')
  })

  it('keeps a single resilience value visible when the peer sample is insufficient', () => {
    const target = input('000001.SZ', {
      financialReports: [report('000001.SZ', '2026-03-31', { cashRatio: null, interestBearingDebtRatio: null }), report('000001.SZ', '2025-12-31', { cashRatio: null, interestBearingDebtRatio: null })],
    })
    const peer = input('000002.SZ', {
      financialReports: [report('000002.SZ', '2026-03-31', { interestCoverage: null, cashRatio: null, interestBearingDebtRatio: null }), report('000002.SZ', '2025-12-31', { interestCoverage: null, cashRatio: null, interestBearingDebtRatio: null })],
    })
    const result = buildValueQualityResult(target, [target, peer])
    const resilience = result.dimensions.find(dimension => dimension.key === 'resilience')!
    const coverage = resilience.metrics.find(metric => metric.key === 'interest_coverage')!

    expect(resilience.status).toBe('partial')
    expect(coverage.value).toBe(10)
    expect(coverage.sampleCount).toBe(1)
    expect(coverage.favorablePercentile).toBeNull()
  })

  it('reports partial source failure without zero-filling the result', () => {
    const result = buildValueQualityResult(input('000001.SZ', {
      valuation: null,
      valuationErrorCode: 'QUANT_PROVIDER_TIMEOUT',
    }), [input('000001.SZ', { valuation: null, valuationErrorCode: 'QUANT_PROVIDER_TIMEOUT' }), input('000002.SZ')])

    expect(result.status).toBe('partial')
    expect(result.valuationStatus).toBe('failed')
    expect(result.score).toBeNull()
    expect(result.missingFields[0]).toContain('QUANT_PROVIDER_TIMEOUT')
  })

  it('requires a full 60-day return window instead of accepting a short history', () => {
    const shortHistory = input('000001.SZ', { dailyBars: bars('000001.SZ', 60) })
    const result = buildValueQualityResult(shortHistory, [shortHistory, input('000002.SZ')])

    expect(result.dailyStatus).toBe('partial')
    expect(result.status).toBe('insufficient_data')
    expect(result.missingFields).toContain('60 日趋势窗口')
  })
})
