import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { chapters, movies, readingProgress, watchingProgress } from '@starye/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'

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
const SaveReadingProgressSchema = z.object({
  chapterId: z.string(),
  page: z.number().min(1),
})

publicProgress.post('/reading', zValidator('json', SaveReadingProgressSchema), async (c) => {
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
})

// 查询阅读进度
const GetReadingProgressSchema = z.object({
  chapterId: z.string().optional(),
  comicSlug: z.string().optional(),
})

publicProgress.get('/reading', zValidator('query', GetReadingProgressSchema), async (c) => {
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
})

// === 观看进度 ===

// 保存观看进度
const SaveWatchingProgressSchema = z.object({
  movieCode: z.string(),
  progress: z.number().min(0), // 秒
  duration: z.number().optional(), // 秒
})

publicProgress.post('/watching', zValidator('json', SaveWatchingProgressSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const { movieCode, progress, duration } = c.req.valid('json')

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
          progress,
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
        progress,
        duration: duration || null,
        updatedAt: new Date(),
      })
    }

    return c.json({ success: true })
  }
  catch (error) {
    console.error(`[PublicProgress] Failed to save watching progress for movie ${movieCode}:`, error)
    return c.json({
      success: false,
      error: '保存观看进度失败',
    }, 500)
  }
})

// 查询观看进度
const GetWatchingProgressSchema = z.object({
  movieCode: z.string().optional(),
})

publicProgress.get('/watching', zValidator('query', GetWatchingProgressSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const { movieCode } = c.req.valid('query')

  try {
    if (movieCode) {
      // 查询单个影片进度
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
        data: progress || null,
      })
    }

    // 返回所有观看进度（按时间倒序）
    const allProgress = await db
      .select()
      .from(watchingProgress)
      .where(eq(watchingProgress.userId, user.id))
      .orderBy(desc(watchingProgress.updatedAt))
      .limit(50)

    return c.json({
      success: true,
      data: allProgress,
    })
  }
  catch (error) {
    console.error('[PublicProgress] Failed to fetch watching progress:', error)
    return c.json({
      success: false,
      error: '查询观看进度失败',
    }, 500)
  }
})

export default publicProgress
