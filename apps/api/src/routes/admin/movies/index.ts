/* eslint-disable no-console */
/**
 * 电影管理 API 路由
 *
 * 提供完整的电影 CRUD、筛选、排序、批量操作功能
 * 权限要求：admin 或 movie_admin
 */

import type { InferInsertModel, SQL } from 'drizzle-orm'
import type { MovieFilter } from '../../../schemas/admin'
import type { AppEnv } from '../../../types'
import { movies, players } from '@starye/db/schema'
import { and, count, desc, eq, gt, gte, like, lte, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { nanoid } from 'nanoid'
import * as v from 'valibot'
import { captureResourceState, computeChanges, createAuditLog } from '../../../middleware/audit-logger'
import { requireResource } from '../../../middleware/resource-guard'
import { serviceAuth } from '../../../middleware/service-auth'
import { AddPlayerSchema, BatchImportPlayersSchema, BatchOperationMoviesSchema, MovieFilterSchema, UpdateMovieActorsSchema, UpdateMovieMetadataSchema, UpdateMoviePublishersSchema, UpdatePlayerSchema } from '../../../schemas/admin'

const adminMovies = new Hono<AppEnv>()

// 批量查询电影状态 (用于爬虫增量爬取)
// 使用 serviceAuth 认证，必须在 requireResource 中间件之前定义
adminMovies.get(
  '/batch-status',
  describeRoute({
    summary: '批量查询电影状态',
    description: '用于爬虫增量爬取，查询指定电影编号的状态',
    tags: ['Admin'],
    operationId: 'getMoviesBatchStatus',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '电影状态列表' },
    },
  }),
  serviceAuth(['admin']),
  async (c) => {
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
  },
)

// 所有其他路由都需要 movie 资源权限
adminMovies.use('/*', requireResource('movie'))

/**
 * 构建筛选条件
 */
function buildMovieFilters(filter: MovieFilter) {
  const conditions: SQL[] = []

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
    const searchCondition = or(
      like(movies.title, `%${filter.search}%`),
      like(movies.code, `%${filter.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filter.hasPlayers === 'false') {
    // 无播放源：totalPlayers = 0 或 null
    conditions.push(eq(movies.totalPlayers, 0))
  }
  else if (filter.hasPlayers === 'true') {
    // 有播放源：totalPlayers > 0
    conditions.push(gt(movies.totalPlayers, 0))
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
  describeRoute({
    summary: '获取电影列表（管理）',
    description: '支持分页、筛选、排序的电影列表接口',
    tags: ['Admin'],
    operationId: 'getAdminMoviesList',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '电影列表' },
    },
  }),
  validator('query', MovieFilterSchema),
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

// 分析数据响应 Schema
const HotMovieItemSchema = v.object({
  id: v.string(),
  code: v.string(),
  title: v.string(),
  coverImage: v.nullable(v.string()),
  viewCount: v.number(),
  isR18: v.boolean(),
})

const GenreDistributionItemSchema = v.object({
  genre: v.string(),
  count: v.number(),
})

const MovieAnalyticsResponseSchema = v.object({
  hotMovies: v.array(HotMovieItemSchema),
  genreDistribution: v.array(GenreDistributionItemSchema),
})

interface GenreRow { genre: string, count: number }

/**
 * GET /analytics - 内容洞察：热门排行 + Genre 分布
 * 权限：admin 或 movie_admin（由 requireResource('movie') 中间件保证）
 * 注意：此路由必须在 GET /:id 之前注册，避免被参数路由截获
 */
adminMovies.get(
  '/analytics',
  describeRoute({
    summary: '内容洞察',
    description: '返回热门影片 Top 10 和 Genre 分布（含 R18），供管理端展示',
    tags: ['Admin'],
    operationId: 'getMovieAnalytics',
    responses: {
      200: {
        description: '分析数据',
        content: {
          'application/json': {
            schema: resolver(MovieAnalyticsResponseSchema),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db')

    try {
      const [hotMovies, genreRows] = await Promise.all([
        // 热门影片：按 viewCount DESC，再按 createdAt DESC 兜底，取前 10 条
        db
          .select({
            id: movies.id,
            code: movies.code,
            title: movies.title,
            coverImage: movies.coverImage,
            viewCount: movies.viewCount,
            isR18: movies.isR18,
          })
          .from(movies)
          .orderBy(desc(movies.viewCount), desc(movies.createdAt))
          .limit(10),

        // Genre 分布：json_each 展开 genres 数组，聚合计数，含 R18 全量，过滤空值
        db.all<GenreRow>(sql`
          SELECT json_each.value AS genre, COUNT(*) AS count
          FROM movie, json_each(movie.genres)
          WHERE json_each.value != ''
          GROUP BY json_each.value
          ORDER BY count DESC
          LIMIT 50
        `),
      ])

      return c.json({
        hotMovies,
        genreDistribution: genreRows,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Movies] ❌ Analytics query failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * GET /api/admin/movies/:id
 * 电影详情查询
 */
adminMovies.get(
  '/:id',
  describeRoute({
    summary: '获取电影详情（管理）',
    description: '获取指定电影的详细信息',
    tags: ['Admin'],
    operationId: 'getAdminMovieDetail',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '电影详情' },
      404: { description: '电影不存在' },
    },
  }),
  async (c) => {
    const id = c.req.param('id')
    const db = c.get('db')

    try {
      const movie = await db.query.movies.findFirst({
        where: eq(movies.id, id),
        with: {
          players: {
            orderBy: (players, { asc }) => [asc(players.sortOrder)],
          },
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
  },
)

/**
 * PATCH /api/admin/movies/:id
 * 更新电影元数据
 */
adminMovies.patch(
  '/:id',
  describeRoute({
    summary: '更新电影元数据',
    description: '更新指定电影的元数据信息',
    tags: ['Admin'],
    operationId: 'updateAdminMovieMetadata',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
      404: { description: '电影不存在' },
    },
  }),
  validator('json', UpdateMovieMetadataSchema),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const before = await captureResourceState(c, 'movie', id)

      if (!before) {
        return c.json({ error: 'Movie not found' }, 404)
      }

      type MovieUpdate = Partial<InferInsertModel<typeof movies>>
      const updateData: MovieUpdate = {
        ...data as Omit<typeof data, 'releaseDate'>,
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
adminMovies.get(
  '/:id/players',
  describeRoute({
    summary: '获取电影播放源',
    description: '获取指定电影的所有播放源',
    tags: ['Admin'],
    operationId: 'getMoviePlayers',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '播放源列表' },
    },
  }),
  async (c) => {
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
  },
)

/**
 * POST /api/admin/movies/:id/players
 * 手动添加播放源
 */
adminMovies.post(
  '/:id/players',
  describeRoute({
    summary: '添加电影播放源',
    description: '为指定电影添加新的播放源',
    tags: ['Admin'],
    operationId: 'addMoviePlayersManual',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '添加成功' },
    },
  }),
  validator('json', AddPlayerSchema),
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
  describeRoute({
    summary: '更新播放源',
    description: '更新指定播放源的信息',
    tags: ['Admin'],
    operationId: 'updatePlayer',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  validator('json', UpdatePlayerSchema),
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
  describeRoute({
    summary: '批量导入播放源',
    description: '为指定电影批量导入播放源',
    tags: ['Admin'],
    operationId: 'batchImportMoviePlayers',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '导入成功' },
    },
  }),
  validator('json', BatchImportPlayersSchema),
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
  describeRoute({
    summary: '批量操作电影',
    description: '批量更新电影状态、元数据或删除',
    tags: ['Admin'],
    operationId: 'bulkOperateMovies',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '操作成功' },
    },
  }),
  validator('json', BatchOperationMoviesSchema),
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

            let updateData: Partial<InferInsertModel<typeof movies>> = {}

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
  describeRoute({
    summary: '更新电影演员',
    description: '更新指定电影的演员关联',
    tags: ['Admin'],
    operationId: 'updateMovieActors',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
      404: { description: '电影不存在' },
    },
  }),
  validator('json', UpdateMovieActorsSchema),
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
  describeRoute({
    summary: '更新电影厂商',
    description: '更新指定电影的厂商关联',
    tags: ['Admin'],
    operationId: 'updateMoviePublishers',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '更新成功' },
      404: { description: '电影不存在' },
    },
  }),
  validator('json', UpdateMoviePublishersSchema),
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

export const adminMoviesRoutes = adminMovies
