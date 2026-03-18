/* eslint-disable no-console */
import type { Resource } from '../lib/permissions'
import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { hasPermission } from '../lib/permissions'

/**
 * Admin Authentication Middleware
 *
 * Supports two authentication methods:
 * 1. Service Token: Via 'x-service-token' header (for crawlers/scripts)
 * 2. User Session: Via 'starye_session' cookie (for admin users in dashboard)
 *
 * @deprecated 推荐使用 requireAuth + requireResource 组合，提供更细粒度的权限控制
 */
export function serviceAuth(allowedRoles: string[] = ['admin']) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // Method 1: Service Token Check (Always allows Root Access)
    if (token && secret && token === secret) {
      console.log('[Auth] ✓ Service Token authenticated')
      // Set a virtual admin user for service token requests
      // This allows downstream middlewares (like requireResource) to work correctly
      c.set('user', {
        id: 'service-token',
        email: 'service@system',
        role: 'super_admin',
        isAdult: true,
        emailVerified: true,
        createdAt: new Date(),
      } as SessionUser)
      return await next()
    }

    // Method 2: Session Role Check
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user as unknown as SessionUser | undefined
    const userRole = user?.role

    if (session && userRole) {
      // Store user in context
      c.set('user', user)

      // Super Admin and Admin always have access
      if (userRole === 'super_admin' || userRole === 'admin') {
        console.log(`[Auth] ✓ Admin authenticated: ${user.email} (Role: ${userRole})`)
        return await next()
      }

      if (allowedRoles.includes(userRole)) {
        console.log(`[Auth] ✓ User authenticated: ${user.email} (Role: ${userRole})`)
        return await next()
      }
    }

    // Fail
    console.warn('[Auth] ❌ Unauthorized access attempt', {
      required: allowedRoles,
      actual: userRole,
    })

    throw new HTTPException(401, { message: `Unauthorized: Requires one of [${allowedRoles.join(', ')}]` })
  })
}

/**
 * 增强的认证中间件 - 支持资源级权限检查
 *
 * @param options - 配置选项
 * @param options.resource - 资源类型（'comic', 'movie', 'global'）
 * @param options.allowServiceToken - 是否允许服务 token（默认 true）
 * @returns Hono 中间件
 *
 * @example
 * ```typescript
 * // 漫画管理路由（只允许 admin 和 comic_admin）
 * admin.use('/comics/*', serviceAuthWithResource({ resource: 'comic' }))
 *
 * // 电影管理路由（只允许 admin 和 movie_admin）
 * admin.use('/movies/*', serviceAuthWithResource({ resource: 'movie' }))
 *
 * // 用户管理路由（只允许 admin）
 * admin.use('/users/*', serviceAuthWithResource({ resource: 'global' }))
 * ```
 */
export function serviceAuthWithResource(options: {
  resource: Resource
  allowServiceToken?: boolean
}) {
  const { resource, allowServiceToken = true } = options

  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // Method 1: Service Token Check (Always allows Root Access if enabled)
    if (allowServiceToken && token && secret && token === secret) {
      console.log(`[Auth] ✓ Service Token authenticated (Resource: ${resource})`)
      return await next()
    }

    // Method 2: Session + Resource Permission Check
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user as unknown as SessionUser | undefined

    if (!session || !user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    // Store user in context
    c.set('user', user)

    // Check resource permission
    if (hasPermission(user, resource)) {
      console.log(`[Auth] ✓ User authenticated: ${user.email} (Role: ${user.role}, Resource: ${resource})`)
      return await next()
    }

    // Permission denied
    console.warn('[Auth] ❌ Insufficient permissions', {
      user: user.email,
      role: user.role,
      resource,
    })

    throw new HTTPException(403, {
      message: 'Insufficient permissions',
      res: Response.json({
        error: 'Insufficient permissions',
        resource,
        userRole: user.role,
      }, { status: 403 }),
    })
  })
}
