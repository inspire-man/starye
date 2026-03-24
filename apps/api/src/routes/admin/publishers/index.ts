/* eslint-disable no-console */
/**
 * 厂商管理 API 路由
 *
 * 提供厂商 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../../../types'
import { zValidator } from '@hono/zod-validator'
import { movies, publishers } from '@starye/db/schema'
import { and, count, desc, eq, gt, isNotNull, isNull, like } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { CacheKeys, CacheManager, CacheTTL, withCache } from '../../../lib/cache'
import { captureResourceState, createAuditLog } from '../../../middleware/audit-logger'
import { requireResource } from '../../../middleware/resource-guard'

const adminPublishers = new Hono<AppEnv>()

adminPublishers.use('/*', requireResource('movie'))

/**
 * GET /api/admin/publishers/countries
 * 获取所有不同的国家列表（用于筛选器）
 */
adminPublishers.get('/countries', async (c) => {
  const db = c.get('db')
  const cache = new CacheManager(c.env.CACHE)

  try {
    const cacheKey = CacheKeys.publisherCountries()

    return await withCache(
      cacheKey,
      CacheTTL.STATS,
      async () => {
        const results = await db
          .selectDistinct({ country: publishers.country })
          .from(publishers)
          .where(isNotNull(publishers.country))
          .orderBy(publishers.country)

        const countries = results
          .map(r => r.country)
          .filter(c => c && c.trim() !== '')

        return { countries }
      },
      cache,
    ).then(result => c.json(result))
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Admin/Publishers] ❌ Failed to get countries:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * GET /api/admin/publishers/stats
 * 厂商统计信息
 */
adminPublishers.get('/stats', async (c) => {
  const db = c.get('db')
  const cache = new CacheManager(c.env.CACHE)

  try {
    const cacheKey = CacheKeys.publisherStats()

    return await withCache(
      cacheKey,
      CacheTTL.STATS,
      async () => {
        const [totalCount, pendingCount, withSourceUrlCount] = await Promise.all([
          db.select({ value: count() }).from(publishers).then(res => res[0]?.value || 0),
          db
            .select({ value: count() })
            .from(publishers)
            .where(eq(publishers.hasDetailsCrawled, false))
            .then(res => res[0]?.value || 0),
          db
            .select({ value: count() })
            .from(publishers)
            .where(and(eq(publishers.hasDetailsCrawled, false), like(publishers.sourceUrl, '%/studio/%')))
            .then(res => res[0]?.value || 0),
        ])

        return {
          total: totalCount,
          crawled: totalCount - pendingCount,
          pending: pendingCount,
          withSourceUrl: withSourceUrlCount,
          crawledPercentage: totalCount > 0 ? Math.round(((totalCount - pendingCount) / totalCount) * 100) : 0,
        }
      },
      cache,
    ).then(result => c.json(result))
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Admin/Publishers] ❌ Failed to query stats:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * GET /api/admin/publishers
 * 厂商列表（按作品数排序，支持搜索和筛选）
 */
adminPublishers.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    onlyPending: z.enum(['true', 'false']).optional(), // 向后兼容
    crawlStatus: z.enum(['complete', 'pending', 'failed', 'no-link']).optional(), // 爬取状态筛选
    country: z.string().optional(), // 国家筛选
  })),
  async (c) => {
    const { page, limit, search, onlyPending, crawlStatus, country } = c.req.valid('query')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)
    const offset = (page - 1) * limit

    try {
      // 构建筛选器对象用于缓存键
      const filters = {
        search: search || '',
        crawlStatus: crawlStatus || '',
        country: country || '',
        onlyPending: onlyPending || '',
      }

      const cacheKey = CacheKeys.publisherList(page, limit, filters)

      return await withCache(
        cacheKey,
        CacheTTL.LIST,
        async () => {
          const conditions = []

          // 搜索条件
          if (search) {
            conditions.push(like(publishers.name, `%${search}%`))
          }

          // 爬取状态筛选（优先使用新参数，兼容旧参数）
          if (crawlStatus) {
            switch (crawlStatus) {
              case 'complete':
                conditions.push(eq(publishers.hasDetailsCrawled, true))
                break
              case 'pending':
                conditions.push(
                  and(
                    eq(publishers.hasDetailsCrawled, false),
                    eq(publishers.crawlFailureCount, 0),
                    isNotNull(publishers.sourceUrl),
                  )!,
                )
                break
              case 'failed':
                conditions.push(
                  and(
                    eq(publishers.hasDetailsCrawled, false),
                    gt(publishers.crawlFailureCount, 0),
                  )!,
                )
                break
              case 'no-link':
                conditions.push(
                  and(
                    eq(publishers.hasDetailsCrawled, false),
                    isNull(publishers.sourceUrl),
                  )!,
                )
                break
            }
          }
          else if (onlyPending === 'true') {
            // 向后兼容旧参数
            conditions.push(eq(publishers.hasDetailsCrawled, false))
          }

          // 国家筛选
          if (country) {
            conditions.push(eq(publishers.country, country))
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined

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

          return {
            data: results,
            meta: {
              total: totalResult,
              page,
              limit,
              totalPages: Math.ceil(totalResult / limit),
            },
          }
        },
        cache,
      ).then(result => c.json(result))
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
    const cache = new CacheManager(c.env.CACHE)

    try {
      const before = await captureResourceState(c, 'publisher', publisherId)

      if (!before) {
        return c.json({ error: 'Publisher not found' }, 404)
      }

      await db.update(publishers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(publishers.id, publisherId))

      // 清除相关缓存
      await Promise.all([
        cache.delete(CacheKeys.publisherDetail(publisherId)),
        cache.deleteByPrefix('publishers:list:'),
        cache.delete(CacheKeys.publisherStats()),
      ])

      console.log(`[Admin/Publishers] ✓ Updated publisher ${publisherId} and cleared cache`)
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
    const cache = new CacheManager(c.env.CACHE)

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

      // 清除相关缓存
      await cache.clearPublisherCache()

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

export const adminPublishersRoutes = adminPublishers
