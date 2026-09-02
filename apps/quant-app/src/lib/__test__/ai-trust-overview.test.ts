import type { CandidateItem, QuantAiDecisionReview, QuantDecisionRecord, QuantDecisionRecordAction, WatchlistItem } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildQuantAiTrustOverview } from '../ai-trust-overview'

function review(recommendation: 'bullish' | 'bearish' | 'watch', accepted = true): QuantAiDecisionReview {
  return {
    decisionVersion: 'ai-decision-v1',
    recommendation,
    confidence: 72,
    accepted,
    rejectionReason: accepted ? null : 'low-confidence',
    factorReviewCoverage: accepted ? 100 : 0,
    rationale: '测试复核',
    invalidationConditions: ['测试条件'],
    citedEvidenceKeys: ['trend-sample'],
  }
}

function record(
  id: string,
  tsCode: string,
  action: QuantDecisionRecordAction,
  price: number | null,
  observedAt: string,
  aiReview: QuantAiDecisionReview | null,
): QuantDecisionRecord {
  return {
    id,
    researchRunId: `run-${id}`,
    tsCode,
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
      aiDecisionReview: aiReview,
      aiFactorReviews: [],
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

function candidate(tsCode: string, close: number | null, name = tsCode): CandidateItem {
  return {
    id: `candidate-${tsCode}`,
    tsCode,
    factorVersion: 'momentum-v1',
    name,
    score: 4,
    close,
    changePercent: 1,
    ma5: 10,
    ma20: 10,
    return20: 0.02,
    newHigh20: false,
    upStreak: 1,
    volumeRatio: 1,
    relativeStrength: 1,
    signals: [],
    missingFactors: [],
    quality: 'ready',
  }
}

function watchlistItem(tsCode: string, latestClose: number | null, latestTradeDate: string | null): WatchlistItem {
  return {
    id: `watch-${tsCode}`,
    tsCode,
    name: tsCode,
    latestClose,
    latestTradeDate,
    latestChangePercent: null,
    barCount: 100,
    createdAt: null,
  }
}

const baseInput = {
  candidates: [],
  watchlist: [],
  candidateTradeDate: '20260902',
}

describe('buildQuantAiTrustOverview', () => {
  it('separates accepted, pending, rejected, and inactive latest decisions', () => {
    const result = buildQuantAiTrustOverview({
      ...baseInput,
      records: [
        record('bull', '601899.SH', 'plan-buy', 10, '20260901', review('bullish')),
        record('bear', '600011.SH', 'holding', 20, '20260901', review('bearish')),
        record('pending', '000001.SZ', 'plan-buy', 15, '20260902', review('bullish')),
        record('rejected', '000063.SZ', 'plan-buy', 30, '20260901', review('bullish', false)),
        record('inactive', '600028.SH', 'watch', 8, '20260901', review('bullish')),
      ],
      candidates: [
        candidate('601899.SH', 12, '紫金矿业'),
        candidate('600011.SH', 22, '华能国际'),
        candidate('000001.SZ', 16, '平安银行'),
        candidate('000063.SZ', 31, '中兴通信'),
        candidate('600028.SH', 9, '中国石化'),
      ],
      watchlist: [
        watchlistItem('601899.SH', 12, '20260902'),
        watchlistItem('600011.SH', 22, '20260902'),
        watchlistItem('000001.SZ', 16, '20260902'),
        watchlistItem('000063.SZ', 31, '20260902'),
        watchlistItem('600028.SH', 9, '20260902'),
      ],
    })

    expect(result.summary).toMatchObject({
      total: 5,
      accepted: 3,
      observed: 2,
      pending: 1,
      unavailable: 0,
      notAccepted: 1,
      inactive: 1,
      aligned: 1,
      opposed: 1,
      flat: 0,
      directionalSampleCount: 2,
      agreementRate: null,
    })
    expect(result.items.map(item => item.status)).toEqual(['opposed', 'pending', 'not-accepted', 'aligned', 'inactive'])
    expect(result.items.find(item => item.tsCode === '000063.SZ')?.aiAccepted).toBe(false)
  })

  it('uses watchlist prices when a decision stock is outside the candidate snapshot', () => {
    const result = buildQuantAiTrustOverview({
      ...baseInput,
      records: [record('fallback', '600900.SH', 'holding', 10, '20260901', review('bullish'))],
      watchlist: [watchlistItem('600900.SH', 9, '20260902')],
    })

    expect(result.items[0]).toMatchObject({ status: 'opposed', currentPrice: 9, changePercent: -10 })
  })

  it('does not calculate same-day or missing observations and gates the agreement rate', () => {
    const result = buildQuantAiTrustOverview({
      ...baseInput,
      records: [
        record('up', '601899.SH', 'plan-buy', 10, '20260901', review('bullish')),
        record('down', '600011.SH', 'plan-buy', 20, '20260901', review('bearish')),
        record('opposed', '000001.SZ', 'holding', 10, '20260901', review('bullish')),
        record('flat', '000063.SZ', 'holding', 10, '20260901', review('bearish')),
        record('same', '600028.SH', 'holding', 10, '20260902', review('bullish')),
        record('missing', '600900.SH', 'holding', 10, '20260901', review('bullish')),
      ],
      candidates: [
        candidate('601899.SH', 11),
        candidate('600011.SH', 19),
        candidate('000001.SZ', 9),
        candidate('000063.SZ', 10),
        candidate('600028.SH', 11),
        candidate('600900.SH', null),
      ],
    })

    expect(result.summary).toMatchObject({ observed: 4, aligned: 2, opposed: 1, flat: 1, pending: 1, unavailable: 1, directionalSampleCount: 3, agreementRate: 66.67 })
    expect(result.items.find(item => item.tsCode === '000063.SZ')?.status).toBe('flat')
    expect(result.items.find(item => item.tsCode === '600028.SH')?.changePercent).toBeNull()
    expect(result.items.find(item => item.tsCode === '600900.SH')?.status).toBe('unavailable')
  })

  it('keeps an empty queue free of a fabricated AI percentage', () => {
    const result = buildQuantAiTrustOverview({ ...baseInput, records: [] })

    expect(result.summary).toMatchObject({ total: 0, accepted: 0, directionalSampleCount: 0, agreementRate: null })
    expect(result.items).toHaveLength(0)
  })
})
