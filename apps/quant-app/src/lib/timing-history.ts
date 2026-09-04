import type { DailyBar } from './quant-view-models'
import type { TimingWindowState } from './timing-window'
import { buildTimingWindow } from './timing-window'
import { buildTrendStructure } from './trend-analysis'

export type TimingHistoryState = Exclude<TimingWindowState, 'insufficient'>

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
  readonly averageForwardReturn20: number | null
  readonly medianForwardReturn20: number | null
  readonly bestForwardReturn20: number | null
  readonly worstForwardReturn20: number | null
}

export interface TimingHistory {
  readonly availableBars: number
  readonly evaluatedWindows: number
  readonly forwardDays: number
  readonly dataStartDate: string | null
  readonly dataEndDate: string | null
  readonly evaluationStartDate: string | null
  readonly evaluationEndDate: string | null
  readonly currentState: TimingWindowState
  readonly currentLabel: string
  readonly observations: readonly TimingHistoryObservation[]
  readonly buckets: readonly TimingHistoryBucket[]
}

const FORWARD_DAYS = 20
const HISTORY_DAYS = 60
const HISTORY_STATES: readonly TimingHistoryState[] = ['constructive', 'pullback_watch', 'extended', 'weak']
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

function emptyBucket(state: TimingHistoryState, returns: readonly number[] = []): TimingHistoryBucket {
  const positiveCount = returns.filter(value => value > 0).length
  return {
    state,
    label: STATE_LABELS[state],
    sampleSize: returns.length,
    positiveCount,
    positiveRate: returns.length ? positiveCount / returns.length : null,
    averageForwardReturn20: average(returns),
    medianForwardReturn20: median(returns),
    bestForwardReturn20: returns.length ? Math.max(...returns) : null,
    worstForwardReturn20: returns.length ? Math.min(...returns) : null,
  }
}

export function buildTimingHistory(bars: readonly DailyBar[]): TimingHistory {
  const chronologicalBars = validBars(bars)
  const observations: TimingHistoryObservation[] = []
  const returnsByState = new Map<TimingHistoryState, number[]>(HISTORY_STATES.map(state => [state, []]))

  for (let anchorIndex = HISTORY_DAYS - 1; anchorIndex + FORWARD_DAYS < chronologicalBars.length; anchorIndex++) {
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
  return {
    availableBars: chronologicalBars.length,
    evaluatedWindows: observations.length,
    forwardDays: FORWARD_DAYS,
    dataStartDate: chronologicalBars[0]?.tradeDate ?? null,
    dataEndDate: chronologicalBars.at(-1)?.tradeDate ?? null,
    evaluationStartDate: observations[0]?.anchorDate ?? null,
    evaluationEndDate: observations.at(-1)?.anchorDate ?? null,
    currentState: latestTiming.state,
    currentLabel: latestTiming.label,
    observations,
    buckets: HISTORY_STATES.map(state => emptyBucket(state, returnsByState.get(state) ?? [])),
  }
}
