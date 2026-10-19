import { describe, expect, it } from 'vitest'
import { walkQuantDailyPriceRule } from '../daily-rule-walk'

function bars(closes: number[]) {
  return closes.map((close, index) => ({
    tsCode: '000001.SZ',
    tradeDate: `2024${String(index + 1).padStart(4, '0')}`,
    open: close,
    high: close,
    low: close,
    close,
    preClose: null,
    change: null,
    pctChg: null,
    volume: 1000,
    amount: null,
  }))
}

describe('walkQuantDailyPriceRule', () => {
  it('does not turn a rising series into a loss', () => {
    const walk = walkQuantDailyPriceRule(bars(Array.from({ length: 80 }, (_, index) => 10 + index * 0.05)))
    expect(walk).not.toBeNull()
    expect(walk!.strategyReturn).toBeGreaterThanOrEqual(-0.01)
    expect(walk!.trades).toBe(walk!.wins + walk!.losses)
  })
})
