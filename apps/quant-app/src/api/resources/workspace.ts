import type { DailyBar, QuantStockBasic, SyncResult, SyncStatus, WatchlistItem } from '../../lib/quant-view-models'
import type { QuantRequestOptions } from '../http-client'
import type { AddWatchlistRequestDto, DailyBarQueryDto, UpdateWatchlistNameRequestDto } from '../quant-dtos'
import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readList, readNumber, readString } from '../payload'

export interface AddWatchlistInput {
  tsCode: string
  name?: string
}

export type DailyBarQuery = DailyBarQueryDto

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

function parseWatchlistItem(value: Record<string, unknown>, index: number): WatchlistItem | null {
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

function parseStockBasic(payload: unknown): QuantStockBasic {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('股票名称数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const tsCode = readString(data, 'tsCode', 'ts_code', 'code')
  const name = readString(data, 'name', 'stockName', 'stock_name')
  const observedAt = readString(data, 'observedAt', 'observed_at')
  if (!tsCode || !name || !observedAt)
    throw new QuantApiError('股票名称数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return { tsCode, name, observedAt }
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

function parseSyncState(payload: unknown): SyncResult | null {
  const data = unwrapData(payload)
  return data === null ? null : parseSyncResult(data)
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

function queryString(query: DailyBarQueryDto): string {
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

export const quantWorkspaceApi = {
  async getWatchlist(): Promise<WatchlistItem[]> {
    return parseWatchlist(await requestJson('/watchlist'))
  },

  async getStockBasic(tsCode: string): Promise<QuantStockBasic> {
    return parseStockBasic(await requestJson(`/stock-basic/${encodeURIComponent(tsCode)}`))
  },

  async addWatchlist(input: AddWatchlistInput): Promise<WatchlistItem | null> {
    const body: AddWatchlistRequestDto = { ts_code: input.tsCode, name: input.name || undefined }
    const payload = await requestJson('/watchlist', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const items = parseWatchlist(payload)
    return items[0] || null
  },

  async updateWatchlistName(tsCode: string, name: string): Promise<WatchlistItem | null> {
    const body: UpdateWatchlistNameRequestDto = { name }
    const payload = await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    const items = parseWatchlist(payload)
    return items[0] || null
  },

  async removeWatchlist(tsCode: string): Promise<void> {
    await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, { method: 'DELETE' })
  },

  async getSyncState(options: QuantRequestOptions = {}): Promise<SyncResult | null> {
    return parseSyncState(await requestJson('/sync', options.signal ? { signal: options.signal } : undefined))
  },

  async syncDaily(): Promise<SyncResult> {
    return parseSyncResult(await requestJson('/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    }, { allowErrorResponse: true }))
  },

  async getDailyBars(tsCode: string, query: DailyBarQueryDto = {}): Promise<DailyBar[]> {
    return parseDailyBars(await requestJson(`/daily/${encodeURIComponent(tsCode)}${queryString(query)}`))
  },
}
