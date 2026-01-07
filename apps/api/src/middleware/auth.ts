import type { AppEnv } from '../types'
import { createMiddleware } from 'hono/factory'
import { createAuth } from '../lib/auth'

export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = createAuth(c.env, c.req.raw)
    c.set('auth', auth)
    await next()
  })
}
