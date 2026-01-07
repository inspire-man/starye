/* eslint-disable no-console */
import type { Env } from '../lib/auth'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export function serviceAuth() {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // 必须确保 secret 存在且长度足够安全
    if (!secret || secret.length < 8) {
      console.error('[Service Auth] CRAWLER_SECRET is missing or too weak', {
        exists: !!secret,
        length: secret?.length || 0,
      })
      throw new HTTPException(500, { message: 'Server Configuration Error: CRAWLER_SECRET not properly configured' })
    }

    if (!token) {
      console.warn('[Service Auth] No x-service-token header provided')
      throw new HTTPException(401, { message: 'Unauthorized: Missing service token' })
    }

    if (token !== secret) {
      console.warn('[Service Auth] Invalid service token provided', {
        tokenPrefix: token.substring(0, 10),
        secretPrefix: secret.substring(0, 10),
      })
      throw new HTTPException(401, { message: 'Unauthorized: Invalid service token' })
    }

    console.log('[Service Auth] ✓ Service authenticated successfully')
    await next()
  })
}
