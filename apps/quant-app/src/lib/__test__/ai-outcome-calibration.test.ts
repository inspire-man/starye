import type { QuantAiDecisionReview, QuantAiFactorReview, QuantDecisionRecord, QuantDecisionRecordAction } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildQuantAiOutcomeCalibration } from '../ai-outcome-calibration'

function aiReview(recommendation: 'bullish' | 'bearish', accepted = true): QuantAiDecisionReview {
  return {
    decisionVersion: 'ai-decision-v1',
    recommendation,
    confidence: 72,
    accepted,
    rejectionReason: accepted ? null : 'low-confidence',
    factorReviewCoverage: accepted ? 100 : 0,
    rationale: '仅用于测试的已保存复核理由',
    invalidationConditions: ['测试条件'],
    citedEvidenceKeys: ['trend-sample'],
  }
}

function factorReview(factor: QuantAiFactorReview['factor'], stance: QuantAiFactorReview['stance'], accepted = true): QuantAiFactorReview {
  return {
    factor,
    stance,
    confidence: 72,
    accepted,
    rationale: '仅用于测试的因子复核理由',
    citedEvidenceKeys: ['trend-sample'],
  }
}

function record(
  id: string,
  action: QuantDecisionRecordAction,
  price: number,
  observedAt: string,
  review: QuantAiDecisionReview | null = null,
  factorReviews: QuantAiFactorReview[] = [],
): QuantDecisionRecord {
  return {
    id,
    researchRunId: `run-${id}`,
    tsCode: '601899.SH',
    action,
    note: null,
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: observedAt,
      recommendation: 'watch',
      confidence: null,
      coverage: null,
      evidenceKeys: [],
      currentPrice: price,
      currentPriceObservedAt: observedAt,
      buyPriceRange: null,
      sellPriceRange: null,
      aiDecisionReview: review,
      aiFactorReviews: factorReviews,
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

describe('buildQuantAiOutcomeCalibration', () => {
  it('only includes accepted AI decisions and keeps the sample gate honest', () => {
    const result = buildQuantAiOutcomeCalibration([
      record('watch', 'watch', 12, '20260910'),
      record('accepted', 'plan-buy', 10, '20260901', aiReview('bullish')),
      record('rejected', 'watch', 12, '20260902', aiReview('bearish', false)),
    ])

    expect(result).toMatchObject({ eligibleCount: 1, observedCount: 1, alignedCount: 1, opposedCount: 0, pendingCount: 0, agreementRate: null })
    expect(result.entries[0]).toMatchObject({ baselineId: 'accepted', alignment: 'aligned', changePercent: 20 })
  })

  it('classifies opposite and flat observations and computes a rate after three directions', () => {
    const result = buildQuantAiOutcomeCalibration([
      record('sold-3', 'watch', 32, '20260910'),
      record('buy-3', 'plan-buy', 30, '20260909', aiReview('bullish')),
      record('sold-2', 'watch', 19, '20260908'),
      record('buy-2', 'plan-buy', 20, '20260907', aiReview('bullish')),
      record('sold-1', 'watch', 11, '20260906'),
      record('buy-1', 'plan-buy', 10, '20260905', aiReview('bullish')),
      record('flat-watch', 'watch', 40, '20260904'),
      record('flat-buy', 'holding', 40, '20260903', aiReview('bearish')),
    ])

    expect(result).toMatchObject({ eligibleCount: 4, observedCount: 4, alignedCount: 2, opposedCount: 1, flatCount: 1, directionalSampleCount: 3, agreementRate: 66.67 })
    expect(result.entries.find(entry => entry.baselineId === 'flat-buy')?.alignment).toBe('flat')
  })

  it('keeps accepted factor reviews separate and leaves caution indeterminate', () => {
    const result = buildQuantAiOutcomeCalibration([
      record('observation', 'watch', 12, '20260910'),
      record('baseline', 'plan-buy', 10, '20260901', aiReview('bullish'), [
        factorReview('trend', 'support'),
        factorReview('valuation', 'oppose'),
        factorReview('quality', 'caution'),
        factorReview('risk', 'support', false),
      ]),
    ])

    expect(result.factors).toEqual([
      { factor: 'trend', label: '趋势', observedCount: 1, alignedCount: 1, opposedCount: 0, indeterminateCount: 0 },
      { factor: 'valuation', label: '估值', observedCount: 1, alignedCount: 0, opposedCount: 1, indeterminateCount: 0 },
      { factor: 'quality', label: '盈利质量', observedCount: 1, alignedCount: 0, opposedCount: 0, indeterminateCount: 1 },
    ])
  })

  it('shows pending and empty states without fabricating percentages', () => {
    const pending = buildQuantAiOutcomeCalibration([record('pending', 'holding', 10, '20260901', aiReview('bullish'))])
    const empty = buildQuantAiOutcomeCalibration([record('none', 'watch', 10, '20260901')])

    expect(pending).toMatchObject({ status: 'pending', eligibleCount: 1, observedCount: 0, pendingCount: 1, agreementRate: null })
    expect(pending.headline).not.toContain('%')
    expect(empty).toMatchObject({ status: 'empty', eligibleCount: 0, observedCount: 0, pendingCount: 0, agreementRate: null })
    expect(empty.headline).not.toContain('%')
  })
})
