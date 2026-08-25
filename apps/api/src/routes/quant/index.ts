import type { EastmoneyProviderOptions, TushareProviderOptions } from '../../domain/quant/provider'
import type { MomentumCandidate } from '../../domain/quant/types'
import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { createQuantCapabilityRegistryFromEnv } from '../../domain/quant/capabilities'
import { buildQuantValuationComparison } from '../../domain/quant/comparison'
import { QuantError } from '../../domain/quant/errors'
import { screenMomentum } from '../../domain/quant/factor'
import { buildQuantFinancialQualityComparison } from '../../domain/quant/financial-comparison'
import { getQuantInvestmentKnowledge } from '../../domain/quant/investment-knowledge'
import { createEastmoneyFinancialProvider, createEastmoneyStockBasicProvider, createEastmoneyValuationProvider, createTushareDividendProvider, createTushareStockBasicProvider, mapQuantProviderError, resolveQuantProviderName } from '../../domain/quant/provider'
import {
  createQuantWatchlistItem,
  deleteQuantWatchlistItem,
  getLatestQuantScanSnapshot,
  getQuantSyncState,
  listQuantDailyBars,
  listQuantResearchMarkers,
  listQuantWatchlist,
  listQuantWatchlistWithStats,
  normalizeTsCode,
  updateQuantWatchlistItem,
  upsertQuantResearchMarker,
} from '../../domain/quant/repository'
import { readQuantShareholderReturns } from '../../domain/quant/shareholder-return'
import { syncQuantDaily } from '../../domain/quant/sync'
import { readQuantValueSelection } from '../../domain/quant/value-selection-service'
import { requireAuth } from '../../middleware/guard'
import {
  QuantDailyQuerySchema,
  QuantFinancialHistoryQuerySchema,
  QuantResearchMarkerUpdateSchema,
  QuantSyncSchema,
  QuantWatchlistCreateSchema,
  QuantWatchlistParamSchema,
  QuantWatchlistUpdateSchema,
} from '../../schemas/quant'

export const quantRoutes = new Hono<AppEnv>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStoredCandidates(snapshot: { readonly candidatesJson: string } | undefined): ReadonlyMap<string, Record<string, unknown>> {
  if (!snapshot)
    return new Map()
  try {
    const value: unknown = JSON.parse(snapshot.candidatesJson)
    if (!Array.isArray(value))
      return new Map()
    return new Map(value.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.tsCode === 'string').map(item => [item.tsCode as string, item]))
  }
  catch {
    return new Map()
  }
}

async function readCurrentQuantCandidates(db: AppEnv['Variables']['db']) {
  const [watchlist, snapshot] = await Promise.all([
    listQuantWatchlist(db),
    getLatestQuantScanSnapshot(db),
  ])
  const barsByCode = Object.fromEntries(await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const)))
  const recalculated = new Map(screenMomentum(barsByCode).map(candidate => [candidate.tsCode, candidate]))
  const stored = parseStoredCandidates(snapshot)
  const candidates = watchlist.map((item) => {
    const snapshotCandidate = stored.get(item.tsCode)
    if (snapshotCandidate) {
      return {
        ...snapshotCandidate,
        id: `snapshot-${item.tsCode}`,
        tsCode: item.tsCode,
        name: item.name ?? snapshotCandidate.name ?? null,
        pendingSync: false,
        pendingReason: null,
      }
    }

    const candidate = recalculated.get(item.tsCode) as MomentumCandidate | undefined
    return {
      ...(candidate ?? {
        tsCode: item.tsCode,
        factorVersion: 'momentum-v1',
        factors: {
          ma5: null,
          ma20: null,
          isNewHigh20: null,
          consecutiveUpDays: null,
          volumeRatio: null,
          return20: null,
          relativeStrength: null,
        },
        matchedFactors: [],
        missingFactors: ['ma5', 'ma20', 'new_high_20', 'continuation', 'volume_ratio', 'relative_strength'],
        dataQuality: 'insufficient_data' as const,
        score: 0,
      }),
      id: `watchlist-${item.tsCode}`,
      tsCode: item.tsCode,
      name: item.name,
      pendingSync: true,
      pendingReason: '尚未进入最近一次候选快照，请更新观察池',
    }
  })

  return {
    id: snapshot?.id ?? 'pending',
    factorVersion: snapshot?.factorVersion ?? 'momentum-v1',
    generatedAt: snapshot?.generatedAt ?? null,
    fromDate: snapshot?.fromDate ?? null,
    toDate: snapshot?.toDate ?? null,
    inputTsCodes: watchlist.map(item => item.tsCode),
    candidates,
  }
}

function eastmoneyProviderOptions(env?: AppEnv['Bindings']): EastmoneyProviderOptions {
  const baseUrl = env?.EASTMONEY_BASE_URL?.trim()
  const timeoutMs = Number(env?.EASTMONEY_TIMEOUT_MS)
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

function tushareProviderOptions(env?: AppEnv['Bindings']): TushareProviderOptions {
  const token = env?.TUSHARE_TOKEN?.trim()
  const baseUrl = env?.TUSHARE_BASE_URL?.trim()
  const timeoutMs = Number(env?.TUSHARE_TIMEOUT_MS)
  return {
    ...(token ? { token } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

function stockBasicProvider(env?: AppEnv['Bindings']) {
  const options = tushareProviderOptions(env)
  return resolveQuantProviderName(env) === 'tushare'
    ? createTushareStockBasicProvider(options)
    : createEastmoneyStockBasicProvider(eastmoneyProviderOptions(env))
}

quantRoutes.use('*', requireAuth(['admin', 'super_admin']))

quantRoutes.onError((error, c) => {
  if (error instanceof QuantError) {
    return c.json({
      success: false as const,
      code: error.code,
      error: error.message,
      details: error.details ?? null,
    }, error.status)
  }
  throw error
})

quantRoutes.get('/capabilities', (c) => {
  const registry = createQuantCapabilityRegistryFromEnv(c.env)
  return c.json({
    success: true as const,
    data: {
      tier: registry.tier,
      provider: registry.provider,
      enabled: registry.enabled,
      capabilities: registry.capabilities,
    },
  })
})

quantRoutes.get('/knowledge', (c) => {
  return c.json({
    success: true as const,
    data: getQuantInvestmentKnowledge(),
  })
})

quantRoutes.get('/watchlist', async (c) => {
  const data = await listQuantWatchlistWithStats(c.get('db'))
  return c.json({ success: true as const, data })
})

quantRoutes.get('/stock-basic/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const data = await stockBasicProvider(c.env).fetchStockBasic({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/research', async (c) => {
  const data = await listQuantResearchMarkers(c.get('db'))
  return c.json({ success: true as const, data })
})

quantRoutes.put(
  '/research/:tsCode',
  validator('param', QuantWatchlistParamSchema),
  validator('json', QuantResearchMarkerUpdateSchema),
  async (c) => {
    const { tsCode } = c.req.valid('param')
    const input = c.req.valid('json')
    const data = await upsertQuantResearchMarker(c.get('db'), {
      tsCode,
      status: input.status,
      note: input.note,
      reviewDate: input.review_date,
    })
    return c.json({ success: true as const, data })
  },
)

quantRoutes.post('/watchlist', validator('json', QuantWatchlistCreateSchema), async (c) => {
  const input = c.req.valid('json')
  let name = input.name?.trim() || null
  if (!name) {
    try {
      name = (await stockBasicProvider(c.env).fetchStockBasic({ tsCode: input.ts_code })).name
    }
    catch {
      name = null
    }
  }
  let data = await createQuantWatchlistItem(c.get('db'), { tsCode: input.ts_code, name })
  if (!data.name && name)
    data = await updateQuantWatchlistItem(c.get('db'), input.ts_code, name)
  return c.json({ success: true as const, data }, 201)
})

quantRoutes.patch(
  '/watchlist/:tsCode',
  validator('param', QuantWatchlistParamSchema),
  validator('json', QuantWatchlistUpdateSchema),
  async (c) => {
    const { tsCode } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const data = await updateQuantWatchlistItem(c.get('db'), tsCode, name)
    return c.json({ success: true as const, data })
  },
)

quantRoutes.delete('/watchlist/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const deleted = await deleteQuantWatchlistItem(c.get('db'), tsCode)
  if (!deleted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)
  return c.json({ success: true as const, data: { tsCode } })
})

quantRoutes.get('/daily/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantDailyQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  const data = await listQuantDailyBars(c.get('db'), {
    tsCode,
    ...(input.from ? { fromDate: input.from } : {}),
    ...(input.to ? { toDate: input.to } : {}),
  })
  const limit = input.limit ? Math.min(120, Math.max(1, Number(input.limit))) : 120
  return c.json({ success: true as const, data: data.slice(-limit) })
})

quantRoutes.get('/valuation/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchValuation({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/valuation/compare/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          valuation: await provider.fetchValuation({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, valuation: null }
      }
    }))
    const data = buildQuantValuationComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchFinancialQuality({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/history/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantFinancialHistoryQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const reports = await provider.fetchFinancialQualityHistory({
      tsCode,
      ...(input.limit ? { limit: Number(input.limit) } : {}),
    })
    return c.json({
      success: true as const,
      data: {
        tsCode: reports[0]?.tsCode ?? tsCode.toUpperCase(),
        observedAt: reports[0]?.observedAt ?? new Date().toISOString(),
        reports,
      },
    })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/compare/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          quality: await provider.fetchFinancialQuality({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, quality: null }
      }
    }))
    const data = buildQuantFinancialQualityComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/candidates', async (c) => {
  return c.json({ success: true as const, data: await readCurrentQuantCandidates(c.get('db')) })
})

quantRoutes.get('/value-selection', async (c) => {
  const options = eastmoneyProviderOptions(c.env)
  const data = await readQuantValueSelection(c.get('db'), {
    valuation: createEastmoneyValuationProvider(options),
    financial: createEastmoneyFinancialProvider(options),
  })
  return c.json({ success: true as const, data })
})

quantRoutes.get('/shareholder-returns', async (c) => {
  const data = await readQuantShareholderReturns(
    c.get('db'),
    createTushareDividendProvider(tushareProviderOptions(c.env)),
  )
  return c.json({ success: true as const, data })
})

quantRoutes.get('/sync', async (c) => {
  const state = await getQuantSyncState(c.get('db'))
  return c.json({ success: true as const, data: state ?? null })
})

quantRoutes.post('/sync', validator('json', QuantSyncSchema), async (c) => {
  const input = c.req.valid('json')
  const result = await syncQuantDaily(c.get('db'), c.env, {
    ...(input.from_date ? { fromDate: input.from_date } : {}),
    ...(input.to_date ? { toDate: input.to_date } : {}),
    ...(input.ts_codes ? { tsCodes: input.ts_codes } : {}),
  })
  const status = result.status === 'rejected' ? 409 : 200
  return c.json({ success: result.status !== 'rejected', data: result }, status)
})

export default quantRoutes
