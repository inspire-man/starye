import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { chapters, pages } from '@starye/db/schema'
import { and, count, eq } from 'drizzle-orm'

/**
 * 获取漫画章节列表（管理后台）
 */
export async function getComicChapters(c: Context<AppEnv>) {
  const id = c.req.param('id')!
  const db = c.get('db')

  const results = await db.query.chapters.findMany({
    where: eq(chapters.comicId, id),
    orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
  })

  return c.json(results)
}

/**
 * 获取章节详情（含图片）
 */
export async function getChapterDetail(c: Context<AppEnv>) {
  const id = c.req.param('id')!
  const db = c.get('db')

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, id),
    with: {
      pages: {
        orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
      },
    },
  })

  if (!chapter) {
    return c.json({ error: 'Chapter not found' }, 404)
  }

  return c.json(chapter)
}

/**
 * 删除章节
 */
export async function deleteChapter(c: Context<AppEnv>) {
  const id = c.req.param('id')!
  const db = c.get('db')

  await db.delete(chapters).where(eq(chapters.id, id))
  return c.json({ success: true })
}

/**
 * 获取漫画已存在的章节列表（用于爬虫去重）
 */
export async function getExistingChapters(c: Context<AppEnv>) {
  const slug = c.req.param('slug')!
  const db = c.get('db')

  // 智能查询：仅返回 "已验证完整" 的章节
  // 完整定义：页面数量 (count) == 源站数量 (source_page_count)
  const result = await db
    .select({
      slug: chapters.slug,
      count: count(pages.id),
      expected: chapters.sourcePageCount,
    })
    .from(chapters)
    .leftJoin(pages, eq(pages.chapterId, chapters.id))
    .where(eq(chapters.comicId, slug))
    .groupBy(chapters.id)
    .having(({ count, expected }) =>
      expected ? eq(count, expected) : undefined,
    )

  return c.json(result.map(r => r.slug))
}

/**
 * 检查章节状态
 */
export async function checkChapterStatus(c: Context<AppEnv>) {
  const { comicSlug, chapterSlug, sourceCount } = (c.req as any).valid('query')
  const db = c.get('db')
  const chapterId = `${comicSlug}-${chapterSlug}`

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    with: {
      pages: true,
    },
  })

  if (!chapter) {
    return c.json({ exists: false, count: 0, hasFailures: false })
  }

  const currentCount = chapter.pages.length
  const hasFailures = chapter.pages.some(p => p.imageUrl.includes('placehold.co') || p.imageUrl.includes('failed'))

  // Side Effect: 如果提供了 sourceCount 且匹配，更新 sourcePageCount 以标记为"已验证"
  if (sourceCount && currentCount >= sourceCount && !hasFailures) {
    if (chapter.sourcePageCount !== sourceCount) {
      c.executionCtx.waitUntil(
        db.update(chapters)
          .set({ sourcePageCount: sourceCount, updatedAt: new Date() })
          .where(eq(chapters.id, chapterId)),
      )
    }
  }

  return c.json({
    exists: true,
    count: currentCount,
    hasFailures,
    status: currentCount >= (sourceCount || 0) && !hasFailures ? 'complete' : 'partial',
  })
}

/**
 * 批量删除章节
 */
export async function bulkDeleteChapters(c: Context<AppEnv>) {
  const comicId = c.req.param('id')!
  const { chapterIds } = (c.req as any).valid('json')
  const db = c.get('db')

  const results = {
    success: [] as string[],
    failed: [] as { id: string, reason: string }[],
  }

  try {
    for (const chapterId of chapterIds) {
      try {
        const chapter = await db.query.chapters.findFirst({
          where: and(
            eq(chapters.id, chapterId),
            eq(chapters.comicId, comicId),
          ),
        })

        if (!chapter) {
          results.failed.push({ id: chapterId, reason: 'Chapter not found or not belong to this comic' })
          continue
        }

        await db.delete(chapters).where(eq(chapters.id, chapterId))
        results.success.push(chapterId)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.failed.push({ id: chapterId, reason: message })
      }
    }
    return c.json(results)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Admin/Chapters] ❌ Bulk delete failed:', message)
    return c.json({ error: 'Bulk delete operation failed' }, 500)
  }
}
