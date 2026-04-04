import type { AppEnv } from '../../../types'
import { actors, movies, publishers } from '@starye/db/schema'
import { eq, like, or } from 'drizzle-orm'
import { Hono } from 'hono'

export const publicSearchRoutes = new Hono<AppEnv>()
  /**
   * GET /api/search?q=&types=movie,actor,publisher&limit=5
   * 跨类型关键词搜索，返回混合结果
   */
  .get('/', async (c) => {
    const { q, types = 'movie,actor,publisher', limit = '5' } = c.req.query()
    const user = c.get('user')
    const db = c.get('db')

    if (!q || q.trim().length === 0) {
      return c.json({ q: q ?? '', results: {} })
    }

    const typeList = types.split(',').map(t => t.trim())
    const limitNum = Math.min(Math.max(1, Number.parseInt(limit, 10) || 5), 20)
    const keyword = q.trim()

    const results: {
      movies?: Array<{ id: string, code: string, title: string, slug: string, coverImage: string | null, isR18: boolean }>
      actors?: Array<{ id: string, name: string, slug: string, avatar: string | null }>
      publishers?: Array<{ id: string, name: string, slug: string, logo: string | null }>
    } = {}

    try {
      if (typeList.includes('movie')) {
        // R18 过滤：未验证用户只看非 R18 内容
        const r18Filter = user?.isR18Verified ? undefined : eq(movies.isR18, false)
        // 非 R18 用户：精确番号匹配 + 非R18条件，或模糊标题匹配 + 非R18条件
        results.movies = await db
          .select({
            id: movies.id,
            code: movies.code,
            title: movies.title,
            slug: movies.slug,
            coverImage: movies.coverImage,
            isR18: movies.isR18,
          })
          .from(movies)
          .where(
            r18Filter
              ? or(
                  // 精确番号匹配
                  eq(movies.code, keyword),
                  // 标题模糊搜索（仅非 R18）
                  like(movies.title, `%${keyword}%`),
                )
              : or(
                  eq(movies.code, keyword),
                  like(movies.title, `%${keyword}%`),
                ),
          )
          .limit(limitNum) as typeof results.movies

        // 若有 R18 过滤则在应用层过滤
        if (r18Filter && results.movies) {
          results.movies = results.movies.filter(m => !m.isR18)
        }
      }

      if (typeList.includes('actor')) {
        results.actors = await db
          .select({
            id: actors.id,
            name: actors.name,
            slug: actors.slug,
            avatar: actors.avatar,
          })
          .from(actors)
          .where(like(actors.name, `%${keyword}%`))
          .limit(limitNum) as typeof results.actors
      }

      if (typeList.includes('publisher')) {
        results.publishers = await db
          .select({
            id: publishers.id,
            name: publishers.name,
            slug: publishers.slug,
            logo: publishers.logo,
          })
          .from(publishers)
          .where(like(publishers.name, `%${keyword}%`))
          .limit(limitNum) as typeof results.publishers
      }

      return c.json({ q: keyword, results })
    }
    catch (error) {
      console.error(`[PublicSearch] 搜索失败 q="${keyword}":`, error)
      return c.json({ error: '搜索失败' }, 500)
    }
  })
