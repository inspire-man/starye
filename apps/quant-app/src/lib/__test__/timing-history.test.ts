import type { DailyBar } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildTimingHistory } from '../timing-history'

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
      evaluatedWindows: 41,
      forwardDays: 20,
      evaluationStartDate: '20260060',
      evaluationEndDate: '20260100',
    })
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.sampleSize, 0)).toBe(41)
    expect(result.observations).toHaveLength(41)
    expect(result.buckets.find(bucket => bucket.sampleSize > 0)?.positiveRate).toBe(1)
  })

  it('keeps all outcome metrics null when the forward window is unavailable', () => {
    const result = buildTimingHistory(bars(Array.from({ length: 79 }, (_, index) => 100 + index)))

    expect(result).toMatchObject({ availableBars: 79, evaluatedWindows: 0, evaluationStartDate: null, evaluationEndDate: null })
    expect(result.buckets.every(bucket => bucket.sampleSize === 0 && bucket.positiveRate === null && bucket.medianForwardReturn20 === null)).toBe(true)
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
