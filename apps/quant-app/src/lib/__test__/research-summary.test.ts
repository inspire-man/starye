import type { CandidateItem, QuantFinancialQualitySnapshot } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildResearchSummary } from '../research-summary'

function candidate(overrides: Partial<CandidateItem> = {}): CandidateItem {
  return {
    id: 'candidate-1',
    tsCode: '601899.SH',
    factorVersion: 'momentum-v1',
    name: '紫金矿业',
    score: 3,
    close: 34.74,
    changePercent: 1.2,
    ma5: 34.2,
    ma20: 33.4,
    return20: 0.08,
    newHigh20: false,
    upStreak: 2,
    volumeRatio: 1.3,
    relativeStrength: 0.8,
    signals: ['ma20', 'volume_ratio', 'relative_strength'],
    missingFactors: [],
    quality: 'ready',
    ...overrides,
  }
}

function financial(overrides: Partial<QuantFinancialQualitySnapshot> = {}): QuantFinancialQualitySnapshot {
  return {
    tsCode: '601899.SH',
    observedAt: '2026-08-24T00:00:00.000Z',
    reportDate: '2026-06-30',
    reportType: '中报',
    reportDateName: '2026中报',
    noticeDate: '2026-08-20',
    revenue: 350000000000,
    revenueYoY: 15.78,
    netProfit: 41000000000,
    netProfitYoY: 68.17,
    adjustedNetProfit: null,
    adjustedNetProfitYoY: null,
    roe: 19.6,
    grossMargin: 37.74,
    netMargin: 16.2,
    debtAssetRatio: 49.55,
    operatingCashflowToRevenue: 0.28,
    operatingCashflowPerShare: null,
    fcffBack: null,
    fcffForward: null,
    interestCoverage: null,
    interestBearingDebtRatio: null,
    cashRatio: null,
    totalLiability: null,
    roic: 11.75,
    ...overrides,
  }
}

function baseInput() {
  return {
    candidate: candidate(),
    valuation: {
      tsCode: '601899.SH',
      observedAt: '2026-08-24T00:00:00.000Z',
      dynamicPe: 11.79,
      peTtm: 17.84,
      peStatic: 13.65,
      pb: 2.46,
      ps: null,
      peg: 1.46,
      marketCap: 923761425968.28,
    },
    valuationComparison: {
      target: {
        tsCode: '601899.SH',
        observedAt: '2026-08-24T00:00:00.000Z',
        dynamicPe: 11.79,
        peTtm: 17.84,
        peStatic: 13.65,
        pb: 2.46,
        ps: null,
        peg: 1.46,
        marketCap: 923761425968.28,
      },
      peers: [],
      sampleCount: 4,
      availableSampleCount: 4,
      ttmPeSampleCount: 4,
      pbSampleCount: 4,
      ttmPeHigherThanPercent: 0,
      pbHigherThanPercent: 33,
    },
    financial: financial(),
    financialComparison: null,
    trends: [
      { label: '营收增速', tone: 'positive' as const, state: '改善' },
      { label: 'ROE 回报', tone: 'positive' as const, state: '改善' },
    ],
    risks: [],
  }
}

describe('buildResearchSummary', () => {
  it('turns complete supporting data into a research state', () => {
    const result = buildResearchSummary(baseInput())

    expect(result).toMatchObject({ status: 'research', tone: 'positive', label: '继续研究' })
    expect(result?.headline).toContain('技术与基本面方向一致')
    expect(result?.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'technical', state: 'positive' }),
      expect.objectContaining({ key: 'financial', state: 'positive' }),
    ]))
    expect(result?.support).toContain('技术信号命中 3 项')
    expect(result?.support).toContain('估值在当前观察池中相对靠前')
  })

  it('downgrades the state when danger or weak trends are present', () => {
    const result = buildResearchSummary({
      ...baseInput(),
      trends: [
        { label: '营收增速', tone: 'negative', state: '走弱' },
        { label: 'ROE 回报', tone: 'negative', state: '走弱' },
      ],
      risks: [{ tone: 'danger', title: '短线回撤' }],
      valuationComparison: { ...baseInput().valuationComparison, ttmPeHigherThanPercent: 80, pbHigherThanPercent: 80 },
    })

    expect(result).toMatchObject({ status: 'observe', tone: 'warning', label: '先观察' })
    expect(result?.watchouts).toContain('短线回撤')
    expect(result?.watchouts).toContain('营收增速走弱')
  })

  it('explains when strong technical signals conflict with high valuation', () => {
    const result = buildResearchSummary({
      ...baseInput(),
      valuationComparison: { ...baseInput().valuationComparison, ttmPeHigherThanPercent: 80, pbHigherThanPercent: 80 },
    })

    expect(result?.headline).toContain('估值处于观察池高位')
    expect(result?.watchouts).toContain('技术较强但估值偏高，避免只看涨势')
    expect(result?.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'valuation', state: 'caution' }),
    ]))
  })

  it('asks for technical confirmation when fundamentals lead', () => {
    const result = buildResearchSummary({
      ...baseInput(),
      candidate: candidate({ score: 1, signals: ['ma20'] }),
      trends: [
        { label: '营收增速', tone: 'positive' as const, state: '改善' },
        { label: 'ROE 回报', tone: 'positive' as const, state: '改善' },
      ],
    })

    expect(result?.headline).toContain('技术信号尚未确认')
    expect(result?.nextChecks).toContain('等待技术信号进一步确认')
  })

  it('reports incomplete data and gives concrete next checks', () => {
    const result = buildResearchSummary({
      ...baseInput(),
      candidate: candidate({ quality: 'partial' }),
      valuation: null,
      valuationComparison: null,
      financial: null,
    })

    expect(result).toMatchObject({ status: 'incomplete', label: '数据不足' })
    expect(result?.nextChecks).toContain('先更新缺失的数据，再重新判断')
    expect(result?.watchouts).toContain('估值字段不完整，暂不做估值结论')
  })

  it('returns no summary until a stock is selected', () => {
    expect(buildResearchSummary({ ...baseInput(), candidate: null })).toBeNull()
  })
})
