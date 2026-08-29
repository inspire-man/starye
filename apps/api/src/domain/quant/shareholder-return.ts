import type { Database } from '@starye/db'
import type { QuantDividendProvider, QuantDividendRecord, QuantProviderName } from './provider'
import type { DailyBar } from './types'
import { mapQuantProviderError, QuantDividendProviderChainError } from './provider'
import { getQuantWatchlistItem, listQuantDailyBars, listQuantWatchlist } from './repository'

export const QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION = 'shareholder-return-v1' as const
export const QUANT_SHAREHOLDER_RETURN_CONCURRENCY = 4

export type ShareholderReturnStatus = 'ready' | 'partial' | 'insufficient_data'

export interface QuantShareholderReturnDistribution {
  readonly endDate: string
  readonly annDate: string | null
  readonly cashDividendPerShare: number
  readonly exDate: string | null
  readonly payDate: string | null
}

export interface QuantShareholderReturnItem {
  readonly tsCode: string
  readonly name: string | null
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION
  readonly status: ShareholderReturnStatus
  readonly provider: QuantProviderName | null
  readonly providerChain: readonly QuantProviderName[]
  readonly fallbackUsed: boolean
  readonly fallbackReason: string | null
  readonly providerErrorCode: string | null
  readonly observedAt: string
  readonly latestClose: number | null
  readonly trailingCashDividendPerShare: number | null
  readonly trailingDividendYield: number | null
  readonly dividendYears: number
  readonly distributions: readonly QuantShareholderReturnDistribution[]
  readonly missingFields: readonly string[]
}

export interface QuantShareholderReturnBatchResult {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION
  readonly observedAt: string
  readonly provider: QuantProviderName | null
  readonly providerChain: readonly QuantProviderName[]
  readonly sampleCount: number
  readonly readyCount: number
  readonly partialCount: number
  readonly insufficientCount: number
  readonly items: readonly QuantShareholderReturnItem[]
}

export interface ShareholderReturnInput {
  readonly tsCode: string
  readonly name: string | null
  readonly dividends: readonly QuantDividendRecord[]
  readonly dailyBars: readonly DailyBar[]
  readonly dividendErrorCode: string | null
  readonly dividendProvider?: QuantProviderName | null
  readonly providerChain?: readonly QuantProviderName[]
  readonly fallbackUsed?: boolean
  readonly fallbackReason?: string | null
  readonly observedAt: string
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function latestClose(bars: readonly DailyBar[]): number | null {
  const sorted = [...bars]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  return finite(sorted.at(-1)?.close)
}

function effectiveDate(record: QuantDividendRecord): string | null {
  return record.payDate ?? record.exDate
}

function dateValue(value: string): number | null {
  const normalized = value.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value
  const timestamp = Date.parse(`${normalized}T00:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function implementedDistributions(records: readonly QuantDividendRecord[]): readonly QuantDividendRecord[] {
  return records
    .filter(record => record.divProc === '实施' && (record.cashDiv ?? 0) > 0 && effectiveDate(record) !== null)
    .sort((left, right) => (dateValue(effectiveDate(right)!) ?? 0) - (dateValue(effectiveDate(left)!) ?? 0))
}

function buildDistributions(records: readonly QuantDividendRecord[]): readonly QuantShareholderReturnDistribution[] {
  return records.slice(0, 12).map(record => ({
    endDate: record.endDate,
    annDate: record.annDate,
    cashDividendPerShare: record.cashDiv!,
    exDate: record.exDate,
    payDate: record.payDate,
  }))
}

export function buildShareholderReturnResult(input: ShareholderReturnInput): QuantShareholderReturnItem {
  const now = Date.parse(input.observedAt)
  const cutoff = Number.isFinite(now) ? now - 365 * 24 * 60 * 60 * 1000 : null
  const implemented = implementedDistributions(input.dividends)
  const trailing = implemented.filter((record) => {
    const date = effectiveDate(record)
    const timestamp = date ? dateValue(date) : null
    return timestamp !== null && cutoff !== null && timestamp > cutoff && timestamp <= now
  })
  const close = latestClose(input.dailyBars)
  const trailingCashDividendPerShare = trailing.length > 0
    ? round(trailing.reduce((total, record) => total + (record.cashDiv ?? 0), 0))
    : null
  const trailingDividendYield = trailingCashDividendPerShare !== null && close !== null && close > 0
    ? round(trailingCashDividendPerShare / close * 100, 2)
    : null
  const currentYear = Number.parseInt(input.observedAt.slice(0, 4), 10)
  const dividendYears = new Set(
    implemented
      .map(record => Number.parseInt(record.endDate.slice(0, 4), 10))
      .filter(year => Number.isFinite(year) && year >= currentYear - 4 && year <= currentYear),
  ).size
  const missingFields: string[] = []

  if (input.dividendErrorCode)
    missingFields.push(`分红数据暂不可用（${input.dividendErrorCode}）`)
  if (!implemented.length)
    missingFields.push('已实施现金分红记录')
  if (!trailing.length)
    missingFields.push('近 12 个月已实施现金分红')
  if (close === null)
    missingFields.push('观察池最新正收盘价')

  const status: ShareholderReturnStatus = input.dividendErrorCode
    ? 'partial'
    : trailingDividendYield !== null
      ? 'ready'
      : implemented.length || close !== null
        ? 'partial'
        : 'insufficient_data'

  return {
    tsCode: input.tsCode,
    name: input.name,
    formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
    status,
    provider: input.dividendProvider ?? null,
    providerChain: input.providerChain ?? (input.dividendProvider ? [input.dividendProvider] : []),
    fallbackUsed: input.fallbackUsed ?? false,
    fallbackReason: input.fallbackReason ?? null,
    providerErrorCode: input.dividendErrorCode,
    observedAt: input.observedAt,
    latestClose: close,
    trailingCashDividendPerShare,
    trailingDividendYield,
    dividendYears,
    distributions: buildDistributions(implemented),
    missingFields: [...new Set(missingFields)],
  }
}

function providerErrorCode(error: unknown): string {
  if (error instanceof QuantDividendProviderChainError) {
    const primary = mapQuantProviderError(error.primaryError).code
    const fallback = error.fallbackError ? mapQuantProviderError(error.fallbackError).code : 'QUANT_PROVIDER_CONFIGURATION'
    return `${primary}|${fallback}`
  }
  return mapQuantProviderError(error).code
}

async function readShareholderReturnInput(
  item: { readonly tsCode: string, readonly name: string | null },
  dailyBars: readonly DailyBar[],
  provider: QuantDividendProvider,
  observedAt: string,
): Promise<ShareholderReturnInput> {
  let dividends: readonly QuantDividendRecord[] = []
  let dividendErrorCode: string | null = null
  let dividendProvider: QuantProviderName | null = provider.isConfigured ? provider.name : null
  let fallbackUsed = false
  let fallbackReason: string | null = null
  if (provider.isConfigured) {
    try {
      const result = await provider.fetchDividends({ tsCode: item.tsCode })
      dividends = result.records
      dividendProvider = result.provider
      fallbackUsed = result.fallbackUsed
      fallbackReason = result.fallbackReason
    }
    catch (error) {
      dividendErrorCode = providerErrorCode(error)
      dividendProvider = null
    }
  }
  else {
    dividendErrorCode = 'QUANT_PROVIDER_CONFIGURATION'
  }
  return {
    tsCode: item.tsCode,
    name: item.name,
    dividends,
    dailyBars,
    dividendErrorCode,
    dividendProvider,
    providerChain: provider.providerChain,
    fallbackUsed,
    fallbackReason,
    observedAt,
  }
}

export async function readQuantShareholderReturn(
  db: Database,
  userId: string,
  tsCode: string,
  provider: QuantDividendProvider,
  now: () => Date = () => new Date(),
): Promise<QuantShareholderReturnItem | null> {
  const item = await getQuantWatchlistItem(db, userId, tsCode)
  if (!item)
    return null
  const observedAt = now().toISOString()
  const dailyBars = await listQuantDailyBars(db, { tsCode: item.tsCode })
  return buildShareholderReturnResult(await readShareholderReturnInput(item, dailyBars, provider, observedAt))
}

export async function readQuantShareholderReturns(
  db: Database,
  userId: string,
  provider: QuantDividendProvider,
  now: () => Date = () => new Date(),
): Promise<QuantShareholderReturnBatchResult> {
  const observedAt = now().toISOString()
  const watchlist = await listQuantWatchlist(db, userId)
  if (watchlist.length === 0) {
    return {
      formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
      observedAt,
      provider: provider.isConfigured ? provider.name : null,
      providerChain: provider.providerChain,
      sampleCount: 0,
      readyCount: 0,
      partialCount: 0,
      insufficientCount: 0,
      items: [],
    }
  }

  const dailyBars = await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const))
  const barsByCode = new Map(dailyBars)
  const inputs: Array<ShareholderReturnInput | undefined> = Array.from({ length: watchlist.length })
  let nextIndex = 0
  const workerCount = Math.min(QUANT_SHAREHOLDER_RETURN_CONCURRENCY, watchlist.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < watchlist.length) {
      const index = nextIndex++
      const item = watchlist[index]!
      inputs[index] = await readShareholderReturnInput(item, barsByCode.get(item.tsCode) ?? [], provider, observedAt)
    }
  }))

  const items = inputs
    .filter((input): input is ShareholderReturnInput => input !== undefined)
    .map(buildShareholderReturnResult)
  return {
    formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
    observedAt,
    provider: provider.isConfigured ? provider.name : null,
    providerChain: provider.providerChain,
    sampleCount: items.length,
    readyCount: items.filter(item => item.status === 'ready').length,
    partialCount: items.filter(item => item.status === 'partial').length,
    insufficientCount: items.filter(item => item.status === 'insufficient_data').length,
    items,
  }
}
