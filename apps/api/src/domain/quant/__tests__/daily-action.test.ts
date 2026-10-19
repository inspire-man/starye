import { describe, expect, it } from 'vitest'
import { buildQuantDailyAction, buildQuantDailyScore, quantMarketDate } from '../daily-action'

const today = '2026-10-15'

function decide(overrides: Partial<Parameters<typeof buildQuantDailyAction>[0]> = {}) {
  return buildQuantDailyAction({
    recommendation: 'bullish',
    price: 28.4,
    priceDate: today,
    today,
    rangeLow: 27.5,
    rangeHigh: 31.2,
    openQuantity: 0,
    trendExitLabels: [],
    chaseRiskLabels: [],
    ...overrides,
  })
}

describe('buildQuantDailyAction', () => {
  it('buys only when price is inside the saved bullish range and the trend is intact', () => {
    const bought = decide()
    expect(bought.action).toBe('buy')
    expect(bought.priceFreshness).toBe('session')
    expect(bought.reason).toBe('区间内')
    expect(decide({ price: 32 }).action).toBe('hold')
    expect(decide({ openQuantity: 100 }).action).toBe('hold')
  })

  it('uses a prior close for the decision and labels it as not the live session', () => {
    const prior = decide({ priceDate: '2026-10-14' })
    expect(prior.action).toBe('buy')
    expect(prior.priceFreshness).toBe('prior-close')
    expect(prior.reason).toBe('区间内')
    expect(prior.reason).not.toContain('不是盘中')
    expect(decide({ price: null })).toMatchObject({ action: 'blocked', blocker: 'price', priceFreshness: 'missing' })
    expect(decide({ recommendation: null }).blocker).toBe('report')
    expect(decide({ rangeLow: null }).blocker).toBe('range')
  })

  it('sells a holding only when the saved report turns bearish', () => {
    expect(decide({ openQuantity: 100, recommendation: 'bearish' }).action).toBe('sell')
    expect(decide({ openQuantity: 100, trendExitLabels: ['20日均线'] }).action).toBe('hold')
    const extended = decide({ openQuantity: 100, chaseRiskLabels: ['量比'] })
    expect(extended.action).toBe('hold')
    expect(extended.reason).toBe('量比')
    expect(decide({ chaseRiskLabels: ['连涨'] }).action).toBe('hold')
    expect(decide({ trendExitLabels: ['20日收益'] }).action).toBe('hold')
  })

  it('reads a Shanghai market date without shifting a date-only close', () => {
    expect(quantMarketDate('2026-10-15')).toBe('2026-10-15')
    expect(quantMarketDate('2026-10-15T02:00:00.000Z')).toBe('2026-10-15')
  })
})

describe('buildQuantDailyScore', () => {
  it('keeps same-day trades out of the swing payoff used to judge the rule', () => {
    const score = buildQuantDailyScore({
      closed: [{ pnl: 20, sameDay: true }, { pnl: 30, sameDay: false }, { pnl: -10, sameDay: false }],
      closedCount: 3,
      winCount: 2,
      lossCount: 1,
      flatCount: 0,
      winRate: null,
      payoffRatio: 2.5,
      realizedPnl: 40,
      dividendCash: 0,
      passCount: 1,
    })
    expect(score.sameDayRealizedPnl).toBe(20)
    expect(score.swingRealizedPnl).toBe(20)
    expect(score.swingPayoffRatio).toBe(3)
    expect(score.winRate).toBeNull()
  })
})
