import type { DailyBar } from './quant-view-models'
import type { TimingHistory, TimingHistoryEdgeAssessment, TimingHistoryState } from './timing-history'
import type { TimingWindowState } from './timing-window'
import { buildTimingHistory } from './timing-history'

export const TIMING_POOL_HISTORY_LIMIT = 520
export const TIMING_POOL_FETCH_CONCURRENCY = 3
export const TIMING_POOL_MIN_CROSS_TICKER = 6
export const TIMING_POOL_MIN_BARS = 80

export const TIMING_POOL_STATES: readonly TimingHistoryState[] = ['constructive', 'pullback_watch', 'extended', 'weak']

const STATE_LABELS: Record<TimingHistoryState, string> = {
  constructive: '结构平稳',
  pullback_watch: '回撤观察',
  extended: '短线偏热',
  weak: '趋势走弱',
}

export type TimingPoolTickerStatus = 'ready' | 'source-failed' | 'insufficient-data'
export type TimingPoolConsensus = 'insufficient-pool' | 'indeterminate' | 'mixed' | 'supported' | 'weaker'
export type TimingPoolThresholdAdvice = 'hold-thresholds'

export interface TimingPoolTickerInput {
  readonly tsCode: string
  readonly name: string | null
}

export interface TimingPoolBucketSummary {
  readonly state: TimingHistoryState
  readonly label: string
  readonly sampleSize: number
  readonly edgeAssessment: TimingHistoryEdgeAssessment
}

export interface TimingPoolTickerResult {
  readonly tsCode: string
  readonly name: string | null
  readonly status: TimingPoolTickerStatus
  readonly availableBars: number | null
  readonly evaluatedWindows: number | null
  readonly currentState: TimingWindowState | null
  readonly currentLabel: string | null
  readonly currentSampleSize: number | null
  readonly currentEdgeAssessment: TimingHistoryEdgeAssessment | null
  readonly buckets: readonly TimingPoolBucketSummary[]
}

export interface TimingPoolStateSummary {
  readonly state: TimingHistoryState
  readonly label: string
  readonly tickerCount: number
  readonly insufficientCount: number
  readonly indeterminateCount: number
  readonly supportedCount: number
  readonly weakerCount: number
  readonly consensus: TimingPoolConsensus
}

export interface TimingPoolAudit {
  readonly universeSize: number
  readonly readyCount: number
  readonly sourceFailedCount: number
  readonly insufficientDataCount: number
  readonly states: readonly TimingPoolStateSummary[]
  readonly thresholdAdvice: TimingPoolThresholdAdvice
  readonly thresholdAdviceLabel: string
  readonly headline: string
}

export interface TimingPoolCollection {
  readonly aborted: boolean
  readonly results: readonly TimingPoolTickerResult[]
  readonly audit: TimingPoolAudit
}

function emptyBuckets(): TimingPoolBucketSummary[] {
  return TIMING_POOL_STATES.map(state => ({
    state,
    label: STATE_LABELS[state],
    sampleSize: 0,
    edgeAssessment: 'insufficient',
  }))
}

function currentBucket(history: TimingHistory): TimingPoolBucketSummary | null {
  if (history.currentState === 'insufficient')
    return null
  const bucket = history.buckets.find(item => item.state === history.currentState)
  return bucket
    ? {
        state: bucket.state,
        label: bucket.label,
        sampleSize: bucket.sampleSize,
        edgeAssessment: bucket.edgeAssessment,
      }
    : null
}

export function timingPoolEdgeLabel(value: TimingHistoryEdgeAssessment | null): string {
  if (value === 'supported')
    return '相对基准有稳定支持'
  if (value === 'weaker')
    return '相对基准偏弱'
  if (value === 'indeterminate')
    return '区间重叠'
  if (value === 'insufficient')
    return '样本不足'
  return '--'
}

export function timingPoolConsensusLabel(value: TimingPoolConsensus): string {
  return {
    'insufficient-pool': '跨标的样本不足',
    'indeterminate': '区间重叠为主',
    'mixed': '方向不一致',
    'supported': '多标的相对基准有稳定支持',
    'weaker': '多标的相对基准偏弱',
  }[value]
}

export function timingPoolTickerStatusLabel(value: TimingPoolTickerStatus): string {
  return {
    'ready': '已评估',
    'source-failed': '来源失败',
    'insufficient-data': '数据不足',
  }[value]
}

function classifyConsensus(input: {
  readonly insufficientCount: number
  readonly indeterminateCount: number
  readonly supportedCount: number
  readonly weakerCount: number
}): TimingPoolConsensus {
  const directionalCount = input.supportedCount + input.weakerCount
  const assessedCount = directionalCount + input.indeterminateCount
  if (assessedCount < TIMING_POOL_MIN_CROSS_TICKER)
    return 'insufficient-pool'
  if (input.supportedCount > 0 && input.weakerCount > 0)
    return 'mixed'
  if (input.supportedCount >= TIMING_POOL_MIN_CROSS_TICKER && input.weakerCount === 0)
    return 'supported'
  if (input.weakerCount >= TIMING_POOL_MIN_CROSS_TICKER && input.supportedCount === 0)
    return 'weaker'
  return 'indeterminate'
}

function headlineFor(audit: Pick<TimingPoolAudit, 'readyCount' | 'states'>): string {
  if (audit.readyCount === 0)
    return '还没有可审计的历史时机样本。阈值保持不变，也不构成买卖判断。'
  if (audit.states.every(state => state.consensus === 'insufficient-pool'))
    return '跨标的样本仍不足，不调整状态阈值。'
  if (audit.states.some(state => state.consensus === 'mixed'))
    return '同一状态在不同标的上方向不一致，不调整状态阈值。'
  if (audit.states.some(state => state.consensus === 'supported' || state.consensus === 'weaker'))
    return '部分状态出现跨标的方向，仍不调整状态阈值。'
  return '多数状态仍是区间重叠或样本不足，不调整状态阈值。'
}

export function buildTickerTimingPoolResult(
  item: TimingPoolTickerInput,
  bars: readonly DailyBar[] | null,
  status: TimingPoolTickerStatus,
): TimingPoolTickerResult {
  if (status !== 'ready' || bars === null) {
    return {
      tsCode: item.tsCode,
      name: item.name,
      status,
      availableBars: status === 'source-failed' ? null : bars?.length ?? 0,
      evaluatedWindows: null,
      currentState: null,
      currentLabel: null,
      currentSampleSize: null,
      currentEdgeAssessment: null,
      buckets: emptyBuckets(),
    }
  }

  const history = buildTimingHistory(bars)
  if (history.evaluatedWindows === 0) {
    return {
      tsCode: item.tsCode,
      name: item.name,
      status: 'insufficient-data',
      availableBars: history.availableBars,
      evaluatedWindows: 0,
      currentState: history.currentState,
      currentLabel: history.currentLabel,
      currentSampleSize: null,
      currentEdgeAssessment: null,
      buckets: emptyBuckets(),
    }
  }

  const current = currentBucket(history)
  return {
    tsCode: item.tsCode,
    name: item.name,
    status: 'ready',
    availableBars: history.availableBars,
    evaluatedWindows: history.evaluatedWindows,
    currentState: history.currentState,
    currentLabel: history.currentLabel,
    currentSampleSize: current?.sampleSize ?? null,
    currentEdgeAssessment: current?.edgeAssessment ?? null,
    buckets: history.buckets.map(bucket => ({
      state: bucket.state,
      label: bucket.label,
      sampleSize: bucket.sampleSize,
      edgeAssessment: bucket.edgeAssessment,
    })),
  }
}

export function buildTimingPoolAudit(results: readonly TimingPoolTickerResult[]): TimingPoolAudit {
  const ready = results.filter(item => item.status === 'ready')
  const states = TIMING_POOL_STATES.map((state) => {
    const buckets = ready.map(item => item.buckets.find(bucket => bucket.state === state)).filter((bucket): bucket is TimingPoolBucketSummary => Boolean(bucket))
    const insufficientCount = buckets.filter(bucket => bucket.edgeAssessment === 'insufficient').length
    const indeterminateCount = buckets.filter(bucket => bucket.edgeAssessment === 'indeterminate').length
    const supportedCount = buckets.filter(bucket => bucket.edgeAssessment === 'supported').length
    const weakerCount = buckets.filter(bucket => bucket.edgeAssessment === 'weaker').length
    return {
      state,
      label: STATE_LABELS[state],
      tickerCount: ready.length,
      insufficientCount,
      indeterminateCount,
      supportedCount,
      weakerCount,
      consensus: classifyConsensus({
        insufficientCount,
        indeterminateCount,
        supportedCount,
        weakerCount,
      }),
    } satisfies TimingPoolStateSummary
  })
  const audit = {
    universeSize: results.length,
    readyCount: ready.length,
    sourceFailedCount: results.filter(item => item.status === 'source-failed').length,
    insufficientDataCount: results.filter(item => item.status === 'insufficient-data').length,
    states,
    thresholdAdvice: 'hold-thresholds',
    thresholdAdviceLabel: '阈值保持不变',
    headline: '',
  } satisfies Omit<TimingPoolAudit, 'headline'> & { headline: string }
  return {
    ...audit,
    headline: headlineFor(audit),
  }
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = Array.from({ length: items.length })
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item === undefined)
        return
      results[index] = await mapper(item, index)
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: items.length ? workerCount : 0 }, () => worker()))
  return results
}

export async function collectTimingPoolAudit(
  items: readonly TimingPoolTickerInput[],
  loadBars: (tsCode: string) => Promise<readonly DailyBar[]>,
  options: {
    readonly concurrency?: number
    readonly isCurrent?: () => boolean
    readonly onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<TimingPoolCollection> {
  const concurrency = options.concurrency ?? TIMING_POOL_FETCH_CONCURRENCY
  let completed = 0
  const results = await mapPool(items, concurrency, async (item) => {
    if (options.isCurrent && !options.isCurrent()) {
      return buildTickerTimingPoolResult(item, null, 'source-failed')
    }
    try {
      const bars = await loadBars(item.tsCode)
      if (options.isCurrent && !options.isCurrent())
        return buildTickerTimingPoolResult(item, null, 'source-failed')
      const validCount = bars.filter(bar => bar.close !== null && Number.isFinite(bar.close) && bar.close > 0).length
      const status: TimingPoolTickerStatus = validCount < TIMING_POOL_MIN_BARS ? 'insufficient-data' : 'ready'
      return buildTickerTimingPoolResult(item, bars, status)
    }
    catch {
      return buildTickerTimingPoolResult(item, null, 'source-failed')
    }
    finally {
      completed += 1
      options.onProgress?.(completed, items.length)
    }
  })

  if (options.isCurrent && !options.isCurrent()) {
    return {
      aborted: true,
      results: [],
      audit: buildTimingPoolAudit([]),
    }
  }

  return {
    aborted: false,
    results,
    audit: buildTimingPoolAudit(results),
  }
}
