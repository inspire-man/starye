import type { QuantDecisionRecord, QuantDecisionRecordAction, QuantRecommendation } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionCalibration } from '../decision-calibration'

function record(id: string, action: QuantDecisionRecordAction, price: number, observedAt: string, aiAccepted = true): QuantDecisionRecord {
  return {
    id,
    researchRunId: `run-${id}`,
    tsCode: '000001.SZ',
    action,
    note: null,
    createdAt: observedAt,
    updatedAt: observedAt,
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: observedAt,
      recommendation: 'bullish',
      confidence: 80,
      coverage: 100,
      evidenceKeys: ['trend'],
      currentPrice: price,
      currentPriceObservedAt: observedAt,
      buyPriceRange: null,
      sellPriceRange: null,
      aiDecisionReview: { decisionVersion: 'v1', recommendation: 'bullish', confidence: 80, accepted: aiAccepted, rejectionReason: aiAccepted ? null : 'low-confidence', factorReviewCoverage: 100, rationale: 'test', invalidationConditions: [], citedEvidenceKeys: ['trend'] },
      aiFactorReviews: [],
      factorConfiguration: null,
    },
  }
}

describe('buildQuantDecisionCalibration', () => {
  it('separates observed and pending outcomes', () => {
    const result = buildQuantDecisionCalibration([
      record('base', 'plan-buy', 10, '20260901'),
      record('follow', 'watch', 11, '20260902'),
      record('pending', 'holding', 12, '20260903'),
    ], [{ tsCode: '000001.SZ', latestClose: 12, latestTradeDate: '20260903' }])
    expect(result.summary).toMatchObject({ recordCount: 3, observedCount: 1, pendingCount: 1, alignedCount: 1, acceptedAiCount: 3, averageChangePercent: null, recommendationAlignedCount: 1, recommendationDirectionalSampleCount: 1, recommendationAgreementRate: null })
    expect(result.recommendationHeadline).toContain('不足 6 条')
    expect(result.recommendationHeadline).toContain('这不是胜率')
    expect(result.recommendationHeadline).not.toContain('%')
  })

  it('keeps AI rejection separate from price outcomes', () => {
    const result = buildQuantDecisionCalibration([record('watch', 'watch', 10, '20260901', false)], [])
    expect(result.summary.unacceptedAiCount).toBe(1)
    expect(result.summary.observedCount).toBe(0)
    expect(result.status).toBe('empty')
  })

  it('calculates recommendation agreement only after six directional samples and excludes watch and flat prices', () => {
    const records = [
      ...Array.from({ length: 6 }, (_, index) => pair(`up-${index}`, 'bullish', 12)).flat(),
      ...Array.from({ length: 2 }, (_, index) => pair(`down-${index}`, 'bearish', 12)).flat(),
      ...pair('watch', 'watch', 12),
      ...pair('flat', 'bullish', 10),
    ]
    const result = buildQuantDecisionCalibration(records, [{ tsCode: 'down-0', name: '看空样本', latestClose: null, latestTradeDate: null }])
    expect(result.summary).toMatchObject({
      recommendationAlignedCount: 6,
      recommendationOpposedCount: 2,
      recommendationFlatCount: 1,
      recommendationNonDirectionalCount: 1,
      recommendationDirectionalSampleCount: 8,
      recommendationAgreementRate: 75,
    })
    expect(result.bullish).toEqual({ alignedCount: 6, opposedCount: 0, sampleCount: 6, agreementRate: 100 })
    expect(result.bearish).toEqual({ alignedCount: 0, opposedCount: 2, sampleCount: 2, agreementRate: null })
    expect(result.recommendationHeadline).toContain('看多方向一致 6 / 6（100%）')
    expect(result.recommendationHeadline).toContain('看空方向样本 2 条，不足 6 条')
    expect(result.recommendationHeadline).toContain('6 / 8（75%）')
    expect(result.recommendationHeadline).toContain('这不是胜率，也不是收益')
    expect(result.recommendationOutcomes.filter(item => !item.matched).map(item => [item.tsCode, item.name, item.recommendation, item.direction])).toEqual([
      ['down-0', '看空样本', 'bearish', 'up'],
      ['down-1', null, 'bearish', 'up'],
    ])
  })
})

function pair(code: string, recommendation: QuantRecommendation, laterPrice: number): QuantDecisionRecord[] {
  return [record(`${code}-base`, 'plan-buy', 10, '20260901'), record(`${code}-follow`, 'watch', laterPrice, '20260902')].map(item => ({
    ...item,
    tsCode: code,
    snapshot: { ...item.snapshot, recommendation },
  }))
}
