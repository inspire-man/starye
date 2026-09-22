import type { QuantDecisionRecord, QuantDecisionRecordAction } from '../quant-view-models'
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
    expect(result.summary).toMatchObject({ recordCount: 3, observedCount: 1, pendingCount: 1, alignedCount: 1, acceptedAiCount: 3 })
    expect(result.summary.averageChangePercent).toBe(10)
  })

  it('keeps AI rejection separate from price outcomes', () => {
    const result = buildQuantDecisionCalibration([record('watch', 'watch', 10, '20260901', false)], [])
    expect(result.summary.unacceptedAiCount).toBe(1)
    expect(result.summary.observedCount).toBe(0)
    expect(result.status).toBe('empty')
  })
})
