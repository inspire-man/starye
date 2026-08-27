import type { CandidateItem, QuantValueQualityDimension, QuantValueQualityItem, QuantValueQualityMetric } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildCandidateEvidenceScore } from '../candidate-evidence-score'

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

function metric(key: string, value: number | null, sampleCount = 5): QuantValueQualityMetric {
  return { key, label: key, value, favorablePercentile: value === null ? null : 50, sampleCount }
}

function dimension(key: QuantValueQualityDimension['key'], status: QuantValueQualityDimension['status'], values: Array<number | null>): QuantValueQualityDimension {
  return {
    key,
    label: key,
    score: status === 'missing' ? null : 10,
    maxScore: 20,
    status,
    metrics: values.map((value, index) => metric(`${key}-${index}`, value)),
  }
}

function valueQuality(overrides: Partial<QuantValueQualityItem> = {}): QuantValueQualityItem {
  return {
    tsCode: '601899.SH',
    name: '紫金矿业',
    formulaVersion: 'value-quality-v2',
    status: 'ready',
    score: 78,
    observedAt: '2026-08-27T00:00:00.000Z',
    valuationObservedAt: '2026-08-27T00:00:00.000Z',
    financialObservedAt: '2026-08-27T00:00:00.000Z',
    financialReportDate: '2026-06-30',
    financialNoticeDate: '2026-08-20',
    valuationStatus: 'ready',
    financialStatus: 'ready',
    dailyStatus: 'ready',
    dimensions: [
      dimension('valuation', 'ready', [12, 1.2]),
      dimension('quality', 'ready', [12, 9, 25]),
      dimension('growth', 'ready', [10, 12]),
      dimension('resilience', 'ready', [8, 1.2]),
      dimension('trend', 'ready', [0.1, 0.03]),
    ],
    riskDeduction: 0,
    riskNotes: [],
    missingFields: [],
    ...overrides,
  }
}

describe('candidate evidence readiness', () => {
  it('reports complete raw-field coverage without using favorable values', () => {
    const result = buildCandidateEvidenceScore(candidate(), valueQuality())

    expect(result).toMatchObject({
      formulaVersion: 'candidate-evidence-v1',
      status: 'ready',
      score: 100,
      coveredMetricCount: 11,
      totalMetricCount: 11,
      completeDimensionCount: 5,
      partialDimensionCount: 0,
      missingDimensionCount: 0,
    })
    expect(result.dimensions.every(dimension => dimension.comparableMetricCount > 0)).toBe(true)
  })

  it('keeps raw coverage useful when peer comparability or fields are partial', () => {
    const result = buildCandidateEvidenceScore(candidate(), valueQuality({
      status: 'insufficient_data',
      missingFields: ['最近两期财务增长数据'],
      dimensions: [
        dimension('valuation', 'partial', [12, null]),
        dimension('quality', 'ready', [12, 9, 25]),
        dimension('growth', 'missing', [null, null]),
        dimension('resilience', 'ready', [8, 1.2]),
        dimension('trend', 'ready', [0.1, 0.03]),
      ],
    }))

    expect(result.status).toBe('partial')
    expect(result.score).toBe(70)
    expect(result.completeDimensionCount).toBe(3)
    expect(result.partialDimensionCount).toBe(1)
    expect(result.missingDimensionCount).toBe(1)
    expect(result.dimensions.find(dimension => dimension.key === 'valuation')).toMatchObject({ coveredMetricCount: 1, totalMetricCount: 2, coveragePercent: 50, comparableMetricCount: 1 })
    expect(result.missingReasons).toEqual(expect.arrayContaining(['增长稳定性：暂无可用原始字段 · 共 2 个字段', '最近两期财务增长数据']))
  })

  it('distinguishes unloaded results from a loaded missing stock result', () => {
    const unloaded = buildCandidateEvidenceScore(candidate(), undefined)
    const missing = buildCandidateEvidenceScore(candidate(), null)

    expect(unloaded).toMatchObject({ status: 'unavailable', score: null, missingDimensionCount: 0 })
    expect(unloaded.dimensions.every(dimension => dimension.status === 'unavailable' && dimension.coveragePercent === null)).toBe(true)
    expect(missing).toMatchObject({ status: 'missing', score: null, missingDimensionCount: 5 })
    expect(missing.missingReasons).toContain('当前股票没有可用价值质量结果')
  })

  it('caps trend readiness while a candidate is pending daily sync', () => {
    const result = buildCandidateEvidenceScore(candidate({ pendingSync: true }), valueQuality())
    const trend = result.dimensions.find(dimension => dimension.key === 'trend')!

    expect(result.status).toBe('partial')
    expect(trend).toMatchObject({ status: 'missing', coveredMetricCount: 0, coveragePercent: 0, detail: '日线尚未进入当前候选快照' })
    expect(result.missingReasons[0]).toContain('趋势与风险：日线尚未进入当前候选快照')
  })

  it('does not count non-finite raw values as covered evidence', () => {
    const quality = valueQuality({
      dimensions: [
        dimension('valuation', 'ready', [Number.NaN, Number.POSITIVE_INFINITY]),
        dimension('quality', 'ready', [12, 9, 25]),
        dimension('growth', 'ready', [10, 12]),
        dimension('resilience', 'ready', [8, 1.2]),
        dimension('trend', 'ready', [0.1, 0.03]),
      ],
    })
    const result = buildCandidateEvidenceScore(candidate(), quality)

    expect(result.status).toBe('partial')
    expect(result.score).toBe(80)
    expect(result.dimensions[0]).toMatchObject({ status: 'missing', coveredMetricCount: 0, coveragePercent: 0 })
  })
})
