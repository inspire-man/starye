import type { DailyBar, MomentumCandidate, MomentumFactors } from './types'
import { QUANT_FACTOR_VERSION } from './types'

const MATCH_THRESHOLDS = {
  continuationDays: 3,
  volumeRatio: 1.2,
} as const

const FACTOR_WINDOWS = {
  ma5: 5,
  ma20: 20,
  newHigh20: 20,
  return20Intervals: 20,
  volumeRatioBaseline: 5,
} as const

function average(values: readonly number[]): number | null {
  if (values.length === 0)
    return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function calculateConsecutiveUpDays(bars: readonly DailyBar[]): number | null {
  if (bars.length < 2)
    return null

  let count = 0
  for (let index = bars.length - 1; index > 0; index--) {
    if (bars[index].close <= bars[index - 1].close)
      break
    count++
  }
  return count
}

export function calculateMomentumFactors(input: readonly DailyBar[]): MomentumFactors {
  const bars = [...input].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  const latest = bars.at(-1)
  const closes = bars.map(bar => bar.close)
  const ma5 = bars.length >= FACTOR_WINDOWS.ma5 ? average(closes.slice(-FACTOR_WINDOWS.ma5)) : null
  const ma20 = bars.length >= FACTOR_WINDOWS.ma20 ? average(closes.slice(-FACTOR_WINDOWS.ma20)) : null
  const recent20Closes = bars.slice(-FACTOR_WINDOWS.newHigh20).map(bar => bar.close)
  const isNewHigh20 = recent20Closes.length === FACTOR_WINDOWS.newHigh20 && latest !== undefined
    ? latest.close >= Math.max(...recent20Closes)
    : null
  const consecutiveUpDays = calculateConsecutiveUpDays(bars)
  const previousVolumes = bars.length >= FACTOR_WINDOWS.volumeRatioBaseline + 1
    ? bars.slice(-(FACTOR_WINDOWS.volumeRatioBaseline + 1), -1).map(bar => bar.volume)
    : []
  const previousVolumeAverage = average(previousVolumes)
  const volumeRatio = latest && previousVolumeAverage && previousVolumeAverage > 0
    ? latest.volume / previousVolumeAverage
    : null
  const returnBase = bars.at(-(FACTOR_WINDOWS.return20Intervals + 1))
  const return20 = latest && returnBase && returnBase.close > 0
    ? latest.close / returnBase.close - 1
    : null

  return {
    ma5,
    ma20,
    isNewHigh20,
    consecutiveUpDays,
    volumeRatio,
    return20,
    relativeStrength: null,
  }
}

function withRelativeStrength(
  factorsByCode: ReadonlyMap<string, MomentumFactors>,
): ReadonlyMap<string, number | null> {
  const ranked = [...factorsByCode.entries()]
    .filter(([, factors]) => factors.return20 !== null)
    .sort((left, right) => {
      const returnDifference = (right[1].return20 ?? 0) - (left[1].return20 ?? 0)
      return returnDifference || left[0].localeCompare(right[0])
    })
  const result = new Map<string, number | null>([...factorsByCode.keys()].map(code => [code, null]))
  const denominator = Math.max(1, ranked.length - 1)
  ranked.forEach(([code], index) => result.set(code, ranked.length === 1 ? 1 : 1 - index / denominator))
  return result
}

function buildCandidate(tsCode: string, factors: MomentumFactors): MomentumCandidate {
  const missingFactors = [
    factors.ma5 === null ? 'ma5' : null,
    factors.ma20 === null ? 'ma20' : null,
    factors.isNewHigh20 === null ? 'new_high_20' : null,
    factors.consecutiveUpDays === null ? 'continuation' : null,
    factors.volumeRatio === null ? 'volume_ratio' : null,
    factors.relativeStrength === null ? 'relative_strength' : null,
  ].filter((value): value is string => value !== null)

  const matchedFactors = [
    factors.ma5 !== null && factors.ma5 < (factors.ma20 ?? Number.POSITIVE_INFINITY) ? null : factors.ma5 !== null ? 'ma5' : null,
    factors.ma20 !== null ? 'ma20' : null,
    factors.isNewHigh20 === true ? 'new_high_20' : null,
    factors.consecutiveUpDays !== null && factors.consecutiveUpDays >= MATCH_THRESHOLDS.continuationDays ? 'continuation' : null,
    factors.volumeRatio !== null && factors.volumeRatio >= MATCH_THRESHOLDS.volumeRatio ? 'volume_ratio' : null,
    factors.relativeStrength !== null && factors.relativeStrength >= 0.5 ? 'relative_strength' : null,
  ].filter((value): value is string => value !== null)

  return {
    tsCode,
    factorVersion: QUANT_FACTOR_VERSION,
    factors,
    matchedFactors,
    missingFactors,
    dataQuality: missingFactors.length === 0 ? 'ready' : 'insufficient_data',
    score: matchedFactors.length,
  }
}

export function screenMomentum(barsByCode: Readonly<Record<string, readonly DailyBar[]>>): readonly MomentumCandidate[] {
  const factorsByCode = new Map(Object.entries(barsByCode).map(([tsCode, bars]) => [tsCode, calculateMomentumFactors(bars)]))
  const relativeStrengthByCode = withRelativeStrength(factorsByCode)
  const candidates = [...factorsByCode.entries()].map(([tsCode, factors]) => buildCandidate(tsCode, {
    ...factors,
    relativeStrength: relativeStrengthByCode.get(tsCode) ?? null,
  }))

  return candidates.sort((left, right) => {
    const scoreDifference = right.score - left.score
    if (scoreDifference !== 0)
      return scoreDifference
    const strengthDifference = (right.factors.relativeStrength ?? -1) - (left.factors.relativeStrength ?? -1)
    return strengthDifference || left.tsCode.localeCompare(right.tsCode)
  })
}
