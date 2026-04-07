import type { AppEnv } from '../../../types'
import { chapters, movies, readingProgress, watchingProgress } from '@starye/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { nanoid } from 'nanoid'
import * as v from 'valibot'
import { GetReadingProgressQuerySchema, GetWatchingProgressQuerySchema, ReadingProgressItemSchema, SaveReadingProgressSchema, SaveWatchingProgressSchema, WatchingHistoryItemSchema, WatchingProgressItemSchema } from '../../../schemas/progress'
import { ErrorResponseSchema, MessageResponseSchema, SuccessResponseSchema } from '../../../schemas/responses'

const publicProgress = new Hono<AppEnv>()

// 所有进度接口都需要登录
publicProgress.use('*', async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ success: false, error: '需要登录' }, 401)
  }
  await next()
})

// === 阅读进度 ===

// 保存阅读进度
publicProgress.post(
  '/reading',
  describeRoute({
    summary: '保存阅读进度',
    description: '保存或更新用户的漫画阅读进度',
    tags: ['Progress'],
    operationId: 'saveReadingProgress',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: '保存成功',
        content: {
          'application/json': {
            schema: resolver(MessageResponseSchema),
          },
        },
      },
      401: {
        description: '需要登录',
        content: {
          'application/json': {
            schema: resolver(ErrorResponseSchema),
          },
        },
      },
      404: {
        description: '章节不存在',
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
  validator('json', SaveReadingProgressSchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { chapterId, page } = c.req.valid('json')

    try {
    // 验证章节是否存在
      const chapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      })

      if (!chapter) {
        return c.json({ success: false, error: '章节不存在' }, 404)
      }

      // Upsert 进度记录
      const existingProgress = await db
        .select()
        .from(readingProgress)
        .where(
          and(
            eq(readingProgress.userId, user.id),
            eq(readingProgress.chapterId, chapterId),
          ),
        )
        .get()

      if (existingProgress) {
        await db
          .update(readingProgress)
          .set({
            page,
            updatedAt: new Date(),
          })
          .where(eq(readingProgress.id, existingProgress.id))
      }
      else {
        await db.insert(readingProgress).values({
          id: nanoid(),
          userId: user.id,
          chapterId,
          page,
          updatedAt: new Date(),
        })
      }

      return c.json({ success: true })
    }
    catch (error) {
      console.error(`[PublicProgress] Failed to save reading progress for chapter ${chapterId}:`, error)
      return c.json({
        success: false,
        error: '保存阅读进度失败',
      }, 500)
    }
  },
)

// 查询阅读进度
publicProgress.get(
  '/reading',
  describeRoute({
    summary: '查询阅读进度',
    description: '根据章节 ID 或漫画 slug 查询用户的阅读进度',
    tags: ['Progress'],
    operationId: 'getReadingProgress',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: '成功返回阅读进度',
        content: {
          'application/json': {
            schema: resolver(
              SuccessResponseSchema(
                v.union([
                  ReadingProgressItemSchema,
                  v.array(ReadingProgressItemSchema),
                ]),
                '成功返回阅读进度',
              ),
            ),
          },
        },
      },
      401: {
        description: '需要登录',
        content: {
          'application/json': {
            schema: resolver(ErrorResponseSchema),
          },
        },
      },
      404: {
        description: '未找到进度记录',
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
  validator('query', GetReadingProgressQuerySchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { chapterId, comicSlug } = c.req.valid('query')

    try {
      if (chapterId) {
      // 查询单个章节进度
        const progress = await db
          .select()
          .from(readingProgress)
          .where(
            and(
              eq(readingProgress.userId, user.id),
              eq(readingProgress.chapterId, chapterId),
            ),
          )
          .get()

        return c.json({
          success: true,
          data: progress || null,
        })
      }

      if (comicSlug) {
      // 查询该漫画所有章节的进度
        const chapterList = await db
          .select({ id: chapters.id })
          .from(chapters)
          .where(eq(chapters.comicId, comicSlug))

        const chapterIds = chapterList.map(ch => ch.id)

        if (chapterIds.length === 0) {
          return c.json({ success: true, data: [] })
        }

        // 查询所有该用户的进度，然后过滤
        const allProgress = await db
          .select()
          .from(readingProgress)
          .where(eq(readingProgress.userId, user.id))

        const filtered = allProgress.filter(p => chapterIds.includes(p.chapterId))

        return c.json({
          success: true,
          data: filtered,
        })
      }

      // 返回所有阅读进度（按时间倒序）
      const allProgress = await db
        .select()
        .from(readingProgress)
        .where(eq(readingProgress.userId, user.id))
        .orderBy(desc(readingProgress.updatedAt))
        .limit(50)

      return c.json({
        success: true,
        data: allProgress,
      })
    }
    catch (error) {
      console.error('[PublicProgress] Failed to fetch reading progress:', error)
      return c.json({
        success: false,
        error: '查询阅读进度失败',
      }, 500)
    }
  },
)

// === 观看进度 ===

// 保存观看进度
publicProgress.post(
  '/watching',
  describeRoute({
    summary: '保存观看进度',
    description: '保存或更新用户的影片观看进度',
    tags: ['Progress'],
    operationId: 'saveWatchingProgress',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: '保存成功',
        content: {
          'application/json': {
            schema: resolver(MessageResponseSchema),
          },
        },
      },
      401: {
        description: '需要登录',
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
  validator('json', SaveWatchingProgressSchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { movieCode, currentTime, duration } = c.req.valid('json')

    try {
    // 验证影片是否存在
      const movie = await db.query.movies.findFirst({
        where: eq(movies.code, movieCode),
      })

      if (!movie) {
        return c.json({ success: false, error: '影片不存在' }, 404)
      }

      // Upsert 进度记录
      const existingProgress = await db
        .select()
        .from(watchingProgress)
        .where(
          and(
            eq(watchingProgress.userId, user.id),
            eq(watchingProgress.movieCode, movieCode),
          ),
        )
        .get()

      if (existingProgress) {
        await db
          .update(watchingProgress)
          .set({
            progress: currentTime,
            duration: duration || existingProgress.duration,
            updatedAt: new Date(),
          })
          .where(eq(watchingProgress.id, existingProgress.id))
      }
      else {
        await db.insert(watchingProgress).values({
          id: nanoid(),
          userId: user.id,
          movieCode,
          progress: currentTime,
          duration: duration || null,
          updatedAt: new Date(),
        })
      }

      return c.json({ success: true, message: '观看进度已保存' })
    }
    catch (error) {
      console.error(`[PublicProgress] Failed to save watching progress for movie ${movieCode}:`, error)
      return c.json({
        success: false,
        error: '保存观看进度失败',
      }, 500)
    }
  },
)

// 查询观看进度 / 历史列表
publicProgress.get(
  '/watching',
  describeRoute({
    summary: '查询观看进度',
    description: '传入 movieCode 时查询单条进度；不传时返回含影片详情的历史列表（按最近观看倒序）',
    tags: ['Progress'],
    operationId: 'getWatchingProgress',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: '成功返回观看进度',
        content: {
          'application/json': {
            schema: resolver(
              SuccessResponseSchema(
                v.union([
                  WatchingProgressItemSchema,
                  v.null(),
                  v.array(WatchingHistoryItemSchema),
                ]),
                '成功返回观看进度',
              ),
            ),
          },
        },
      },
      401: {
        description: '需要登录',
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
  validator('query', GetWatchingProgressQuerySchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { movieCode, limit } = c.req.valid('query')

    try {
      if (movieCode) {
        // 查询单个影片进度（向后兼容，返回原始字段）
        const progress = await db
          .select()
          .from(watchingProgress)
          .where(
            and(
              eq(watchingProgress.userId, user.id),
              eq(watchingProgress.movieCode, movieCode),
            ),
          )
          .get()

        return c.json({
          success: true,
          data: progress ?? null,
        })
      }

      // 历史列表：JOIN movies 返回含影片详情的记录
      const effectiveLimit = Math.min(limit ?? 20, 50)
      const history = await db
        .select({
          id: watchingProgress.id,
          movieCode: watchingProgress.movieCode,
          progress: watchingProgress.progress,
          duration: watchingProgress.duration,
          updatedAt: watchingProgress.updatedAt,
          title: movies.title,
          coverImage: movies.coverImage,
          isR18: movies.isR18,
        })
        .from(watchingProgress)
        .innerJoin(movies, eq(watchingProgress.movieCode, movies.code))
        .where(eq(watchingProgress.userId, user.id))
        .orderBy(desc(watchingProgress.updatedAt))
        .limit(effectiveLimit)

      return c.json({
        success: true,
        data: history,
      })
    }
    catch (error) {
      console.error('[PublicProgress] Failed to fetch watching progress:', error)
      return c.json({
        success: false,
        error: '查询观看进度失败',
      }, 500)
    }
  },
)

export const publicProgressRoutes = publicProgress
