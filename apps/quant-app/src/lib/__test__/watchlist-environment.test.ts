import type { CandidateItem, WatchlistItem } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildWatchlistEnvironment } from '../watchlist-environment'

function watchlist(tsCode: string, change: number | null, covered = true): WatchlistItem {
  return {
    id: tsCode,
    tsCode,
    name: tsCode,
    latestTradeDate: covered ? '20260825' : null,
    barCount: covered ? 120 : 0,
    latestClose: change === null ? null : 10,
    latestChangePercent: change,
    createdAt: null,
  }
}

function candidate(tsCode: string, overrides: Partial<CandidateItem> = {}): CandidateItem {
  return {
    id: tsCode,
    tsCode,
    factorVersion: 'momentum-v1',
    name: tsCode,
    score: 3,
    close: 10,
    changePercent: 1,
    ma5: 10,
    ma20: 9,
    return20: 0.05,
    newHigh20: false,
    upStreak: 2,
    volumeRatio: 1.2,
    relativeStrength: 0.6,
    signals: ['ma20', 'relative_strength'],
    missingFactors: [],
    quality: 'ready',
    ...overrides,
  }
}

describe('buildWatchlistEnvironment', () => {
  it('summarizes breadth, signal and risk ratios from the current sample', () => {
    const result = buildWatchlistEnvironment({
      watchlist: [watchlist('A', 1), watchlist('B', 0), watchlist('C', -1), watchlist('D', -2), watchlist('E', -3)],
      candidates: [candidate('A'), candidate('B'), candidate('C', { changePercent: -3.5 }), candidate('D', { score: 1 }), candidate('E', { pendingSync: true })],
    })

    expect(result).toMatchObject({
      formulaVersion: 'watchlist-environment-v1',
      status: 'defensive',
      watchlistCount: 5,
      coveredCount: 5,
      pricedCount: 5,
      positiveCount: 1,
      negativeCount: 3,
      candidateCount: 4,
      signalCount: 3,
      riskCount: 1,
    })
    expect(result.metrics.find(metric => metric.key === 'breadth')?.ratio).toBeCloseTo(0.2)
    expect(result.cautions).toContain('上涨占比低于 40%，先观察整体波动')
  })

  it('does not infer an environment from too few priced or scored samples', () => {
    const result = buildWatchlistEnvironment({
      watchlist: [watchlist('A', 1), watchlist('B', null, false)],
      candidates: [candidate('A'), candidate('B', { pendingSync: true })],
    })

    expect(result.status).toBe('insufficient')
    expect(result.headline).toContain('先补齐')
    expect(result.metrics.find(metric => metric.key === 'breadth')?.ratio).toBe(1)
    expect(result.metrics.find(metric => metric.key === 'signals')?.ratio).toBe(1)
  })

  it('recognizes a broad and low-risk sample without using pending candidates', () => {
    const result = buildWatchlistEnvironment({
      watchlist: [watchlist('A', 1), watchlist('B', 2), watchlist('C', 3), watchlist('D', 0), watchlist('E', 1)],
      candidates: [candidate('A'), candidate('B'), candidate('C'), candidate('D'), candidate('E', { pendingSync: true })],
    })

    expect(result.status).toBe('positive')
    expect(result.positiveCount).toBe(4)
    expect(result.signalCount).toBe(4)
    expect(result.riskCount).toBe(0)
  })
})
