import type { DailyBar } from './types'

export const FACTOR_ROBUSTNESS_FORMULA_VERSION = 'factor-robustness-v1' as const
const FORWARD_DAYS = 20
const MIN_DIRECTIONAL_SAMPLE = 6

export type FactorRobustnessEdge = 'insufficient' | 'supported' | 'weaker' | 'indeterminate' | 'split'

export interface FactorRobustness {
  readonly formulaVersion: typeof FACTOR_ROBUSTNESS_FORMULA_VERSION
  readonly currentLabel: string
  readonly expectedDirection: 'up' | 'down' | 'split'
  readonly matchedSampleSize: number
  readonly directionalSampleSize: number
  readonly agreementCount: number
  readonly agreementRate: number | null
  readonly baselineAgreementRate: number | null
  readonly edge: FactorRobustnessEdge
  readonly label: string
  readonly detail: string
}

interface FactorState {
  readonly ma20Above: boolean
  readonly return20Up: boolean
}

function validCloses(bars: readonly Pick<DailyBar, 'close' | 'tradeDate'>[]): number[] {
  return [...bars]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
    .map(bar => bar.close)
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function stateAt(closes: readonly number[], index: number): FactorState | null {
  if (index < FORWARD_DAYS)
    return null
  const ma20 = average(closes.slice(index - (FORWARD_DAYS - 1), index + 1))
  const base = closes[index - FORWARD_DAYS]
  const close = closes[index]
  if (ma20 === null || base === undefined || close === undefined || base <= 0)
    return null
  return {
    ma20Above: close >= ma20,
    return20Up: close / base - 1 >= 0,
  }
}

function sameState(left: FactorState, right: FactorState): boolean {
  return left.ma20Above === right.ma20Above && left.return20Up === right.return20Up
}

function expectedDirection(state: FactorState): 'up' | 'down' | 'split' {
  if (state.ma20Above && state.return20Up)
    return 'up'
  if (!state.ma20Above && !state.return20Up)
    return 'down'
  return 'split'
}

function currentLabel(state: FactorState): string {
  const ma20 = state.ma20Above ? '收盘在 MA20 上' : '收盘在 MA20 下'
  const trend = state.return20Up ? '20 日收益为正' : '20 日收益为负'
  return `${ma20}，且 ${trend}`
}

function wilson(successes: number, sampleSize: number): { readonly lower: number, readonly upper: number } | null {
  if (!sampleSize)
    return null
  const z = 1.96
  const proportion = successes / sampleSize
  const denominator = 1 + (z ** 2) / sampleSize
  const center = (proportion + (z ** 2) / (2 * sampleSize)) / denominator
  const margin = z * Math.sqrt((proportion * (1 - proportion) / sampleSize) + (z ** 2) / (4 * sampleSize ** 2)) / denominator
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) }
}

function classify(matchedSuccesses: number, matchedSample: number, baselineSuccesses: number, baselineSample: number): FactorRobustnessEdge {
  if (matchedSample < MIN_DIRECTIONAL_SAMPLE)
    return 'insufficient'
  const matched = wilson(matchedSuccesses, matchedSample)
  const baseline = wilson(baselineSuccesses, baselineSample)
  if (!matched || !baseline)
    return 'indeterminate'
  if (matched.lower > baseline.upper)
    return 'supported'
  if (matched.upper < baseline.lower)
    return 'weaker'
  return 'indeterminate'
}

export function buildFactorRobustness(bars: readonly Pick<DailyBar, 'close' | 'tradeDate'>[]): FactorRobustness {
  const closes = validCloses(bars)
  const current = stateAt(closes, closes.length - 1)
  const empty = (detail: string, edge: FactorRobustnessEdge = 'insufficient'): FactorRobustness => ({
    formulaVersion: FACTOR_ROBUSTNESS_FORMULA_VERSION,
    currentLabel: current ? currentLabel(current) : '当前 K 线不足以计算 MA20 和 20 日收益',
    expectedDirection: current ? expectedDirection(current) : 'split',
    matchedSampleSize: 0,
    directionalSampleSize: 0,
    agreementCount: 0,
    agreementRate: null,
    baselineAgreementRate: null,
    edge,
    label: edge === 'split' ? '状态分裂' : '样本不足',
    detail,
  })
  if (!current)
    return empty('至少需要 21 根有效日线才能判断当前因子状态。')

  const direction = expectedDirection(current)
  if (direction === 'split') {
    return empty('MA20 位置和 20 日收益方向不一致，当前分析没有单一方向，不计算历史准确度。', 'split')
  }

  const matched: number[] = []
  const baseline: number[] = []
  for (let index = FORWARD_DAYS; index + FORWARD_DAYS < closes.length; index += FORWARD_DAYS) {
    const state = stateAt(closes, index)
    const future = closes[index + FORWARD_DAYS]
    const anchor = closes[index]
    if (!state || future === undefined || anchor === undefined || anchor <= 0)
      continue
    const forwardReturn = future / anchor - 1
    baseline.push(forwardReturn)
    if (sameState(state, current))
      matched.push(forwardReturn)
  }

  const agreed = (value: number) => direction === 'up' ? value > 0 : value < 0
  const matchedDirectional = matched.filter(value => value !== 0)
  const baselineDirectional = baseline.filter(value => value !== 0)
  const agreementCount = matchedDirectional.filter(agreed).length
  const baselineAgreementCount = baselineDirectional.filter(agreed).length
  const edge = classify(agreementCount, matchedDirectional.length, baselineAgreementCount, baselineDirectional.length)
  const agreementRate = edge === 'insufficient' ? null : Math.round(agreementCount / matchedDirectional.length * 100)
  const baselineAgreementRate = baselineDirectional.length ? Math.round(baselineAgreementCount / baselineDirectional.length * 100) : null
  const label = edge === 'supported'
    ? '同类历史状态支持当前方向'
    : edge === 'weaker'
      ? '同类历史状态弱于全体 K 线'
      : edge === 'indeterminate'
        ? '区间重叠'
        : '样本不足'
  const detail = edge === 'insufficient'
    ? `同类非重叠 K 线只有 ${matchedDirectional.length} 个方向样本，不足 ${MIN_DIRECTIONAL_SAMPLE} 个，不判断当前分析是否更准。`
    : `同类状态后续方向一致 ${agreementRate}%（${agreementCount} / ${matchedDirectional.length}），全体 K 线同一方向为 ${baselineAgreementRate === null ? '--' : `${baselineAgreementRate}%`}。这不是预测准确率。`
  return {
    formulaVersion: FACTOR_ROBUSTNESS_FORMULA_VERSION,
    currentLabel: currentLabel(current),
    expectedDirection: direction,
    matchedSampleSize: matched.length,
    directionalSampleSize: matchedDirectional.length,
    agreementCount,
    agreementRate,
    baselineAgreementRate,
    edge,
    label,
    detail,
  }
}
