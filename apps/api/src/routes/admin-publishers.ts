/* eslint-disable no-console */
/**
 * 厂商管理 API 路由
 *
 * 提供厂商 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { movies, publishers } from '@starye/db/schema'
import { count, desc, eq, like } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { captureResourceState, createAuditLog } from '../middleware/audit-logger'
import { requireResource } from '../middleware/resource-guard'

const adminPublishers = new Hono<AppEnv>()

adminPublishers.use('/*', requireResource('movie'))

/**
 * GET /api/admin/publishers
 * 厂商列表（按作品数排序，支持搜索）
 */
adminPublishers.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
  })),
  async (c) => {
    const { page, limit, search } = c.req.valid('query')
    const db = c.get('db')
    const offset = (page - 1) * limit

    try {
      const whereClause = search ? like(publishers.name, `%${search}%`) : undefined

      const [results, totalResult] = await Promise.all([
        db.query.publishers.findMany({
          where: whereClause,
          orderBy: desc(publishers.movieCount),
          limit,
          offset,
        }),
        db
          .select({ value: count() })
          .from(publishers)
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
      console.error('[Admin/Publishers] ❌ Failed to query publishers:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/publishers/:id
 * 厂商详情（包含关联电影列表）
 */
adminPublishers.get('/:id', async (c) => {
  const publisherId = c.req.param('id')
  const db = c.get('db')

  try {
    const publisher = await db.query.publishers.findFirst({
      where: eq(publishers.id, publisherId),
    })

    if (!publisher) {
      return c.json({ error: 'Publisher not found' }, 404)
    }

    const relatedMovies = await db.query.movies.findMany({
      where: like(movies.publisher, `%${publisher.name}%`),
      columns: {
        id: true,
        code: true,
        title: true,
        coverImage: true,
        releaseDate: true,
      },
      orderBy: desc(movies.releaseDate),
      limit: 100,
    })

    return c.json({
      ...publisher,
      relatedMovies,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Publishers] ❌ Failed to get publisher ${publisherId}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * PATCH /api/admin/publishers/:id
 * 编辑厂商信息
 */
adminPublishers.patch(
  '/:id',
  zValidator('json', z.object({
    name: z.string().optional(),
    logo: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
    foundedYear: z.number().optional(),
    country: z.string().optional(),
  })),
  async (c) => {
    const publisherId = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const before = await captureResourceState(c, 'publisher', publisherId)

      if (!before) {
        return c.json({ error: 'Publisher not found' }, 404)
      }

      await db.update(publishers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(publishers.id, publisherId))

      console.log(`[Admin/Publishers] ✓ Updated publisher ${publisherId}`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Publishers] ❌ Failed to update publisher ${publisherId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/publishers/:id/logo
 * 上传厂商 logo 到 R2
 *
 * TODO: 实现 R2 上传逻辑
 */
adminPublishers.post('/:id/logo', async (c) => {
  const _publisherId = c.req.param('id')

  return c.json({
    error: 'R2 upload not implemented yet',
    todo: 'Implement R2 upload logic',
  }, 501)
})

/**
 * POST /api/admin/publishers/merge
 * 合并重复厂商
 */
adminPublishers.post(
  '/merge',
  zValidator('json', z.object({
    sourceId: z.string(),
    targetId: z.string(),
  })),
  async (c) => {
    const { sourceId, targetId } = c.req.valid('json')
    const db = c.get('db')

    try {
      const [sourcePublisher, targetPublisher] = await Promise.all([
        db.query.publishers.findFirst({ where: eq(publishers.id, sourceId) }),
        db.query.publishers.findFirst({ where: eq(publishers.id, targetId) }),
      ])

      if (!sourcePublisher || !targetPublisher) {
        return c.json({ error: 'Publisher not found' }, 404)
      }

      const affectedMovies = await db.query.movies.findMany({
        where: like(movies.publisher, `%${sourcePublisher.name}%`),
      })

      for (const movie of affectedMovies) {
        const updatedPublisher = (movie.publisher || '').replace(
          sourcePublisher.name,
          targetPublisher.name,
        )

        await db.update(movies)
          .set({ publisher: updatedPublisher, updatedAt: new Date() })
          .where(eq(movies.id, movie.id))
      }

      await db.update(publishers)
        .set({
          movieCount: targetPublisher.movieCount + sourcePublisher.movieCount,
          updatedAt: new Date(),
        })
        .where(eq(publishers.id, targetId))

      await db.delete(publishers).where(eq(publishers.id, sourceId))

      const mergeChanges: Record<string, any> = {
        operation: 'merge',
        sourcePublisher: sourcePublisher.name,
        targetPublisher: targetPublisher.name,
        affectedMovies: affectedMovies.length,
      }

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'publisher',
        resourceId: targetId,
        resourceIdentifier: targetPublisher.name,
        affectedCount: affectedMovies.length,
        changes: mergeChanges,
      })

      console.log(`[Admin/Publishers] ✓ Merged ${sourcePublisher.name} into ${targetPublisher.name}, affected ${affectedMovies.length} movies`)

      return c.json({
        success: true,
        mergedCount: affectedMovies.length,
        targetName: targetPublisher.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Publishers] ❌ Failed to merge publishers:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/publishers
 * 创建新厂商
 */
adminPublishers.post(
  '/',
  zValidator('json', z.object({
    name: z.string().min(1),
  })),
  async (c) => {
    const { name } = c.req.valid('json')
    const db = c.get('db')

    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-')

      const newPublisher = {
        id: crypto.randomUUID(),
        name,
        slug,
        source: 'manual',
        sourceId: slug,
        movieCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await db.insert(publishers).values(newPublisher)

      await createAuditLog(c, {
        action: 'CREATE',
        resourceType: 'publisher',
        resourceId: newPublisher.id,
        resourceIdentifier: name,
        changes: { name },
      })

      console.log(`[Admin/Publishers] ✓ Created publisher: ${name}`)

      return c.json({
        id: newPublisher.id,
        name: newPublisher.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Publishers] ❌ Failed to create publisher:', message)
      return c.json({ error: message }, 500)
    }
  },
)

export default adminPublishers
