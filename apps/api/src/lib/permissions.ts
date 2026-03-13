/**
 * 权限管理工具 - 细粒度角色权限控制
 */

import type { User } from '@starye/db/schema'

export type Role = 'super_admin' | 'admin' | 'comic_admin' | 'movie_admin' | 'user'
export type Resource = 'comic' | 'movie' | 'global'
export type Action = 'create' | 'read' | 'update' | 'delete'

/**
 * 权限矩阵
 *
 * 定义了每个角色对每种资源的访问权限
 *
 * Resource Type     | admin | comic_admin | movie_admin | user
 * ------------------|-------|-------------|-------------|------
 * Comics (CRUD)     |  ✓    |      ✓      |     ✗       |  ✗
 * Chapters (CRUD)   |  ✓    |      ✓      |     ✗       |  ✗
 * Movies (CRUD)     |  ✓    |      ✗      |     ✓       |  ✗
 * Players (CRUD)    |  ✓    |      ✗      |     ✓       |  ✗
 * Actors (CRUD)     |  ✓    |      ✗      |     ✓       |  ✗
 * Publishers (CRUD) |  ✓    |      ✗      |     ✓       |  ✗
 * Crawlers (View)   |  ✓    |      ✓*     |     ✓*      |  ✗
 * Audit Logs (View) |  ✓    |      ✗      |     ✗       |  ✗
 * Users (Manage)    |  ✓    |      ✗      |     ✗       |  ✗
 *
 * Crawlers: comic_admin 只能查看漫画爬虫，movie_admin 只能查看电影爬虫
 */
export const PERMISSION_MATRIX: Record<Resource, Role[]> = {
  comic: ['admin', 'super_admin', 'comic_admin'],
  movie: ['admin', 'super_admin', 'movie_admin'],
  global: ['admin', 'super_admin'],
}

/**
 * 检查用户是否有权限访问指定资源
 *
 * @param user - 用户对象
 * @param resource - 资源类型
 * @returns 是否有权限
 *
 * @example
 * ```typescript
 * const canAccess = hasPermission(user, 'comic')
 * if (!canAccess) {
 *   throw new HTTPException(403, { message: 'Insufficient permissions' })
 * }
 * ```
 */
export function hasPermission(
  user: Pick<User, 'role'>,
  resource: Resource,
): boolean {
  const userRole = user.role as Role
  const allowedRoles = PERMISSION_MATRIX[resource]

  return allowedRoles.includes(userRole)
}

/**
 * 获取用户可访问的资源类型列表
 *
 * @param user - 用户对象
 * @returns 可访问的资源类型数组
 *
 * @example
 * ```typescript
 * const resources = getAccessibleResources(user)
 * // admin: ['comic', 'movie', 'global']
 * // comic_admin: ['comic']
 * // movie_admin: ['movie']
 * ```
 */
export function getAccessibleResources(user: Pick<User, 'role'>): Resource[] {
  const userRole = user.role as Role
  const resources: Resource[] = []

  for (const [resource, roles] of Object.entries(PERMISSION_MATRIX)) {
    if (roles.includes(userRole)) {
      resources.push(resource as Resource)
    }
  }

  return resources
}

/**
 * 检查用户是否可以访问爬虫监控
 *
 * @param user - 用户对象
 * @param crawlerType - 爬虫类型（'comic' 或 'movie'）
 * @returns 是否可以访问
 *
 * @example
 * ```typescript
 * const canViewComicCrawler = canAccessCrawler(user, 'comic')
 * const canViewMovieCrawler = canAccessCrawler(user, 'movie')
 * ```
 */
export function canAccessCrawler(
  user: Pick<User, 'role'>,
  crawlerType: 'comic' | 'movie',
): boolean {
  const userRole = user.role as Role

  if (userRole === 'admin' || userRole === 'super_admin') {
    return true
  }

  if (crawlerType === 'comic' && userRole === 'comic_admin') {
    return true
  }

  if (crawlerType === 'movie' && userRole === 'movie_admin') {
    return true
  }

  return false
}

/**
 * 断言用户有权限，否则抛出异常
 *
 * @param user - 用户对象
 * @param resource - 资源类型
 * @throws HTTPException 403 如果没有权限
 *
 * @example
 * ```typescript
 * assertPermission(user, 'movie')
 * // 如果没有权限，抛出 403 错误
 * // 如果有权限，继续执行
 * ```
 */
export function assertPermission(
  user: Pick<User, 'role'>,
  resource: Resource,
): void {
  if (!hasPermission(user, resource)) {
    const error: any = new Error('Insufficient permissions')
    error.status = 403
    error.details = {
      required: PERMISSION_MATRIX[resource],
      actual: user.role,
    }
    throw error
  }
}
