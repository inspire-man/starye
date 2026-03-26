/* eslint-disable no-console */
/**
 * 厂商管理 API 路由
 *
 * 提供厂商 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../../../types'
import { movies, publishers } from '@starye/db/schema'
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, like, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { CacheKeys, CacheManager, CacheTTL, withCache } from '../../../lib/cache'
import { captureResourceState, createAuditLog } from '../../../middleware/audit-logger'
import { requireResource } from '../../../middleware/resource-guard'
import {
  BatchQueryPublisherStatusSchema,
  BatchSyncPublishersSchema,
  CreatePublisherSchema,
  GetAdminPublishersQuerySchema,
  GetPendingPublishersQuerySchema,
  MergePublishersSchema,
  SyncPublisherDetailsSchema,
  UpdatePublisherSchema,
} from '../../../schemas/admin'

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
  describeRoute({
    summary: '获取厂商列表（管理）',
    description: '支持分页、搜索、筛选的厂商列表接口',
    tags: ['Admin'],
    operationId: 'getAdminPublishersList',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '厂商列表' },
    },
  }),
  validator('query', GetAdminPublishersQuerySchema),
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
  describeRoute({
    summary: '更新厂商信息',
    description: '更新指定厂商的元数据',
    tags: ['Admin'],
    operationId: 'updatePublisherInfo',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  validator('json', UpdatePublisherSchema),
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
  describeRoute({
    summary: '合并厂商',
    description: '将多个重复的厂商记录合并为一个',
    tags: ['Admin'],
    operationId: 'mergePublisherRecords',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '合并成功' },
    },
  }),
  validator('json', MergePublishersSchema),
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
 * GET /api/admin/publishers/batch-status
 * 批量查询厂商状态
 */
adminPublishers.get(
  '/batch-status',
  describeRoute({
    summary: '批量查询厂商状态',
    description: '批量查询多个厂商的爬取状态，用于爬虫增量优化',
    tags: ['Admin'],
    operationId: 'batchQueryPublisherStatus',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '状态映射' },
      400: { description: '参数错误' },
    },
  }),
  validator('query', BatchQueryPublisherStatusSchema),
  async (c) => {
    const { ids: idsParam } = c.req.valid('query')
    const db = c.get('db')

    try {
      const startTime = Date.now()

      // 解析 IDs
      const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)

      if (ids.length === 0) {
        return c.json({ error: 'No IDs provided' }, 400)
      }

      if (ids.length > 200) {
        return c.json({ error: 'Too many IDs (max 200)' }, 400)
      }

      // 批量查询
      const results = await db.query.publishers.findMany({
        where: inArray(publishers.id, ids),
        columns: {
          id: true,
          hasDetailsCrawled: true,
          crawlFailureCount: true,
          movieCount: true,
          lastCrawlAttempt: true,
          sourceUrl: true,
        },
      })

      // 构建状态映射
      const statusMap: Record<string, any> = {}
      for (const id of ids) {
        const result = results.find(r => r.id === id)
        statusMap[id] = result
          ? {
              exists: true,
              hasDetailsCrawled: result.hasDetailsCrawled,
              crawlFailureCount: result.crawlFailureCount,
              movieCount: result.movieCount,
              lastCrawlAttempt: result.lastCrawlAttempt,
              sourceUrl: result.sourceUrl,
            }
          : { exists: false }
      }

      const elapsed = Date.now() - startTime

      // 性能日志
      if (elapsed > 1000) {
        console.warn(`[Admin/Publishers] ⚠️ Batch status query took ${elapsed}ms for ${ids.length} IDs`)
      }

      console.log(`[Admin/Publishers] ✓ Batch status query: ${ids.length} IDs in ${elapsed}ms`)

      return c.json(statusMap)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Publishers] ❌ Failed to batch query status:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/publishers/pending
 * 获取待爬取的厂商列表
 */
adminPublishers.get(
  '/pending',
  describeRoute({
    summary: '获取待爬取厂商列表',
    description: '返回待爬取的厂商列表，按优先级排序',
    tags: ['Admin'],
    operationId: 'getPendingPublishers',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '待爬取厂商列表' },
    },
  }),
  validator('query', GetPendingPublishersQuerySchema),
  async (c) => {
    const { limit } = c.req.valid('query')
    const db = c.get('db')

    try {
      // 筛选条件：未爬取、有 sourceUrl、失败次数 < 3
      const results = await db.query.publishers.findMany({
        where: and(
          eq(publishers.hasDetailsCrawled, false),
          isNotNull(publishers.sourceUrl),
          lt(publishers.crawlFailureCount, 3),
        ),
        columns: {
          id: true,
          name: true,
          sourceUrl: true,
          movieCount: true,
          crawlFailureCount: true,
          lastCrawlAttempt: true,
        },
        orderBy: [desc(publishers.movieCount), publishers.crawlFailureCount, publishers.lastCrawlAttempt],
        limit,
      })

      // 统计高优先级数量（movieCount >= 10）
      const highPriorityCount = results.filter(p => p.movieCount >= 10).length

      console.log(`[Admin/Publishers] ✓ Returned ${results.length} pending publishers (${highPriorityCount} high priority)`)

      return c.json({
        publishers: results,
        total: results.length,
        highPriority: highPriorityCount,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Publishers] ❌ Failed to get pending publishers:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * POST /api/admin/publishers/:id/details
 * 同步厂商详情
 */
adminPublishers.post(
  '/:id/details',
  describeRoute({
    summary: '同步厂商详情',
    description: '更新厂商的详细信息并标记为已爬取',
    tags: ['Admin'],
    operationId: 'syncPublisherDetails',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '同步成功' },
      404: { description: '厂商不存在' },
    },
  }),
  validator('json', SyncPublisherDetailsSchema),
  async (c) => {
    const publisherId = c.req.param('id')
    const details = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const publisher = await db.query.publishers.findFirst({
        where: eq(publishers.id, publisherId),
      })

      if (!publisher) {
        return c.json({ error: 'Publisher not found' }, 404)
      }

      // 计算数据完整度（权重：logo 30%, website 20%, description 20%, foundedYear 15%, country 15%）
      const fields = [
        { key: 'logo', weight: 0.30 },
        { key: 'website', weight: 0.20 },
        { key: 'description', weight: 0.20 },
        { key: 'foundedYear', weight: 0.15 },
        { key: 'country', weight: 0.15 },
      ]

      let completeness = 0
      for (const field of fields) {
        const value = details[field.key as keyof typeof details]
        if (value !== null && value !== undefined && value !== '') {
          completeness += field.weight
        }
      }

      // 更新数据库
      const updateData: any = {
        ...details,
        hasDetailsCrawled: true,
        crawlFailureCount: 0,
        lastCrawlAttempt: new Date(),
        updatedAt: new Date(),
      }

      await db.update(publishers).set(updateData).where(eq(publishers.id, publisherId))

      // 清除缓存
      await Promise.all([
        cache.delete(CacheKeys.publisherDetail(publisherId)),
        cache.deleteByPrefix('publishers:list:'),
        cache.delete(CacheKeys.publisherStats()),
      ])

      console.log(`[Admin/Publishers] ✓ Synced details for publisher ${publisherId} (completeness: ${(completeness * 100).toFixed(0)}%)`)

      return c.json({
        success: true,
        dataCompleteness: completeness,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Publishers] ❌ Failed to sync details for publisher ${publisherId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/publishers/batch-sync
 * 批量同步厂商
 */
adminPublishers.post(
  '/batch-sync',
  describeRoute({
    summary: '批量同步厂商',
    description: '批量创建或更新厂商的 sourceUrl',
    tags: ['Admin'],
    operationId: 'batchSyncPublishers',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '同步成功' },
    },
  }),
  validator('json', BatchSyncPublishersSchema),
  async (c) => {
    const { publishers: publishersData } = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      let createdCount = 0
      let updatedCount = 0

      for (const publisherData of publishersData) {
        // 查找是否已存在
        const existing = await db.query.publishers.findFirst({
          where: eq(publishers.name, publisherData.name),
        })

        if (existing) {
          // 更新 sourceUrl
          await db
            .update(publishers)
            .set({
              sourceUrl: publisherData.sourceUrl,
              updatedAt: new Date(),
            })
            .where(eq(publishers.id, existing.id))

          updatedCount++
        }
        else {
          // 创建新记录
          const slug = publisherData.name.toLowerCase().replace(/\s+/g, '-')
          const newPublisher = {
            id: crypto.randomUUID(),
            name: publisherData.name,
            slug,
            source: 'javbus',
            sourceId: slug,
            sourceUrl: publisherData.sourceUrl,
            movieCount: 0,
            hasDetailsCrawled: false,
            crawlFailureCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          await db.insert(publishers).values(newPublisher)
          createdCount++
        }
      }

      // 清除缓存
      await cache.clearPublisherCache()

      console.log(`[Admin/Publishers] ✓ Batch sync: created ${createdCount}, updated ${updatedCount}`)

      return c.json({
        success: true,
        created: createdCount,
        updated: updatedCount,
        total: publishersData.length,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Publishers] ❌ Failed to batch sync publishers:', message)
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
  describeRoute({
    summary: '创建厂商',
    description: '创建新的厂商记录',
    tags: ['Admin'],
    operationId: 'createPublisher',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '创建成功' },
      400: { description: '验证失败' },
    },
  }),
  validator('json', CreatePublisherSchema),
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
