import type { DailyBar } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildTrendStructure } from '../trend-analysis'

function bars(closes: readonly number[]): DailyBar[] {
  return closes.map((close, index) => ({
    id: `bar-${index}`,
    tsCode: '601899.SH',
    tradeDate: `202608${String(index + 1).padStart(2, '0')}`,
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

describe('buildTrendStructure', () => {
  it('calculates multi-period returns, moving-average gap and drawdown', () => {
    const result = buildTrendStructure(bars(Array.from({ length: 61 }, (_, index) => index + 1)))

    expect(result.availableBars).toBe(61)
    expect(result.return5).toBeCloseTo(5 / 56)
    expect(result.return20).toBeCloseTo(20 / 41)
    expect(result.return60).toBeCloseTo(60 / 1)
    expect(result.ma20Gap).toBeGreaterThan(0)
    expect(result.drawdown60).toBe(0)
    expect(result).toMatchObject({ tone: 'positive', conclusion: '多周期偏强，价格站在 20 日均线之上' })
  })

  it('keeps unavailable windows null instead of filling zero', () => {
    const result = buildTrendStructure(bars([10, 9, 8, 7, 6, 5]))

    expect(result).toMatchObject({ return5: -0.5, return20: null, return60: null, ma20Gap: null, drawdown60: null })
    expect(result).toMatchObject({ tone: 'neutral', conclusion: '周期表现分化，结合估值与基本面核对' })
  })

  it('reports a medium-term pullback when the latest close is far below the 60-day high', () => {
    const closes = [
      ...Array.from({ length: 41 }, (_, index) => 160 + index),
      ...Array.from({ length: 21 }, (_, index) => 150 + index),
    ]
    const result = buildTrendStructure(bars(closes))

    expect(result.drawdown60).toBeLessThan(-0.1)
    expect(result.tone).toBe('warning')
    expect(result.conclusion).toContain('60 日回撤')
  })
})
