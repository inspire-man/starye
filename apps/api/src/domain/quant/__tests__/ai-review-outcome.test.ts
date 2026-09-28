import { describe, expect, it } from 'vitest'
import { buildQuantAiReviewOutcomeBoard, readQuantAiSummaryDecision } from '../ai-review-outcome'

const bars = [
  { tradeDate: '2026-09-20', close: 10 },
  { tradeDate: '2026-09-24', close: 12 },
]

describe('quant AI review outcomes', () => {
  it('scores the latest saved review against a later close and withholds a rate below three samples', () => {
    const board = buildQuantAiReviewOutcomeBoard([
      { tsCode: '601899.SH', name: '紫金矿业', reviewedAt: '2026-09-21T01:00:00.000Z', accepted: true, recommendation: 'bullish', bars },
      { tsCode: '600938.SH', name: '中国海油', reviewedAt: '2026-09-21T01:00:00.000Z', accepted: false, recommendation: 'bullish', bars: [{ tradeDate: '20260920', close: 10 }, { tradeDate: '20260924', close: 8 }] },
      { tsCode: '600011.SH', name: '华能国际', reviewedAt: '2026-09-27T01:00:00.000Z', accepted: true, recommendation: 'bearish', bars: [{ tradeDate: '2026-09-24', close: 6.74 }] },
    ])

    expect(board.items.map(item => [item.tsCode, item.status])).toEqual([
      ['600938.SH', 'opposed'],
      ['601899.SH', 'aligned'],
      ['600011.SH', 'pending'],
    ])
    expect(board.acceptedAgreementRate).toBeNull()
    expect(board.unacceptedAgreementRate).toBeNull()
    expect(board.pendingCount).toBe(1)
    expect(board.headline).toContain('不足 3 条')
    expect(board.headline).not.toContain('胜率')
    expect(board.items[0]?.detail).toContain('不是收益')
  })

  it('reads the stored decision review without deriving a missing conclusion', () => {
    expect(readQuantAiSummaryDecision('{')).toEqual({ accepted: null, recommendation: null })
    expect(readQuantAiSummaryDecision(JSON.stringify({
      decisionReview: { accepted: true, recommendation: 'bearish' },
    }))).toEqual({ accepted: true, recommendation: 'bearish' })
  })
})
