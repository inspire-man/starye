/* eslint-disable no-console */
import type { AppEnv } from '../../types'
// Note: schema export might be 'user' not 'users'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * Auth 路由 - 使用链式调用以支持 RPC 类型推导
 */
const auth = new Hono<AppEnv>()
  .get('/session', async (c) => {
    const authInstance = c.get('auth')
    const cookies = c.req.header('cookie')
    console.log('[Auth Debug] Cookies:', cookies)

    try {
      const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
      console.log('[Auth Debug] Session result:', session ? 'found' : 'null')
      if (session) {
        return c.json({
          user: session.user,
          session: session.session,
        })
      }
      return c.json(null)
    }
    catch (error) {
      console.error('[Auth] Session error:', error)
      return c.json(null)
    }
  })
  .post('/verify-age', async (c) => {
    const authInstance = c.get('auth')
    const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const db = c.get('db')
    const userId = session.user.id

    await db.update(user)
      .set({ isAdult: true })
      .where(eq(user.id, userId))

    return c.json({ success: true })
  })
  .on(['POST', 'GET'], '/*', (c) => {
    // Better Auth Routes (Catch-all)
    const authInstance = c.get('auth')
    return authInstance.handler(c.req.raw)
  })

export const authRoutes = auth
