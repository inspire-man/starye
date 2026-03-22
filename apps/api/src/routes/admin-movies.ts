/* eslint-disable no-console */
/**
 * 电影管理 API 路由
 *
 * 提供完整的电影 CRUD、筛选、排序、批量操作功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { movies, players } from '@starye/db/schema'
import { and, count, desc, eq, gte, like, lte, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { captureResourceState, computeChanges, createAuditLog } from '../middleware/audit-logger'
import { requireResource } from '../middleware/resource-guard'
import { serviceAuth } from '../middleware/service-auth'

const adminMovies = new Hono<AppEnv>()

// 批量查询电影状态 (用于爬虫增量爬取)
// 使用 serviceAuth 认证，必须在 requireResource 中间件之前定义
adminMovies.get('/batch-status', serviceAuth(['admin']), async (c) => {
  const codesParam = c.req.query('codes')
  if (!codesParam) {
    return c.json({ error: 'codes parameter is required' }, 400)
  }

  const codes = codesParam.split(',').map(s => s.trim()).filter(Boolean)
  if (codes.length === 0) {
    return c.json({ error: 'codes parameter is required' }, 400)
  }

  const db = c.get('db')
  const startTime = Date.now()

  try {
    // 使用 SQL IN 查询批量获取电影状态
    const results = await db.query.movies.findMany({
      where: (movies, { inArray }) => inArray(movies.code, codes),
      columns: {
        code: true,
        slug: true,
        updatedAt: true,
      },
    })

    // 构建响应对象
    const statusMap: Record<string, any> = {}
    for (const code of codes) {
      const result = results.find(r => r.code === code)
      if (result) {
        statusMap[code] = {
          exists: true,
          code: result.code,
          slug: result.slug,
          updatedAt: result.updatedAt?.toISOString(),
        }
      }
      else {
        statusMap[code] = {
          exists: false,
          code,
        }
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[BatchStatus] 批量查询 ${codes.length} 个电影，耗时 ${elapsed}ms`)

    if (elapsed > 1000) {
      console.warn(`[BatchStatus] ⚠️ 批量查询过慢，耗时 ${elapsed}ms`)
    }

    return c.json(statusMap)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[BatchStatus] ❌ Database operation failed:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

// 所有其他路由都需要 movie 资源权限
adminMovies.use('/*', requireResource('movie'))

/**
 * 筛选参数 Schema
 */
const MovieFilterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  isR18: z.union([z.enum(['true', 'false', 'all']), z.literal('')]).optional().default('all'),
  crawlStatus: z.union([z.enum(['pending', 'partial', 'complete']), z.literal('')]).optional(),
  metadataLocked: z.union([z.enum(['true', 'false']), z.literal('')]).optional(),
  actor: z.string().optional(),
  publisher: z.string().optional(),
  genre: z.string().optional(),
  releaseDateFrom: z.string().optional(),
  releaseDateTo: z.string().optional(),
  createdAtFrom: z.string().optional(),
  createdAtTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['releaseDate', 'createdAt', 'updatedAt', 'sortOrder', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * 构建筛选条件
 */
function buildMovieFilters(filter: z.infer<typeof MovieFilterSchema>) {
  const conditions: any[] = []

  if (filter.isR18 === 'true') {
    conditions.push(eq(movies.isR18, true))
  }
  else if (filter.isR18 === 'false') {
    conditions.push(eq(movies.isR18, false))
  }

  if (filter.crawlStatus) {
    conditions.push(eq(movies.crawlStatus, filter.crawlStatus as 'pending' | 'partial' | 'complete'))
  }

  if (filter.metadataLocked && filter.metadataLocked === 'true') {
    conditions.push(eq(movies.metadataLocked, true))
  }
  else if (filter.metadataLocked && filter.metadataLocked === 'false') {
    conditions.push(eq(movies.metadataLocked, false))
  }

  if (filter.actor) {
    conditions.push(like(movies.actors, `%${filter.actor}%`))
  }

  if (filter.publisher) {
    conditions.push(like(movies.publisher, `%${filter.publisher}%`))
  }

  if (filter.genre) {
    conditions.push(like(movies.genres, `%${filter.genre}%`))
  }

  if (filter.releaseDateFrom) {
    const date = new Date(filter.releaseDateFrom)
    conditions.push(gte(movies.releaseDate, date))
  }

  if (filter.releaseDateTo) {
    const date = new Date(filter.releaseDateTo)
    conditions.push(lte(movies.releaseDate, date))
  }

  if (filter.createdAtFrom) {
    const date = new Date(filter.createdAtFrom)
    conditions.push(gte(movies.createdAt, date))
  }

  if (filter.createdAtTo) {
    const date = new Date(filter.createdAtTo)
    conditions.push(lte(movies.createdAt, date))
  }

  if (filter.search) {
    conditions.push(
      or(
        like(movies.title, `%${filter.search}%`),
        like(movies.code, `%${filter.search}%`),
      ),
    )
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * 构建排序条件
 */
function buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
  const column = {
    releaseDate: movies.releaseDate,
    createdAt: movies.createdAt,
    updatedAt: movies.updatedAt,
    sortOrder: movies.sortOrder,
    title: movies.title,
  }[sortBy] || movies.updatedAt

  return sortOrder === 'desc' ? desc(column) : column
}

/**
 * GET /api/admin/movies
 * 电影列表查询（支持分页、筛选、排序）
 */
adminMovies.get(
  '/',
  zValidator('query', MovieFilterSchema),
  async (c) => {
    const filter = c.req.valid('query')
    const db = c.get('db')

    try {
      const whereClause = buildMovieFilters(filter)
      const orderByClause = buildOrderBy(filter.sortBy, filter.sortOrder)
      const offset = (filter.page - 1) * filter.limit

      const [results, totalResult] = await Promise.all([
        db.query.movies.findMany({
          where: whereClause,
          orderBy: orderByClause,
          limit: filter.limit,
          offset,
          with: {
            movieActors: {
              with: {
                actor: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
            },
            moviePublishers: {
              with: {
                publisher: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        db
          .select({ value: count() })
          .from(movies)
          .where(whereClause)
          .then(res => res[0]?.value || 0),
      ])

      // 添加 actorNames 和 publisherNames 字段
      const enrichedResults = results.map((movie) => {
        const actorNames = movie.movieActors?.map(ma => ma.actor?.name).filter(Boolean) || []
        const publisherNames = movie.moviePublishers?.map(mp => mp.publisher?.name).filter(Boolean) || []

        return {
          ...movie,
          actorNames,
          publisherNames,
        }
      })

      return c.json({
        data: enrichedResults,
        meta: {
          total: totalResult,
          page: filter.page,
          limit: filter.limit,
          totalPages: Math.ceil(totalResult / filter.limit),
        },
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Movies] ❌ Failed to query movies:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/movies/:id
 * 电影详情查询
 */
adminMovies.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  try {
    const movie = await db.query.movies.findFirst({
      where: eq(movies.id, id),
      with: {
        players: {
          orderBy: (players, { asc }) => [asc(players.sortOrder)],
        },
      },
    })

    if (!movie) {
      return c.json({ error: 'Movie not found' }, 404)
    }

    return c.json(movie)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Movies] ❌ Failed to get movie ${id}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * PATCH /api/admin/movies/:id
 * 更新电影元数据
 */
adminMovies.patch(
  '/:id',
  zValidator('json', z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    coverImage: z.string().optional(),
    isR18: z.boolean().optional(),
    metadataLocked: z.boolean().optional(),
    sortOrder: z.number().optional(),
    actors: z.array(z.string()).optional(),
    genres: z.array(z.string()).optional(),
    publisher: z.string().optional(),
    releaseDate: z.string().optional(),
    duration: z.number().optional(),
  })),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const before = await captureResourceState(c, 'movie', id)

      if (!before) {
        return c.json({ error: 'Movie not found' }, 404)
      }

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      }

      if (data.releaseDate) {
        updateData.releaseDate = new Date(data.releaseDate)
      }

      await db.update(movies)
        .set(updateData)
        .where(eq(movies.id, id))

      const after = await db.query.movies.findFirst({
        where: eq(movies.id, id),
      })

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'movie',
        resourceId: id,
        resourceIdentifier: before.code,
        changes: computeChanges(before, after),
      })

      console.log(`[Admin/Movies] ✓ Updated movie ${id}`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Movies] ❌ Failed to update movie ${id}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/movies/:id/cover
 * 上传电影封面到 R2
 *
 * TODO: 实现 R2 上传逻辑
 */
adminMovies.post('/:id/cover', async (c) => {
  const _id = c.req.param('id')

  return c.json({
    error: 'R2 upload not implemented yet',
    todo: 'Implement R2 upload logic',
  }, 501)
})

/**
 * DELETE /api/admin/movies/:id
 * 删除电影（级联删除 players）
 */
adminMovies.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  try {
    const before = await captureResourceState(c, 'movie', id)

    if (!before) {
      return c.json({ error: 'Movie not found' }, 404)
    }

    await db.delete(movies).where(eq(movies.id, id))

    await createAuditLog(c, {
      action: 'DELETE',
      resourceType: 'movie',
      resourceId: id,
      resourceIdentifier: before.code,
      changes: {
        before,
        after: {},
      },
    })

    console.log(`[Admin/Movies] ✓ Deleted movie ${id} (${before.code})`)
    return c.json({ success: true })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Movies] ❌ Failed to delete movie ${id}:`, message)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/admin/movies/:id/players
 * 查询电影的所有播放源
 */
adminMovies.get('/:id/players', async (c) => {
  const movieId = c.req.param('id')
  const db = c.get('db')

  try {
    const movie = await db.query.movies.findFirst({
      where: eq(movies.id, movieId),
    })

    if (!movie) {
      return c.json({ error: 'Movie not found' }, 404)
    }

    const playerList = await db.query.players.findMany({
      where: eq(players.movieId, movieId),
      orderBy: (players, { asc }) => [asc(players.sortOrder)],
    })

    return c.json({
      movieId,
      players: playerList,
      total: playerList.length,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Players] ❌ Failed to get players for ${movieId}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * POST /api/admin/movies/:id/players
 * 手动添加播放源
 */
adminMovies.post(
  '/:id/players',
  zValidator('json', z.object({
    sourceName: z.string(),
    sourceUrl: z.string().url(),
    quality: z.string().optional(),
  })),
  async (c) => {
    const movieId = c.req.param('id')
    const { sourceName, sourceUrl, quality } = c.req.valid('json')
    const db = c.get('db')

    try {
      const movie = await db.query.movies.findFirst({
        where: eq(movies.id, movieId),
      })

      if (!movie) {
        return c.json({ error: 'Movie not found' }, 404)
      }

      const existingPlayer = await db.query.players.findFirst({
        where: and(
          eq(players.movieId, movieId),
          eq(players.sourceUrl, sourceUrl),
        ),
      })

      if (existingPlayer) {
        return c.json({ error: '该播放源已存在' }, 409)
      }

      const existingCount = await db
        .select({ value: count() })
        .from(players)
        .where(eq(players.movieId, movieId))
        .then(res => res[0]?.value || 0)

      const playerId = nanoid()
      await db.insert(players).values({
        id: playerId,
        movieId,
        sourceName,
        sourceUrl,
        quality: quality || null,
        sortOrder: existingCount + 1,
      })

      await db.update(movies)
        .set({
          totalPlayers: existingCount + 1,
          crawledPlayers: existingCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(movies.id, movieId))

      await createAuditLog(c, {
        action: 'CREATE',
        resourceType: 'player',
        resourceId: playerId,
        resourceIdentifier: `${movie.code}-${sourceName}`,
      })

      console.log(`[Admin/Players] ✓ Added player to movie ${movieId}`)
      return c.json({ success: true, id: playerId })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Players] ❌ Failed to add player:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * PATCH /api/admin/players/:id
 * 编辑播放源
 */
adminMovies.patch(
  '/players/:id',
  zValidator('json', z.object({
    sourceName: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    quality: z.string().optional(),
  })),
  async (c) => {
    const playerId = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const before = await db.query.players.findFirst({
        where: eq(players.id, playerId),
      })

      if (!before) {
        return c.json({ error: 'Player not found' }, 404)
      }

      if (data.sourceUrl && data.sourceUrl !== before.sourceUrl) {
        const duplicate = await db.query.players.findFirst({
          where: and(
            eq(players.movieId, before.movieId),
            eq(players.sourceUrl, data.sourceUrl),
          ),
        })

        if (duplicate) {
          return c.json({ error: '该播放源 URL 已存在' }, 409)
        }
      }

      await db.update(players)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(players.id, playerId))

      console.log(`[Admin/Players] ✓ Updated player ${playerId}`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Players] ❌ Failed to update player ${playerId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * DELETE /api/admin/players/:id
 * 删除播放源（更新 totalPlayers）
 */
adminMovies.delete('/players/:id', async (c) => {
  const playerId = c.req.param('id')
  const db = c.get('db')

  try {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })

    if (!player) {
      return c.json({ error: 'Player not found' }, 404)
    }

    await db.delete(players).where(eq(players.id, playerId))

    const remainingCount = await db
      .select({ value: count() })
      .from(players)
      .where(eq(players.movieId, player.movieId))
      .then(res => res[0]?.value || 0)

    await db.update(movies)
      .set({
        totalPlayers: remainingCount,
        crawledPlayers: remainingCount,
        crawlStatus: remainingCount === 0 ? 'partial' : 'complete',
        updatedAt: new Date(),
      })
      .where(eq(movies.id, player.movieId))

    await createAuditLog(c, {
      action: 'DELETE',
      resourceType: 'player',
      resourceId: playerId,
      resourceIdentifier: player.sourceName,
    })

    console.log(`[Admin/Players] ✓ Deleted player ${playerId}`)
    return c.json({ success: true })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Players] ❌ Failed to delete player ${playerId}:`, message)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/admin/movies/:id/players/batch-import
 * 批量导入播放源（JSON 格式）
 */
adminMovies.post(
  '/:id/players/batch-import',
  zValidator('json', z.object({
    players: z.array(z.object({
      sourceName: z.string(),
      sourceUrl: z.string().url(),
      quality: z.string().optional(),
    })),
  })),
  async (c) => {
    const movieId = c.req.param('id')
    const { players: playerData } = c.req.valid('json')
    const db = c.get('db')

    const results = {
      success: [] as string[],
      failed: [] as { url: string, reason: string }[],
      skipped: [] as string[],
    }

    try {
      const movie = await db.query.movies.findFirst({
        where: eq(movies.id, movieId),
      })

      if (!movie) {
        return c.json({ error: 'Movie not found' }, 404)
      }

      const existingPlayers = await db.query.players.findMany({
        where: eq(players.movieId, movieId),
      })

      const existingUrls = new Set(existingPlayers.map(p => p.sourceUrl))
      const nextSortOrder = existingPlayers.length + 1

      for (let i = 0; i < playerData.length; i++) {
        const playerInput = playerData[i]

        if (existingUrls.has(playerInput.sourceUrl)) {
          results.skipped.push(playerInput.sourceUrl)
          continue
        }

        try {
          const playerId = nanoid()
          await db.insert(players).values({
            id: playerId,
            movieId,
            sourceName: playerInput.sourceName,
            sourceUrl: playerInput.sourceUrl,
            quality: playerInput.quality || null,
            sortOrder: nextSortOrder + i,
          })

          existingUrls.add(playerInput.sourceUrl)
          results.success.push(playerInput.sourceUrl)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          results.failed.push({ url: playerInput.sourceUrl, reason: message })
        }
      }

      const finalCount = existingPlayers.length + results.success.length
      await db.update(movies)
        .set({
          totalPlayers: finalCount,
          crawledPlayers: finalCount,
          updatedAt: new Date(),
        })
        .where(eq(movies.id, movieId))

      console.log(`[Admin/Players] ✓ Batch import complete: ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`)

      return c.json(results)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Players] ❌ Batch import failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/movies/bulk-operation
 * 批量操作电影
 *
 * 支持的操作：
 * - update_r18: 批量修改 R18 标记
 * - lock_metadata: 批量锁定元数据
 * - unlock_metadata: 批量解锁元数据
 * - update_sort_order: 批量更新排序权重
 * - delete: 批量删除
 */
adminMovies.post(
  '/bulk-operation',
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100),
    operation: z.enum(['update_r18', 'lock_metadata', 'unlock_metadata', 'update_sort_order', 'delete']),
    payload: z.record(z.string(), z.any()).optional(),
  })),
  async (c) => {
    const { ids, operation, payload } = c.req.valid('json')
    const db = c.get('db')

    const results = {
      success: [] as string[],
      failed: [] as { id: string, reason: string }[],
    }

    const BATCH_SIZE = 20

    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)

        for (const id of batch) {
          try {
            const movie = await db.query.movies.findFirst({
              where: eq(movies.id, id),
            })

            if (!movie) {
              results.failed.push({ id, reason: 'Movie not found' })
              continue
            }

            let updateData: any = {}

            switch (operation) {
              case 'update_r18':
                updateData = { isR18: payload?.isR18 ?? true }
                break

              case 'lock_metadata':
                updateData = { metadataLocked: true }
                break

              case 'unlock_metadata':
                updateData = { metadataLocked: false }
                break

              case 'update_sort_order':
                updateData = { sortOrder: payload?.sortOrder ?? 0 }
                break

              case 'delete':
                await db.delete(movies).where(eq(movies.id, id))
                results.success.push(id)
                continue

              default:
                results.failed.push({ id, reason: 'Unknown operation' })
                continue
            }

            if (operation !== 'delete' as any) {
              await db.update(movies)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(movies.id, id))
            }

            results.success.push(id)
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.failed.push({ id, reason: message })
          }
        }
      }

      await createAuditLog(c, {
        action: operation === 'delete' ? 'BULK_DELETE' : 'BULK_UPDATE',
        resourceType: 'movie',
        affectedCount: results.success.length,
        changes: {
          operation,
          payload,
          successCount: results.success.length,
          failedCount: results.failed.length,
        },
      })

      console.log(`[Admin/Movies] ✓ Bulk operation complete: ${results.success.length} success, ${results.failed.length} failed`)

      return c.json(results)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Movies] ❌ Bulk operation failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * PUT /api/admin/movies/:id/actors
 * 更新电影的女优关联
 */
adminMovies.put(
  '/:id/actors',
  zValidator('json', z.object({
    actors: z.array(z.object({
      id: z.string().min(1),
      sortOrder: z.number(),
    })),
  })),
  async (c) => {
    const movieId = c.req.param('id')
    const { actors: actorList } = c.req.valid('json')
    const db = c.get('db')

    try {
      const { movieActors } = await import('@starye/db/schema')

      // 过滤掉无效的 actor ID
      const validActors = actorList.filter(actor => actor.id && actor.id.trim() !== '')

      if (validActors.length !== actorList.length) {
        console.warn(`[Admin/Movies] ⚠️ Filtered out ${actorList.length - validActors.length} invalid actor IDs`)
      }

      // 删除现有关联
      await db.delete(movieActors).where(eq(movieActors.movieId, movieId))

      // 创建新关联
      if (validActors.length > 0) {
        await db.insert(movieActors).values(
          validActors.map(actor => ({
            id: crypto.randomUUID(),
            movieId,
            actorId: actor.id,
            sortOrder: actor.sortOrder,
            createdAt: new Date(),
          })),
        )
      }

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'movie',
        resourceId: movieId,
        changes: { actors: actorList.length },
      })

      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Movies] ❌ Update actors failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * PUT /api/admin/movies/:id/publishers
 * 更新电影的厂商关联
 */
adminMovies.put(
  '/:id/publishers',
  zValidator('json', z.object({
    publishers: z.array(z.object({
      id: z.string(),
      sortOrder: z.number(),
    })),
  })),
  async (c) => {
    const movieId = c.req.param('id')
    const { publishers: publisherList } = c.req.valid('json')
    const db = c.get('db')

    try {
      const { moviePublishers } = await import('@starye/db/schema')

      // 删除现有关联
      await db.delete(moviePublishers).where(eq(moviePublishers.movieId, movieId))

      // 创建新关联
      if (publisherList.length > 0) {
        await db.insert(moviePublishers).values(
          publisherList.map(publisher => ({
            id: crypto.randomUUID(),
            movieId,
            publisherId: publisher.id,
            sortOrder: publisher.sortOrder,
            createdAt: new Date(),
          })),
        )
      }

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'movie',
        resourceId: movieId,
        changes: { publishers: publisherList.length },
      })

      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Movies] ❌ Update publishers failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

export default adminMovies
