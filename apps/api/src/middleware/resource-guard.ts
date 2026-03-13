/**
 * 资源权限守卫中间件
 *
 * 在路由级别强制执行资源权限检查，确保：
 * - admin 可以访问所有资源
 * - comic_admin 只能访问漫画相关资源
 * - movie_admin 只能访问电影相关资源
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { Resource } from '../lib/permissions'
import type { AppEnv } from '../types'
import { HTTPException } from 'hono/http-exception'
import { hasPermission } from '../lib/permissions'

/**
 * 资源权限检查中间件
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
