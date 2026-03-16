import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { chapters, comics } from '@starye/db/schema'
import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const publicComics = new Hono<AppEnv>()

// 漫画列表查询参数 Schema
const ComicsListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  status: z.enum(['serializing', 'completed']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// 获取漫画列表
publicComics.get('/', zValidator('query', ComicsListSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const params = c.req.valid('query')

  const { page, limit, category, status, search, sortBy, sortOrder } = params
  const offset = (page - 1) * limit

  try {
    // 构建查询条件
    const conditions: any[] = []

    // R18 内容过滤
    if (!user?.isR18Verified) {
      conditions.push(eq(comics.isR18, false))
    }

    // 分类筛选
    if (category) {
      conditions.push(like(comics.genres, `%${category}%`))
    }

    // 状态筛选
    if (status) {
      conditions.push(eq(comics.status, status))
    }

    // 搜索
    if (search) {
      conditions.push(
        or(
          like(comics.title, `%${search}%`),
          like(comics.author, `%${search}%`),
        ),
      )
    }

    // 排序字段映射
    const sortField = {
      createdAt: comics.createdAt,
      updatedAt: comics.updatedAt,
      title: comics.title,
    }[sortBy]

    // 查询数据
    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(comics)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sortOrder === 'desc' ? desc(sortField) : sortField)
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(comics)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
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
    console.error('[PublicComics] Failed to fetch comics list:', error)
    return c.json({
      success: false,
      error: '查询漫画列表失败',
    }, 500)
  }
})

// 获取漫画详情
publicComics.get('/:slug', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const { slug } = c.req.param()

  try {
    // 查询漫画
    const comic = await db.query.comics.findFirst({
      where: eq(comics.slug, slug),
    })

    if (!comic) {
      return c.json({ success: false, error: '漫画不存在' }, 404)
    }

    // R18 权限验证
    if (comic.isR18 && !user?.isR18Verified) {
      return c.json({ success: false, error: '需要 R18 访问权限' }, 403)
    }

    // 查询章节列表
    const chapterList = await db.query.chapters.findMany({
      where: eq(chapters.comicId, comic.id),
      orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
    })

    return c.json({
      success: true,
      data: {
        ...comic,
        chapters: chapterList,
      },
    })
  }
  catch (error) {
    console.error(`[PublicComics] Failed to fetch comic ${slug}:`, error)
    return c.json({
      success: false,
      error: '查询漫画详情失败',
    }, 500)
  }
})

// 获取章节详情（图片列表）
publicComics.get('/:slug/chapters/:chapterId', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const { slug, chapterId } = c.req.param()

  try {
    // 先查询漫画
    const comic = await db.query.comics.findFirst({
      where: eq(comics.slug, slug),
      columns: { id: true, isR18: true },
    })

    if (!comic) {
      return c.json({ success: false, error: '漫画不存在' }, 404)
    }

    // R18 权限验证
    if (comic.isR18 && !user?.isR18Verified) {
      return c.json({ success: false, error: '需要 R18 访问权限' }, 403)
    }

    // 查询章节
    const fullChapterId = `${slug}-${chapterId}`
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, fullChapterId),
        eq(chapters.comicId, comic.id),
      ),
      with: {
        pages: {
          orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
        },
      },
    })

    if (!chapter) {
      return c.json({ success: false, error: '章节不存在' }, 404)
    }

    return c.json({
      success: true,
      data: {
        id: chapter.id,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        images: chapter.pages.map(p => p.imageUrl),
      },
    })
  }
  catch (error) {
    console.error(`[PublicComics] Failed to fetch chapter ${slug}/${chapterId}:`, error)
    return c.json({
      success: false,
      error: '查询章节详情失败',
    }, 500)
  }
})

export default publicComics
