import type { Database } from '@starye/db'
import type { QuantDataProvider } from './provider'
import type { DailyBar, QuantSyncInput, QuantSyncResult } from './types'
import { nanoid } from 'nanoid'
import { createQuantCapabilityRegistryFromEnv } from './capabilities'
import { QuantError } from './errors'
import { screenMomentum } from './factor'
import { createEastmoneyProvider, createTushareProvider, mapQuantProviderError, resolveQuantProviderName } from './provider'
import {
  acquireQuantSyncLease,
  createQuantWatchlistItem,
  hasQuantSyncLease,
  listQuantWatchlist,
  normalizeTradeDate,
  readBarsByCode,
  releaseQuantSyncLease,
  saveQuantScanSnapshot,
  saveQuantSyncState,
  upsertQuantDailyBars,
} from './repository'

const DEFAULT_CALENDAR_WINDOW_DAYS = 180
const MAX_DAILY_BARS_PER_CODE = 120
export const QUANT_SYNC_PROVIDER_CONCURRENCY = 4
export const QUANT_SYNC_PROVIDER_TIMEOUT_MS = 10_000
export const QUANT_SYNC_TOTAL_DEADLINE_MS = 120_000
const QUANT_SYNC_DEADLINE_CODE = 'QUANT_SYNC_DEADLINE'

interface QuantEnvironment {
  readonly QUANT_DATA_PROVIDER?: unknown
  readonly TUSHARE_TOKEN?: unknown
  readonly TUSHARE_BASE_URL?: unknown
  readonly TUSHARE_TIMEOUT_MS?: unknown
  readonly EASTMONEY_BASE_URL?: unknown
  readonly EASTMONEY_TIMEOUT_MS?: unknown
}

interface QuantSyncDependencies {
  readonly userId: string
  readonly provider?: QuantDataProvider
  readonly now?: () => Date
  readonly totalDeadlineMs?: number
}

interface TimeoutSignal<T> {
  readonly promise: Promise<T>
  readonly cancel: () => void
}

type ProviderFetchOutcome
  = | { readonly kind: 'success', readonly bars: readonly DailyBar[] }
    | { readonly kind: 'error', readonly code: string }
    | { readonly kind: 'deadline' }

function createTimeoutSignal<T>(milliseconds: number, value: T): TimeoutSignal<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<T>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, milliseconds), value)
  })
  return {
    promise,
    cancel: () => {
      if (timer !== undefined)
        clearTimeout(timer)
    },
  }
}

function createSyncLeaseLostError(): QuantError {
  return new QuantError('QUANT_SYNC_REJECTED', 'Quant sync lease is no longer owned', 409)
}

function resolveTotalDeadlineMs(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : QUANT_SYNC_TOTAL_DEADLINE_MS
}

async function fetchDailyWithDeadlines(
  provider: QuantDataProvider,
  request: Parameters<QuantDataProvider['fetchDaily']>[0],
  totalDeadline: Promise<{ readonly kind: 'deadline' }>,
): Promise<ProviderFetchOutcome> {
  const requestDeadline = createTimeoutSignal<ProviderFetchOutcome>(
    QUANT_SYNC_PROVIDER_TIMEOUT_MS,
    { kind: 'error', code: 'QUANT_PROVIDER_TIMEOUT' },
  )
  const providerResult = Promise.resolve()
    .then(() => provider.fetchDaily(request))
    .then(
      bars => ({ kind: 'success', bars } satisfies ProviderFetchOutcome),
      error => ({ kind: 'error', code: mapQuantProviderError(error).code } satisfies ProviderFetchOutcome),
    )

  try {
    return await Promise.race([providerResult, requestDeadline.promise, totalDeadline])
  }
  finally {
    requestDeadline.cancel()
  }
}

function getString(env: unknown, key: keyof QuantEnvironment): string | undefined {
  if (!env || typeof env !== 'object')
    return undefined
  const value = (env as QuantEnvironment)[key]
  return typeof value === 'string' ? value : undefined
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function resolveDateRange(input: QuantSyncInput, now: Date): { readonly fromDate: string, readonly toDate: string } {
  const toDate = normalizeTradeDate(input.toDate ?? formatDate(now), 'to_date')
  const defaultFrom = new Date(now)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - DEFAULT_CALENDAR_WINDOW_DAYS)
  const fromDate = normalizeTradeDate(input.fromDate ?? formatDate(defaultFrom), 'from_date')
  if (fromDate > toDate)
    throw new QuantError('QUANT_INVALID_INPUT', 'from_date must not be after to_date', 400)
  return { fromDate, toDate }
}

function createProviderFromEnv(env: unknown): QuantDataProvider {
  const providerName = resolveQuantProviderName(env)
  if (!providerName)
    throw new QuantError('QUANT_PROVIDER_CONFIGURATION', 'QUANT_DATA_PROVIDER is not supported', 503)
  const timeoutValue = Number(getString(env, providerName === 'eastmoney' ? 'EASTMONEY_TIMEOUT_MS' : 'TUSHARE_TIMEOUT_MS'))

  if (providerName === 'eastmoney') {
    return createEastmoneyProvider({
      baseUrl: getString(env, 'EASTMONEY_BASE_URL'),
      timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined,
    })
  }

  return createTushareProvider({
    token: getString(env, 'TUSHARE_TOKEN'),
    baseUrl: getString(env, 'TUSHARE_BASE_URL'),
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined,
  })
}

async function persistRejected(
  db: Database,
  userId: string,
  dateRange: { readonly fromDate: string, readonly toDate: string },
  runId: string,
  requestedCount: number,
  startedAt: Date,
  now: () => Date,
  reasonCode: string,
  reason: string,
): Promise<QuantSyncResult> {
  const completedAt = now()
  const saved = await saveQuantSyncState(db, {
    userId,
    status: 'rejected',
    runId,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    requestedCount,
    writtenCount: 0,
    skippedCount: requestedCount,
    reasonCode,
    reason,
    startedAt,
    completedAt,
  })
  if (!saved)
    throw createSyncLeaseLostError()
  return {
    status: 'rejected',
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    requestedCount,
    writtenCount: 0,
    skippedCount: requestedCount,
    reasonCode,
    reason,
    candidates: [],
  }
}

export async function syncQuantDaily(
  db: Database,
  env: unknown,
  input: QuantSyncInput = {},
  dependencies: QuantSyncDependencies,
): Promise<QuantSyncResult> {
  const now = dependencies.now ?? (() => new Date())
  const userId = dependencies.userId
  const startedAt = now()
  const dateRange = resolveDateRange(input, startedAt)
  const watchlist = await listQuantWatchlist(db, userId)
  const watchlistCodes = watchlist.map(item => item.tsCode)
  const requestedCodes = input.tsCodes && input.tsCodes.length > 0
    ? [...new Set(input.tsCodes.map(code => code.trim().toUpperCase()))]
    : watchlistCodes

  if (requestedCodes.length > 50)
    throw new QuantError('QUANT_INVALID_INPUT', 'A sync accepts at most 50 stocks', 400)
  if (requestedCodes.some(code => !watchlistCodes.includes(code)))
    throw new QuantError('QUANT_INVALID_INPUT', 'Sync codes must belong to the watchlist', 400)

  const totalDeadlineMs = resolveTotalDeadlineMs(dependencies.totalDeadlineMs)
  const runId = nanoid()
  const acquired = await acquireQuantSyncLease(db, {
    userId,
    runId,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    requestedCount: requestedCodes.length,
    startedAt,
    leaseDurationMs: totalDeadlineMs,
  })
  if (!acquired)
    throw new QuantError('QUANT_SYNC_IN_PROGRESS', 'Quant daily sync is already running', 409)

  try {
    const registry = createQuantCapabilityRegistryFromEnv(env)
    if (!registry.hasCapability('daily')) {
      return persistRejected(db, userId, dateRange, runId, requestedCodes.length, startedAt, now, 'QUANT_CAPABILITY_DISABLED', 'daily capability is disabled')
    }

    const provider = dependencies.provider ?? createProviderFromEnv(env)
    if (!provider.isConfigured) {
      return persistRejected(db, userId, dateRange, runId, requestedCodes.length, startedAt, now, 'QUANT_PROVIDER_CONFIGURATION', 'Quant data provider is not configured')
    }

    const fetchedByIndex: Array<readonly DailyBar[] | undefined> = []
    const errorsByIndex: Array<string | undefined> = []
    let nextIndex = 0
    let deadlineReached = false
    const totalDeadline = createTimeoutSignal(totalDeadlineMs, { kind: 'deadline' } as const)
    const workerCount = Math.min(QUANT_SYNC_PROVIDER_CONCURRENCY, requestedCodes.length)
    try {
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (!deadlineReached && nextIndex < requestedCodes.length) {
          const index = nextIndex++
          const tsCode = requestedCodes[index]!
          const outcome = await fetchDailyWithDeadlines(provider, {
            tsCode,
            startDate: dateRange.fromDate,
            endDate: dateRange.toDate,
          }, totalDeadline.promise)
          if (outcome.kind === 'deadline') {
            errorsByIndex[index] = QUANT_SYNC_DEADLINE_CODE
            deadlineReached = true
            return
          }
          if (outcome.kind === 'error') {
            errorsByIndex[index] = outcome.code
            continue
          }
          try {
            fetchedByIndex[index] = outcome.bars
              .filter(bar => bar.tradeDate >= dateRange.fromDate && bar.tradeDate <= dateRange.toDate)
              .slice(-MAX_DAILY_BARS_PER_CODE)
          }
          catch (error) {
            errorsByIndex[index] = mapQuantProviderError(error).code
          }
        }
      }))
      if (deadlineReached) {
        for (let index = 0; index < requestedCodes.length; index++) {
          if (fetchedByIndex[index] === undefined && errorsByIndex[index] === undefined)
            errorsByIndex[index] = QUANT_SYNC_DEADLINE_CODE
        }
      }
    }
    finally {
      totalDeadline.cancel()
    }

    // Rebuild both collections in request order after workers finish. This keeps
    // snapshots, error reasons, and write batches deterministic across retries.
    const fetched = new Map<string, readonly DailyBar[]>()
    requestedCodes.forEach((tsCode, index) => {
      const bars = fetchedByIndex[index]
      if (bars !== undefined)
        fetched.set(tsCode, bars)
    })
    const errors = errorsByIndex.filter((code): code is string => code !== undefined)

    if (requestedCodes.length > 0 && fetched.size === 0) {
      return persistRejected(
        db,
        userId,
        dateRange,
        runId,
        requestedCodes.length,
        startedAt,
        now,
        errors[0] ?? 'QUANT_SYNC_REJECTED',
        errors.length > 0 ? [...new Set(errors)].join(',') : 'No daily data returned',
      )
    }

    if (!(await hasQuantSyncLease(db, { userId, runId, now: now() })))
      throw createSyncLeaseLostError()
    const allFetchedBars = [...fetched.values()].flat()
    const writtenCount = await upsertQuantDailyBars(db, allFetchedBars)
    if (!(await hasQuantSyncLease(db, { userId, runId, now: now() })))
      throw createSyncLeaseLostError()
    const barsByCode = await readBarsByCode(db, requestedCodes, dateRange.fromDate, dateRange.toDate)
    const candidates = screenMomentum(barsByCode)
    const status = errors.length > 0 ? 'partial' : 'completed'
    const snapshotId = await saveQuantScanSnapshot(db, {
      userId,
      status,
      runId,
      inputTsCodes: requestedCodes,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      candidates,
      generatedAt: now(),
    })
    const completedAt = now()
    const saved = await saveQuantSyncState(db, {
      userId,
      status,
      runId,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      requestedCount: requestedCodes.length,
      writtenCount,
      skippedCount: errors.length,
      reasonCode: errors.length > 0 ? 'QUANT_PROVIDER_PARTIAL' : undefined,
      reason: errors.length > 0 ? [...new Set(errors)].join(',') : undefined,
      snapshotId,
      startedAt,
      completedAt,
    })
    if (!saved)
      throw createSyncLeaseLostError()

    return {
      status,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      requestedCount: requestedCodes.length,
      writtenCount,
      skippedCount: errors.length,
      reasonCode: errors.length > 0 ? 'QUANT_PROVIDER_PARTIAL' : undefined,
      reason: errors.length > 0 ? [...new Set(errors)].join(',') : undefined,
      snapshotId,
      candidates,
    }
  }
  finally {
    try {
      await releaseQuantSyncLease(db, {
        userId,
        runId,
        completedAt: now(),
      })
    }
    catch {
      // Preserve the primary sync result or error when cleanup itself fails.
    }
  }
}

export async function ensureQuantWatchlistSeed(db: Database, userId: string, tsCode: string): Promise<void> {
  await createQuantWatchlistItem(db, { userId, tsCode })
}
