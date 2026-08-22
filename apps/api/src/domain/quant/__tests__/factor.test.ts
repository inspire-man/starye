import type { DailyBar } from '../types'
import { describe, expect, it } from 'vitest'
import { calculateMomentumFactors, screenMomentum } from '../factor'

function bars(tsCode: string, closes: readonly number[], volume = 100): DailyBar[] {
  return closes.map((close, index) => ({
    tsCode,
    tradeDate: `202608${String(index + 1).padStart(2, '0')}`,
    open: close,
    high: close,
    low: close,
    close,
    preClose: index > 0 ? closes[index - 1] : null,
    change: null,
    pctChg: null,
    volume: index === closes.length - 1 ? volume * 2 : volume,
    amount: null,
  }))
}

function barsWithVolumes(
  tsCode: string,
  closes: readonly number[],
  volumes: readonly number[],
): DailyBar[] {
  return bars(tsCode, closes).map((bar, index) => ({
    ...bar,
    volume: volumes[index] ?? bar.volume,
  }))
}

describe('quant momentum factors', () => {
  it('uses the latest windows and requires 21 bars for a true 20-interval return', () => {
    const factors = calculateMomentumFactors(bars('000001.SZ', Array.from({ length: 25 }, (_, index) => index + 1)))

    expect(factors.ma5).toBe(23)
    expect(factors.ma20).toBe(15.5)
    expect(factors.isNewHigh20).toBe(true)
    expect(factors.consecutiveUpDays).toBe(24)
    expect(factors.volumeRatio).toBe(2)
    expect(factors.return20).toBeCloseTo(4)

    const twentyBarFactors = calculateMomentumFactors(bars('000001.SZ', Array.from({ length: 20 }, (_, index) => index + 1)))
    expect(twentyBarFactors.return20).toBeNull()
    expect(calculateMomentumFactors(bars('000001.SZ', [1, 2])).ma20).toBeNull()
  })

  it('uses close, rather than high, for the rolling 20-day high', () => {
    const highOnlyBreakout = bars('000001.SZ', [
      ...Array.from({ length: 19 }, (_, index) => index + 1),
      18,
    ]).map((bar, index) => index === 19 ? { ...bar, high: 999 } : bar)
    expect(calculateMomentumFactors(highOnlyBreakout).isNewHigh20).toBe(false)

    const equalCloseHigh = bars('000001.SZ', [
      ...Array.from({ length: 19 }, (_, index) => index + 1),
      19,
    ])
    expect(calculateMomentumFactors(equalCloseHigh).isNewHigh20).toBe(true)
  })

  it('keeps consecutive-up and volume-ratio baselines stable', () => {
    expect(calculateMomentumFactors(bars('000001.SZ', [1, 2, 3, 3, 4])).consecutiveUpDays).toBe(1)

    const factors = calculateMomentumFactors(barsWithVolumes(
      '000001.SZ',
      Array.from({ length: 7 }).fill(10),
      [1000, 10, 20, 30, 40, 50, 60],
    ))
    expect(factors.volumeRatio).toBe(2)
    expect(calculateMomentumFactors(bars('000001.SZ', [1, 2, 3, 4, 5])).volumeRatio).toBeNull()
  })

  it('ranks the pool deterministically and records matched/missing factors', () => {
    const candidates = screenMomentum({
      '000001.SZ': bars('000001.SZ', Array.from({ length: 21 }, (_, index) => index + 1)),
      '000002.SZ': bars('000002.SZ', Array.from({ length: 21 }, (_, index) => 21 - index)),
    })

    expect(candidates[0]?.tsCode).toBe('000001.SZ')
    expect(candidates[0]?.factorVersion).toBe('momentum-v1')
    expect(candidates[0]?.factors.relativeStrength).toBe(1)
    expect(candidates[0]?.matchedFactors).toEqual([
      'ma5',
      'ma20',
      'new_high_20',
      'continuation',
      'volume_ratio',
      'relative_strength',
    ])
    expect(candidates[1]?.factors.relativeStrength).toBe(0)
    expect(candidates[1]?.matchedFactors).toEqual(['ma20', 'volume_ratio'])
    expect(candidates[1]?.dataQuality).toBe('ready')
  })

  it('maps tied pool returns by code and keeps the rank order deterministic', () => {
    const flatBars = (tsCode: string) => bars(tsCode, Array.from({ length: 21 }).fill(10))
    const candidates = screenMomentum({
      '000003.SZ': flatBars('000003.SZ'),
      '000001.SZ': flatBars('000001.SZ'),
      '000002.SZ': flatBars('000002.SZ'),
    })

    expect(candidates.map(candidate => candidate.tsCode)).toEqual([
      '000001.SZ',
      '000002.SZ',
      '000003.SZ',
    ])
    expect(candidates.map(candidate => candidate.factors.relativeStrength)).toEqual([1, 0.5, 0])
  })
})
