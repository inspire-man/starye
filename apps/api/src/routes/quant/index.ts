import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { createQuantCapabilityRegistryFromEnv } from '../../domain/quant/capabilities'
import { QuantError } from '../../domain/quant/errors'
import {
  createQuantWatchlistItem,
  deleteQuantWatchlistItem,
  getLatestQuantScanSnapshot,
  getQuantSyncState,
  listQuantDailyBars,
  listQuantWatchlistWithStats,
  updateQuantWatchlistItem,
} from '../../domain/quant/repository'
import { syncQuantDaily } from '../../domain/quant/sync'
import { requireAuth } from '../../middleware/guard'
import {
  QuantDailyQuerySchema,
  QuantSyncSchema,
  QuantWatchlistCreateSchema,
  QuantWatchlistParamSchema,
  QuantWatchlistUpdateSchema,
} from '../../schemas/quant'

export const quantRoutes = new Hono<AppEnv>()

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
