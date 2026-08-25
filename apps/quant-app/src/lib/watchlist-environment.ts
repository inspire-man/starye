import type { CandidateItem, WatchlistItem } from './quant-types'

export const WATCHLIST_ENVIRONMENT_VERSION = 'watchlist-environment-v1' as const

export type WatchlistEnvironmentStatus = 'positive' | 'mixed' | 'defensive' | 'insufficient'
export type WatchlistEnvironmentMetricKey = 'coverage' | 'breadth' | 'signals' | 'risk'

export interface WatchlistEnvironmentMetric {
  key: WatchlistEnvironmentMetricKey
  label: string
  numerator: number
  denominator: number
  ratio: number | null
  detail: string
}

export interface WatchlistEnvironment {
  formulaVersion: typeof WATCHLIST_ENVIRONMENT_VERSION
  status: WatchlistEnvironmentStatus
  label: string
  headline: string
  scopeNote: string
  watchlistCount: number
  coveredCount: number
  pricedCount: number
  positiveCount: number
  negativeCount: number
  candidateCount: number
  signalCount: number
  riskCount: number
  metrics: WatchlistEnvironmentMetric[]
  cautions: string[]
}

export interface WatchlistEnvironmentInput {
  watchlist: readonly WatchlistItem[]
  candidates: readonly CandidateItem[]
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

function hasRiskSignal(item: CandidateItem): boolean {
  return (item.changePercent !== null && item.changePercent <= -3)
    || (item.upStreak !== null && item.upStreak >= 5)
    || (item.volumeRatio !== null && item.volumeRatio >= 2)
}

function metricDetail(numerator: number, denominator: number, emptyText: string): string {
  return denominator > 0 ? `${numerator} / ${denominator} 只` : emptyText
}

function environmentCopy(status: WatchlistEnvironmentStatus): Pick<WatchlistEnvironment, 'label' | 'headline'> {
  if (status === 'positive') {
    return {
      label: '相对稳定',
      headline: '观察池环境相对稳定，可以优先研究基本面更完整的标的。',
    }
  }
  if (status === 'defensive') {
    return {
      label: '偏防守',
      headline: '观察池风险占比较高，先核对波动原因，再看个股长期价值。',
    }
  }
  if (status === 'mixed') {
    return {
      label: '强弱分化',
      headline: '观察池强弱分化，研究时应回到单只股票的证据链。',
    }
  }
  return {
    label: '样本不足',
    headline: '先补齐观察池日线和候选快照，再判断整体环境。',
  }
}

export function buildWatchlistEnvironment(input: WatchlistEnvironmentInput): WatchlistEnvironment {
  const watchlistCount = input.watchlist.length
  const coveredCount = input.watchlist.filter(item => item.barCount > 0 || item.latestTradeDate !== null).length
  const pricedItems = input.watchlist.filter(item => item.latestChangePercent !== null)
  const positiveCount = pricedItems.filter(item => (item.latestChangePercent ?? 0) > 0).length
  const negativeCount = pricedItems.filter(item => (item.latestChangePercent ?? 0) < 0).length

  const candidatesByCode = new Map(input.candidates.map(item => [item.tsCode, item]))
  const scoredCandidates = [...candidatesByCode.values()].filter(item => !item.pendingSync && item.score !== null)
  const candidateCount = scoredCandidates.length
  const signalCount = scoredCandidates.filter(item => (item.score ?? 0) >= 2).length
  const riskCount = scoredCandidates.filter(hasRiskSignal).length
  const coverageRatio = ratio(coveredCount, watchlistCount)
  const positiveBreadth = ratio(positiveCount, pricedItems.length)
  const signalBreadth = ratio(signalCount, candidateCount)
  const riskBreadth = ratio(riskCount, candidateCount)

  const insufficient = watchlistCount === 0 || pricedItems.length < 3 || candidateCount < 3
  let status: WatchlistEnvironmentStatus
  if (insufficient) {
    status = 'insufficient'
  }
  else if ((positiveBreadth ?? 0) < 0.4 || (riskBreadth ?? 0) >= 0.5) {
    status = 'defensive'
  }
  else if ((positiveBreadth ?? 0) >= 0.6 && (signalBreadth ?? 0) >= 0.5 && (riskBreadth ?? 0) < 0.4) {
    status = 'positive'
  }
  else {
    status = 'mixed'
  }
  const copy = environmentCopy(status)
  const cautions: string[] = []

  if (watchlistCount > coveredCount)
    cautions.push(`${watchlistCount - coveredCount} 只观察股还没有日线覆盖`)
  if (pricedItems.length > 0 && (positiveBreadth ?? 0) < 0.4)
    cautions.push('上涨占比低于 40%，先观察整体波动')
  if (candidateCount > 0 && (riskBreadth ?? 0) >= 0.4)
    cautions.push('风险提示占比达到 40% 以上，避免追逐短期强势')
  if (candidateCount > 0 && (signalBreadth ?? 0) < 0.5)
    cautions.push('有效信号不足半数，先补齐数据或等待确认')

  return {
    formulaVersion: WATCHLIST_ENVIRONMENT_VERSION,
    status,
    ...copy,
    scopeNote: '口径：当前观察池 + 最新候选快照；这是样本环境提示，不代表大盘涨跌。',
    watchlistCount,
    coveredCount,
    pricedCount: pricedItems.length,
    positiveCount,
    negativeCount,
    candidateCount,
    signalCount,
    riskCount,
    metrics: [
      {
        key: 'coverage',
        label: '数据覆盖',
        numerator: coveredCount,
        denominator: watchlistCount,
        ratio: coverageRatio,
        detail: metricDetail(coveredCount, watchlistCount, '暂无观察池样本'),
      },
      {
        key: 'breadth',
        label: '上涨占比',
        numerator: positiveCount,
        denominator: pricedItems.length,
        ratio: positiveBreadth,
        detail: metricDetail(positiveCount, pricedItems.length, '暂无最新涨跌数据'),
      },
      {
        key: 'signals',
        label: '有效信号',
        numerator: signalCount,
        denominator: candidateCount,
        ratio: signalBreadth,
        detail: metricDetail(signalCount, candidateCount, '暂无可评分候选'),
      },
      {
        key: 'risk',
        label: '风险提示',
        numerator: riskCount,
        denominator: candidateCount,
        ratio: riskBreadth,
        detail: metricDetail(riskCount, candidateCount, '暂无可评分候选'),
      },
    ],
    cautions: cautions.slice(0, 3),
  }
}
