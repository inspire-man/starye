import type { QuantValuationSnapshot } from '../provider'
import { describe, expect, it } from 'vitest'
import { buildQuantValuationComparison } from '../comparison'

function valuation(tsCode: string, peTtm: number | null, pb: number | null): QuantValuationSnapshot {
  return {
    tsCode,
    observedAt: '2026-08-23T00:00:00.000Z',
    dynamicPe: null,
    peTtm,
    peStatic: null,
    pb,
    ps: null,
    peg: null,
    marketCap: null,
  }
}

describe('quant valuation comparison', () => {
  it('calculates target position against other available watchlist samples', () => {
    const result = buildQuantValuationComparison('601899.SH', [
      { tsCode: '601899.SH', name: '紫金矿业', valuation: valuation('601899.SH', 20, 3) },
      { tsCode: '600089.SH', name: '特变电工', valuation: valuation('600089.SH', 10, 2) },
      { tsCode: '600938.SH', name: '中国海油', valuation: valuation('600938.SH', 15, 4) },
    ])

    expect(result).toMatchObject({
      sampleCount: 3,
      availableSampleCount: 3,
      ttmPeSampleCount: 3,
      pbSampleCount: 3,
      ttmPeHigherThanPercent: 100,
      pbHigherThanPercent: 50,
    })
    expect(result.peers).toHaveLength(2)
  })

  it('keeps a metric position null when there is no comparable peer value', () => {
    const result = buildQuantValuationComparison('601899.SH', [
      { tsCode: '601899.SH', name: '紫金矿业', valuation: valuation('601899.SH', 20, null) },
      { tsCode: '600089.SH', name: '特变电工', valuation: valuation('600089.SH', null, null) },
    ])

    expect(result).toMatchObject({
      sampleCount: 2,
      availableSampleCount: 2,
      ttmPeSampleCount: 1,
      pbSampleCount: 0,
      ttmPeHigherThanPercent: null,
      pbHigherThanPercent: null,
    })
  })
})
