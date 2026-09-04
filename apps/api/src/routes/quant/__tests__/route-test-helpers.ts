import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { vi } from 'vitest'
import { quantRoutes } from '../index'

export function createQuantRouteTestApp(session: unknown) {
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
