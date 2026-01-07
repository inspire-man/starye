import type { AppEnv } from '../types'
import { Hono } from 'hono'

const auth = new Hono<AppEnv>()

// Better Auth Routes
auth.on(['POST', 'GET'], '/*', (c) => {
  const authInstance = c.get('auth')
  return authInstance.handler(c.req.raw)
})

export default auth
