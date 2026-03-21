/* eslint-disable no-console */
/**
 * 演员管理 API 路由
 *
 * 提供演员 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { actors, movies } from '@starye/db/schema'
import { and, count, desc, eq, gt, isNotNull, isNull, like } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { CacheKeys, CacheManager, CacheTTL, withCache } from '../lib/cache'
import { captureResourceState, createAuditLog } from '../middleware/audit-logger'
import { requireResource } from '../middleware/resource-guard'

const adminActors = new Hono<AppEnv>()

adminActors.use('/*', requireResource('movie'))

/**
 * GET /api/admin/actors/nationalities
 * 获取所有不同的国籍列表（用于筛选器）
 */
adminActors.get('/nationalities', async (c) => {
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
})

/**
 * GET /api/admin/actors/stats
 * 女优统计信息
 */
adminActors.get('/stats', async (c) => {
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
})

/**
 * GET /api/admin/actors
 * 演员列表（按作品数排序，支持搜索和筛选）
 */
adminActors.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    onlyPending: z.enum(['true', 'false']).optional(), // 向后兼容
    crawlStatus: z.enum(['complete', 'pending', 'failed', 'no-link']).optional(), // 爬取状态筛选
    nationality: z.string().optional(), // 国籍筛选
  })),
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
 * GET /api/admin/actors/:id
 * 演员详情（包含关联电影列表）
 */
adminActors.get('/:id', async (c) => {
  const actorId = c.req.param('id')
  const db = c.get('db')

  try {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.id, actorId),
    })

    if (!actor) {
      return c.json({ error: 'Actor not found' }, 404)
    }

    const relatedMovies = await db.query.movies.findMany({
      where: like(movies.actors, `%${actor.name}%`),
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
      ...actor,
      relatedMovies,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Actors] ❌ Failed to get actor ${actorId}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * GET /api/admin/actors/:id
 * 获取单个演员详情
 */
adminActors.get('/:id', async (c) => {
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
          return { error: 'Actor not found', status: 404 }
        }

        return { data: actor, status: 200 }
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
})

/**
 * PATCH /api/admin/actors/:id
 * 编辑演员信息
 */
adminActors.patch(
  '/:id',
  zValidator('json', z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar: z.string().optional(),
    birthDate: z.string().optional(),
    height: z.number().optional(),
    measurements: z.string().optional(),
    nationality: z.string().optional(),
    socialLinks: z.record(z.string(), z.string()).optional(),
  })),
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
  zValidator('json', z.object({
    sourceId: z.string(),
    targetId: z.string(),
  })),
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
  zValidator('json', z.object({
    name: z.string().min(1),
  })),
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
  requireResource('movie'),
  zValidator('json', z.object({
    alias: z.string().min(1).max(100),
  })),
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
 * POST /api/admin/actors/batch-recrawl
 * 批量标记演员为待重新爬取
 * 重置 crawlFailureCount 和 hasDetailsCrawled，下次爬虫运行时会重新尝试
 */
adminActors.post(
  '/batch-recrawl',
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100),
  })),
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

export default adminActors
