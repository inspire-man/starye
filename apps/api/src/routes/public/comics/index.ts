import type { SQL } from 'drizzle-orm'
import type { AppEnv } from '../../../types'
import { chapters, comics } from '@starye/db/schema'
import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { ChapterDetailSchema, ComicDetailSchema, ComicsListDataSchema, GetChapterParamSchema, GetComicParamSchema, GetComicsQuerySchema } from '../../../schemas/comic'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../../schemas/responses'

const publicComics = new Hono<AppEnv>()

// 获取漫画列表
publicComics.get(
  '/',
  describeRoute({
    summary: '获取漫画列表',
    description: '支持分页、分类筛选、状态筛选、关键词搜索和排序的漫画列表接口',
    tags: ['Comics'],
    operationId: 'getComicsList',
    responses: {
      200: {
        description: '成功返回漫画列表',
        content: {
          'application/json': {
            schema: resolver(
              SuccessResponseSchema(ComicsListDataSchema, '成功返回漫画列表'),
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
  validator('query', GetComicsQuerySchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')
    const params = c.req.valid('query')

    const { page, limit, category, status, search, sortBy, sortOrder } = params
    const offset = (page - 1) * limit

    try {
    // 构建查询条件
      const conditions: SQL[] = []

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
        const searchCondition = or(
          like(comics.title, `%${search}%`),
          like(comics.author, `%${search}%`),
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
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
      console.error('[PublicComics] Failed to fetch comics list:', error)
      return c.json({
        success: false,
        error: '查询漫画列表失败',
      }, 500)
    }
  },
)

// 获取漫画详情
publicComics.get(
  '/:slug',
  describeRoute({
    summary: '获取漫画详情',
    description: '根据 slug 获取漫画的完整信息，包括章节列表',
    tags: ['Comics'],
    operationId: 'getComicDetail',
    responses: {
      200: {
        description: '成功返回漫画详情',
        content: {
          'application/json': {
            schema: resolver(SuccessResponseSchema(ComicDetailSchema, '成功返回漫画详情')),
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
        description: '漫画不存在',
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
  validator('param', GetComicParamSchema),
  async (c) => {
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
  },
)

// 获取章节详情（图片列表）
publicComics.get(
  '/:slug/chapters/:chapterId',
  describeRoute({
    summary: '获取章节详情',
    description: '获取指定章节的图片列表',
    tags: ['Comics'],
    operationId: 'getChapterDetail',
    responses: {
      200: {
        description: '成功返回章节详情',
        content: {
          'application/json': {
            schema: resolver(SuccessResponseSchema(ChapterDetailSchema, '成功返回章节详情')),
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
        description: '漫画或章节不存在',
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
  validator('param', GetChapterParamSchema),
  async (c) => {
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
  },
)

export const publicComicsRoutes = publicComics
