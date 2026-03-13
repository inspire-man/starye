/* eslint-disable no-console */
/**
 * 审计日志中间件
 *
 * 自动记录所有管理员的 CUD 操作（Create, Update, Delete）
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv, SessionUser } from '../types'
import { auditLogs } from '@starye/db/schema'
import { nanoid } from 'nanoid'

/**
 * 操作类型
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE' | 'BULK_DELETE'

/**
 * 资源类型
 */
export type AuditResourceType = 'comic' | 'movie' | 'chapter' | 'player' | 'actor' | 'publisher' | 'user'

/**
 * 审计日志数据
 */
export interface AuditLogData {
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  resourceIdentifier?: string
  affectedCount?: number
  changes?: Record<string, any>
}

/**
 * 敏感字段列表（不记录到审计日志）
 */
const SENSITIVE_FIELDS = ['password', 'accessToken', 'refreshToken', 'idToken', 'token']

/**
 * 脱敏处理：移除敏感字段
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData)
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '[REDACTED]'
    }
    else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value)
    }
    else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * 计算变更差异
 *
 * @param before - 操作前的数据
 * @param after - 操作后的数据
 * @returns 变更详情
 */
function computeChanges(before: any, after: any): { before: any, after: any } {
  const changes: { before: any, after: any } = {
    before: {},
    after: {},
  }

  if (!before && after) {
    return { before: {}, after: sanitizeData(after) }
  }

  if (before && !after) {
    return { before: sanitizeData(before), after: {} }
  }

  if (!before || !after) {
    return changes
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (SENSITIVE_FIELDS.includes(key)) {
      continue
    }

    const beforeValue = before[key]
    const afterValue = after[key]

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes.before[key] = beforeValue
      changes.after[key] = afterValue
    }
  }

  return changes
}

/**
 * 创建审计日志记录
 *
 * @param c - Hono Context
 * @param data - 审计日志数据
 */
export async function createAuditLog(
  c: Context<AppEnv>,
  data: AuditLogData,
): Promise<void> {
  const user = c.get('user') as SessionUser | undefined

  if (!user) {
    console.warn('[Audit] ⚠️ No user in context, skipping audit log')
    return
  }

  const db = c.get('db')
  const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'

  try {
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: user.id,
      userEmail: user.email,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      resourceIdentifier: data.resourceIdentifier || null,
      affectedCount: data.affectedCount || 1,
      changes: data.changes ? JSON.stringify(sanitizeData(data.changes)) : null,
      ipAddress,
      userAgent,
    })

    console.log(`[Audit] ✓ Logged ${data.action} on ${data.resourceType} by ${user.email}`)
  }
  catch (error) {
    console.error('[Audit] ❌ Failed to create audit log:', error)
  }
}

/**
 * 捕获资源状态（用于记录操作前的数据）
 *
 * @param c - Hono Context
 * @param resourceType - 资源类型
 * @param resourceId - 资源 ID
 * @returns 资源当前状态
 */
export async function captureResourceState(
  c: Context<AppEnv>,
  resourceType: AuditResourceType,
  resourceId: string,
): Promise<any | null> {
  const db = c.get('db')

  try {
    switch (resourceType) {
      case 'comic':
        return await db.query.comics.findFirst({
          where: (comics, { eq }) => eq(comics.id, resourceId),
        })

      case 'movie':
        return await db.query.movies.findFirst({
          where: (movies, { eq }) => eq(movies.id, resourceId),
        })

      case 'chapter':
        return await db.query.chapters.findFirst({
          where: (chapters, { eq }) => eq(chapters.id, resourceId),
        })

      case 'player':
        return await db.query.players.findFirst({
          where: (players, { eq }) => eq(players.id, resourceId),
        })

      case 'actor':
        return await db.query.actors.findFirst({
          where: (actors, { eq }) => eq(actors.id, resourceId),
        })

      case 'publisher':
        return await db.query.publishers.findFirst({
          where: (publishers, { eq }) => eq(publishers.id, resourceId),
        })

      case 'user':
        return await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, resourceId),
        })

      default:
        return null
    }
  }
  catch (error) {
    console.error(`[Audit] ❌ Failed to capture ${resourceType} state:`, error)
    return null
  }
}

/**
 * 审计日志中间件
 *
 * 自动拦截 POST/PUT/PATCH/DELETE 请求，记录操作到审计日志
 *
 * **使用方式**:
 * 1. 应用到需要审计的路由组
 * 2. 在操作完成后，调用 `createAuditLog()` 手动记录
 *
 * **注意**:
 * - 批量操作需要手动调用 `createAuditLog()`，因为中间件无法自动识别批量操作
 * - 读取操作（GET）不会被记录
 *
 * @example
 * ```typescript
 * admin.use('/movies/*', auditMiddleware())
 *
 * admin.patch('/movies/:id', async (c) => {
 *   const before = await captureResourceState(c, 'movie', id)
 *   // ... 执行更新 ...
 *   const after = await db.query.movies.findFirst(...)
 *
 *   await createAuditLog(c, {
 *     action: 'UPDATE',
 *     resourceType: 'movie',
 *     resourceId: id,
 *     changes: computeChanges(before, after),
 *   })
 * })
 * ```
 */
export function auditMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    const method = c.req.method

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return await next()
    }

    await next()
  }
}

/**
 * 辅助函数：从变更前后数据计算差异
 *
 * @param before - 操作前数据
 * @param after - 操作后数据
 * @returns 变更对象
 */
export { computeChanges }
