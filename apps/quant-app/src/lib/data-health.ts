import type { QuantShareholderReturnSelection, QuantValueSelection, SyncResult, WatchlistItem } from './quant-types'

export const QUANT_DATA_HEALTH_VERSION = 'quant-data-health-v3' as const

export type QuantDataHealthStatus = 'ready' | 'partial' | 'missing' | 'loading' | 'error'
export type QuantDataHealthKey = 'daily' | 'value-quality' | 'shareholder-returns'
export type QuantDataHealthAction = 'open-watchlist' | 'refresh-value-quality' | 'refresh-shareholder-returns'
export type QuantDataHealthFreshness = 'fresh' | 'aging' | 'stale' | 'unknown'

export interface QuantDataHealthItem {
  key: QuantDataHealthKey
  label: string
  status: QuantDataHealthStatus
  readyCount: number | null
  totalCount: number | null
  detail: string
  observedAt: string | null
  freshness: QuantDataHealthFreshness
  freshnessLabel: string
  freshnessDetail: string
  action: QuantDataHealthAction | null
  actionLabel: string | null
}

export interface QuantDataHealthSummary {
  formulaVersion: typeof QUANT_DATA_HEALTH_VERSION
  status: QuantDataHealthStatus
  label: string
  headline: string
  scopeNote: string
  freshness: QuantDataHealthFreshness
  freshnessLabel: string
  freshnessDetail: string
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
  now?: string | Date
}

const FRESHNESS_THRESHOLDS = {
  freshHours: 48,
  agingHours: 7 * 24,
} as const

function countCoveredWatchlistItems(watchlist: readonly WatchlistItem[]): number {
  return watchlist.filter(item => item.barCount > 0 || item.latestTradeDate !== null).length
}

function boundedCount(value: number, total: number): number {
  if (!Number.isFinite(value) || total <= 0)
    return 0
  return Math.min(total, Math.max(0, Math.floor(value)))
}

function parseTimestamp(value: string | null): Date | null {
  if (!value)
    return null
  const compact = /^(\d{4})(\d{2})(\d{2})$/u.exec(value)
  const parsed = compact
    ? new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])))
    : new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function resolveNow(value: string | Date | undefined): Date | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value : null
  return parseTimestamp(value || new Date().toISOString())
}

function freshnessLabel(freshness: QuantDataHealthFreshness): string {
  return {
    fresh: '最新',
    aging: '需复核',
    stale: '已过期',
    unknown: '时间未知',
  }[freshness]
}

function elapsedDetail(ageHours: number): string {
  if (ageHours < 1)
    return '刚刚观测'
  const hours = Math.floor(ageHours)
  if (hours < 24)
    return `约 ${hours} 小时前`
  return `约 ${Math.floor(hours / 24)} 天前`
}

function freshnessFor(observedAt: string | null, nowValue: string | Date | undefined): { freshness: QuantDataHealthFreshness, freshnessLabel: string, freshnessDetail: string } {
  const observed = parseTimestamp(observedAt)
  const now = resolveNow(nowValue)
  if (!observed || !now) {
    return {
      freshness: 'unknown',
      freshnessLabel: freshnessLabel('unknown'),
      freshnessDetail: '没有可验证观察时间',
    }
  }

  const ageHours = (now.getTime() - observed.getTime()) / (60 * 60 * 1_000)
  if (ageHours < 0) {
    return {
      freshness: 'unknown',
      freshnessLabel: freshnessLabel('unknown'),
      freshnessDetail: '观察时间晚于当前时间，暂不判断',
    }
  }
  const freshness = ageHours <= FRESHNESS_THRESHOLDS.freshHours
    ? 'fresh'
    : ageHours <= FRESHNESS_THRESHOLDS.agingHours
      ? 'aging'
      : 'stale'
  return {
    freshness,
    freshnessLabel: freshnessLabel(freshness),
    freshnessDetail: freshness === 'fresh'
      ? elapsedDetail(ageHours)
      : freshness === 'aging'
        ? `${elapsedDetail(ageHours)}，建议刷新`
        : `${elapsedDetail(ageHours)}，先刷新数据`,
  }
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

const DATA_HEALTH_ACTIONS: Record<QuantDataHealthKey, { action: QuantDataHealthAction, actionLabel: string }> = {
  'daily': { action: 'open-watchlist', actionLabel: '去更新日线' },
  'value-quality': { action: 'refresh-value-quality', actionLabel: '重新读取价值质量' },
  'shareholder-returns': { action: 'refresh-shareholder-returns', actionLabel: '重新读取股东回报' },
}

function dataHealthActionFor(key: QuantDataHealthKey, status: QuantDataHealthStatus): Pick<QuantDataHealthItem, 'action' | 'actionLabel'> {
  if (status === 'ready' || status === 'loading')
    return { action: null, actionLabel: null }
  return DATA_HEALTH_ACTIONS[key]
}

function createDataHealthItem(
  key: QuantDataHealthKey,
  label: string,
  status: QuantDataHealthStatus,
  details: Omit<QuantDataHealthItem, 'key' | 'label' | 'status' | 'action' | 'actionLabel'>,
): QuantDataHealthItem {
  return { key, label, status, ...details, ...dataHealthActionFor(key, status) }
}

function selectionDetails(selection: QuantValueSelection | QuantShareholderReturnSelection | null, now: string | Date | undefined): Pick<QuantDataHealthItem, 'readyCount' | 'totalCount' | 'observedAt' | 'freshness' | 'freshnessLabel' | 'freshnessDetail'> {
  const counts = selection ? resultCounts(selection) : null
  const observedAt = selection?.observedAt ?? null
  return {
    readyCount: counts?.ready ?? null,
    totalCount: counts?.total ?? null,
    observedAt,
    ...freshnessFor(observedAt, now),
  }
}

function buildSelectionItem(
  key: QuantDataHealthKey,
  label: string,
  selection: QuantValueSelection | QuantShareholderReturnSelection | null,
  loading: boolean,
  error: boolean,
  now: string | Date | undefined,
): QuantDataHealthItem {
  const previous = selectionDetails(selection, now)
  if (loading) {
    return createDataHealthItem(key, label, 'loading', {
      ...previous,
      detail: selection
        ? `正在刷新 · 上次 ${previous.readyCount} / ${previous.totalCount} 只完整`
        : '正在读取当前数据',
    })
  }
  if (error) {
    return createDataHealthItem(key, label, 'error', {
      ...previous,
      detail: selection
        ? `本次读取失败 · 保留上次 ${previous.readyCount} / ${previous.totalCount} 只完整`
        : '数据读取失败，点击下一步重试',
    })
  }
  if (!selection) {
    return createDataHealthItem(key, label, 'missing', { ...previous, readyCount: 0, totalCount: 0, detail: '当前没有可用结果' })
  }

  const counts = resultCounts(selection)
  if (counts.total === 0) {
    return createDataHealthItem(key, label, 'missing', { ...previous, readyCount: 0, totalCount: 0, detail: '当前观察池没有可比较样本' })
  }

  const status = counts.ready === counts.total && counts.partial === 0 && counts.insufficient === 0 ? 'ready' : 'partial'
  const detail = `${counts.ready} / ${counts.total} 只完整 · ${counts.partial} 只部分 · ${counts.insufficient} 只数据不足`
  return createDataHealthItem(key, label, status, { ...previous, readyCount: counts.ready, totalCount: counts.total, detail })
}

function syncObservedAt(sync: SyncResult | null): string | null {
  return sync?.completedAt || sync?.startedAt || null
}

function buildDailyItem(input: QuantDataHealthInput): QuantDataHealthItem {
  const total = input.watchlist.length
  const covered = countCoveredWatchlistItems(input.watchlist)
  const observedAt = syncObservedAt(input.sync)
  const previous = { observedAt, ...freshnessFor(observedAt, input.now) }
  if (input.syncLoading)
    return createDataHealthItem('daily', '日线同步', 'loading', { ...previous, readyCount: covered, totalCount: total, detail: input.sync ? '正在刷新同步状态 · 保留最近一次结果' : '正在读取最近一次同步状态' })
  if (input.syncError)
    return createDataHealthItem('daily', '日线同步', 'error', { ...previous, readyCount: covered, totalCount: total, detail: input.sync ? `同步状态读取失败 · 保留最近一次结果 · 当前覆盖 ${covered} / ${total} 只` : `同步状态读取失败 · 当前覆盖 ${covered} / ${total} 只` })
  if (total === 0)
    return createDataHealthItem('daily', '日线同步', 'missing', { ...previous, readyCount: 0, totalCount: 0, detail: '观察池为空，先加入股票' })
  if (!input.sync) {
    const status = covered > 0 ? 'partial' : 'missing'
    return createDataHealthItem('daily', '日线同步', status, {
      ...previous,
      readyCount: covered,
      totalCount: total,
      detail: covered > 0 ? `已覆盖 ${covered} / ${total} 只，但没有同步状态记录` : '尚未完成一次日线同步',
    })
  }

  if (input.sync.status === 'rejected') {
    const status = covered > 0 ? 'partial' : 'error'
    return createDataHealthItem('daily', '日线同步', status, {
      ...previous,
      readyCount: covered,
      totalCount: total,
      detail: `${input.sync.reason || '最近一次同步被拒绝'} · 当前覆盖 ${covered} / ${total} 只`,
    })
  }
  if (input.sync.status === 'partial' || covered < total) {
    return createDataHealthItem('daily', '日线同步', 'partial', {
      ...previous,
      readyCount: covered,
      totalCount: total,
      detail: `${input.sync.status === 'partial' ? '最近一次同步部分完成' : '同步已完成但覆盖不足'} · ${covered} / ${total} 只`,
    })
  }
  return createDataHealthItem('daily', '日线同步', 'ready', {
    ...previous,
    readyCount: covered,
    totalCount: total,
    detail: `最近一次同步已完成 · ${covered} / ${total} 只`,
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

function freshnessSummary(items: readonly QuantDataHealthItem[], watchlistCount: number): { freshness: QuantDataHealthFreshness, freshnessLabel: string, freshnessDetail: string } {
  if (watchlistCount === 0) {
    return {
      freshness: 'unknown',
      freshnessLabel: freshnessLabel('unknown'),
      freshnessDetail: '加入观察池后记录数据观察时间',
    }
  }
  if (items.some(item => item.freshness === 'stale')) {
    const count = items.filter(item => item.freshness === 'stale').length
    return {
      freshness: 'stale',
      freshnessLabel: freshnessLabel('stale'),
      freshnessDetail: `${count} 个数据域已超过 7 天，先刷新后再判断`,
    }
  }
  if (items.some(item => item.freshness === 'aging')) {
    const count = items.filter(item => item.freshness === 'aging').length
    return {
      freshness: 'aging',
      freshnessLabel: freshnessLabel('aging'),
      freshnessDetail: `${count} 个数据域已超过 48 小时，建议复核`,
    }
  }
  if (items.some(item => item.freshness === 'unknown')) {
    return {
      freshness: 'unknown',
      freshnessLabel: freshnessLabel('unknown'),
      freshnessDetail: '部分数据域没有可验证观察时间',
    }
  }
  return {
    freshness: 'fresh',
    freshnessLabel: freshnessLabel('fresh'),
    freshnessDetail: '全部数据域均在 48 小时内观测',
  }
}

export function buildQuantDataHealth(input: QuantDataHealthInput): QuantDataHealthSummary {
  const items = [
    buildDailyItem(input),
    buildSelectionItem('value-quality', '价值质量', input.valueSelection, input.valueLoading, input.valueError, input.now),
    buildSelectionItem('shareholder-returns', '股东回报', input.shareholderReturns, input.shareholderLoading, input.shareholderError, input.now),
  ] as const
  const status = summaryStatus(items, input.watchlist.length)
  const freshness = freshnessSummary(items, input.watchlist.length)
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
    ...freshness,
    items,
  }
}
