import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantRoutes } from '../index'

function createApp(session: unknown) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('auth', {
      api: { getSession: vi.fn().mockResolvedValue(session) },
    } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

describe('quant route contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires an authenticated admin session', async () => {
    const response = await createApp(null).request('/api/quant/capabilities')
    expect(response.status).toBe(401)
  })

  it('returns the default 120-point capability contract', async () => {
    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: undefined,
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tier: 120,
        enabled: ['daily'],
      },
    })
  })

  it('fails closed for an invalid configured tier', async () => {
    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: '-1',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { tier: null, enabled: [] },
    })
  })
})
