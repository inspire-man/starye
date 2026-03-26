/* eslint-disable no-console */
/**
 * 演员管理 API 路由
 *
 * 提供演员 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../../../types'
import { actors, movieActors, movies } from '@starye/db/schema'
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, like, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { CacheKeys, CacheManager, CacheTTL, withCache } from '../../../lib/cache'
import { captureResourceState, createAuditLog } from '../../../middleware/audit-logger'
import { requireResource } from '../../../middleware/resource-guard'
import {
  AddActorAliasSchema,
  BatchDeleteSchema,
  BatchQueryActorStatusSchema,
  BatchSyncActorsSchema,
  CreateActorSchema,
  GetAdminActorsQuerySchema,
  GetPendingActorsQuerySchema,
  MergeActorsSchema,
  SyncActorDetailsSchema,
  UpdateActorSchema,
} from '../../../schemas/admin'

const adminActors = new Hono<AppEnv>()

adminActors.use('/*', requireResource('movie'))

/**
 * GET /api/admin/actors/nationalities
 * 获取所有不同的国籍列表（用于筛选器）
 */
adminActors.get(
  '/nationalities',
  describeRoute({
    summary: '获取演员国籍列表',
    description: '返回所有不同的演员国籍，用于筛选器',
    tags: ['Admin'],
    operationId: 'getActorNationalities',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '国籍列表' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const cacheKey = CacheKeys.actorNationalities()

      return await withCache(
        cacheKey,
        CacheTTL.STATS,
        async () => {
          const results = await db
            .selectDistinct({ nationality: actors.nationality })
            .from(actors)
            .where(isNotNull(actors.nationality))
            .orderBy(actors.nationality)

          const nationalities = results
            .map(r => r.nationality)
            .filter(n => n && n.trim() !== '')

          return { nationalities }
        },
        cache,
      ).then(result => c.json(result))
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to get nationalities:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors/stats
 * 女优统计信息
 */
adminActors.get(
  '/stats',
  describeRoute({
    summary: '获取演员统计信息',
    description: '返回演员数量统计，包括待审核、爬取失败等状态',
    tags: ['Admin'],
    operationId: 'getAdminActorsStats',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '统计信息' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const cacheKey = CacheKeys.actorStats()

      return await withCache(
        cacheKey,
        CacheTTL.STATS,
        async () => {
          const [totalCount, pendingCount, withSourceUrlCount] = await Promise.all([
            db.select({ value: count() }).from(actors).then(res => res[0]?.value || 0),
            db
              .select({ value: count() })
              .from(actors)
              .where(eq(actors.hasDetailsCrawled, false))
              .then(res => res[0]?.value || 0),
            db
              .select({ value: count() })
              .from(actors)
              .where(and(eq(actors.hasDetailsCrawled, false), like(actors.sourceUrl, '%/star/%')))
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
      console.error('[Admin/Actors] ❌ Failed to query stats:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors
 * 演员列表（按作品数排序，支持搜索和筛选）
 */
adminActors.get(
  '/',
  describeRoute({
    summary: '获取演员列表（管理）',
    description: '支持分页、搜索、筛选、排序的演员列表接口',
    tags: ['Admin'],
    operationId: 'getAdminActorsList',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '演员列表' },
    },
  }),
  validator('query', GetAdminActorsQuerySchema),
  async (c) => {
    const { page, limit, search, onlyPending, crawlStatus, nationality } = c.req.valid('query')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)
    const offset = (page - 1) * limit

    try {
      // 构建筛选器对象用于缓存键
      const filters = {
        search: search || '',
        crawlStatus: crawlStatus || '',
        nationality: nationality || '',
        onlyPending: onlyPending || '',
      }

      const cacheKey = CacheKeys.actorList(page, limit, filters)

      return await withCache(
        cacheKey,
        CacheTTL.LIST,
        async () => {
          const conditions = []

          // 搜索条件
          if (search) {
            conditions.push(like(actors.name, `%${search}%`))
          }

          // 爬取状态筛选（优先使用新参数，兼容旧参数）
          if (crawlStatus) {
            switch (crawlStatus) {
              case 'complete':
                conditions.push(eq(actors.hasDetailsCrawled, true))
                break
              case 'pending':
                conditions.push(
                  and(
                    eq(actors.hasDetailsCrawled, false),
                    eq(actors.crawlFailureCount, 0),
                    isNotNull(actors.sourceUrl),
                  )!,
                )
                break
              case 'failed':
                conditions.push(
                  and(
                    eq(actors.hasDetailsCrawled, false),
                    gt(actors.crawlFailureCount, 0),
                  )!,
                )
                break
              case 'no-link':
                conditions.push(
                  and(
                    eq(actors.hasDetailsCrawled, false),
                    isNull(actors.sourceUrl),
                  )!,
                )
                break
            }
          }
          else if (onlyPending === 'true') {
            // 向后兼容旧参数
            conditions.push(eq(actors.hasDetailsCrawled, false))
          }

          // 国籍筛选
          if (nationality) {
            conditions.push(eq(actors.nationality, nationality))
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined

          // 如果有搜索条件，先获取所有可能匹配的演员（包括别名匹配）
          let results: typeof actors.$inferSelect[]
          let totalResult: number

          if (search) {
            // 获取更多结果以支持别名搜索
            const allResults = await db.query.actors.findMany({
              where: whereClause,
              orderBy: desc(actors.movieCount),
            })

            // 在内存中筛选：匹配名称或别名
            const searchLower = search.toLowerCase()
            const filteredResults = allResults.filter((actor) => {
              // 匹配名称
              if (actor.name.toLowerCase().includes(searchLower)) {
                return true
              }

              // 匹配别名
              const aliases = (actor.aliases as string[]) || []
              return aliases.some(alias => alias.toLowerCase().includes(searchLower))
            })

            totalResult = filteredResults.length
            results = filteredResults.slice(offset, offset + limit)
          }
          else {
            // 无搜索条件时使用原有逻辑
            const [queryResults, countResult] = await Promise.all([
              db.query.actors.findMany({
                where: whereClause,
                orderBy: desc(actors.movieCount),
                limit,
                offset,
              }),
              db
                .select({ value: count() })
                .from(actors)
                .where(whereClause)
                .then(res => res[0]?.value || 0),
            ])

            results = queryResults
            totalResult = countResult
          }

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
      console.error('[Admin/Actors] ❌ Failed to query actors:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors/batch-status
 * 批量查询女优状态（爬虫专用端口）
 */
adminActors.get(
  '/batch-status',
  describeRoute({
    summary: '批量查询演员状态',
    description: '批量查询多个演员的爬取状态，用于爬虫增量优化',
    tags: ['Admin'],
    operationId: 'batchQueryActorStatus',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '状态映射' },
      400: { description: '参数错误' },
    },
  }),
  validator('query', BatchQueryActorStatusSchema),
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
      const results = await db.query.actors.findMany({
        where: inArray(actors.id, ids),
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
        console.warn(`[Admin/Actors] ⚠️ Batch status query took ${elapsed}ms for ${ids.length} IDs`)
      }

      console.log(`[Admin/Actors] ✓ Batch status query: ${ids.length} IDs in ${elapsed}ms`)

      return c.json(statusMap)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to batch query status:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors/pending
 * 获取待爬取的女优列表（爬虫专用端口）
 */
adminActors.get(
  '/pending',
  describeRoute({
    summary: '获取待爬取演员列表',
    description: '返回待爬取的演员列表，按优先级排序',
    tags: ['Admin'],
    operationId: 'getPendingActors',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '待爬取演员列表' },
    },
  }),
  validator('query', GetPendingActorsQuerySchema),
  async (c) => {
    const { limit } = c.req.valid('query')
    const db = c.get('db')

    try {
      // 筛选条件：
      // 1. 未爬取详情的女优（hasDetailsCrawled=false）
      // 2. 已爬取但头像是外链的女优（头像不以 R2_PUBLIC_URL 开头）
      // 3. 有 sourceUrl
      // 4. 失败次数 < 3
      const r2PublicUrl = c.env.R2_PUBLIC_URL || ''

      const allActors = await db.query.actors.findMany({
        where: and(
          isNotNull(actors.sourceUrl),
          lt(actors.crawlFailureCount, 3),
        ),
        columns: {
          id: true,
          name: true,
          sourceUrl: true,
          movieCount: true,
          crawlFailureCount: true,
          lastCrawlAttempt: true,
          hasDetailsCrawled: true,
          avatar: true,
        },
        orderBy: [desc(actors.movieCount), actors.crawlFailureCount, actors.lastCrawlAttempt],
        limit: limit * 2, // 多取一些，过滤后可能不够
      })

      // 过滤：未爬取 或 已爬取但头像是外链
      const results = allActors.filter((actor) => {
        // 未爬取的直接包含
        if (!actor.hasDetailsCrawled) {
          return true
        }
        // 已爬取但头像是外链的也包含（需要补全）
        if (actor.avatar && !actor.avatar.startsWith(r2PublicUrl)) {
          return true
        }
        return false
      }).slice(0, limit) // 取前 limit 个

      // 统计高优先级数量（movieCount >= 10）
      const highPriorityCount = results.filter(a => a.movieCount >= 10).length
      const needsAvatarUpdate = results.filter(a => a.hasDetailsCrawled && a.avatar && !a.avatar.startsWith(r2PublicUrl)).length

      console.log(`[Admin/Actors] ✓ Returned ${results.length} pending actors (${highPriorityCount} high priority, ${needsAvatarUpdate} need avatar update)`)

      return c.json({
        actors: results.map(a => ({
          id: a.id,
          name: a.name,
          sourceUrl: a.sourceUrl,
          movieCount: a.movieCount,
          crawlFailureCount: a.crawlFailureCount,
          lastCrawlAttempt: a.lastCrawlAttempt,
          hasDetailsCrawled: a.hasDetailsCrawled,
          needsAvatarUpdate: a.hasDetailsCrawled && a.avatar ? !a.avatar.startsWith(r2PublicUrl) : false,
        })),
        total: results.length,
        highPriority: highPriorityCount,
        needsAvatarUpdate,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to get pending actors:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors/:id
 * 获取单个演员详情（包含关联电影列表）
 */
adminActors.get(
  '/:id',
  describeRoute({
    summary: '获取演员详情（管理）',
    description: '获取指定演员的详细信息，包含关联电影列表',
    tags: ['Admin'],
    operationId: 'getAdminActorDetail',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '演员详情' },
      404: { description: '演员不存在' },
    },
  }),
  async (c) => {
    const actorId = c.req.param('id')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const cacheKey = CacheKeys.actorDetail(actorId)

      return await withCache(
        cacheKey,
        CacheTTL.DETAIL,
        async () => {
          const actor = await db.query.actors.findFirst({
            where: eq(actors.id, actorId),
          })

          if (!actor) {
            return { error: 'Actor not found', status: 404, data: null, movies: [] }
          }

          // 查询关联的电影（通过 movieActors 关联表）
          const movieRelations = await db.query.movieActors.findMany({
            where: eq(movieActors.actorId, actorId),
            with: {
              movie: {
                columns: {
                  id: true,
                  code: true,
                  title: true,
                  coverImage: true,
                  releaseDate: true,
                },
              },
            },
            orderBy: desc(movieActors.sortOrder),
            limit: 100,
          })

          const movies = movieRelations.map(rel => rel.movie).filter(Boolean)

          return { data: actor, movies, status: 200 }
        },
        cache,
      ).then((result) => {
        if (result.status === 404) {
          return c.json({ error: result.error }, 404)
        }
        return c.json(result)
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to get actor ${actorId}:`, message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * PATCH /api/admin/actors/:id
 * 编辑演员信息
 */
adminActors.patch(
  '/:id',
  describeRoute({
    summary: '更新演员信息',
    description: '更新指定演员的元数据',
    tags: ['Admin'],
    operationId: 'updateAdminActor',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
      404: { description: '演员不存在' },
    },
  }),
  validator('json', UpdateActorSchema),
  async (c) => {
    const actorId = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const before = await captureResourceState(c, 'actor', actorId)

      if (!before) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      }

      if (data.birthDate) {
        updateData.birthDate = new Date(data.birthDate)
      }

      await db.update(actors)
        .set(updateData)
        .where(eq(actors.id, actorId))

      // 清除相关缓存
      await Promise.all([
        cache.delete(CacheKeys.actorDetail(actorId)),
        cache.deleteByPrefix('actors:list:'),
        cache.delete(CacheKeys.actorStats()),
      ])

      console.log(`[Admin/Actors] ✓ Updated actor ${actorId} and cleared cache`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to update actor ${actorId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/:id/avatar
 * 上传演员头像到 R2
 *
 * TODO: 实现 R2 上传逻辑
 */
adminActors.post('/:id/avatar', async (c) => {
  const _actorId = c.req.param('id')

  return c.json({
    error: 'R2 upload not implemented yet',
    todo: 'Implement R2 upload logic',
  }, 501)
})

/**
 * POST /api/admin/actors/merge
 * 合并重复演员
 */
adminActors.post(
  '/merge',
  describeRoute({
    summary: '合并演员',
    description: '将多个重复的演员记录合并为一个',
    tags: ['Admin'],
    operationId: 'mergeAdminActors',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '合并成功' },
    },
  }),
  validator('json', MergeActorsSchema),
  async (c) => {
    const { sourceId, targetId } = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const [sourceActor, targetActor] = await Promise.all([
        db.query.actors.findFirst({ where: eq(actors.id, sourceId) }),
        db.query.actors.findFirst({ where: eq(actors.id, targetId) }),
      ])

      if (!sourceActor || !targetActor) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const affectedMovies = await db.query.movies.findMany({
        where: like(movies.actors, `%${sourceActor.name}%`),
      })

      for (const movie of affectedMovies) {
        const actorList = (movie.actors as string[]) || []
        const updatedActors = actorList.map(name =>
          name === sourceActor.name ? targetActor.name : name,
        )

        await db.update(movies)
          .set({ actors: updatedActors, updatedAt: new Date() })
          .where(eq(movies.id, movie.id))
      }

      await db.update(actors)
        .set({
          movieCount: targetActor.movieCount + sourceActor.movieCount,
          updatedAt: new Date(),
        })
        .where(eq(actors.id, targetId))

      await db.delete(actors).where(eq(actors.id, sourceId))

      // 清除相关缓存
      await cache.clearActorCache()

      const mergeChanges: Record<string, any> = {
        operation: 'merge',
        sourceActor: sourceActor.name,
        targetActor: targetActor.name,
        affectedMovies: affectedMovies.length,
      }

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'actor',
        resourceId: targetId,
        resourceIdentifier: targetActor.name,
        affectedCount: affectedMovies.length,
        changes: mergeChanges,
      })

      console.log(`[Admin/Actors] ✓ Merged ${sourceActor.name} into ${targetActor.name}, affected ${affectedMovies.length} movies`)

      return c.json({
        success: true,
        mergedCount: affectedMovies.length,
        targetName: targetActor.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to merge actors:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors
 * 创建新女优
 */
adminActors.post(
  '/',
  describeRoute({
    summary: '创建演员',
    description: '创建新的演员记录',
    tags: ['Admin'],
    operationId: 'createAdminActor',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '创建成功' },
      400: { description: '验证失败' },
    },
  }),
  validator('json', CreateActorSchema),
  async (c) => {
    const { name } = c.req.valid('json')
    const db = c.get('db')

    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-')

      const newActor = {
        id: crypto.randomUUID(),
        name,
        slug,
        source: 'manual',
        sourceId: slug,
        movieCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await db.insert(actors).values(newActor)

      await createAuditLog(c, {
        action: 'CREATE',
        resourceType: 'actor',
        resourceId: newActor.id,
        resourceIdentifier: name,
        changes: { name },
      })

      console.log(`[Admin/Actors] ✓ Created actor: ${name}`)

      return c.json({
        id: newActor.id,
        name: newActor.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to create actor:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/:id/aliases
 * 添加女优别名
 */
adminActors.post(
  '/:id/aliases',
  describeRoute({
    summary: '添加演员别名',
    description: '为指定演员添加别名',
    tags: ['Admin'],
    operationId: 'addActorAlias',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '添加成功' },
    },
  }),
  requireResource('movie'),
  validator('json', AddActorAliasSchema),
  async (c) => {
    const actorId = c.req.param('id')
    const { alias } = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const actor = await db.query.actors.findFirst({
        where: eq(actors.id, actorId),
      })

      if (!actor) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const currentAliases = (actor.aliases as string[]) || []

      // 检查别名是否已存在
      if (currentAliases.includes(alias)) {
        return c.json({ error: 'Alias already exists' }, 400)
      }

      const updatedAliases = [...currentAliases, alias]

      await db.update(actors)
        .set({ aliases: updatedAliases, updatedAt: new Date() })
        .where(eq(actors.id, actorId))

      // 清除缓存
      await Promise.all([
        cache.delete(CacheKeys.actorDetail(actorId)),
        cache.deleteByPrefix('actors:list:'),
      ])

      console.log(`[Admin/Actors] ✓ Added alias "${alias}" to actor ${actorId}`)

      return c.json({
        success: true,
        aliases: updatedAliases,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to add alias to actor ${actorId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * DELETE /api/admin/actors/:id/aliases/:alias
 * 删除女优别名
 */
adminActors.delete(
  '/:id/aliases/:alias',
  describeRoute({
    summary: '删除演员别名',
    description: '删除指定演员的别名',
    tags: ['Admin'],
    operationId: 'deleteActorAlias',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '删除成功' },
    },
  }),
  requireResource('movie'),
  async (c) => {
    const actorId = c.req.param('id')
    const alias = c.req.param('alias')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const actor = await db.query.actors.findFirst({
        where: eq(actors.id, actorId),
      })

      if (!actor) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const currentAliases = (actor.aliases as string[]) || []
      const updatedAliases = currentAliases.filter(a => a !== alias)

      if (currentAliases.length === updatedAliases.length) {
        return c.json({ error: 'Alias not found' }, 404)
      }

      await db.update(actors)
        .set({ aliases: updatedAliases, updatedAt: new Date() })
        .where(eq(actors.id, actorId))

      // 清除缓存
      await Promise.all([
        cache.delete(CacheKeys.actorDetail(actorId)),
        cache.deleteByPrefix('actors:list:'),
      ])

      console.log(`[Admin/Actors] ✓ Removed alias "${alias}" from actor ${actorId}`)

      return c.json({
        success: true,
        aliases: updatedAliases,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to remove alias from actor ${actorId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/:id/details
 * 同步女优详情
 */
adminActors.post(
  '/:id/details',
  describeRoute({
    summary: '同步演员详情',
    description: '更新演员的详细信息并标记为已爬取',
    tags: ['Admin'],
    operationId: 'syncActorDetails',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '同步成功' },
      404: { description: '演员不存在' },
    },
  }),
  validator('json', SyncActorDetailsSchema),
  async (c) => {
    const actorId = c.req.param('id')
    const details = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      const actor = await db.query.actors.findFirst({
        where: eq(actors.id, actorId),
      })

      if (!actor) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      // 计算数据完整度（权重：avatar 25%, bio 20%, birthDate 15%, height 15%, measurements 10%, nationality 15%）
      const fields = [
        { key: 'avatar', weight: 0.25 },
        { key: 'bio', weight: 0.20 },
        { key: 'birthDate', weight: 0.15 },
        { key: 'height', weight: 0.15 },
        { key: 'measurements', weight: 0.10 },
        { key: 'nationality', weight: 0.15 },
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

      if (details.birthDate) {
        updateData.birthDate = new Date(details.birthDate)
      }

      await db.update(actors).set(updateData).where(eq(actors.id, actorId))

      // 清除缓存
      await Promise.all([
        cache.delete(CacheKeys.actorDetail(actorId)),
        cache.deleteByPrefix('actors:list:'),
        cache.delete(CacheKeys.actorStats()),
      ])

      console.log(`[Admin/Actors] ✓ Synced details for actor ${actorId} (completeness: ${(completeness * 100).toFixed(0)}%)`)

      return c.json({
        success: true,
        dataCompleteness: completeness,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to sync details for actor ${actorId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/batch-sync
 * 批量同步女优
 */
adminActors.post(
  '/batch-sync',
  describeRoute({
    summary: '批量同步演员',
    description: '批量创建或更新演员的 sourceUrl',
    tags: ['Admin'],
    operationId: 'batchSyncActors',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '同步成功' },
    },
  }),
  validator('json', BatchSyncActorsSchema),
  async (c) => {
    const { actors: actorsData } = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      let createdCount = 0
      let updatedCount = 0

      for (const actorData of actorsData) {
        // 查找是否已存在
        const existing = await db.query.actors.findFirst({
          where: eq(actors.name, actorData.name),
        })

        if (existing) {
          // 更新 sourceUrl
          await db
            .update(actors)
            .set({
              sourceUrl: actorData.sourceUrl,
              updatedAt: new Date(),
            })
            .where(eq(actors.id, existing.id))

          updatedCount++
        }
        else {
          // 创建新记录
          const slug = actorData.name.toLowerCase().replace(/\s+/g, '-')
          const newActor = {
            id: crypto.randomUUID(),
            name: actorData.name,
            slug,
            source: 'javbus',
            sourceId: slug,
            sourceUrl: actorData.sourceUrl,
            movieCount: 0,
            hasDetailsCrawled: false,
            crawlFailureCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          await db.insert(actors).values(newActor)
          createdCount++
        }
      }

      // 清除缓存
      await cache.clearActorCache()

      console.log(`[Admin/Actors] ✓ Batch sync: created ${createdCount}, updated ${updatedCount}`)

      return c.json({
        success: true,
        created: createdCount,
        updated: updatedCount,
        total: actorsData.length,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to batch sync actors:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/batch-recrawl
 * 批量标记演员为待重新爬取
 * 重置 crawlFailureCount 和 hasDetailsCrawled，下次爬虫运行时会重新尝试
 */
adminActors.post(
  '/batch-recrawl',
  describeRoute({
    summary: '批量重新爬取演员',
    description: '批量标记演员为待重新爬取状态',
    tags: ['Admin'],
    operationId: 'batchRecrawlActors',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '操作成功' },
    },
  }),
  validator('json', BatchDeleteSchema),
  async (c) => {
    const { ids } = c.req.valid('json')
    const db = c.get('db')
    const cache = new CacheManager(c.env.CACHE)

    try {
      let successCount = 0

      for (const id of ids) {
        const actor = await db.query.actors.findFirst({
          where: eq(actors.id, id),
        })

        if (!actor) {
          console.warn(`[Admin/Actors] ⚠️ Actor not found: ${id}`)
          continue
        }

        await db
          .update(actors)
          .set({
            hasDetailsCrawled: false,
            crawlFailureCount: 0,
            lastCrawlAttempt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actors.id, id))

        await createAuditLog(c, {
          action: 'UPDATE',
          resourceType: 'actor',
          resourceId: id,
          resourceIdentifier: actor.name,
          changes: { action: 'mark_for_recrawl' },
        })

        successCount++
      }

      // 清除相关缓存
      await cache.clearActorCache()

      console.log(`[Admin/Actors] ✓ Marked ${successCount}/${ids.length} actors for recrawl and cleared cache`)

      return c.json({
        success: true,
        total: ids.length,
        marked: successCount,
        message: `已标记 ${successCount} 个演员为待重新爬取`,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to batch recrawl:', message)
      return c.json({ error: message }, 500)
    }
  },
)

export const adminActorsRoutes = adminActors
