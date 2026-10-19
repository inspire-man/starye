import { describe, expect, it } from 'vitest'
import { buildQuantPriceLocations, readQuantPriceLocationDecision } from '../price-location'

describe('quant price location', () => {
  it('puts an in-range bullish close ahead of prices outside the saved range', () => {
    const locations = buildQuantPriceLocations([
      { tsCode: '601899.SH', name: '紫金矿业', latestClose: 30.01, latestTradeDate: '2026-09-24', reportGeneratedAt: '2026-09-27T00:00:00.000Z', recommendation: 'bullish', rangeLow: 31.93, rangeHigh: 33.24 },
      { tsCode: '600938.SH', name: '中国海油', latestClose: 32.5, latestTradeDate: '2026-09-24', reportGeneratedAt: '2026-09-27T00:00:00.000Z', recommendation: 'bullish', rangeLow: 31, rangeHigh: 33 },
      { tsCode: '600312.SH', name: '平高电气', latestClose: 20, latestTradeDate: '2026-09-24', reportGeneratedAt: '2026-09-27T00:00:00.000Z', recommendation: 'watch', rangeLow: 18, rangeHigh: 19 },
      { tsCode: '000001.SZ', name: '平安银行', latestClose: 10, latestTradeDate: '2026-09-24', reportGeneratedAt: null, recommendation: null, rangeLow: null, rangeHigh: null },
    ])

    expect(locations.map(item => item.tsCode)).toEqual(['600938.SH', '601899.SH', '600312.SH', '000001.SZ'])
    expect(locations[0]).toMatchObject({ status: 'inside', distancePercent: 0, label: '收盘在参考区间内' })
    expect(locations[1]).toMatchObject({ status: 'below', label: '收盘低于参考区间' })
    expect(locations[1]?.distancePercent).toBeLessThan(0)
    expect(locations[2]).toMatchObject({ status: 'not-buying', distancePercent: null })
    expect(locations[2]?.detail).toContain('不表示现在要动作')
  })

  it('does not derive a range from a malformed report', () => {
    expect(readQuantPriceLocationDecision('{')).toEqual({ recommendation: null, rangeLow: null, rangeHigh: null })
    expect(readQuantPriceLocationDecision(JSON.stringify({
      decision: { recommendation: 'bullish', buyPriceRange: { low: 10, high: 12 } },
    }))).toEqual({ recommendation: 'bullish', rangeLow: 10, rangeHigh: 12 })
  })
})
