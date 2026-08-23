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
  readonly now?: () => Date
}

export interface QuantValuationRequest {
  readonly tsCode: string
}

export interface QuantValuationSnapshot {
  readonly tsCode: string
  readonly observedAt: string
  readonly dynamicPe: number | null
  readonly peTtm: number | null
  readonly peStatic: number | null
  readonly pb: number | null
  readonly ps: number | null
  readonly peg: number | null
  readonly marketCap: number | null
}

export interface QuantValuationProvider {
  readonly name: QuantProviderName
  readonly isConfigured: boolean
  fetchValuation: (request: QuantValuationRequest) => Promise<QuantValuationSnapshot>
}

export interface QuantFinancialQualitySnapshot {
  readonly tsCode: string
  readonly observedAt: string
  readonly reportDate: string
  readonly reportType: string | null
  readonly reportDateName: string | null
  readonly noticeDate: string | null
  readonly revenue: number | null
  readonly revenueYoY: number | null
  readonly netProfit: number | null
  readonly netProfitYoY: number | null
  readonly adjustedNetProfit: number | null
  readonly adjustedNetProfitYoY: number | null
  readonly roe: number | null
  readonly grossMargin: number | null
  readonly netMargin: number | null
  readonly debtAssetRatio: number | null
  readonly operatingCashflowToRevenue: number | null
  readonly roic: number | null
}

export interface QuantFinancialQualityProvider {
  readonly name: QuantProviderName
  readonly isConfigured: boolean
  fetchFinancialQuality: (request: QuantValuationRequest) => Promise<QuantFinancialQualitySnapshot>
}

const EastmoneyResponseSchema = v.object({
  rc: v.number(),
  data: v.optional(v.nullable(v.object({
    code: v.string(),
    market: v.number(),
    klines: v.optional(v.array(v.string())),
  }))),
})

const EastmoneyQuoteResponseSchema = v.object({
  rc: v.number(),
  data: v.optional(v.nullable(v.unknown())),
})

const EastmoneyFinancialResponseSchema = v.object({
  data: v.array(v.unknown()),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function eastmoneyMarket(tsCode: string): string {
  const [code, market] = tsCode.trim().toUpperCase().split('.')
  if (!code || !market || !/^\d{6}$/u.test(code) || !['SH', 'SZ', 'BJ'].includes(market))
    throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney only supports SH, SZ, and BJ stock codes')
  return `${market === 'SH' ? '1' : '0'}.${code}`
}

function eastmoneyFinancialCode(tsCode: string): string {
  const [code, market] = tsCode.trim().toUpperCase().split('.')
  if (!code || !market || !/^\d{6}$/u.test(code) || !['SH', 'SZ', 'BJ'].includes(market))
    throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney only supports SH, SZ, and BJ stock codes')
  return `${market}${code}`
}

function eastmoneyNumber(value: string | undefined, field: string): number {
  const normalized = value?.trim()
  const numeric = normalized ? Number(normalized) : Number.NaN
  if (!Number.isFinite(numeric))
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney daily field: ${field}`)
  return numeric
}

function eastmoneyQuoteNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined)
    return null
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized || normalized === '-' || normalized === '--')
      return null
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric))
      throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney quote field: ${field}`)
    return numeric
  }
  const numeric = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(numeric))
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney quote field: ${field}`)
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

export function createEastmoneyValuationProvider(options: EastmoneyProviderOptions = {}): QuantValuationProvider {
  const baseUrl = options.baseUrl?.trim() || 'https://push2.eastmoney.com'
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? options.timeoutMs! : 10000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const now = options.now ?? (() => new Date())

  async function fetchValuation(request: QuantValuationRequest): Promise<QuantValuationSnapshot> {
    const tsCode = request.tsCode.trim().toUpperCase()
    const url = new URL('/api/qt/stock/get', baseUrl)
    url.searchParams.set('secid', eastmoneyMarket(tsCode))
    url.searchParams.set('invt', '2')
    url.searchParams.set('fltt', '2')
    url.searchParams.set('fields', 'f57,f162,f163,f164,f165,f166,f167,f168,f116')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal })
    }
    catch {
      if (controller.signal.aborted)
        throw new EastmoneyProviderError('TIMEOUT', 'Eastmoney valuation request timed out')
      throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney valuation request failed')
    }
    finally {
      clearTimeout(timer)
    }

    if (!response.ok)
      throw new EastmoneyProviderError('UPSTREAM_ERROR', `Eastmoney valuation HTTP ${response.status}`)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney valuation response is not JSON')
    }

    const parsed = v.safeParse(EastmoneyQuoteResponseSchema, payload)
    if (!parsed.success || parsed.output.rc !== 0 || !isRecord(parsed.output.data))
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney valuation response schema is invalid')

    const returnedCode = parsed.output.data.f57
    const requestedCode = tsCode.split('.')[0]
    if ((typeof returnedCode !== 'string' && typeof returnedCode !== 'number') || String(returnedCode).padStart(6, '0') !== requestedCode)
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney valuation code is missing')

    return {
      tsCode,
      observedAt: now().toISOString(),
      dynamicPe: eastmoneyQuoteNumber(parsed.output.data.f162, 'dynamicPe'),
      peTtm: eastmoneyQuoteNumber(parsed.output.data.f163, 'peTtm'),
      peStatic: eastmoneyQuoteNumber(parsed.output.data.f164, 'peStatic'),
      pb: eastmoneyQuoteNumber(parsed.output.data.f165, 'pb'),
      ps: eastmoneyQuoteNumber(parsed.output.data.f166, 'ps'),
      peg: eastmoneyQuoteNumber(parsed.output.data.f168, 'peg'),
      marketCap: eastmoneyQuoteNumber(parsed.output.data.f116, 'marketCap'),
    }
  }

  return {
    name: 'eastmoney',
    isConfigured: true,
    fetchValuation,
  }
}

function financialString(record: Record<string, unknown>, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeFinancialDate(value: unknown, field: string, required: boolean): string | null {
  if (value === null || value === undefined || value === '') {
    if (required)
      throw new EastmoneyProviderError('INVALID_RESPONSE', `Eastmoney financial ${field} is missing`)
    return null
  }
  if (typeof value !== 'string')
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney financial ${field}`)

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/u.exec(value.trim())
  if (!match)
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney financial ${field}`)
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`)
    throw new EastmoneyProviderError('INVALID_RESPONSE', `Invalid Eastmoney financial ${field}`)
  return `${match[1]}-${match[2]}-${match[3]}`
}

function normalizeFinancialReport(tsCode: string, record: Record<string, unknown>, observedAt: string): QuantFinancialQualitySnapshot {
  const requestedCode = tsCode.split('.')[0]
  const returnedCode = financialString(record, 'SECURITY_CODE')
  if (!returnedCode || returnedCode.padStart(6, '0') !== requestedCode)
    throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney financial code is missing or mismatched')

  const reportDate = normalizeFinancialDate(record.REPORT_DATE, 'report date', true)
  if (!reportDate)
    throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney financial report date is missing')

  return {
    tsCode,
    observedAt,
    reportDate,
    reportType: financialString(record, 'REPORT_TYPE'),
    reportDateName: financialString(record, 'REPORT_DATE_NAME'),
    noticeDate: normalizeFinancialDate(record.NOTICE_DATE, 'notice date', false),
    revenue: eastmoneyQuoteNumber(record.TOTALOPERATEREVE, 'revenue'),
    revenueYoY: eastmoneyQuoteNumber(record.TOTALOPERATEREVETZ, 'revenueYoY'),
    netProfit: eastmoneyQuoteNumber(record.PARENTNETPROFIT, 'netProfit'),
    netProfitYoY: eastmoneyQuoteNumber(record.PARENTNETPROFITTZ, 'netProfitYoY'),
    adjustedNetProfit: eastmoneyQuoteNumber(record.KCFJCXSYJLR, 'adjustedNetProfit'),
    adjustedNetProfitYoY: eastmoneyQuoteNumber(record.KCFJCXSYJLRTZ, 'adjustedNetProfitYoY'),
    roe: eastmoneyQuoteNumber(record.ROEJQ, 'roe'),
    grossMargin: eastmoneyQuoteNumber(record.XSMLL, 'grossMargin'),
    netMargin: eastmoneyQuoteNumber(record.XSJLL, 'netMargin'),
    debtAssetRatio: eastmoneyQuoteNumber(record.ZCFZL, 'debtAssetRatio'),
    operatingCashflowToRevenue: eastmoneyQuoteNumber(record.JYXJLYYSR, 'operatingCashflowToRevenue'),
    roic: eastmoneyQuoteNumber(record.ROIC, 'roic'),
  }
}

export function createEastmoneyFinancialProvider(options: EastmoneyProviderOptions = {}): QuantFinancialQualityProvider {
  const baseUrl = options.baseUrl?.trim() || 'https://emweb.securities.eastmoney.com'
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? options.timeoutMs! : 10000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const now = options.now ?? (() => new Date())

  async function fetchFinancialQuality(request: QuantValuationRequest): Promise<QuantFinancialQualitySnapshot> {
    const tsCode = request.tsCode.trim().toUpperCase()
    const url = new URL('/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew', baseUrl)
    url.searchParams.set('type', '0')
    url.searchParams.set('code', eastmoneyFinancialCode(tsCode))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal })
    }
    catch {
      if (controller.signal.aborted)
        throw new EastmoneyProviderError('TIMEOUT', 'Eastmoney financial request timed out')
      throw new EastmoneyProviderError('UPSTREAM_ERROR', 'Eastmoney financial request failed')
    }
    finally {
      clearTimeout(timer)
    }

    if (!response.ok)
      throw new EastmoneyProviderError('UPSTREAM_ERROR', `Eastmoney financial HTTP ${response.status}`)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney financial response is not JSON')
    }

    const parsed = v.safeParse(EastmoneyFinancialResponseSchema, payload)
    if (!parsed.success || parsed.output.data.length === 0)
      throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney financial response has no reports')

    const normalizedTsCode = tsCode
    const reportRows = parsed.output.data.map((value) => {
      if (!isRecord(value))
        throw new EastmoneyProviderError('INVALID_RESPONSE', 'Eastmoney financial report is not an object')
      return value
    })
    const reportDates = reportRows.map(record => normalizeFinancialDate(record.REPORT_DATE, 'report date', true))
    const latestIndex = reportDates.reduce((bestIndex, date, index) => date && (!reportDates[bestIndex] || date > reportDates[bestIndex]!) ? index : bestIndex, 0)
    const observedAt = now().toISOString()
    return normalizeFinancialReport(normalizedTsCode, reportRows[latestIndex]!, observedAt)
  }

  return {
    name: 'eastmoney',
    isConfigured: true,
    fetchFinancialQuality,
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
