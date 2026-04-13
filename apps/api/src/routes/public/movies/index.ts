import type { SQL } from 'drizzle-orm'
import type { AppEnv } from '../../../types'
import { actors, movieActors, moviePublishers, movies, players, publishers, watchingProgress } from '@starye/db/schema'
import { and, count, desc, eq, getTableColumns, gte, inArray, like, lte, ne, notInArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import * as v from 'valibot'
import { GetMovieParamSchema, GetMoviesQuerySchema, MovieDetailSchema, MovieItemSchema, MoviesListDataSchema } from '../../../schemas/movie'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../../schemas/responses'

/**
 * 公开影片路由 — 使用方法链以支持 Hono RPC 类型推导
 */
export const publicMoviesRoutes = new Hono<AppEnv>()
  // 获取影片列表
  .get(
    '/',
    describeRoute({
      summary: '获取影片列表',
      description: '支持分页、演员筛选、出版商筛选、类型筛选、关键词搜索和排序',
      tags: ['Movies'],
      operationId: 'getMoviesList',
      responses: {
        200: {
          description: '成功返回影片列表',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(MoviesListDataSchema, '成功返回影片列表')),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
      },
    }),
    validator('query', GetMoviesQuerySchema),
    async (c) => {
      const db = c.get('db')
      const user = c.get('user')
      const params = c.req.valid('query')

      const { page, limit, actor, publisher, genre, series, search, sortBy, sortOrder, yearFrom, yearTo, durationMin, durationMax } = params
      const offset = (page - 1) * limit

      try {
        const conditions: SQL[] = []

        if (!user?.isR18Verified) {
          conditions.push(eq(movies.isR18, false))
        }

        // 演员筛选 — 通过 movie_actors 关联表 EXISTS 子查询
        if (actor) {
          conditions.push(
            sql`EXISTS (
            SELECT 1 FROM ${movieActors}
            INNER JOIN ${actors} ON ${movieActors.actorId} = ${actors.id}
            WHERE ${movieActors.movieId} = ${movies.id}
            AND (${actors.slug} = ${actor} OR ${actors.name} LIKE ${`%${actor}%`})
          )`,
          )
        }

        // 厂商筛选 — 通过 movie_publishers 关联表 EXISTS 子查询
        if (publisher) {
          conditions.push(
            sql`EXISTS (
            SELECT 1 FROM ${moviePublishers}
            INNER JOIN ${publishers} ON ${moviePublishers.publisherId} = ${publishers.id}
            WHERE ${moviePublishers.movieId} = ${movies.id}
            AND (${publishers.slug} = ${publisher} OR ${publishers.name} LIKE ${`%${publisher}%`})
          )`,
          )
        }

        if (genre) {
          conditions.push(like(movies.genres, `%${genre}%`))
        }

        if (series) {
          conditions.push(eq(movies.series, series))
        }

        if (search) {
          const searchCondition = or(
            like(movies.code, `%${search}%`),
            like(movies.title, `%${search}%`),
          )
          if (searchCondition) {
            conditions.push(searchCondition)
          }
        }

        if (yearFrom) {
          const fromDate = new Date(Number.parseInt(yearFrom), 0, 1)
          conditions.push(gte(movies.releaseDate, fromDate))
        }

        if (yearTo) {
          const toDate = new Date(Number.parseInt(yearTo), 11, 31, 23, 59, 59, 999)
          conditions.push(lte(movies.releaseDate, toDate))
        }

        if (durationMin) {
          conditions.push(gte(movies.duration, Number.parseInt(durationMin)))
        }

        if (durationMax) {
          conditions.push(lte(movies.duration, Number.parseInt(durationMax)))
        }

        const sortField = {
          releaseDate: movies.releaseDate,
          createdAt: movies.createdAt,
          updatedAt: movies.updatedAt,
          title: movies.title,
        }[sortBy]

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(movies)
            .where(whereClause)
            .orderBy(sortOrder === 'desc' ? desc(sortField) : sortField)
            .limit(limit)
            .offset(offset),
          db
            .select({ value: count() })
            .from(movies)
            .where(whereClause)
            .then(res => res[0].value),
        ])

        return c.json({
          success: true,
          data,
          pagination: {
            page,
            limit,
            total: totalResult,
            totalPages: Math.ceil(totalResult / limit),
          },
        })
      }
      catch (error) {
        console.error('[PublicMovies] Failed to fetch movies list:', error)
        return c.json({
          success: false,
          error: '查询影片列表失败',
        }, 500)
      }
    },
  )
  // 获取 Genre 列表（必须在 /:code 之前，避免 "genres" 被解析为 movie code）
  .get(
    '/genres',
    describeRoute({
      summary: '获取 Genre 列表',
      description: '聚合所有影片的题材/标签列表，按作品数量降序排列',
      tags: ['Movies'],
      operationId: 'getGenresList',
      responses: {
        200: {
          description: '成功返回 Genre 列表',
          content: {
            'application/json': {
              schema: resolver(
                SuccessResponseSchema(
                  v.array(v.object({ genre: v.string(), count: v.number() })),
                  '成功返回 Genre 列表',
                ),
              ),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get('db')
      const user = c.get('user')

      try {
        // 使用 SQLite json_each 聚合 genres 数组字段，R18 认证决定可见范围
        const r18Filter = !user?.isR18Verified
          ? sql`AND m.is_r18 = 0`
          : sql``

        const results = await db.all<{ genre: string, count: number }>(
          sql`
            SELECT j.value AS genre, COUNT(*) AS count
            FROM movie m, json_each(m.genres) j
            WHERE m.genres IS NOT NULL
              AND m.genres != '[]'
              AND j.value != ''
              ${r18Filter}
            GROUP BY j.value
            ORDER BY count DESC
            LIMIT 100
          `,
        )

        return c.json({ success: true, data: results })
      }
      catch (error) {
        console.error('[PublicMovies] Failed to fetch genres:', error)
        return c.json({ success: false, error: '查询 Genre 列表失败' }, 500)
      }
    },
  )
  // 获取个性化推荐
  .get(
    '/recommended',
    describeRoute({
      summary: '获取个性化推荐',
      description: '已登录用户根据观看历史推荐，未登录用户返回热门影片',
      tags: ['Movies'],
      operationId: 'getRecommendedMovies',
      responses: {
        200: {
          description: '成功返回推荐列表',
          content: {
            'application/json': {
              schema: resolver(
                SuccessResponseSchema(
                  v.object({
                    data: v.array(MovieItemSchema),
                    meta: v.object({ strategy: v.string() }),
                  }),
                  '成功返回推荐列表',
                ),
              ),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get('db')
      const user = c.get('user')

      try {
        const fallBackToHot = async () => {
          const conditions: SQL[] = []
          if (!user?.isR18Verified) {
            conditions.push(eq(movies.isR18, false))
          }
          const whereClause = conditions.length > 0 ? and(...conditions) : undefined
          const data = await db
            .select()
            .from(movies)
            .where(whereClause)
            .orderBy(desc(movies.viewCount))
            .limit(12)
          return c.json({ success: true, data, meta: { strategy: 'hot' } })
        }

        if (!user) {
          return await fallBackToHot()
        }

        const history = await db
          .select({ movieCode: watchingProgress.movieCode })
          .from(watchingProgress)
          .where(eq(watchingProgress.userId, user.id))
          .orderBy(desc(watchingProgress.updatedAt))
          .limit(30)

        if (history.length === 0) {
          return await fallBackToHot()
        }

        const watchedCodes = history.map(h => h.movieCode)

        const recentMovies = await db.query.movies.findMany({
          where: inArray(movies.code, watchedCodes),
          with: {
            movieActors: true,
          },
        })

        const genreCounts = new Map<string, number>()
        const actorCounts = new Map<string, number>()

        for (const m of recentMovies) {
          if (Array.isArray(m.genres)) {
            for (const g of m.genres) {
              if (g) {
                genreCounts.set(g, (genreCounts.get(g) || 0) + 1)
              }
            }
          }
          const maList = m.movieActors
          if (maList) {
            for (const ma of maList) {
              actorCounts.set(ma.actorId, (actorCounts.get(ma.actorId) || 0) + 1)
            }
          }
        }

        const topGenres = Array.from(genreCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(e => e[0])
          .slice(0, 3)

        const topActorIds = Array.from(actorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(e => e[0])
          .slice(0, 5)

        const conditions: SQL[] = [notInArray(movies.code, watchedCodes)]
        if (!user?.isR18Verified) {
          conditions.push(eq(movies.isR18, false))
        }

        let recData: (typeof movies.$inferSelect)[] = []
        if (topGenres.length > 0 || topActorIds.length > 0) {
          const matchConditions: SQL[] = []

          if (topGenres.length > 0) {
            matchConditions.push(sql`EXISTS (
              SELECT 1 FROM json_each(${movies.genres})
              WHERE json_each.value IN ${topGenres}
            )`)
          }

          if (topActorIds.length > 0) {
            matchConditions.push(sql`EXISTS (
              SELECT 1 FROM ${movieActors}
              WHERE ${movieActors.movieId} = ${movies.id}
              AND ${movieActors.actorId} IN ${topActorIds}
            )`)
          }

          conditions.push(or(...matchConditions)!)

          recData = await db
            .select()
            .from(movies)
            .where(and(...conditions))
            .orderBy(desc(movies.viewCount))
            .limit(12)
        }

        let finalData = recData

        if (finalData.length < 12) {
          const currentIds = finalData.map(m => m.id)
          const fillConditions: SQL[] = []
          if (!user?.isR18Verified) {
            fillConditions.push(eq(movies.isR18, false))
          }
          if (currentIds.length > 0) {
            fillConditions.push(notInArray(movies.id, currentIds))
          }
          fillConditions.push(notInArray(movies.code, watchedCodes))

          const fillData = await db
            .select()
            .from(movies)
            .where(fillConditions.length > 0 ? and(...fillConditions) : undefined)
            .orderBy(desc(movies.viewCount))
            .limit(12 - finalData.length)

          finalData = [...finalData, ...fillData]
        }

        return c.json({ success: true, data: finalData, meta: { strategy: 'personalized' } })
      }
      catch (error) {
        console.error('[PublicMovies] Failed to fetch recommended:', error)
        return c.json({ success: false, error: '查询推荐列表失败' }, 500)
      }
    },
  )
  // 获取影片详情
  .get(
    '/:code',
    describeRoute({
      summary: '获取影片详情',
      description: '根据番号获取影片的完整信息，包括播放源和相关影片推荐',
      tags: ['Movies'],
      operationId: 'getMovieDetail',
      responses: {
        200: {
          description: '成功返回影片详情',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(MovieDetailSchema, '成功返回影片详情')),
            },
          },
        },
        403: {
          description: 'R18 内容需要权限验证',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        404: {
          description: '影片不存在',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
      },
    }),
    validator('param', GetMovieParamSchema),
    async (c) => {
      const db = c.get('db')
      const user = c.get('user')
      const { code } = c.req.param()

      try {
        // 通过关联表查询影片详情（含演员和厂商）
        const movie = await db.query.movies.findFirst({
          where: eq(movies.code, code),
          with: {
            movieActors: {
              with: { actor: true },
              orderBy: (ma, { asc }) => [asc(ma.sortOrder)],
            },
            moviePublishers: {
              with: { publisher: true },
              orderBy: (mp, { asc }) => [asc(mp.sortOrder)],
            },
          },
        })

        if (!movie) {
          return c.json({ success: false, error: '影片不存在' }, 404)
        }

        if (movie.isR18 && !user?.isR18Verified) {
          return c.json({ success: false, error: '需要 R18 访问权限' }, 403)
        }

        const playerList = await db.query.players.findMany({
          where: eq(players.movieId, movie.id),
          orderBy: (players, { asc }) => [asc(players.sortOrder)],
        })

        // 结构化演员和厂商数据
        const movieActorsList = movie.movieActors.map(ma => ({
          id: ma.actor.id,
          name: ma.actor.name,
          slug: ma.actor.slug,
          avatar: ma.actor.avatar,
        }))

        const moviePublishersList = movie.moviePublishers.map(mp => ({
          id: mp.publisher.id,
          name: mp.publisher.name,
          slug: mp.publisher.slug,
          logo: mp.publisher.logo,
        }))

        // 基于关联表查询相关影片（共同演员 + 同系列）
        let relatedMovies: (typeof movies.$inferSelect)[] = []

        try {
          const actorIds = movie.movieActors.map(ma => ma.actorId)
          const relatedFromActors: (typeof movies.$inferSelect & { shared_actors: number })[] = []
          const relatedFromSeries: (typeof movies.$inferSelect)[] = []

          // 共同演员推荐：查找与当前影片共享演员最多的其他影片
          if (actorIds.length > 0) {
            const movieCols = getTableColumns(movies)
            const sharedCountExpr = sql<number>`count(distinct ${movieActors.actorId})`

            const actorConditions: SQL[] = [
              inArray(movieActors.actorId, actorIds),
              ne(movies.id, movie.id),
            ]
            if (!user?.isR18Verified) {
              actorConditions.push(eq(movies.isR18, false))
            }

            const sharedResult = await db
              .select({
                ...movieCols,
                shared_actors: sharedCountExpr.as('shared_actors'),
              })
              .from(movies)
              .innerJoin(movieActors, eq(movieActors.movieId, movies.id))
              .where(and(...actorConditions))
              .groupBy(movies.id)
              .orderBy(desc(sharedCountExpr))
              .limit(8)

            relatedFromActors.push(...sharedResult)
          }

          // 同系列推荐（limit 提升至 8，确保系列导航有足够数据推导位置）
          if (movie.series) {
            const seriesConditions: SQL[] = [
              eq(movies.series, movie.series),
              ne(movies.id, movie.id),
            ]
            if (!user?.isR18Verified) {
              seriesConditions.push(eq(movies.isR18, false))
            }

            const seriesResult = await db
              .select()
              .from(movies)
              .where(and(...seriesConditions))
              .limit(8)

            relatedFromSeries.push(...seriesResult)
          }

          // 合并去重（共同演员优先）
          const seenIds = new Set<string>()
          const merged: (typeof movies.$inferSelect)[] = []
          for (const m of [...relatedFromActors, ...relatedFromSeries]) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id)
              merged.push(m)
            }
          }

          // genre fallback：当演员+系列结果 < 4 时，用同 genre 热门影片补足至 6 条
          if (merged.length < 4) {
            const rawGenres = movie.genres as string[] | null
            const firstGenre = Array.isArray(rawGenres)
              ? rawGenres.find(g => g && g.trim() !== '')
              : null

            if (firstGenre) {
              const existingIds = [movie.id, ...merged.map(m => m.id)]
              const genreConditions: SQL[] = [
                sql`EXISTS (
                  SELECT 1 FROM json_each(${movies.genres})
                  WHERE json_each.value = ${firstGenre}
                )`,
                notInArray(movies.id, existingIds),
              ]
              if (!user?.isR18Verified) {
                genreConditions.push(eq(movies.isR18, false))
              }

              try {
                const genreResult = await db
                  .select()
                  .from(movies)
                  .where(and(...genreConditions))
                  .orderBy(desc(movies.viewCount))
                  .limit(6 - merged.length)

                for (const m of genreResult) {
                  if (!seenIds.has(m.id)) {
                    seenIds.add(m.id)
                    merged.push(m)
                  }
                }
              }
              catch {
                // genre fallback 失败时静默忽略，返回现有结果
              }
            }
          }

          relatedMovies = merged.slice(0, 6)
        }
        catch (error) {
          console.error('[PublicMovies] Failed to fetch related movies:', error)
        }

        // 构建响应：用关联表的结构化数据覆盖老的 JSON 文本字段
        const { movieActors: _ma, moviePublishers: _mp, ...movieData } = movie

        return c.json({
          success: true,
          data: {
            ...movieData,
            actors: movieActorsList,
            publishers: moviePublishersList,
            players: playerList,
            relatedMovies,
          },
        })
      }
      catch (error) {
        console.error(`[PublicMovies] Failed to fetch movie ${code}:`, error)
        return c.json({
          success: false,
          error: '查询影片详情失败',
        }, 500)
      }
    },
  )
  // 上报影片观看（埋点，匿名可用，fire-and-forget 设计）
  .post(
    '/:code/view',
    describeRoute({
      summary: '上报影片观看',
      description: '进入播放页时调用，自增 viewCount 用于热门排序。无需登录，影片不存在时静默成功。',
      tags: ['Movies'],
      operationId: 'trackMovieView',
      responses: {
        200: {
          description: '上报成功',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.null(), '上报成功')),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get('db')
      const { code } = c.req.param()

      try {
        // 原子自增，影片不存在时 UPDATE 影响 0 行，静默成功
        await db
          .update(movies)
          .set({ viewCount: sql`${movies.viewCount} + 1` })
          .where(eq(movies.code, code))
      }
      catch (error) {
        console.error(`[PublicMovies] Failed to track view for movie ${code}:`, error)
      }

      return c.json({ success: true, data: null })
    },
  )
