import type { CandidateItem, QuantDecisionRecord, QuantDecisionRecordAction, WatchlistItem } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionQueue } from '../decision-queue'

function record(
  id: string,
  tsCode: string,
  action: QuantDecisionRecordAction,
  price: number | null,
  observedAt: string,
  updatedAt = observedAt,
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
      recommendation: 'bullish',
      confidence: 80,
      coverage: 100,
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
    updatedAt,
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

const watchlist = (items: Array<Pick<WatchlistItem, 'tsCode' | 'name' | 'latestClose' | 'latestTradeDate'>>): WatchlistItem[] => items as WatchlistItem[]

describe('buildQuantDecisionQueue', () => {
  it('keeps the latest record per stock, sorts it, and summarizes active actions', () => {
    const result = buildQuantDecisionQueue({
      records: [
        record('older', '601899.SH', 'watch', 30, '20260828', '2026-08-28T01:00:00.000Z'),
        record('latest', '601899.SH', 'plan-buy', 32, '20260829', '2026-08-29T02:00:00.000Z'),
        record('holding', '600011.SH', 'holding', 10, '20260829', '2026-08-29T01:00:00.000Z'),
        record('sold', '600028.SH', 'sold', 8, '20260828', '2026-08-28T03:00:00.000Z'),
      ],
      candidates: [candidate('601899.SH', 33, '紫金矿业'), candidate('600011.SH', 10, '华能国际')],
      watchlist: watchlist([
        { tsCode: '601899.SH', name: '紫金矿业', latestClose: 33, latestTradeDate: '20260830' },
        { tsCode: '600011.SH', name: '华能国际', latestClose: 10, latestTradeDate: '20260830' },
      ]),
      candidateTradeDate: '20260830',
    })

    expect(result.items.map(item => item.record.id)).toEqual(['latest', 'holding', 'sold'])
    expect(result.summary).toMatchObject({ total: 3, planBuy: 1, holding: 1, sold: 1, active: 2 })
    expect(result.items[0]).toMatchObject({ name: '紫金矿业', observation: 'newer-price', changePercent: 3.125 })
  })

  it('does not calculate a same-day or invalid price change and marks missing candidates', () => {
    const result = buildQuantDecisionQueue({
      records: [
        record('same-day', '601899.SH', 'plan-buy', 32, '20260830'),
        record('invalid', '600011.SH', 'holding', Number.POSITIVE_INFINITY, '20260829'),
        record('outside', '600028.SH', 'watch', 8, '20260829'),
      ],
      candidates: [candidate('601899.SH', 33, '紫金矿业'), candidate('600011.SH', Number.NaN, '华能国际')],
      watchlist: watchlist([{ tsCode: '600028.SH', name: '中国石化', latestClose: 8, latestTradeDate: '20260830' }]),
      candidateTradeDate: '20260830',
    })

    expect(new Map(result.items.map(item => [item.tsCode, [item.observation, item.changePercent]]))).toEqual(new Map([
      ['601899.SH', ['same-day', null]],
      ['600011.SH', ['missing-price', null]],
      ['600028.SH', ['outside-candidate', null]],
    ]))
  })

  it('applies a positive display limit after per-stock deduplication', () => {
    const result = buildQuantDecisionQueue({
      records: [record('one', '601899.SH', 'watch', 32, '20260829'), record('two', '600011.SH', 'sold', 10, '20260828')],
      candidates: [],
      watchlist: [],
      candidateTradeDate: null,
      limit: 1,
    })

    expect(result.totalRecords).toBe(2)
    expect(result.items).toHaveLength(1)
  })
})
