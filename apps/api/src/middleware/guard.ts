import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Middleware to require authentication and optional role verification.
 *
 * @param requiredRole Single role or array of roles allowed to access.
 *                     'admin' and 'super_admin' are always allowed.
 *                     ADMIN_GITHUB_ID env var whitelist bypasses role check (D-04).
 */
export function requireAuth(requiredRole?: string | string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth')
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session || !session.user) {
      throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
    }

    const user = session.user as SessionUser

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

      // D-04：ADMIN_GITHUB_ID 白名单命中即视为 super_admin，覆盖 DB role
      // 格式：单个 ID（"12345678"）或逗号分隔多个（"12345,67890"）
      if (user.githubId) {
        const adminIds = c.env.ADMIN_GITHUB_ID
        if (adminIds && adminIds.split(',').map((s: string) => s.trim()).includes(String(user.githubId))) {
          await next()
          return
        }
      }

      // Super admin always passes
      if (user.role === 'super_admin' || user.role === 'admin') {
        await next()
        return
      }

      if (!roles.includes(user.role)) {
        throw new HTTPException(403, { message: `Forbidden: Requires one of [${roles.join(', ')}] role` })
      }
    }

    await next()
  })
}
