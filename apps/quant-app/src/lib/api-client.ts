import type {
  CandidateItem,
  CandidateQuality,
  CandidateSnapshot,
  CapabilitiesResponse,
  CapabilityKey,
  DailyBar,
  QuantProviderName,
  SyncResult,
  SyncStatus,
  WatchlistItem,
} from './quant-types'
import { CAPABILITY_ORDER } from './quant-types'

export const QUANT_API_PREFIX = '/api/quant'

type JsonRecord = Record<string, unknown>

export interface AddWatchlistInput {
  tsCode: string
  name?: string
}

export interface DailyBarQuery {
  from?: string
  to?: string
  limit?: number
}

export class QuantApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'QuantApiError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value)
  return null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value)
      return value
  }
  return null
}

function readNumber(record: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value !== null)
      return value
  }
  return null
}

function readBoolean(record: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = asBoolean(record[key])
    if (value !== null)
      return value
  }
  return null
}

function unwrapData(payload: unknown, allowErrorPayload = false): unknown {
  if (!isRecord(payload))
    return payload
  if (payload.success === false && !allowErrorPayload)
    throw new QuantApiError(readString(payload, 'error', 'message') || '量化接口返回失败', 422, readString(payload, 'code'))
  return 'data' in payload ? payload.data : payload
}

function readList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload))
    return payload
  if (!isRecord(payload))
    return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value))
      return value
    if (isRecord(value) && Array.isArray(value.items))
      return value.items
  }
  return []
}

function capabilityLabel(key: CapabilityKey): string {
  const labels: Record<CapabilityKey, string> = {
    daily: '日线 daily',
    stock_basic: '股票基础 stock_basic',
    trade_cal: '交易日历 trade_cal',
    daily_basic: '估值基础 daily_basic',
  }
  return labels[key]
}

function defaultCapabilityReason(key: CapabilityKey, tier: number | null): string {
  if (key === 'daily' && tier !== null)
    return '当前 v1 日线能力已开放'
  if (tier === null)
    return `当前积分档位未配置，${key} 未启用`
  return `当前积分档位 ${tier} 仅开放 daily，${key} 仍未启用`
}

function capabilityReason(key: CapabilityKey, tier: number | null, value: string | null): string {
  if (value === 'enabled')
    return key === 'daily' ? '当前 v1 日线能力已开放' : '当前能力已开放'
  if (value === 'requires_points_tier_2000')
    return `需要 2000 积分，当前 ${tier ?? '未知'} 积分档位未启用`
  if (value === 'invalid_points_tier')
    return '积分档位配置无效，能力已关闭'
  return value || defaultCapabilityReason(key, tier)
}

function findCapability(raw: unknown, key: CapabilityKey): JsonRecord | null {
  if (Array.isArray(raw)) {
    const item = raw.find((value) => {
      if (!isRecord(value))
        return false
      return readString(value, 'key', 'name', 'capability', 'apiName', 'api_name') === key
    })
    return isRecord(item) ? item : null
  }
  if (isRecord(raw) && isRecord(raw[key]))
    return raw[key]
  return null
}

function parseCapabilities(payload: unknown): CapabilitiesResponse {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const tier = readNumber(record, 'tier', 'pointsTier', 'points_tier')
  const providerValue = readString(record, 'provider', 'dataProvider', 'data_provider')
  const provider: QuantProviderName | null = providerValue === 'tushare' || providerValue === 'eastmoney' ? providerValue : null
  const enabledValues = Array.isArray(record.enabled) ? record.enabled : []
  const enabled = CAPABILITY_ORDER.filter(key => enabledValues.includes(key))
  const rawCapabilities = record.capabilities
  const capabilities = CAPABILITY_ORDER.map((key) => {
    const item = findCapability(rawCapabilities, key)
    const itemEnabled = item ? readBoolean(item, 'enabled', 'available') : null
    const isEnabled = itemEnabled ?? enabled.includes(key)
    if (isEnabled && !enabled.includes(key))
      enabled.push(key)
    return {
      key,
      label: capabilityLabel(key),
      enabled: isEnabled,
      reason: capabilityReason(key, tier, readString(item ?? {}, 'reason', 'disabledReason', 'disabled_reason')),
      requires: item && Array.isArray(item.requires) ? item.requires.filter((value): value is string => typeof value === 'string') : undefined,
    }
  })
  return { tier, provider, enabled, capabilities }
}

function parseWatchlist(payload: unknown): WatchlistItem[] {
  const data = unwrapData(payload)
  if (isRecord(data)) {
    const item = parseWatchlistItem(data, 0)
    return item ? [item] : []
  }
  return readList(data, 'items', 'watchlist', 'rows').flatMap((value, index) => {
    return isRecord(value) ? [parseWatchlistItem(value, index)].filter((item): item is WatchlistItem => item !== null) : []
  })
}

function parseWatchlistItem(value: JsonRecord, index: number): WatchlistItem | null {
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  return {
    id: readString(value, 'id') || tsCode || `watch-${index}`,
    tsCode,
    name: readString(value, 'name', 'stockName', 'stock_name'),
    latestTradeDate: readString(value, 'latestTradeDate', 'latest_trade_date', 'tradeDate', 'trade_date'),
    barCount: readNumber(value, 'barCount', 'bar_count', 'dailyBarCount', 'daily_bar_count') ?? 0,
    latestClose: readNumber(value, 'latestClose', 'latest_close', 'close'),
    latestChangePercent: readNumber(value, 'latestChangePercent', 'latest_change_percent', 'pctChg', 'pct_chg'),
    createdAt: readString(value, 'createdAt', 'created_at'),
  }
}

function parseSyncResult(payload: unknown): SyncResult {
  const data = unwrapData(payload, true)
  const record = isRecord(data) ? data : {}
  const status = readString(record, 'status')
  const normalizedStatus: SyncStatus = status === 'completed' || status === 'partial' || status === 'rejected' ? status : 'rejected'
  const requestedCount = readNumber(record, 'requestedCount', 'requested_count', 'requested') ?? 0
  const writtenCount = readNumber(record, 'writtenCount', 'written_count', 'written') ?? 0
  const skippedCount = readNumber(record, 'skippedCount', 'skipped_count', 'skipped') ?? 0
  return {
    status: normalizedStatus,
    requestedCount,
    writtenCount,
    skippedCount,
    requested: requestedCount,
    processed: readNumber(record, 'processed', 'processedCount', 'processed_count') ?? 0,
    written: writtenCount,
    skipped: skippedCount,
    reason: readString(record, 'reason', 'message', 'error'),
    snapshotId: readString(record, 'snapshotId', 'snapshot_id'),
    startedAt: readString(record, 'startedAt', 'started_at'),
    completedAt: readString(record, 'completedAt', 'completed_at'),
  }
}

function parseCandidate(value: unknown, index: number): CandidateItem | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  const factors = isRecord(value.factors) ? value.factors : value
  const quality = readString(value, 'dataQuality', 'data_quality', 'quality')
  const normalizedQuality: CandidateQuality = quality === 'ready' || quality === 'partial' || quality === 'insufficient' || quality === 'insufficient_data' ? quality : 'partial'
  const rawSignals = Array.isArray(value.matchedFactors)
    ? value.matchedFactors
    : Array.isArray(value.signals)
      ? value.signals
      : []
  const rawMissingFactors = Array.isArray(value.missingFactors) ? value.missingFactors : []
  return {
    id: readString(value, 'id') || tsCode || `candidate-${index}`,
    tsCode,
    factorVersion: readString(value, 'factorVersion', 'factor_version'),
    name: readString(value, 'name', 'stockName', 'stock_name'),
    score: readNumber(value, 'score', 'factorScore', 'factor_score'),
    close: readNumber(value, 'close', 'closePrice', 'close_price'),
    changePercent: readNumber(value, 'changePercent', 'change_percent', 'pctChange', 'pct_chg'),
    ma5: readNumber(factors, 'ma5', 'ma_5') ?? readNumber(value, 'ma5', 'ma_5'),
    ma20: readNumber(factors, 'ma20', 'ma_20') ?? readNumber(value, 'ma20', 'ma_20'),
    return20: readNumber(factors, 'return20', 'return_20') ?? readNumber(value, 'return20', 'return_20'),
    newHigh20: readBoolean(factors, 'isNewHigh20', 'newHigh20', 'new_high_20') ?? readBoolean(value, 'isNewHigh20', 'newHigh20', 'new_high_20'),
    upStreak: readNumber(factors, 'consecutiveUpDays', 'upStreak', 'up_streak', 'continuation') ?? readNumber(value, 'consecutiveUpDays', 'upStreak', 'up_streak', 'continuation'),
    volumeRatio: readNumber(factors, 'volumeRatio', 'volume_ratio') ?? readNumber(value, 'volumeRatio', 'volume_ratio'),
    relativeStrength: readNumber(factors, 'relativeStrength', 'relative_strength') ?? readNumber(value, 'relativeStrength', 'relative_strength'),
    signals: rawSignals.filter((signal): signal is string => typeof signal === 'string'),
    missingFactors: rawMissingFactors.filter((factor): factor is string => typeof factor === 'string'),
    quality: normalizedQuality,
  }
}

function parseSnapshot(payload: unknown): CandidateSnapshot {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const rawCandidates = readList(record, 'candidates', 'items', 'results')
  return {
    id: readString(record, 'id', 'snapshotId', 'snapshot_id') || 'latest',
    factorVersion: readString(record, 'factorVersion', 'factor_version', 'version') || 'momentum-v1',
    generatedAt: readString(record, 'generatedAt', 'generated_at', 'createdAt', 'created_at'),
    fromDate: readString(record, 'fromDate', 'from_date', 'startDate', 'start_date'),
    toDate: readString(record, 'toDate', 'to_date', 'endDate', 'end_date'),
    candidates: rawCandidates.flatMap((value, index) => {
      const item = parseCandidate(value, index)
      return item ? [item] : []
    }),
  }
}

function parseDailyBar(value: unknown, index: number): DailyBar | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code') || ''
  const tradeDate = readString(value, 'tradeDate', 'trade_date', 'date')
  if (!tradeDate)
    return null
  return {
    id: readString(value, 'id') || `${tsCode}-${tradeDate}-${index}`,
    tsCode,
    tradeDate,
    open: readNumber(value, 'open'),
    high: readNumber(value, 'high'),
    low: readNumber(value, 'low'),
    close: readNumber(value, 'close'),
    preClose: readNumber(value, 'preClose', 'pre_close'),
    change: readNumber(value, 'change'),
    changePercent: readNumber(value, 'changePercent', 'change_percent', 'pctChange', 'pct_chg'),
    volume: readNumber(value, 'volume', 'vol'),
    amount: readNumber(value, 'amount'),
  }
}

function parseDailyBars(payload: unknown): DailyBar[] {
  const data = unwrapData(payload)
  return readList(data, 'bars', 'items', 'rows', 'daily').flatMap((value, index) => {
    const item = parseDailyBar(value, index)
    return item ? [item] : []
  })
}

async function requestJson(path: string, init?: RequestInit, options: { readonly allowErrorResponse?: boolean } = {}): Promise<unknown> {
  const response = await fetch(`${QUANT_API_PREFIX}${path}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })
  let payload: unknown = null
  try {
    payload = await response.json() as unknown
  }
  catch {
    payload = null
  }
  if (!response.ok && !options.allowErrorResponse) {
    const record = isRecord(payload) ? payload : {}
    throw new QuantApiError(
      readString(record, 'error', 'message') || `量化接口请求失败（${response.status}）`,
      response.status,
      readString(record, 'code'),
    )
  }
  return payload
}

function queryString(query: DailyBarQuery): string {
  const params = new URLSearchParams()
  if (query.from)
    params.set('from', query.from)
  if (query.to)
    params.set('to', query.to)
  if (query.limit !== undefined)
    params.set('limit', String(query.limit))
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const quantApi = {
  async getCapabilities(): Promise<CapabilitiesResponse> {
    return parseCapabilities(await requestJson('/capabilities'))
  },

  async getWatchlist(): Promise<WatchlistItem[]> {
    return parseWatchlist(await requestJson('/watchlist'))
  },

  async addWatchlist(input: AddWatchlistInput): Promise<WatchlistItem | null> {
    const payload = await requestJson('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ ts_code: input.tsCode, name: input.name || undefined }),
    })
    const items = parseWatchlist(payload)
    return items[0] || null
  },

  async removeWatchlist(tsCode: string): Promise<void> {
    await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, { method: 'DELETE' })
  },

  async syncDaily(): Promise<SyncResult> {
    return parseSyncResult(await requestJson('/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    }, { allowErrorResponse: true }))
  },

  async getCandidates(): Promise<CandidateSnapshot> {
    return parseSnapshot(await requestJson('/candidates'))
  },

  async getDailyBars(tsCode: string, query: DailyBarQuery = {}): Promise<DailyBar[]> {
    return parseDailyBars(await requestJson(`/daily/${encodeURIComponent(tsCode)}${queryString(query)}`))
  },
}
