/**
 * 女优 API 路由（公开接口）
 *
 * 提供女优列表、详情查询功能
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { actors, movieActors, movies } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const actorsRoute = new Hono<AppEnv>()

/**
 * GET /api/actors
 * 女优列表（支持分页、排序、筛选）
 */
actorsRoute.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['name', 'movieCount', 'createdAt']).default('name'),
    nationality: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    hasDetails: z.coerce.boolean().optional(),
  })),
  async (c) => {
    const { page, limit, sort, nationality, isActive, hasDetails } = c.req.valid('query')
    const db = c.get('db')
    const offset = (page - 1) * limit

    try {
      // 构建查询条件
      const conditions = []
      if (nationality) {
        conditions.push(eq(actors.nationality, nationality))
      }
      if (isActive !== undefined) {
        conditions.push(eq(actors.isActive, isActive))
      }
      if (hasDetails !== undefined) {
        conditions.push(eq(actors.hasDetailsCrawled, hasDetails))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 确定排序字段
      let orderBy
      switch (sort) {
        case 'movieCount':
          orderBy = desc(actors.movieCount)
          break
        case 'createdAt':
          orderBy = desc(actors.createdAt)
          break
        case 'name':
        default:
          orderBy = actors.name
      }

      const [results, totalResult] = await Promise.all([
        db.query.actors.findMany({
          where: whereClause,
          orderBy,
          limit,
          offset,
          columns: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
            nationality: true,
            movieCount: true,
            isActive: true,
            hasDetailsCrawled: true,
          },
        }),
        db
          .select({ value: count() })
          .from(actors)
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
      console.error('[Actors] ❌ Failed to query actors:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/actors/:slug
 * 女优详情（包含作品列表）
 */
actorsRoute.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.get('db')

  try {
    // 查找女优
    const actor = await db.query.actors.findFirst({
      where: eq(actors.slug, slug),
    })

    if (!actor) {
      return c.json({ error: 'Actor not found' }, 404)
    }

    // 查询关联电影（通过 movie_actors 表）
    const relatedMoviesData = await db
      .select({
        id: movies.id,
        code: movies.code,
        title: movies.title,
        slug: movies.slug,
        coverImage: movies.coverImage,
        releaseDate: movies.releaseDate,
        duration: movies.duration,
        sortOrder: movieActors.sortOrder,
      })
      .from(movieActors)
      .innerJoin(movies, eq(movieActors.movieId, movies.id))
      .where(eq(movieActors.actorId, actor.id))
      .orderBy(desc(movies.releaseDate))
      .limit(100)

    return c.json({
      ...actor,
      relatedMovies: relatedMoviesData,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Actors] ❌ Failed to get actor ${slug}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

export default actorsRoute
