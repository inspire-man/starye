import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { QuantError } from '../../../domain/quant/errors'
import { mapQuantProviderError } from '../../../domain/quant/provider'
import { createQuantWatchlistWorkspaceItem, deleteQuantWatchlistWorkspaceItem, readQuantDailyBars, readQuantStockBasic, readQuantSyncState, readQuantWatchlistWorkspace, runQuantDailySync, updateQuantWatchlistWorkspaceItem } from '../../../domain/quant/workspace-service'
import { QuantDailyQuerySchema, QuantSyncSchema, QuantWatchlistCreateSchema, QuantWatchlistParamSchema, QuantWatchlistUpdateSchema } from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId, stockBasicProvider } from '../route-context'

export const quantWorkspaceRoutes = new Hono<AppEnv>()

quantWorkspaceRoutes.get('/watchlist', quantRouteDocs('workspace.watchlist.list'), async (c) => {
  const userId = currentQuantUserId(c)
  const data = await readQuantWatchlistWorkspace(c.get('db'), userId)
  return c.json({ success: true as const, data })
})

quantWorkspaceRoutes.post('/watchlist', quantRouteDocs('workspace.watchlist.create'), validator('json', QuantWatchlistCreateSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const input = c.req.valid('json')
  const data = await createQuantWatchlistWorkspaceItem(c.get('db'), stockBasicProvider(c.env), { userId, tsCode: input.ts_code, name: input.name })
  return c.json({ success: true as const, data }, 201)
})

quantWorkspaceRoutes.patch(
  '/watchlist/:tsCode',
  quantRouteDocs('workspace.watchlist.update'),
  validator('param', QuantWatchlistParamSchema),
  validator('json', QuantWatchlistUpdateSchema),
  async (c) => {
    const { tsCode } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const data = await updateQuantWatchlistWorkspaceItem(c.get('db'), currentQuantUserId(c), tsCode, name)
    return c.json({ success: true as const, data })
  },
)

quantWorkspaceRoutes.delete('/watchlist/:tsCode', quantRouteDocs('workspace.watchlist.delete'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const deleted = await deleteQuantWatchlistWorkspaceItem(c.get('db'), currentQuantUserId(c), tsCode)
  if (!deleted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)
  return c.json({ success: true as const, data: { tsCode } })
})

quantWorkspaceRoutes.get('/stock-basic/:tsCode', quantRouteDocs('workspace.stockBasic.get'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const data = await readQuantStockBasic(stockBasicProvider(c.env), tsCode)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantWorkspaceRoutes.get('/daily/:tsCode', quantRouteDocs('workspace.daily.list'), validator('param', QuantWatchlistParamSchema), validator('query', QuantDailyQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  const limit = input.limit ? Math.min(120, Math.max(1, Number(input.limit))) : 120
  const data = await readQuantDailyBars(c.get('db'), {
    tsCode,
    ...(input.from ? { fromDate: input.from } : {}),
    ...(input.to ? { toDate: input.to } : {}),
    limit,
  })
  return c.json({ success: true as const, data })
})

quantWorkspaceRoutes.get('/sync', quantRouteDocs('workspace.sync.get'), async (c) => {
  const state = await readQuantSyncState(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data: state ?? null })
})

quantWorkspaceRoutes.post('/sync', quantRouteDocs('workspace.sync.run'), validator('json', QuantSyncSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const input = c.req.valid('json')
  const result = await runQuantDailySync(c.get('db'), c.env, {
    ...(input.from_date ? { fromDate: input.from_date } : {}),
    ...(input.to_date ? { toDate: input.to_date } : {}),
    ...(input.ts_codes ? { tsCodes: input.ts_codes } : {}),
  }, userId)
  const status = result.status === 'rejected' ? 409 : 200
  return c.json({ success: result.status !== 'rejected', data: result }, status)
})
