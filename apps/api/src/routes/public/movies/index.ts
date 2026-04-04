import type { SQL } from 'drizzle-orm'
import type { AppEnv } from '../../../types'
import { actors, movieActors, moviePublishers, movies, players, publishers } from '@starye/db/schema'
import { and, count, desc, eq, getTableColumns, inArray, like, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { GetMovieParamSchema, GetMoviesQuerySchema, MovieDetailSchema, MoviesListDataSchema } from '../../../schemas/movie'
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

      const { page, limit, actor, publisher, genre, series, search, sortBy, sortOrder } = params
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

          // 同系列推荐
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
              .limit(6)

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
          relatedMovies = merged.slice(0, 6)
        }
        catch (error) {
          console.error('[PublicMovies] Failed to fetch related movies:', error)
        }

        // 构建兼容响应：保留原有字段，附加结构化关联数据
        const { movieActors: _ma, moviePublishers: _mp, ...movieData } = movie

        return c.json({
          success: true,
          data: {
            ...movieData,
            players: playerList,
            relatedMovies,
            actorDetails: movieActorsList,
            publisherDetails: moviePublishersList,
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
