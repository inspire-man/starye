import type { EastmoneyProviderOptions } from '../../domain/quant/provider'
import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { createQuantCapabilityRegistryFromEnv } from '../../domain/quant/capabilities'
import { buildQuantValuationComparison } from '../../domain/quant/comparison'
import { QuantError } from '../../domain/quant/errors'
import { buildQuantFinancialQualityComparison } from '../../domain/quant/financial-comparison'
import { createEastmoneyFinancialProvider, createEastmoneyValuationProvider, mapQuantProviderError } from '../../domain/quant/provider'
import {
  createQuantWatchlistItem,
  deleteQuantWatchlistItem,
  getLatestQuantScanSnapshot,
  getQuantSyncState,
  listQuantDailyBars,
  listQuantWatchlist,
  listQuantWatchlistWithStats,
  normalizeTsCode,
  updateQuantWatchlistItem,
} from '../../domain/quant/repository'
import { syncQuantDaily } from '../../domain/quant/sync'
import { requireAuth } from '../../middleware/guard'
import {
  QuantDailyQuerySchema,
  QuantFinancialHistoryQuerySchema,
  QuantSyncSchema,
  QuantWatchlistCreateSchema,
  QuantWatchlistParamSchema,
  QuantWatchlistUpdateSchema,
} from '../../schemas/quant'

export const quantRoutes = new Hono<AppEnv>()

function eastmoneyProviderOptions(env?: AppEnv['Bindings']): EastmoneyProviderOptions {
  const baseUrl = env?.EASTMONEY_BASE_URL?.trim()
  const timeoutMs = Number(env?.EASTMONEY_TIMEOUT_MS)
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
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

quantRoutes.get('/watchlist', async (c) => {
  const data = await listQuantWatchlistWithStats(c.get('db'))
  return c.json({ success: true as const, data })
})

quantRoutes.post('/watchlist', validator('json', QuantWatchlistCreateSchema), async (c) => {
  const input = c.req.valid('json')
  const data = await createQuantWatchlistItem(c.get('db'), { tsCode: input.ts_code, name: input.name })
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
  const snapshot = await getLatestQuantScanSnapshot(c.get('db'))
  if (!snapshot)
    return c.json({ success: true as const, data: null })
  return c.json({
    success: true as const,
    data: {
      ...snapshot,
      inputTsCodes: JSON.parse(snapshot.inputTsCodesJson) as readonly string[],
      candidates: JSON.parse(snapshot.candidatesJson) as readonly unknown[],
    },
  })
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
