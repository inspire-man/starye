import type { AppEnv } from '../../../types'
import { chapters, comics, movies, progress } from '@starye/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { nanoid } from 'nanoid'
import * as v from 'valibot'
import {
  GetReadingProgressQuerySchema,
  GetWatchingProgressQuerySchema,
  ReadingProgressItemSchema,
  SaveReadingProgressSchema,
  SaveWatchingProgressSchema,
  WatchingHistoryItemSchema,
  WatchingProgressItemSchema,
} from '../../../schemas/progress'
import { ErrorResponseSchema, MessageResponseSchema, SuccessResponseSchema } from '../../../schemas/responses'

const publicProgress = new Hono<AppEnv>()
type ProgressRow = typeof progress.$inferSelect
interface ComicChapterMeta {
  comicSlug?: string
  comicTitle?: string
  chapterTitle?: string
}

publicProgress.use('*', async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ success: false, error: '需要登录' }, 401)
  }
  await next()
})

function toReadingProgressItem(entry: ProgressRow, chapterMeta?: ComicChapterMeta) {
  return {
    id: entry.id,
    contentType: 'comic' as const,
    contentId: entry.contentId,
    chapterId: entry.contentId,
    comicSlug: chapterMeta?.comicSlug,
    comicTitle: chapterMeta?.comicTitle,
    chapterTitle: chapterMeta?.chapterTitle,
    position: entry.position,
    page: entry.position,
    duration: null,
    completed: entry.completed,
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function toWatchingProgressItem(entry: ProgressRow) {
  return {
    id: entry.id,
    contentType: 'movie' as const,
    contentId: entry.contentId,
    movieCode: entry.contentId,
    position: entry.position,
    progress: entry.position,
    duration: entry.duration ?? null,
    completed: entry.completed,
    updatedAt: entry.updatedAt.toISOString(),
  }
}

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
        content: { 'application/json': { schema: resolver(MessageResponseSchema) } },
      },
      401: {
        description: '需要登录',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      404: {
        description: '章节不存在',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      500: {
        description: '服务器内部错误',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
    },
  }),
  validator('json', SaveReadingProgressSchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { chapterId, page, completed } = c.req.valid('json')

    try {
      const chapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      })

      if (!chapter) {
        return c.json({ success: false, error: '章节不存在' }, 404)
      }

      await db
        .insert(progress)
        .values({
          id: nanoid(),
          userId: user.id,
          contentType: 'comic',
          contentId: chapterId,
          position: page,
          duration: null,
          completed,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [progress.userId, progress.contentType, progress.contentId],
          set: {
            position: page,
            duration: null,
            completed,
            updatedAt: new Date(),
          },
        })

      return c.json({ success: true, message: '阅读进度已保存' })
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
                  v.null(),
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
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      500: {
        description: '服务器内部错误',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
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
        const chapter = await db.query.chapters.findFirst({
          where: eq(chapters.id, chapterId),
          with: {
            comic: true,
          },
        })

        if (!chapter) {
          return c.json({ success: true, data: null })
        }

        const entry = await db
          .select()
          .from(progress)
          .where(and(
            eq(progress.userId, user.id),
            eq(progress.contentType, 'comic'),
            eq(progress.contentId, chapterId),
          ))
          .get()

        return c.json({
          success: true,
          data: entry
            ? toReadingProgressItem(entry, {
                comicSlug: chapter.comic.slug,
                comicTitle: chapter.comic.title,
                chapterTitle: chapter.title,
              })
            : null,
        })
      }

      if (comicSlug) {
        const comic = await db.query.comics.findFirst({
          where: eq(comics.slug, comicSlug),
        })

        if (!comic) {
          return c.json({ success: true, data: [] })
        }

        const chapterList = await db.query.chapters.findMany({
          where: eq(chapters.comicId, comic.id),
        })

        if (chapterList.length === 0) {
          return c.json({ success: true, data: [] })
        }

        const chapterIds = chapterList.map(chapter => chapter.id)
        const chapterMeta = new Map<string, ComicChapterMeta>(chapterList.map(chapter => [
          chapter.id,
          {
            comicSlug: comic.slug,
            comicTitle: comic.title,
            chapterTitle: chapter.title,
          },
        ]))

        const entries = await db
          .select()
          .from(progress)
          .where(and(
            eq(progress.userId, user.id),
            eq(progress.contentType, 'comic'),
            inArray(progress.contentId, chapterIds),
          ))
          .orderBy(desc(progress.updatedAt))

        return c.json({
          success: true,
          data: entries.map((entry: ProgressRow) => toReadingProgressItem(entry, chapterMeta.get(entry.contentId))),
        })
      }

      const entries = await db
        .select()
        .from(progress)
        .where(and(
          eq(progress.userId, user.id),
          eq(progress.contentType, 'comic'),
        ))
        .orderBy(desc(progress.updatedAt))
        .limit(50)

      const chapterIds = entries.map(entry => entry.contentId)
      const chapterList = chapterIds.length > 0
        ? await db.query.chapters.findMany({
            where: inArray(chapters.id, chapterIds),
            with: {
              comic: true,
            },
          })
        : []

      const chapterMeta = new Map<string, ComicChapterMeta>(chapterList.map(chapter => [
        chapter.id,
        {
          comicSlug: chapter.comic.slug,
          comicTitle: chapter.comic.title,
          chapterTitle: chapter.title,
        },
      ]))

      return c.json({
        success: true,
        data: entries.map((entry: ProgressRow) => toReadingProgressItem(entry, chapterMeta.get(entry.contentId))),
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
        content: { 'application/json': { schema: resolver(MessageResponseSchema) } },
      },
      401: {
        description: '需要登录',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      404: {
        description: '影片不存在',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      500: {
        description: '服务器内部错误',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
    },
  }),
  validator('json', SaveWatchingProgressSchema),
  async (c) => {
    const db = c.get('db')
    const user = c.get('user')!
    const { movieCode, currentTime, duration, completed } = c.req.valid('json')

    try {
      const movie = await db.query.movies.findFirst({
        where: eq(movies.code, movieCode),
      })

      if (!movie) {
        return c.json({ success: false, error: '影片不存在' }, 404)
      }

      await db
        .insert(progress)
        .values({
          id: nanoid(),
          userId: user.id,
          contentType: 'movie',
          contentId: movieCode,
          position: currentTime,
          duration: duration ?? null,
          completed,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [progress.userId, progress.contentType, progress.contentId],
          set: {
            position: currentTime,
            duration: duration ?? null,
            completed,
            updatedAt: new Date(),
          },
        })

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
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
      },
      500: {
        description: '服务器内部错误',
        content: { 'application/json': { schema: resolver(ErrorResponseSchema) } },
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
        const entry = await db
          .select()
          .from(progress)
          .where(and(
            eq(progress.userId, user.id),
            eq(progress.contentType, 'movie'),
            eq(progress.contentId, movieCode),
          ))
          .get()

        return c.json({
          success: true,
          data: entry ? toWatchingProgressItem(entry) : null,
        })
      }

      const effectiveLimit = Math.min(limit ?? 20, 50)
      const history = await db
        .select({
          id: progress.id,
          contentId: progress.contentId,
          position: progress.position,
          duration: progress.duration,
          completed: progress.completed,
          updatedAt: progress.updatedAt,
          title: movies.title,
          coverImage: movies.coverImage,
          isR18: movies.isR18,
        })
        .from(progress)
        .innerJoin(movies, eq(progress.contentId, movies.code))
        .where(and(
          eq(progress.userId, user.id),
          eq(progress.contentType, 'movie'),
        ))
        .orderBy(desc(progress.updatedAt))
        .limit(effectiveLimit)

      return c.json({
        success: true,
        data: history.map(item => ({
          id: item.id,
          contentType: 'movie' as const,
          contentId: item.contentId,
          movieCode: item.contentId,
          title: item.title,
          coverImage: item.coverImage,
          isR18: item.isR18,
          position: item.position,
          progress: item.position,
          duration: item.duration ?? null,
          completed: item.completed,
          updatedAt: item.updatedAt.toISOString(),
        })),
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
