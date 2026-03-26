import type { SQL } from 'drizzle-orm'
import type { AppEnv } from '../../../types'
import { movies, players } from '@starye/db/schema'
import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { GetMovieParamSchema, GetMoviesQuerySchema, MovieDetailSchema, MoviesListDataSchema } from '../../../schemas/movie'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../../schemas/responses'

const publicMovies = new Hono<AppEnv>()

// 获取影片列表
publicMovies.get(
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

    const { page, limit, actor, publisher, genre, search, sortBy, sortOrder } = params
    const offset = (page - 1) * limit

    try {
    // 构建查询条件
      const conditions: SQL[] = []

      // R18 内容过滤
      if (!user?.isR18Verified) {
        conditions.push(eq(movies.isR18, false))
      }

      // 演员筛选
      if (actor) {
        conditions.push(like(movies.actors, `%${actor}%`))
      }

      // 厂商筛选
      if (publisher) {
        conditions.push(like(movies.publisher, `%${publisher}%`))
      }

      // 标签筛选
      if (genre) {
        conditions.push(like(movies.genres, `%${genre}%`))
      }

      // 搜索（番号或标题）
      if (search) {
        const searchCondition = or(
          like(movies.code, `%${search}%`),
          like(movies.title, `%${search}%`),
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // 排序字段映射
      const sortField = {
        releaseDate: movies.releaseDate,
        createdAt: movies.createdAt,
        updatedAt: movies.updatedAt,
        title: movies.title,
      }[sortBy]

      // 查询数据
      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(movies)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(sortOrder === 'desc' ? desc(sortField) : sortField)
          .limit(limit)
          .offset(offset),
        db
          .select({ value: count() })
          .from(movies)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .then(res => res[0].value),
      ])

      return c.json({
        success: true,
        data: {
          data,
          pagination: {
            page,
            limit,
            total: totalResult,
            totalPages: Math.ceil(totalResult / limit),
          },
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
publicMovies.get(
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
    // 查询影片
      const movie = await db.query.movies.findFirst({
        where: eq(movies.code, code),
      })

      if (!movie) {
        return c.json({ success: false, error: '影片不存在' }, 404)
      }

      // R18 权限验证
      if (movie.isR18 && !user?.isR18Verified) {
        return c.json({ success: false, error: '需要 R18 访问权限' }, 403)
      }

      // 查询播放源列表
      const playerList = await db.query.players.findMany({
        where: eq(players.movieId, movie.id),
        orderBy: (players, { asc }) => [asc(players.sortOrder)],
      })

      // 查询相关影片（同演员或同系列）
      let relatedMovies: typeof movie[] = []

      try {
        // 构建相关影片查询条件
        const relatedConditions: SQL[] = []

        // R18 过滤
        if (movie.isR18 && !user?.isR18Verified) {
          relatedConditions.push(eq(movies.isR18, false))
        }

        // 同演员或同系列（至少有一个条件）
        const similarityConditions: SQL[] = []
        if (movie.actors && Array.isArray(movie.actors) && movie.actors.length > 0) {
          similarityConditions.push(like(movies.actors, `%${movie.actors[0]}%`))
        }
        if (movie.series) {
          similarityConditions.push(eq(movies.series, movie.series))
        }

        // 只有在有相似性条件时才查询
        if (similarityConditions.length > 0) {
          const similarityOr = or(...similarityConditions)
          if (similarityOr) {
            relatedConditions.push(similarityOr)
          }

          relatedMovies = await db
            .select()
            .from(movies)
            .where(relatedConditions.length > 0 ? and(...relatedConditions) : undefined)
            .limit(10)
        }
      }
      catch (error) {
        console.error('[PublicMovies] Failed to fetch related movies:', error)
      }

      return c.json({
        success: true,
        data: {
          ...movie,
          players: playerList,
          relatedMovies: relatedMovies.filter(m => m.id !== movie.id).slice(0, 6),
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

export const publicMoviesRoutes = publicMovies
