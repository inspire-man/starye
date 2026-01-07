import type { AppEnv } from '../types'
// Note: schema export might be 'user' not 'users'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

const auth = new Hono<AppEnv>()

// Custom Auth Actions
auth.post('/verify-age', async (c) => {
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

// Better Auth Routes (Catch-all)
auth.on(['POST', 'GET'], '/*', (c) => {
  const authInstance = c.get('auth')
  return authInstance.handler(c.req.raw)
})

export default auth
