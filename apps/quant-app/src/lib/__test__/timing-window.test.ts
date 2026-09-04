import type { DailyBar } from '../quant-view-models'
import type { TrendStructure } from '../trend-analysis'
import { describe, expect, it } from 'vitest'
import { buildTimingWindow } from '../timing-window'

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

function trend(overrides: Partial<TrendStructure> = {}): TrendStructure {
  return {
    return5: 0.02,
    return20: 0.04,
    return60: 0.08,
    ma20Gap: 0.02,
    drawdown60: -0.02,
    availableBars: 60,
    tone: 'positive',
    conclusion: '结构',
    ...overrides,
  }
}

describe('buildTimingWindow', () => {
  it('classifies a stable medium-term structure and returns all metrics', () => {
    const result = buildTimingWindow(bars(Array.from({ length: 60 }, (_, index) => 100 + index)), trend())

    expect(result.state).toBe('constructive')
    expect(result.ma60Gap).toBeGreaterThan(0)
    expect(result.pullback20).toBe(0)
    expect(result.volatility20).toBeGreaterThan(0)
    expect(result.metrics).toHaveLength(4)
  })

  it('marks a pullback near MA20 with MA60 support', () => {
    const closes = [
      ...Array.from({ length: 40 }, (_, index) => 100 + index),
      ...Array.from({ length: 20 }, (_, index) => 139 - index * 0.263),
    ]
    const result = buildTimingWindow(bars(closes), trend({ ma20Gap: -0.018, drawdown60: -0.04 }))

    expect(result.state).toBe('pullback_watch')
    expect(result.pullback20).toBeLessThan(-0.03)
    expect(result.ma20Gap).toBeGreaterThan(-0.03)
  })

  it('prioritizes an extended move when the price is far above MA20', () => {
    const closes = [
      ...Array.from({ length: 55 }, (_, index) => 100 + index),
      160,
      166,
      172,
      178,
      184,
    ]
    const result = buildTimingWindow(bars(closes), trend({ return5: 0.08 }))

    expect(result.state).toBe('extended')
    expect(result.ma20Gap).toBeGreaterThanOrEqual(0.08)
  })

  it('prioritizes a weak structure when the price falls below medium-term support', () => {
    const closes = [
      ...Array.from({ length: 40 }, (_, index) => 100 + index),
      ...Array.from({ length: 20 }, (_, index) => 120 - index),
    ]
    const result = buildTimingWindow(bars(closes), trend({ drawdown60: -0.16 }))

    expect(result.state).toBe('weak')
    expect(result.tone).toBe('danger')
  })

  it('keeps the state insufficient when the 60-bar window is missing', () => {
    const result = buildTimingWindow(bars(Array.from({ length: 20 }, (_, index) => 100 + index)), trend({ availableBars: 20 }))

    expect(result).toMatchObject({ state: 'insufficient', ma60Gap: null, volatility20: null })
    expect(result.metrics.find(metric => metric.key === 'ma20-gap')).toMatchObject({ status: 'pass' })
  })
})
