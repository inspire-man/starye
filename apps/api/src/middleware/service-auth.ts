/* eslint-disable no-console */
import type { AppEnv } from '../types'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Admin Authentication Middleware
 *
 * Supports two authentication methods:
 * 1. Service Token: Via 'x-service-token' header (for crawlers/scripts)
 * 2. User Session: Via 'starye_session' cookie (for admin users in dashboard)
 */
export function serviceAuth() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // Method 1: Service Token Check
    if (token && secret && token === secret) {
      console.log('[Auth] ✓ Service Token authenticated')
      return await next()
    }

    // Method 2: Admin Session Check
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (session && (session.user as any).role === 'admin') {
      console.log(`[Auth] ✓ Admin User authenticated: ${session.user.email}`)
      return await next()
    }

    // Fail if neither method works
    console.warn('[Auth] ❌ Unauthorized access attempt to Admin API', {
      hasToken: !!token,
      hasSession: !!session,
      role: (session?.user as any)?.role,
    })

    throw new HTTPException(401, { message: 'Unauthorized: Admin access required' })
  })
}
