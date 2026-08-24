import type { DailyBar } from './types'
import * as v from 'valibot'
import { QuantError } from './errors'

export const QUANT_PROVIDER_NAMES = ['tushare', 'eastmoney'] as const
export type QuantProviderName = typeof QUANT_PROVIDER_NAMES[number]

export const TUSHARE_API_NAMES = ['daily'] as const
export type TushareApiName = typeof TUSHARE_API_NAMES[number]

export const TUSHARE_DAILY_FIELDS = [
  'ts_code',
  'trade_date',
  'open',
  'high',
  'low',
  'close',
  'pre_close',
  'change',
  'pct_chg',
  'vol',
  'amount',
] as const

export type TushareProviderErrorCode
  = | 'UNKNOWN_API'
    | 'TOKEN_MISSING'
    | 'TIMEOUT'
    | 'QUOTA_EXHAUSTED'
    | 'UPSTREAM_ERROR'
    | 'INVALID_RESPONSE'

export class TushareProviderError extends Error {
  readonly code: TushareProviderErrorCode
  readonly apiName?: string

  constructor(code: TushareProviderErrorCode, message: string, apiName?: string) {
    super(message)
    this.name = 'TushareProviderError'
    this.code = code
    this.apiName = apiName
  }
}

export interface TushareProviderOptions {
  readonly token?: string | null
  readonly baseUrl?: string
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export interface TushareRequest {
  readonly apiName: string
  readonly params: Readonly<Record<string, string>>
}

export interface TushareDailyRequest {
  readonly tsCode: string
  readonly startDate: string
  readonly endDate: string
}

export interface QuantDataProvider {
  readonly name?: QuantProviderName
  readonly isConfigured: boolean
  fetchDaily: (request: TushareDailyRequest) => Promise<readonly DailyBar[]>
}

export interface TushareProvider extends QuantDataProvider {
  request: (request: TushareRequest) => Promise<readonly DailyBar[]>
}

const TushareResponseSchema = v.object({
  code: v.number(),
  msg: v.optional(v.nullable(v.string())),
  data: v.optional(v.nullable(v.object({
    fields: v.array(v.string()),
    items: v.array(v.array(v.unknown())),
  }))),
})

function normalizeDate(value: string, field: string): string {
  if (!/^\d{8}$/u.test(value))
    throw new TushareProviderError('UPSTREAM_ERROR', `Invalid ${field}`)
  return value
}

function requiredNumber(value: unknown, field: string): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric))
    throw new TushareProviderError('INVALID_RESPONSE', `Invalid daily field: ${field}`, 'daily')
  return numeric
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '')
    return null
  return requiredNumber(value, field)
}

function normalizeDailyRows(fields: readonly string[], items: readonly (readonly unknown[])[]): readonly DailyBar[] {
  const positions = new Map(fields.map((field, index) => [field, index]))
  for (const field of ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol']) {
    if (!positions.has(field))
      throw new TushareProviderError('INVALID_RESPONSE', `Missing daily field: ${field}`, 'daily')
  }

  const read = (row: readonly unknown[], field: string): unknown => row[positions.get(field) ?? -1]
  const rows = items.map((row) => {
    const tsCode = read(row, 'ts_code')
    const tradeDate = read(row, 'trade_date')
    if (typeof tsCode !== 'string' || tsCode.trim() === '')
      throw new TushareProviderError('INVALID_RESPONSE', 'Invalid daily ts_code', 'daily')
    if (typeof tradeDate !== 'string')
      throw new TushareProviderError('INVALID_RESPONSE', 'Invalid daily trade_date', 'daily')

    return {
      tsCode: tsCode.trim().toUpperCase(),
      tradeDate: normalizeDate(tradeDate, 'trade_date'),
      open: requiredNumber(read(row, 'open'), 'open'),
      high: requiredNumber(read(row, 'high'), 'high'),
      low: requiredNumber(read(row, 'low'), 'low'),
      close: requiredNumber(read(row, 'close'), 'close'),
      preClose: optionalNumber(read(row, 'pre_close'), 'pre_close'),
      change: optionalNumber(read(row, 'change'), 'change'),
      pctChg: optionalNumber(read(row, 'pct_chg'), 'pct_chg'),
      volume: requiredNumber(read(row, 'vol'), 'vol'),
      amount: optionalNumber(read(row, 'amount'), 'amount'),
    } satisfies DailyBar
  })

  const deduplicated = new Map(rows.map(row => [`${row.tsCode}:${row.tradeDate}`, row]))
  return [...deduplicated.values()].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
}

function isQuotaResponse(code: number, message: string): boolean {
  return code === 402 || /quota|point|积分|配额/iu.test(message)
}

export function createTushareProvider(options: TushareProviderOptions = {}): TushareProvider {
  const token = options.token?.trim() || null
  const baseUrl = options.baseUrl?.trim() || 'https://api.tushare.pro'
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? options.timeoutMs! : 10000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function fetchDaily(request: TushareDailyRequest): Promise<readonly DailyBar[]> {
    if (!token)
      throw new TushareProviderError('TOKEN_MISSING', 'Tushare token is not configured', 'daily')

    const tsCode = request.tsCode.trim().toUpperCase()
    if (!/^[A-Z0-9.-]{1,20}$/u.test(tsCode))
      throw new TushareProviderError('UPSTREAM_ERROR', 'Invalid ts_code', 'daily')
    const startDate = normalizeDate(request.startDate, 'start_date')
    const endDate = normalizeDate(request.endDate, 'end_date')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetchImpl(baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_name: 'daily',
          token,
          params: { ts_code: tsCode, start_date: startDate, end_date: endDate },
          fields: TUSHARE_DAILY_FIELDS.join(','),
        }),
        signal: controller.signal,
      })
    }
    catch (error) {
      if (controller.signal.aborted)
        throw new TushareProviderError('TIMEOUT', 'Tushare request timed out', 'daily')
      throw new TushareProviderError('UPSTREAM_ERROR', error instanceof Error ? 'Tushare request failed' : 'Tushare request failed', 'daily')
    }
    finally {
      clearTimeout(timer)
    }

    if (response.status === 429)
      throw new TushareProviderError('QUOTA_EXHAUSTED', 'Tushare quota exhausted', 'daily')
    if (!response.ok)
      throw new TushareProviderError('UPSTREAM_ERROR', `Tushare HTTP ${response.status}`, 'daily')

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new TushareProviderError('INVALID_RESPONSE', 'Tushare response is not JSON', 'daily')
    }

    const parsed = v.safeParse(TushareResponseSchema, payload)
    if (!parsed.success)
      throw new TushareProviderError('INVALID_RESPONSE', 'Tushare response schema is invalid', 'daily')

    const message = parsed.output.msg ?? ''
    if (parsed.output.code !== 0) {
      if (isQuotaResponse(parsed.output.code, message))
        throw new TushareProviderError('QUOTA_EXHAUSTED', 'Tushare quota exhausted', 'daily')
      throw new TushareProviderError('UPSTREAM_ERROR', 'Tushare rejected the request', 'daily')
    }

    if (!parsed.output.data)
      return []
    return normalizeDailyRows(parsed.output.data.fields, parsed.output.data.items)
  }

  async function request(request: TushareRequest): Promise<readonly DailyBar[]> {
    if (!TUSHARE_API_NAMES.includes(request.apiName as TushareApiName))
      throw new TushareProviderError('UNKNOWN_API', `Unsupported Tushare api_name: ${request.apiName}`, request.apiName)
    return fetchDaily({
      tsCode: request.params.ts_code ?? '',
      startDate: request.params.start_date ?? '',
      endDate: request.params.end_date ?? '',
    })
  }

  return {
    name: 'tushare',
    isConfigured: token !== null,
    request,
    fetchDaily,
  }
}

export type EastmoneyProviderErrorCode = 'TIMEOUT' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE'

export class EastmoneyProviderError extends Error {
  readonly code: EastmoneyProviderErrorCode

  constructor(code: EastmoneyProviderErrorCode, message: string) {
    super(message)
    this.name = 'EastmoneyProviderError'
    this.code = code
  }
}

export interface EastmoneyProviderOptions {
  readonly baseUrl?: string
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const EastmoneyResponseSchema = v.object({
  rc: v.number(),
  data: v.optional(v.nullable(v.object({
    code: v.string(),
    market: v.number(),
    klines: v.optional(v.array(v.string())),
  }))),
})

function eastmoneyMarket(tsCode: string): string {
  const [code, market] = tsCode.trim().toUpperCase().split('.')
  if (!code || !market || !/^\d{6}$/u.test(code) || !['SH', 'SZ', 'BJ'].includes(market))
    throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney only supports SH, SZ, and BJ stock codes')
  return `${market === 'SH' ? '1' : '0'}.${code}`
}

function eastmoneyNumber(value: string | undefined, field: string): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric))
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney daily field: ${field}`)
  return numeric
}

function normalizeEastmoneyRows(tsCode: string, rows: readonly string[]): readonly DailyBar[] {
  const normalized = rows.map((row) => {
    const [rawDate, rawOpen, rawClose, rawHigh, rawLow, rawVolume, rawAmount, , rawPctChg, rawChange] = row.split(',')
    const tradeDate = rawDate?.replaceAll('-', '')
    if (!tradeDate || !/^\d{8}$/u.test(tradeDate))
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Invalid Eastmoney trade date')

    const change = rawChange ? eastmoneyNumber(rawChange, 'change') : null
    const close = eastmoneyNumber(rawClose, 'close')
    return {
      tsCode: tsCode.trim().toUpperCase(),
      tradeDate,
      open: eastmoneyNumber(rawOpen, 'open'),
      high: eastmoneyNumber(rawHigh, 'high'),
      low: eastmoneyNumber(rawLow, 'low'),
      close,
      preClose: change === null ? null : close - change,
      change,
      pctChg: rawPctChg ? eastmoneyNumber(rawPctChg, 'pct_chg') : null,
      volume: eastmoneyNumber(rawVolume, 'volume'),
      amount: rawAmount ? eastmoneyNumber(rawAmount, 'amount') : null,
    } satisfies DailyBar
  })

  return [...new Map(normalized.map(row => [`${row.tsCode}:${row.tradeDate}`, row])).values()]
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
}

export function createEastmoneyProvider(options: EastmoneyProviderOptions = {}): QuantDataProvider {
  const baseUrl = options.baseUrl?.trim() || 'https://push2his.eastmoney.com'
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? options.timeoutMs! : 10000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function fetchDaily(request: TushareDailyRequest): Promise<readonly DailyBar[]> {
    const startDate = normalizeDate(request.startDate, 'start_date')
    const endDate = normalizeDate(request.endDate, 'end_date')
    const url = new URL('/api/qt/stock/kline/get', baseUrl)
    url.searchParams.set('secid', eastmoneyMarket(request.tsCode))
    url.searchParams.set('klt', '101')
    url.searchParams.set('fqt', '1')
    url.searchParams.set('beg', startDate)
    url.searchParams.set('end', endDate)
    url.searchParams.set('lmt', '120')
    url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
    url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal })
    }
    catch {
      if (controller.signal.aborted)
        throw new EastmoneyProviderError('TIMEOUT', 'Eastmoney request timed out')
      throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney request failed')
    }
    finally {
      clearTimeout(timer)
    }

    if (!response.ok)
      throw new EastmoneyProviderError('UPSTREAM_ERROR', `Eastmoney HTTP ${response.status}`)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney response is not JSON')
    }

    const parsed = v.safeParse(EastmoneyResponseSchema, payload)
    if (!parsed.success || parsed.output.rc !== 0)
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney response schema is invalid')

    return normalizeEastmoneyRows(request.tsCode, parsed.output.data?.klines ?? [])
  }

  return {
    name: 'eastmoney',
    isConfigured: true,
    fetchDaily,
  }
}

function envString(env: unknown, key: string): string | undefined {
  if (!env || typeof env !== 'object')
    return undefined
  const value = (env as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveQuantProviderName(env: unknown): QuantProviderName | null {
  const configured = envString(env, 'QUANT_DATA_PROVIDER')?.toLowerCase()
  if (configured)
    return QUANT_PROVIDER_NAMES.includes(configured as QuantProviderName) ? configured as QuantProviderName : null
  return envString(env, 'TUSHARE_TOKEN') ? 'tushare' : 'eastmoney'
}

export function mapQuantProviderError(error: unknown): QuantError {
  if (error instanceof TushareProviderError) {
    switch (error.code) {
      case 'TOKEN_MISSING':
        return new QuantError('QUANT_PROVIDER_CONFIGURATION', 'Tushare provider is not configured', 503)
      case 'UNKNOWN_API':
        return new QuantError('QUANT_PROVIDER_UNKNOWN_API', 'Tushare api_name is not registered', 400)
      case 'TIMEOUT':
        return new QuantError('QUANT_PROVIDER_TIMEOUT', 'Tushare request timed out', 504)
      case 'QUOTA_EXHAUSTED':
        return new QuantError('QUANT_PROVIDER_QUOTA', 'Tushare quota exhausted', 429)
      case 'INVALID_RESPONSE':
        return new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Tushare response is invalid', 502)
      default:
        return new QuantError('QUANT_PROVIDER_UPSTREAM', 'Tushare provider failed', 502)
    }
  }

  if (error instanceof EastmoneyProviderError) {
    return new QuantError(
      error.code === 'TIMEOUT' ? 'QUANT_PROVIDER_TIMEOUT' : error.code === 'INVALID_RESPONSE' ? 'QUANT_PROVIDER_INVALID_RESPONSE' : 'QUANT_PROVIDER_UPSTREAM',
      `Eastmoney provider ${error.code === 'TIMEOUT' ? 'timed out' : 'failed'}`,
      error.code === 'TIMEOUT' ? 504 : 502,
    )
  }

  return new QuantError('QUANT_PROVIDER_UPSTREAM', 'Quant data provider failed', 502)
}

export function mapTushareProviderError(error: unknown): QuantError {
  return mapQuantProviderError(error)
}
