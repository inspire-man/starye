/**
 * 资源权限守卫中间件
 *
 * 在路由级别强制执行资源权限检查，确保：
 * - admin 可以访问所有资源
 * - comic_admin 只能访问漫画相关资源
 * - movie_admin 只能访问电影相关资源
 * - service token（爬虫）拥有完全访问权限
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { Resource } from '../lib/permissions'
import type { AppEnv, SessionUser } from '../types'
import { HTTPException } from 'hono/http-exception'
import { hasPermission } from '../lib/permissions'

/**
 * 资源权限检查中间件
 *
 * 支持两种认证方式：
 * 1. Service Token: 通过 x-service-token header（用于爬虫脚本）
 * 2. User Session: 通过 cookie（用于管理后台用户）
 *
 * @param resource - 资源类型（'comic', 'movie', 'global'）
 * @returns Hono 中间件
 *
 * @example
 * ```typescript
 * // 漫画管理路由
 * admin.use('/comics/*', requireResource('comic'))
 * admin.get('/comics', listComics)
 *
 * // 电影管理路由
 * admin.use('/movies/*', requireResource('movie'))
 * admin.get('/movies', listMovies)
 *
 * // 全局管理路由（仅 admin）
 * admin.use('/users/*', requireResource('global'))
 * admin.get('/users', listUsers)
 * ```
 */
export function requireResource(resource: Resource): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    // 首先检查 service token（用于爬虫）
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    if (token && secret && token === secret) {
      // Service token 始终拥有完全访问权限
      // 设置虚拟用户以支持下游中间件
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

    // 然后检查 session 用户
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      })
    }

    if (!hasPermission(user, resource)) {
      throw new HTTPException(403, {
        message: 'Insufficient permissions',
        res: Response.json({
          error: 'Insufficient permissions',
          required: resource,
          actual: user.role,
        }, { status: 403 }),
      })
    }

    await next()
  }
}

/**
 * 可选的资源权限检查中间件
 *
 * 如果用户已认证且有权限，设置 c.var('hasAccess', true)
 * 如果用户未认证或无权限，不抛出异常，设置 c.var('hasAccess', false)
 *
 * @param resource - 资源类型
 * @returns Hono 中间件
 *
 * @example
 * ```typescript
 * admin.use('/stats', optionalResource('comic'))
 * admin.get('/stats', (c) => {
 *   const hasAccess = c.get('hasAccess')
 *   if (hasAccess) {
 *     // 返回完整数据
 *   } else {
 *     // 返回受限数据
 *   }
 * })
 * ```
 */
export function optionalResource(resource: Resource): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    const user = c.get('user')

    if (user && hasPermission(user, resource)) {
      c.set('hasAccess' as any, true)
    }
    else {
      c.set('hasAccess' as any, false)
    }

    await next()
  }
}
