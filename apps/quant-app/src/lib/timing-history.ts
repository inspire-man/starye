import type { DailyBar } from './quant-view-models'
import type { TimingWindowState } from './timing-window'
import { buildTimingWindow } from './timing-window'
import { buildTrendStructure } from './trend-analysis'

export type TimingHistoryState = Exclude<TimingWindowState, 'insufficient'>
export type TimingHistorySampleQuality = 'insufficient' | 'limited' | 'usable'
export type TimingHistoryEdgeAssessment = 'insufficient' | 'indeterminate' | 'supported' | 'weaker'

export interface TimingHistoryObservation {
  readonly anchorDate: string
  readonly state: TimingHistoryState
  readonly forwardReturn20: number
}

export interface TimingHistoryBucket {
  readonly state: TimingHistoryState
  readonly label: string
  readonly sampleSize: number
  readonly positiveCount: number
  readonly positiveRate: number | null
  readonly positiveRateLower: number | null
  readonly positiveRateUpper: number | null
  readonly positiveRateLift: number | null
  readonly edgeAssessment: TimingHistoryEdgeAssessment
  readonly averageForwardReturn20: number | null
  readonly averageForwardReturn20Delta: number | null
  readonly medianForwardReturn20: number | null
  readonly medianForwardReturn20Delta: number | null
  readonly bestForwardReturn20: number | null
  readonly worstForwardReturn20: number | null
  readonly sampleQuality: TimingHistorySampleQuality
}

export interface TimingHistoryBaseline {
  readonly sampleSize: number
  readonly positiveCount: number
  readonly positiveRate: number | null
  readonly positiveRateLower: number | null
  readonly positiveRateUpper: number | null
  readonly averageForwardReturn20: number | null
  readonly medianForwardReturn20: number | null
}

export interface TimingHistory {
  readonly availableBars: number
  readonly evaluatedWindows: number
  readonly forwardDays: number
  readonly samplingInterval: number
  readonly minimumReliableSampleSize: number
  readonly dataStartDate: string | null
  readonly dataEndDate: string | null
  readonly evaluationStartDate: string | null
  readonly evaluationEndDate: string | null
  readonly currentState: TimingWindowState
  readonly currentLabel: string
  readonly observations: readonly TimingHistoryObservation[]
  readonly baseline: TimingHistoryBaseline
  readonly buckets: readonly TimingHistoryBucket[]
}

const FORWARD_DAYS = 20
const HISTORY_DAYS = 60
const HISTORY_STATES: readonly TimingHistoryState[] = ['constructive', 'pullback_watch', 'extended', 'weak']
const MIN_RELIABLE_SAMPLE_SIZE = 6
const USABLE_SAMPLE_SIZE = 12
const STATE_LABELS: Record<TimingHistoryState, string> = {
  constructive: '结构平稳',
  pullback_watch: '回撤观察',
  extended: '短线偏热',
  weak: '趋势走弱',
}

function validBars(bars: readonly DailyBar[]): DailyBar[] {
  return [...bars]
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
    .filter(bar => bar.close !== null && Number.isFinite(bar.close) && bar.close > 0)
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function median(values: readonly number[]): number | null {
  if (!values.length)
    return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const lower = sorted[middle - 1]
  const upper = sorted[middle]
  return sorted.length % 2 ? upper ?? null : lower !== undefined && upper !== undefined ? (lower + upper) / 2 : null
}

function sampleQuality(sampleSize: number): TimingHistorySampleQuality {
  if (sampleSize < MIN_RELIABLE_SAMPLE_SIZE)
    return 'insufficient'
  if (sampleSize < USABLE_SAMPLE_SIZE)
    return 'limited'
  return 'usable'
}

function wilsonInterval(positiveCount: number, sampleSize: number): { readonly lower: number, readonly upper: number } | null {
  if (!sampleSize)
    return null
  const z = 1.96
  const proportion = positiveCount / sampleSize
  const denominator = 1 + (z ** 2) / sampleSize
  const center = (proportion + (z ** 2) / (2 * sampleSize)) / denominator
  const margin = z * Math.sqrt((proportion * (1 - proportion) / sampleSize) + (z ** 2) / (4 * sampleSize ** 2)) / denominator
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  }
}

function buildBaseline(returns: readonly number[]): TimingHistoryBaseline {
  const positiveCount = returns.filter(value => value > 0).length
  const interval = wilsonInterval(positiveCount, returns.length)
  return {
    sampleSize: returns.length,
    positiveCount,
    positiveRate: returns.length ? positiveCount / returns.length : null,
    positiveRateLower: interval?.lower ?? null,
    positiveRateUpper: interval?.upper ?? null,
    averageForwardReturn20: average(returns),
    medianForwardReturn20: median(returns),
  }
}

export function classifyTimingHistoryEdge(
  bucket: Pick<TimingHistoryBucket, 'sampleSize' | 'positiveRateLower' | 'positiveRateUpper'>,
  baseline: Pick<TimingHistoryBaseline, 'positiveRateLower' | 'positiveRateUpper'>,
): TimingHistoryEdgeAssessment {
  if (bucket.sampleSize < MIN_RELIABLE_SAMPLE_SIZE)
    return 'insufficient'
  if (bucket.positiveRateLower === null || bucket.positiveRateUpper === null || baseline.positiveRateLower === null || baseline.positiveRateUpper === null)
    return 'indeterminate'
  if (bucket.positiveRateLower > baseline.positiveRateUpper)
    return 'supported'
  if (bucket.positiveRateUpper < baseline.positiveRateLower)
    return 'weaker'
  return 'indeterminate'
}

function buildBucket(state: TimingHistoryState, returns: readonly number[], baseline: TimingHistoryBaseline): TimingHistoryBucket {
  const summary = buildBaseline(returns)
  const edgeAssessment = classifyTimingHistoryEdge(summary, baseline)
  return {
    state,
    label: STATE_LABELS[state],
    sampleSize: summary.sampleSize,
    positiveCount: summary.positiveCount,
    positiveRate: summary.positiveRate,
    positiveRateLower: summary.positiveRateLower,
    positiveRateUpper: summary.positiveRateUpper,
    positiveRateLift: summary.positiveRate !== null && baseline.positiveRate !== null ? summary.positiveRate - baseline.positiveRate : null,
    edgeAssessment,
    averageForwardReturn20: summary.averageForwardReturn20,
    averageForwardReturn20Delta: summary.averageForwardReturn20 !== null && baseline.averageForwardReturn20 !== null ? summary.averageForwardReturn20 - baseline.averageForwardReturn20 : null,
    medianForwardReturn20: summary.medianForwardReturn20,
    medianForwardReturn20Delta: summary.medianForwardReturn20 !== null && baseline.medianForwardReturn20 !== null ? summary.medianForwardReturn20 - baseline.medianForwardReturn20 : null,
    bestForwardReturn20: returns.length ? Math.max(...returns) : null,
    worstForwardReturn20: returns.length ? Math.min(...returns) : null,
    sampleQuality: sampleQuality(summary.sampleSize),
  }
}

export function buildTimingHistory(bars: readonly DailyBar[]): TimingHistory {
  const chronologicalBars = validBars(bars)
  const observations: TimingHistoryObservation[] = []
  const returnsByState = new Map<TimingHistoryState, number[]>(HISTORY_STATES.map(state => [state, []]))

  for (let anchorIndex = HISTORY_DAYS - 1; anchorIndex + FORWARD_DAYS < chronologicalBars.length; anchorIndex += FORWARD_DAYS) {
    const anchor = chronologicalBars[anchorIndex]
    const future = chronologicalBars[anchorIndex + FORWARD_DAYS]
    if (!anchor || !future || anchor.close === null || future.close === null || anchor.close <= 0)
      continue

    const historyBars = chronologicalBars.slice(0, anchorIndex + 1)
    const timing = buildTimingWindow(historyBars, buildTrendStructure(historyBars))
    if (timing.state === 'insufficient')
      continue

    const forwardReturn20 = future.close / anchor.close - 1
    const observation = {
      anchorDate: anchor.tradeDate,
      state: timing.state,
      forwardReturn20,
    } satisfies TimingHistoryObservation
    observations.push(observation)
    returnsByState.get(timing.state)?.push(forwardReturn20)
  }

  const latestTiming = buildTimingWindow(chronologicalBars, buildTrendStructure(chronologicalBars))
  const allReturns = observations.map(observation => observation.forwardReturn20)
  const baseline = buildBaseline(allReturns)
  return {
    availableBars: chronologicalBars.length,
    evaluatedWindows: observations.length,
    forwardDays: FORWARD_DAYS,
    samplingInterval: FORWARD_DAYS,
    minimumReliableSampleSize: MIN_RELIABLE_SAMPLE_SIZE,
    dataStartDate: chronologicalBars[0]?.tradeDate ?? null,
    dataEndDate: chronologicalBars.at(-1)?.tradeDate ?? null,
    evaluationStartDate: observations[0]?.anchorDate ?? null,
    evaluationEndDate: observations.at(-1)?.anchorDate ?? null,
    currentState: latestTiming.state,
    currentLabel: latestTiming.label,
    observations,
    baseline,
    buckets: HISTORY_STATES.map(state => buildBucket(state, returnsByState.get(state) ?? [], baseline)),
  }
}
