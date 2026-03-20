/**
 * 厂商 API 路由（公开接口）
 *
 * 提供厂商列表、详情查询功能
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { moviePublishers, movies, publishers } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const publishersRoute = new Hono<AppEnv>()

/**
 * GET /api/publishers
 * 厂商列表（支持分页、排序、筛选）
 */
publishersRoute.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['name', 'movieCount', 'createdAt']).default('name'),
    country: z.string().optional(),
    hasDetails: z.coerce.boolean().optional(),
  })),
  async (c) => {
    const { page, limit, sort, country, hasDetails } = c.req.valid('query')
    const db = c.get('db')
    const offset = (page - 1) * limit

    try {
      // 构建查询条件
      const conditions = []
      if (country) {
        conditions.push(eq(publishers.country, country))
      }
      if (hasDetails !== undefined) {
        conditions.push(eq(publishers.hasDetailsCrawled, hasDetails))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 确定排序字段
      let orderBy
      switch (sort) {
        case 'movieCount':
          orderBy = desc(publishers.movieCount)
          break
        case 'createdAt':
          orderBy = desc(publishers.createdAt)
          break
        case 'name':
        default:
          orderBy = publishers.name
      }

      const [results, totalResult] = await Promise.all([
        db.query.publishers.findMany({
          where: whereClause,
          orderBy,
          limit,
          offset,
          columns: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            country: true,
            movieCount: true,
            hasDetailsCrawled: true,
          },
        }),
        db
          .select({ value: count() })
          .from(publishers)
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
      console.error('[Publishers] ❌ Failed to query publishers:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/publishers/:slug
 * 厂商详情（包含作品列表）
 */
publishersRoute.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.get('db')

  try {
    // 查找厂商
    const publisher = await db.query.publishers.findFirst({
      where: eq(publishers.slug, slug),
    })

    if (!publisher) {
      return c.json({ error: 'Publisher not found' }, 404)
    }

    // 查询关联电影（通过 movie_publishers 表）
    const relatedMoviesData = await db
      .select({
        id: movies.id,
        code: movies.code,
        title: movies.title,
        slug: movies.slug,
        coverImage: movies.coverImage,
        releaseDate: movies.releaseDate,
        duration: movies.duration,
        sortOrder: moviePublishers.sortOrder,
      })
      .from(moviePublishers)
      .innerJoin(movies, eq(moviePublishers.movieId, movies.id))
      .where(eq(moviePublishers.publisherId, publisher.id))
      .orderBy(desc(movies.releaseDate))
      .limit(100)

    return c.json({
      ...publisher,
      relatedMovies: relatedMoviesData,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Publishers] ❌ Failed to get publisher ${slug}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

export default publishersRoute
