import { describe, expect, it } from 'vitest'
import { buildQuantOperationLedger, operationAiContext, researchContextFromReport } from '../operation-ledger'

function fill(id: string, side: 'buy' | 'sell' | 'dividend' | 'pass', price: number, quantity: number, tradedAt: string, fee = 0) {
  return { id, tsCode: '601899.SH', name: '紫金矿业', side, price, quantity, fee, tradedAt, note: null, researchContext: null }
}

describe('buildQuantOperationLedger', () => {
  it('matches sells to earlier buys and withholds the win rate until six directional closes', () => {
    const ledger = buildQuantOperationLedger([
      fill('b1', 'buy', 30, 100, '2026-09-01T09:30:00'),
      fill('s1', 'sell', 32, 100, '2026-09-02T09:30:00'),
      fill('b2', 'buy', 33, 100, '2026-09-03T09:30:00'),
      fill('s2', 'sell', 31, 40, '2026-09-04T09:30:00'),
    ])

    expect(ledger.closed).toHaveLength(2)
    expect(ledger.closed[0]).toMatchObject({ quantity: 100, pnl: 200, returnRate: 0.0667 })
    expect(ledger.closed[1]).toMatchObject({ quantity: 40, pnl: -80 })
    expect(ledger.openLots).toEqual([{ tsCode: '601899.SH', name: '紫金矿业', quantity: 60, cost: 33 }])
    expect(ledger.winCount).toBe(1)
    expect(ledger.openLots).toEqual([{ tsCode: '601899.SH', name: '紫金矿业', quantity: 60, cost: 33 }])
    expect(ledger.byCode[0]).toMatchObject({ tsCode: '601899.SH', realizedPnl: 120, openQuantity: 60, winRate: null })
    expect(ledger.winRate).toBeNull()
    expect(ledger.payoffRatio).toBe(2.5)
    expect(operationAiContext(ledger, '601899.SH')?.note).toContain('不是研究报告证据')
    expect(operationAiContext(ledger, '000001.SZ')).toBeNull()
    expect(ledger.realizedPnl).toBe(120)
    expect(ledger.aiBrief).toContain('不足 6 笔')
    expect(ledger.aiBrief).not.toContain('下单')
  })

  it('keeps a recorded pass out of open lots and the win-rate sample', () => {
    const ledger = buildQuantOperationLedger([
      fill('b1', 'buy', 30, 100, '2026-09-01T09:30:00'),
      fill('p1', 'pass', 28.4, 0, '2026-10-15T09:30:00'),
    ])
    expect(ledger.openLots).toEqual([{ tsCode: '601899.SH', name: '紫金矿业', quantity: 100, cost: 30 }])
    expect(ledger.closed).toEqual([])
    expect(ledger.winRate).toBeNull()
    expect(ledger.realizedPnl).toBe(0)
  })

  it('calculates the win rate after six non-flat closes and ignores unmatched sells', () => {
    const fills = Array.from({ length: 6 }, (_, index) => [
      fill(`b${index}`, 'buy', 10, 1, `2026-09-${String(index + 1).padStart(2, '0')}T09:30:00`),
      fill(`s${index}`, 'sell', index < 4 ? 11 : 9, 1, `2026-09-${String(index + 1).padStart(2, '0')}T15:00:00`),
    ]).flat()
    fills.push(fill('extra-sell', 'sell', 12, 5, '2026-09-20T15:00:00'))
    const ledger = buildQuantOperationLedger(fills)

    expect(ledger).toMatchObject({ winCount: 4, lossCount: 2, winRate: 66.6667, unmatchedSellQuantity: 5, closedCount: 6 })
    expect(ledger.curve.at(-1)?.cumulativePnl).toBe(2)
  })

  it('keeps Zijin same-day trades together and leaves the older lots open', () => {
    const ledger = buildQuantOperationLedger([
      fill('open-1', 'buy', 40.68, 100, '2026-03-02T15:00:00+08:00', 1),
      fill('open-2', 'buy', 40.11, 100, '2026-03-03T10:00:00+08:00', 0.98),
      fill('open-3', 'buy', 38.89, 100, '2026-03-03T11:00:00+08:00', 0.96),
      fill('t1-buy', 'buy', 35.02, 100, '2026-03-09T10:00:00+08:00', 0.86),
      fill('t1-sell', 'sell', 35.4, 100, '2026-03-09T14:00:00+08:00', 2.64),
      fill('t2-buy', 'buy', 36.57, 100, '2026-03-12T10:00:00+08:00', 0.9),
      fill('t2-sell', 'sell', 36.76, 100, '2026-03-12T14:00:00+08:00', 2.75),
      fill('open-6', 'buy', 36.03, 100, '2026-03-13T15:00:00+08:00', 0.89),
      fill('open-7', 'buy', 33.03, 100, '2026-03-19T15:00:00+08:00', 0.81),
      fill('open-4', 'buy', 29.63, 100, '2026-06-05T15:00:00+08:00', 0.73),
      fill('open-5', 'buy', 27.73, 100, '2026-06-23T15:00:00+08:00', 0.68),
      fill('div-1', 'dividend', 266, 0, '2026-06-25T15:00:00+08:00'),
      fill('div-2', 'dividend', 294, 0, '2026-08-20T15:00:00+08:00'),
      fill('t3-buy', 'buy', 31.18, 100, '2026-09-18T10:00:00+08:00', 0.76),
      fill('t3-sell', 'sell', 31.52, 100, '2026-09-18T14:00:00+08:00', 2.35),
    ])

    expect(ledger.closed.map(item => item.pnl)).toEqual([34.5, 15.35, 30.89])
    expect(ledger.closed.every(item => item.sameDay)).toBe(true)
    expect(ledger.openLots).toEqual([{ tsCode: '601899.SH', name: '紫金矿业', quantity: 700, cost: 35.1658 }])
    expect(ledger.realizedPnl).toBe(80.74)
    expect(ledger.dividendCash).toBe(560)
    expect(ledger.winRate).toBeNull()
    expect(ledger.byCode[0]).toMatchObject({ openQuantity: 700, dividendCash: 560, realizedPnl: 80.74 })
  })

  it('reads the research conclusion saved with a fill', () => {
    expect(researchContextFromReport(JSON.stringify({
      generatedAt: '2026-09-01T00:00:00.000Z',
      decision: { recommendation: 'bullish', buyPriceRange: { low: 27.5, high: 31.2 }, sellPriceRange: { low: 34, high: 36 } },
    }), null)).toMatchObject({ recommendation: 'bullish', buyLow: 27.5, sellHigh: 36 })
    expect(researchContextFromReport('{', null)).toBeNull()
  })
})
