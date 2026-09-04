import type { QuantDecisionRecord, QuantDecisionRecordAction } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildDecisionOutcome } from '../decision-outcome'

function record(id: string, action: QuantDecisionRecordAction, price: number | null, observedAt: string): QuantDecisionRecord {
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
      aiDecisionReview: null,
      aiFactorReviews: [],
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

describe('buildDecisionOutcome', () => {
  it('sorts history and pairs a plan-buy with a later sold record', () => {
    const result = buildDecisionOutcome([
      record('sold', 'sold', 12, '20260910'),
      record('buy', 'plan-buy', 10, '20260901'),
    ])

    expect(result.status).toBe('completed')
    expect(result.completedCount).toBe(1)
    expect(result.entries[0]).toMatchObject({
      baselineAction: 'plan-buy',
      observationKind: 'sold',
      baselinePrice: 10,
      observationPrice: 12,
      changePercent: 20,
    })
  })

  it('uses a later latest daily bar for an open holding observation', () => {
    const result = buildDecisionOutcome(
      [record('holding', 'holding', 20, '20260901')],
      { price: 18, observedAt: '20260908' },
    )

    expect(result.status).toBe('observed')
    expect(result.entries[0]).toMatchObject({ observationKind: 'current', observationPrice: 18, changePercent: -10 })
  })

  it('replaces an older open start with the latest holding start', () => {
    const result = buildDecisionOutcome([
      record('sold', 'sold', 12, '20260910'),
      record('holding', 'holding', 11, '20260905'),
      record('buy', 'plan-buy', 10, '20260901'),
    ])

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({ baselineId: 'holding', baselinePrice: 11, observationPrice: 12 })
  })

  it('keeps missing, non-finite, and same-day prices out of the result', () => {
    const result = buildDecisionOutcome([
      record('same-day', 'watch', 11, '20260901'),
      record('buy', 'plan-buy', 10, '20260901'),
      record('invalid', 'holding', Number.POSITIVE_INFINITY, '20260902'),
    ])

    expect(result.status).toBe('empty')
    expect(result.entries).toHaveLength(0)
    expect(result.headline).not.toContain('%')
  })

  it('does not use a current bar after a sold record with no price', () => {
    const result = buildDecisionOutcome(
      [record('sold', 'sold', null, '20260910'), record('buy', 'plan-buy', 10, '20260901')],
      { price: 12, observedAt: '20260912' },
    )

    expect(result).toMatchObject({ status: 'empty', trackedCount: 0, completedCount: 0, pendingCount: 0 })
    expect(result.entries).toHaveLength(0)
  })

  it('does not create a result from watch-only history', () => {
    const result = buildDecisionOutcome([record('watch', 'watch', 10, '20260901')])

    expect(result).toMatchObject({ status: 'empty', trackedCount: 0, completedCount: 0, pendingCount: 0 })
  })
})
