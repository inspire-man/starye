import type { DailyBar } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildTimingHistory, classifyTimingHistoryEdge } from '../timing-history'

function bars(closes: readonly number[]): DailyBar[] {
  return closes.map((close, index) => ({
    id: `bar-${index}`,
    tsCode: '601899.SH',
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    open: close,
    high: close,
    low: close,
    close,
    preClose: null,
    change: null,
    changePercent: null,
    volume: 1,
    amount: null,
  }))
}

describe('buildTimingHistory', () => {
  it('replays complete local samples and aggregates four states', () => {
    const result = buildTimingHistory(bars(Array.from({ length: 120 }, (_, index) => 100 + index)))

    expect(result).toMatchObject({
      availableBars: 120,
      evaluatedWindows: 3,
      forwardDays: 20,
      evaluationStartDate: '20260060',
      evaluationEndDate: '20260100',
    })
    expect(result.samplingInterval).toBe(20)
    expect(result.baseline.sampleSize).toBe(3)
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.sampleSize, 0)).toBe(3)
    expect(result.observations).toHaveLength(3)
    expect(result.buckets.find(bucket => bucket.sampleSize > 0)?.positiveRate).toBe(1)
  })

  it('compares each state with the non-overlapping all-sample baseline', () => {
    const result = buildTimingHistory(bars(Array.from({ length: 520 }, (_, index) => 100 + index)))
    const bucket = result.buckets.find(item => item.sampleSize > 0)

    expect(result.baseline.sampleSize).toBe(result.evaluatedWindows)
    expect(result.evaluatedWindows).toBe(23)
    expect(bucket).toMatchObject({
      positiveRate: 1,
      positiveRateLift: 0,
      sampleQuality: 'usable',
      edgeAssessment: 'indeterminate',
    })
    expect(bucket?.positiveRateLower).toBeGreaterThan(0.8)
    expect(bucket?.positiveRateUpper).toBe(1)
  })

  it('keeps all outcome metrics null when the forward window is unavailable', () => {
    const result = buildTimingHistory(bars(Array.from({ length: 79 }, (_, index) => 100 + index)))

    expect(result).toMatchObject({ availableBars: 79, evaluatedWindows: 0, evaluationStartDate: null, evaluationEndDate: null })
    expect(result.baseline).toMatchObject({ sampleSize: 0, positiveRate: null, positiveRateLower: null, positiveRateUpper: null })
    expect(result.buckets.every(bucket => bucket.sampleSize === 0 && bucket.positiveRate === null && bucket.medianForwardReturn20 === null)).toBe(true)
  })

  it('classifies interval separation separately from sample quality', () => {
    const baseline = { positiveRateLower: 0.4, positiveRateUpper: 0.6 }

    expect(classifyTimingHistoryEdge({ sampleSize: 5, positiveRateLower: 0.7, positiveRateUpper: 1 }, baseline)).toBe('insufficient')
    expect(classifyTimingHistoryEdge({ sampleSize: 12, positiveRateLower: 0.61, positiveRateUpper: 0.9 }, baseline)).toBe('supported')
    expect(classifyTimingHistoryEdge({ sampleSize: 12, positiveRateLower: 0.1, positiveRateUpper: 0.39 }, baseline)).toBe('weaker')
    expect(classifyTimingHistoryEdge({ sampleSize: 12, positiveRateLower: 0.3, positiveRateUpper: 0.7 }, baseline)).toBe('indeterminate')
  })

  it('does not let future prices change a historical state', () => {
    const closes = Array.from({ length: 100 }, (_, index) => 100 + index)
    const changedFuture = [...closes]
    changedFuture[79] = 50

    const original = buildTimingHistory(bars(closes)).observations[0]
    const changed = buildTimingHistory(bars(changedFuture)).observations[0]

    expect(original).toBeDefined()
    expect(changed).toBeDefined()
    expect(changed?.state).toBe(original?.state)
    expect(changed?.forwardReturn20).not.toBe(original?.forwardReturn20)
  })

  it('sorts dates before replaying and excludes invalid closes', () => {
    const source = bars(Array.from({ length: 100 }, (_, index) => 100 + index))
    const shuffled = [...source].reverse()
    shuffled[0] = { ...shuffled[0]!, close: null }
    const result = buildTimingHistory(shuffled)

    expect(result.availableBars).toBe(99)
    expect(result.observations[0]?.anchorDate).toBe('20260060')
  })
})
