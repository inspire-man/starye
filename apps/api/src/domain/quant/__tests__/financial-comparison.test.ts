import type { QuantFinancialQualitySnapshot } from '../provider'
import { describe, expect, it } from 'vitest'
import { buildQuantFinancialQualityComparison } from '../financial-comparison'

function quality(tsCode: string, revenueYoY: number | null, netProfitYoY: number | null, roe: number | null, debtAssetRatio: number | null): QuantFinancialQualitySnapshot {
  return {
    tsCode,
    observedAt: '2026-08-23T00:00:00.000Z',
    reportDate: '2026-06-30',
    reportType: '中报',
    reportDateName: '2026中报',
    noticeDate: '2026-08-30',
    revenue: null,
    revenueYoY,
    netProfit: null,
    netProfitYoY,
    adjustedNetProfit: null,
    adjustedNetProfitYoY: null,
    roe,
    grossMargin: null,
    netMargin: null,
    debtAssetRatio,
    operatingCashflowToRevenue: null,
    operatingCashflowPerShare: null,
    fcffBack: null,
    fcffForward: null,
    interestCoverage: null,
    interestBearingDebtRatio: null,
    cashRatio: null,
    totalLiability: null,
    roic: null,
  }
}

describe('quant financial quality comparison', () => {
  it('calculates growth, return, and leverage positions against the watchlist', () => {
    const result = buildQuantFinancialQualityComparison('601899.SH', [
      { tsCode: '601899.SH', name: '紫金矿业', quality: quality('601899.SH', 20, 40, 18, 45) },
      { tsCode: '600089.SH', name: '特变电工', quality: quality('600089.SH', 10, 30, 12, 55) },
      { tsCode: '600938.SH', name: '中国海油', quality: quality('600938.SH', 15, 50, 20, 60) },
    ])

    expect(result).toMatchObject({
      sampleCount: 3,
      availableSampleCount: 3,
      revenueYoYSampleCount: 3,
      netProfitYoYSampleCount: 3,
      roeSampleCount: 3,
      debtAssetRatioSampleCount: 3,
      revenueYoYHigherThanPercent: 100,
      netProfitYoYHigherThanPercent: 50,
      roeHigherThanPercent: 50,
      debtAssetRatioLowerThanPercent: 100,
    })
  })

  it('keeps missing peers out of relative positions', () => {
    const result = buildQuantFinancialQualityComparison('601899.SH', [
      { tsCode: '601899.SH', name: '紫金矿业', quality: quality('601899.SH', 20, null, 18, null) },
      { tsCode: '600089.SH', name: '特变电工', quality: null },
      { tsCode: '600938.SH', name: '中国海油', quality: quality('600938.SH', null, null, null, null) },
    ])

    expect(result).toMatchObject({
      availableSampleCount: 2,
      revenueYoYSampleCount: 1,
      revenueYoYHigherThanPercent: null,
      netProfitYoYHigherThanPercent: null,
      roeHigherThanPercent: null,
      debtAssetRatioLowerThanPercent: null,
    })
  })
})
