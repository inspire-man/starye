import { describe, expect, it } from 'vitest'
import { recordedPositionFromBoard } from '../recorded-position'

const board = {
  operations: [],
  ledger: {
    formulaVersion: 'operation-ledger-v1',
    closedCount: 1,
    winCount: 1,
    lossCount: 0,
    flatCount: 0,
    realizedPnl: 120,
    dividendCash: 560,
    winRate: null,
    payoffRatio: null,
    unmatchedSellQuantity: 0,
    openLots: [{ tsCode: '601899.SH', name: '紫金矿业', quantity: 100, cost: 29.42 }],
    closed: [],
    curve: [],
    byCode: [{
      tsCode: '601899.SH',
      name: '紫金矿业',
      closedCount: 1,
      winCount: 1,
      lossCount: 0,
      realizedPnl: 120,
      winRate: null,
      payoffRatio: null,
      openQuantity: 100,
      dividendCash: 560,
    }],
    aiBrief: '',
  },
}

describe('recorded position', () => {
  it('uses the open lot cost and ignores stocks with no book', () => {
    expect(recordedPositionFromBoard(board, '601899.SH')).toEqual({
      tsCode: '601899.SH',
      openQuantity: 100,
      averageCost: 29.42,
      realizedPnl: 120,
      closedCount: 1,
    })
    expect(recordedPositionFromBoard(board, '000001.SZ')).toBeNull()
  })
})
