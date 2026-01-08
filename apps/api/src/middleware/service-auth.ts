/* eslint-disable no-console */
import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Admin Authentication Middleware
 *
 * Supports two authentication methods:
 * 1. Service Token: Via 'x-service-token' header (for crawlers/scripts)
 * 2. User Session: Via 'starye_session' cookie (for admin users in dashboard)
 */
export function serviceAuth(allowedRoles: string[] = ['admin']) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // Method 1: Service Token Check (Always allows Root Access)
    if (token && secret && token === secret) {
      console.log('[Auth] ✓ Service Token authenticated')
      return await next()
    }

    // Method 2: Session Role Check
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user as unknown as SessionUser | undefined
    const userRole = user?.role

    if (session && userRole && allowedRoles.includes(userRole)) {
      console.log(`[Auth] ✓ User authenticated: ${user.email} (Role: ${userRole})`)
      return await next()
    }

    // Fail
    console.warn('[Auth] ❌ Unauthorized access attempt', {
      required: allowedRoles,
      actual: userRole,
    })

    throw new HTTPException(401, { message: `Unauthorized: Requires one of [${allowedRoles.join(', ')}]` })
  })
}
