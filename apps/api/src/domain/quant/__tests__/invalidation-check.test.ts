import type { DailyBar } from '../types'
import { describe, expect, it } from 'vitest'
import { buildQuantInvalidationItem } from '../invalidation-check'

function bars(closes: readonly number[], volumes: readonly number[] = []): DailyBar[] {
  return closes.map((close, index) => ({
    tsCode: '601899.SH',
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    open: close,
    high: close,
    low: close,
    close,
    preClose: null,
    change: null,
    pctChg: null,
    volume: volumes[index] ?? 100,
    amount: null,
  }))
}

describe('quant invalidation check', () => {
  it('marks a saved pass as triggered when the latest bars break MA20 and return', () => {
    const rising = Array.from({ length: 24 }).fill(10)
    const closes = [...rising, 8]
    const item = buildQuantInvalidationItem({
      tsCode: '601899.SH',
      name: '紫金矿业',
      evidence: [
        { key: 'trend-ma20', label: '收盘价 / MA20', status: 'pass' },
        { key: 'trend-return20', label: '20 日收益', status: 'pass' },
        { key: 'valuation-pe', label: '市盈率', status: 'pass' },
      ],
      bars: bars(closes),
    })

    expect(item.checks.map(check => [check.key, check.change])).toEqual([
      ['trend-ma20', 'triggered'],
      ['trend-return20', 'triggered'],
    ])
    expect(item.uncheckedCount).toBe(1)
    expect(item.label).toBe('2 条日线证据转弱')
  })

  it('does not treat a still-passing volume ratio as invalidation', () => {
    const item = buildQuantInvalidationItem({
      tsCode: '601899.SH',
      name: '紫金矿业',
      evidence: [{ key: 'risk-volume', label: '成交量比', status: 'pass' }],
      bars: bars(Array.from({ length: 30 }).fill(10)),
    })
    expect(item.checks[0]?.change).toBe('unchanged')
    expect(item.label).toBe('可对照的日线证据未转弱')
  })
})
