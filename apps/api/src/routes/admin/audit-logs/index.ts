/**
 * 审计日志查询 API 路由
 *
 * 提供审计日志查询、筛选、导出功能
 * 权限要求：仅 admin 角色
 */

import type { AppEnv } from '../../../types'
import { auditLogs } from '@starye/db/schema'
import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { requireResource } from '../../../middleware/resource-guard'
import { ExportAuditLogsQuerySchema, GetAuditLogsQuerySchema } from '../../../schemas/admin'

const adminAuditLogs = new Hono<AppEnv>()

adminAuditLogs.use('/*', requireResource('global'))

/**
 * GET /api/admin/audit-logs
 * 查询审计日志（支持筛选）
 */
adminAuditLogs.get(
  '/',
  describeRoute({
    summary: '获取审计日志',
    description: '查询审计日志，支持分页和筛选',
    tags: ['Admin'],
    operationId: 'getAuditLogs',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '审计日志列表' },
    },
  }),
  validator('query', GetAuditLogsQuerySchema),
  async (c) => {
    const { page, limit, userId, resourceType, action } = c.req.valid('query')
    const db = c.get('db')
    const offset = (page - 1) * limit

    try {
      const conditions: any[] = []

      if (userId) {
        conditions.push(eq(auditLogs.userId, userId))
      }

      if (resourceType) {
        conditions.push(eq(auditLogs.resourceType, resourceType))
      }

      if (action) {
        conditions.push(eq(auditLogs.action, action))
      }

      // Date filtering handled by query schema (dateFrom/dateTo mapped to startDate/endDate)
      // These fields are already validated and converted

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const [results, totalResult] = await Promise.all([
        db.query.auditLogs.findMany({
          where: whereClause,
          orderBy: desc(auditLogs.createdAt),
          limit,
          offset,
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        db
          .select({ value: count() })
          .from(auditLogs)
          .where(whereClause)
          .then(res => res[0]?.value || 0),
      ])

      return c.json({
        data: results,
        meta: {
          total: totalResult,
          page,
          limit,
          totalPages: Math.ceil(totalResult / limit),
        },
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/AuditLogs] ❌ Failed to query audit logs:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/audit-logs/export
 * 导出审计日志为 CSV 或 JSON
 */
adminAuditLogs.get(
  '/export',
  describeRoute({
    summary: '导出审计日志',
    description: '导出审计日志为 CSV 或 JSON 格式',
    tags: ['Admin'],
    operationId: 'exportAuditLogs',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '导出文件' },
    },
  }),
  validator('query', ExportAuditLogsQuerySchema),
  async (c) => {
    const { format, userId, resourceType, action, dateFrom: startDate, dateTo: endDate } = c.req.valid('query')
    const db = c.get('db')

    try {
      const conditions: any[] = []

      if (userId) {
        conditions.push(eq(auditLogs.userId, userId))
      }

      if (resourceType) {
        conditions.push(eq(auditLogs.resourceType, resourceType))
      }

      if (action) {
        conditions.push(eq(auditLogs.action, action))
      }

      if (startDate) {
        conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
      }

      if (endDate) {
        conditions.push(lte(auditLogs.createdAt, new Date(endDate)))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const logs = await db.query.auditLogs.findMany({
        where: whereClause,
        orderBy: desc(auditLogs.createdAt),
        limit: 10000,
      })

      if (format === 'csv') {
        const csvHeader = 'ID,User Email,Action,Resource Type,Resource ID,Affected Count,Created At,IP Address\n'
        const csvRows = logs.map(log =>
          [
            log.id,
            log.userEmail,
            log.action,
            log.resourceType,
            log.resourceId || '',
            log.affectedCount || 1,
            log.createdAt?.toISOString() || '',
            log.ipAddress || '',
          ].join(','),
        ).join('\n')

        const csv = csvHeader + csvRows

        return c.text(csv, 200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`,
        })
      }
      else {
        return c.json(logs, 200, {
          'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.json"`,
        })
      }
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/AuditLogs] ❌ Failed to export audit logs:', message)
      return c.json({ error: 'Export failed' }, 500)
    }
  },
)

export const adminAuditLogsRoutes = adminAuditLogs
