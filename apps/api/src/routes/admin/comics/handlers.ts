import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { comics } from '@starye/db/schema'
import { and, asc, count, desc, eq, like, or } from 'drizzle-orm'

/** 漫画列表排序字段白名单 */
const COMIC_SORT_FIELDS = ['updatedAt', 'createdAt', 'title', 'sortOrder'] as const
type ComicSortField = typeof COMIC_SORT_FIELDS[number]

/**
 * 获取漫画列表（管理员视图）
 * 支持分页、搜索、筛选（isR18/status/region/crawlStatus）、服务端排序
 */
export async function getComicList(c: Context<AppEnv>) {
  const db = c.get('db')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const offset = (page - 1) * limit

  // 筛选参数
  const search = c.req.query('search')
  const isR18Param = c.req.query('isR18')
  const status = c.req.query('status') as 'serializing' | 'completed' | undefined
  const region = c.req.query('region')
  const crawlStatus = c.req.query('crawlStatus') as 'pending' | 'partial' | 'complete' | undefined

  // 排序参数（白名单校验，防止 SQL 注入）
  const sortByParam = c.req.query('sortBy') || 'updatedAt'
  const sortBy: ComicSortField = COMIC_SORT_FIELDS.includes(sortByParam as ComicSortField)
    ? (sortByParam as ComicSortField)
    : 'updatedAt'
  const sortOrderParam = c.req.query('sortOrder')
  const sortOrder: 'asc' | 'desc' = sortOrderParam === 'asc' ? 'asc' : 'desc'

  // 构建 WHERE 条件
  const conditions = []

  if (search) {
    const searchCond = or(
      like(comics.title, `%${search}%`),
      like(comics.author, `%${search}%`),
    )
    if (searchCond)
      conditions.push(searchCond)
  }

  if (isR18Param === 'true') {
    conditions.push(eq(comics.isR18, true))
  }
  else if (isR18Param === 'false') {
    conditions.push(eq(comics.isR18, false))
  }

  if (status === 'serializing' || status === 'completed') {
    conditions.push(eq(comics.status, status))
  }

  if (region) {
    conditions.push(like(comics.region, `%${region}%`))
  }

  if (crawlStatus === 'pending' || crawlStatus === 'partial' || crawlStatus === 'complete') {
    conditions.push(eq(comics.crawlStatus, crawlStatus))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // 构建 ORDER BY
  const sortColumn = {
    updatedAt: comics.updatedAt,
    createdAt: comics.createdAt,
    title: comics.title,
    sortOrder: comics.sortOrder,
  }[sortBy] ?? comics.updatedAt

  const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)

  const [results, totalResult] = await Promise.all([
    db.select().from(comics).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ value: count() }).from(comics).where(where).then(res => res[0].value),
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

/**
 * 更新漫画信息
 */
export async function updateComicMetadata(c: Context<AppEnv>) {
  const id = String(c.req.param('id')!)
  const data = (c.req as any).valid('json')
  const db = c.get('db')

  try {
    await db.update(comics)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(comics.id, id))

    return c.json({ success: true })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin] Failed to update comic ${id}:`, message)
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * 批量获取漫画状态
 */
export async function getBatchComicStatus(c: Context<AppEnv>) {
  const slugsParam = c.req.query('slugs')
  if (!slugsParam) {
    return c.json({ error: 'slugs parameter is required' }, 400)
  }

  const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (slugs.length === 0) {
    return c.json({ error: 'slugs parameter is required' }, 400)
  }

  const db = c.get('db')
  const startTime = Date.now()

  try {
    const results = await db.query.comics.findMany({
      where: (comics, { inArray }) => inArray(comics.slug, slugs),
      columns: {
        slug: true,
        crawlStatus: true,
        lastCrawledAt: true,
        totalChapters: true,
        crawledChapters: true,
        isSerializing: true,
        status: true,
      },
    })

    const statusMap: Record<string, any> = {}
    for (const slug of slugs) {
      const result = results.find(r => r.slug === slug)
      if (result) {
        statusMap[slug] = {
          exists: true,
          status: result.crawlStatus,
          totalChapters: result.totalChapters,
          crawledChapters: result.crawledChapters,
          lastCrawledAt: result.lastCrawledAt?.toISOString(),
          isSerializing: result.isSerializing,
          comicStatus: result.status,
        }
      }
      else {
        statusMap[slug] = {
          exists: false,
        }
      }
    }

    const elapsed = Date.now() - startTime
    // console.log(`[BatchStatus] 批量查询 ${slugs.length} 个漫画，耗时 ${elapsed}ms`)

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
}

/**
 * 更新漫画爬取进度
 */
export async function updateComicProgress(c: Context<AppEnv>) {
  const slug = c.req.param('slug')!
  const { status, crawledChapters, totalChapters } = (c.req as any).valid('json')
  const db = c.get('db')

  try {
    const comic = await db.query.comics.findFirst({
      where: eq(comics.slug, slug),
      columns: { id: true },
    })

    if (!comic) {
      return c.json({ error: 'Comic not found' }, 404)
    }

    await db.update(comics)
      .set({
        crawlStatus: status,
        crawledChapters,
        totalChapters,
        lastCrawledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(comics.slug, slug))

    // console.log(`[Progress] 更新漫画进度: ${slug}, status=${status}, ${crawledChapters}/${totalChapters}`)
    return c.json({ success: true })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Progress] ❌ Failed to update progress for ${slug}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}

/**
 * 获取爬取统计
 */
export async function getCrawlStats(c: Context<AppEnv>) {
  const db = c.get('db')
  const sinceParam = c.req.query('since')

  try {
    const allComics = await db.query.comics.findMany({
      columns: {
        crawlStatus: true,
        isSerializing: true,
        lastCrawledAt: true,
      },
    })

    let filteredComics = allComics
    if (sinceParam) {
      const sinceDate = new Date(sinceParam)
      filteredComics = allComics.filter(c =>
        c.lastCrawledAt && c.lastCrawledAt >= sinceDate,
      )
    }

    const total = filteredComics.length
    const pending = filteredComics.filter(c => c.crawlStatus === 'pending').length
    const partial = filteredComics.filter(c => c.crawlStatus === 'partial').length
    const complete = filteredComics.filter(c => c.crawlStatus === 'complete').length
    const serializing = filteredComics.filter(c => c.isSerializing).length

    const lastCrawlAt = allComics
      .filter(c => c.lastCrawledAt)
      .sort((a, b) => (b.lastCrawledAt?.getTime() || 0) - (a.lastCrawledAt?.getTime() || 0))[0]
      ?.lastCrawledAt

    return c.json({
      total,
      pending,
      partial,
      complete,
      serializing,
      lastCrawlAt: lastCrawlAt?.toISOString() || null,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[CrawlStats] ❌ Database operation failed:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}

/**
 * 批量操作漫画
 */
export async function bulkOperateComics(c: Context<AppEnv>) {
  const { ids, operation, payload } = (c.req as any).valid('json')
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
          const comic = await db.query.comics.findFirst({
            where: eq(comics.id, id),
          })

          if (!comic) {
            results.failed.push({ id, reason: 'Comic not found' })
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
              await db.delete(comics).where(eq(comics.id, id))
              results.success.push(id)
              continue

            default:
              results.failed.push({ id, reason: 'Unknown operation' })
              continue
          }

          if (Object.keys(updateData).length > 0) {
            await db.update(comics)
              .set({ ...updateData, updatedAt: new Date() })
              .where(eq(comics.id, id))

            results.success.push(id)
          }
        }
        catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          results.failed.push({ id, reason: message })
        }
      }
    }

    // console.log(`[BulkOperation] Completed: ${results.success.length} success, ${results.failed.length} failed`)
    return c.json(results)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[BulkOperation] ❌ Operation failed:', message)
    return c.json({ error: 'Bulk operation failed' }, 500)
  }
}
