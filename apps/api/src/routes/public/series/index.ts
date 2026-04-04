import type { AppEnv } from '../../../types'
import { movies } from '@starye/db/schema'
import { and, count, eq, isNotNull, max, min, ne, sql, sum } from 'drizzle-orm'
import { Hono } from 'hono'

export const publicSeriesRoutes = new Hono<AppEnv>()
  /**
   * GET /api/series/:name
   * 返回系列聚合统计信息、所属厂商和同厂商其他系列
   */
  .get('/:name', async (c) => {
    const db = c.get('db')
    const user = c.get('user')
    const rawName = c.req.param('name')
    const seriesName = decodeURIComponent(rawName)

    try {
      // 构建 R18 过滤条件
      const r18Condition = user?.isR18Verified ? undefined : eq(movies.isR18, false)

      // 聚合查询：影片数 / 总时长 / 年份区间 / 厂商名
      const statsRows = await db
        .select({
          movieCount: count(),
          totalDuration: sum(movies.duration),
          minDate: min(movies.releaseDate),
          maxDate: max(movies.releaseDate),
          publisher: movies.publisher,
        })
        .from(movies)
        .where(
          and(
            eq(movies.series, seriesName),
            r18Condition,
          ),
        )
        .groupBy(movies.publisher)

      if (!statsRows.length) {
        return c.json({ error: 'Series not found' }, 404)
      }

      // 取第一行（同系列通常归属同一厂商）
      const { movieCount, totalDuration, minDate, maxDate, publisher: publisherName } = statsRows[0]

      // 计算年份区间（releaseDate 以秒级时间戳存储）
      const minYear = minDate ? new Date((minDate as unknown as number) * 1000).getFullYear() : null
      const maxYear = maxDate ? new Date((maxDate as unknown as number) * 1000).getFullYear() : null

      // 查询厂商 slug（publishers 表模糊匹配）
      let publisherRecord: { name: string, slug: string | null } | null = null
      if (publisherName) {
        const found = await db.query.publishers.findFirst({
          where: (p, { like }) => like(p.name, `%${publisherName}%`),
          columns: { name: true, slug: true },
        })
        publisherRecord = found
          ? { name: found.name, slug: found.slug }
          : { name: publisherName, slug: null }
      }

      // 查询同厂商其他系列（最多 8 个，去重）
      let relatedSeries: string[] = []
      if (publisherName) {
        const relatedRows = await db
          .selectDistinct({ series: movies.series })
          .from(movies)
          .where(
            and(
              eq(movies.publisher, publisherName),
              ne(movies.series, seriesName),
              isNotNull(movies.series),
              // 排除空字符串
              sql`${movies.series} != ''`,
              r18Condition,
            ),
          )
          .limit(8)
        relatedSeries = relatedRows.map(r => r.series!).filter(Boolean)
      }

      return c.json({
        name: seriesName,
        movieCount: movieCount as unknown as number,
        totalDuration: (totalDuration as unknown as number) || 0,
        minYear,
        maxYear,
        publisher: publisherRecord,
        relatedSeries,
      })
    }
    catch (error) {
      console.error(`[PublicSeries] Failed to fetch series "${seriesName}":`, error)
      return c.json({ error: '查询系列详情失败' }, 500)
    }
  })
