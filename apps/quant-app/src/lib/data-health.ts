import type { QuantShareholderReturnSelection, QuantValueSelection, SyncResult, WatchlistItem } from './quant-types'

export const QUANT_DATA_HEALTH_VERSION = 'quant-data-health-v1' as const

export type QuantDataHealthStatus = 'ready' | 'partial' | 'missing' | 'loading' | 'error'
export type QuantDataHealthKey = 'daily' | 'value-quality' | 'shareholder-returns'
export type QuantDataHealthActionView = 'watchlist' | 'candidates'

export interface QuantDataHealthItem {
  key: QuantDataHealthKey
  label: string
  status: QuantDataHealthStatus
  readyCount: number | null
  totalCount: number | null
  detail: string
  observedAt: string | null
  actionView: QuantDataHealthActionView | null
  actionLabel: string | null
}

export interface QuantDataHealthSummary {
  formulaVersion: typeof QUANT_DATA_HEALTH_VERSION
  status: QuantDataHealthStatus
  label: string
  headline: string
  scopeNote: string
  items: readonly QuantDataHealthItem[]
}

export interface QuantDataHealthInput {
  watchlist: readonly WatchlistItem[]
  sync: SyncResult | null
  syncLoading: boolean
  syncError: boolean
  valueSelection: QuantValueSelection | null
  valueLoading: boolean
  valueError: boolean
  shareholderReturns: QuantShareholderReturnSelection | null
  shareholderLoading: boolean
  shareholderError: boolean
}

function countCoveredWatchlistItems(watchlist: readonly WatchlistItem[]): number {
  return watchlist.filter(item => item.barCount > 0 || item.latestTradeDate !== null).length
}

function boundedCount(value: number, total: number): number {
  if (!Number.isFinite(value) || total <= 0)
    return 0
  return Math.min(total, Math.max(0, Math.floor(value)))
}

function resultCounts(selection: QuantValueSelection | QuantShareholderReturnSelection): { ready: number, partial: number, insufficient: number, total: number } {
  const total = Number.isFinite(selection.sampleCount) ? Math.max(0, Math.floor(selection.sampleCount)) : 0
  const ready = boundedCount(selection.readyCount, total)
  const partial = Math.min(total - ready, boundedCount(selection.partialCount, total))
  return {
    ready,
    partial,
    insufficient: Math.min(total - ready - partial, boundedCount(selection.insufficientCount, total)),
    total,
  }
}

const DATA_HEALTH_ACTIONS: Record<QuantDataHealthKey, { actionView: QuantDataHealthActionView, actionLabel: string }> = {
  'daily': { actionView: 'watchlist', actionLabel: '去更新日线' },
  'value-quality': { actionView: 'candidates', actionLabel: '去看候选研究' },
  'shareholder-returns': { actionView: 'candidates', actionLabel: '去看候选研究' },
}

function dataHealthActionFor(key: QuantDataHealthKey, status: QuantDataHealthStatus): Pick<QuantDataHealthItem, 'actionView' | 'actionLabel'> {
  if (status === 'ready' || status === 'loading')
    return { actionView: null, actionLabel: null }
  return DATA_HEALTH_ACTIONS[key]
}

function createDataHealthItem(
  key: QuantDataHealthKey,
  label: string,
  status: QuantDataHealthStatus,
  details: Omit<QuantDataHealthItem, 'key' | 'label' | 'status' | 'actionView' | 'actionLabel'>,
): QuantDataHealthItem {
  return { key, label, status, ...details, ...dataHealthActionFor(key, status) }
}

function buildSelectionItem(
  key: QuantDataHealthKey,
  label: string,
  selection: QuantValueSelection | QuantShareholderReturnSelection | null,
  loading: boolean,
  error: boolean,
): QuantDataHealthItem {
  if (loading) {
    return createDataHealthItem(key, label, 'loading', { readyCount: null, totalCount: null, detail: '正在读取当前数据', observedAt: null })
  }
  if (error) {
    return createDataHealthItem(key, label, 'error', { readyCount: null, totalCount: null, detail: '数据读取失败，请打开详情重试', observedAt: null })
  }
  if (!selection) {
    return createDataHealthItem(key, label, 'missing', { readyCount: 0, totalCount: 0, detail: '当前没有可用结果', observedAt: null })
  }

  const counts = resultCounts(selection)
  if (counts.total === 0) {
    return createDataHealthItem(key, label, 'missing', { readyCount: 0, totalCount: 0, detail: '当前观察池没有可比较样本', observedAt: selection.observedAt })
  }

  const status = counts.ready === counts.total && counts.partial === 0 && counts.insufficient === 0 ? 'ready' : 'partial'
  const detail = `${counts.ready} / ${counts.total} 只完整 · ${counts.partial} 只部分 · ${counts.insufficient} 只数据不足`
  return createDataHealthItem(key, label, status, { readyCount: counts.ready, totalCount: counts.total, detail, observedAt: selection.observedAt })
}

function buildDailyItem(input: QuantDataHealthInput): QuantDataHealthItem {
  const total = input.watchlist.length
  const covered = countCoveredWatchlistItems(input.watchlist)
  if (input.syncLoading)
    return createDataHealthItem('daily', '日线同步', 'loading', { readyCount: covered, totalCount: total, detail: '正在读取最近一次同步状态', observedAt: null })
  if (input.syncError)
    return createDataHealthItem('daily', '日线同步', 'error', { readyCount: covered, totalCount: total, detail: `同步状态读取失败 · 当前覆盖 ${covered} / ${total} 只`, observedAt: null })
  if (total === 0)
    return createDataHealthItem('daily', '日线同步', 'missing', { readyCount: 0, totalCount: 0, detail: '观察池为空，先加入股票', observedAt: null })
  if (!input.sync) {
    const status = covered > 0 ? 'partial' : 'missing'
    return createDataHealthItem('daily', '日线同步', status, {
      readyCount: covered,
      totalCount: total,
      detail: covered > 0 ? `已覆盖 ${covered} / ${total} 只，但没有同步状态记录` : '尚未完成一次日线同步',
      observedAt: null,
    })
  }

  const observedAt = input.sync.completedAt || input.sync.startedAt
  if (input.sync.status === 'rejected') {
    const status = covered > 0 ? 'partial' : 'error'
    return createDataHealthItem('daily', '日线同步', status, {
      readyCount: covered,
      totalCount: total,
      detail: `${input.sync.reason || '最近一次同步被拒绝'} · 当前覆盖 ${covered} / ${total} 只`,
      observedAt,
    })
  }
  if (input.sync.status === 'partial' || covered < total) {
    return createDataHealthItem('daily', '日线同步', 'partial', {
      readyCount: covered,
      totalCount: total,
      detail: `${input.sync.status === 'partial' ? '最近一次同步部分完成' : '同步已完成但覆盖不足'} · ${covered} / ${total} 只`,
      observedAt,
    })
  }
  return createDataHealthItem('daily', '日线同步', 'ready', {
    readyCount: covered,
    totalCount: total,
    detail: `最近一次同步已完成 · ${covered} / ${total} 只`,
    observedAt,
  })
}

function summaryStatus(items: readonly QuantDataHealthItem[], watchlistCount: number): QuantDataHealthStatus {
  if (watchlistCount === 0)
    return 'missing'
  if (items.some(item => item.status === 'loading'))
    return 'loading'
  if (items.some(item => item.status === 'error'))
    return 'error'
  if (items.every(item => item.status === 'ready'))
    return 'ready'
  if (items.every(item => item.status === 'missing'))
    return 'missing'
  return 'partial'
}

function summaryLabel(status: QuantDataHealthStatus): string {
  return {
    ready: '数据完整',
    partial: '部分可用',
    missing: '待补数据',
    loading: '读取中',
    error: '读取失败',
  }[status]
}

export function buildQuantDataHealth(input: QuantDataHealthInput): QuantDataHealthSummary {
  const items = [
    buildDailyItem(input),
    buildSelectionItem('value-quality', '价值质量', input.valueSelection, input.valueLoading, input.valueError),
    buildSelectionItem('shareholder-returns', '股东回报', input.shareholderReturns, input.shareholderLoading, input.shareholderError),
  ] as const
  const status = summaryStatus(items, input.watchlist.length)
  const headline = status === 'ready'
    ? '日线、价值质量和股东回报均可读取'
    : status === 'loading'
      ? '正在读取日线与研究数据状态'
      : status === 'error'
        ? '有数据域读取失败，请按行重试'
        : status === 'missing'
          ? input.watchlist.length ? '尚未形成可用研究数据' : '加入观察池后开始同步'
          : '日线可用，部分研究数据仍有缺口'
  const scopeNote = input.watchlist.length
    ? `当前观察池 ${input.watchlist.length} 只；缺失值保留为数据缺口，不按 0 计算。`
    : '当前观察池为空；加入股票后再同步日线。'

  return {
    formulaVersion: QUANT_DATA_HEALTH_VERSION,
    status,
    label: summaryLabel(status),
    headline,
    scopeNote,
    items,
  }
}
