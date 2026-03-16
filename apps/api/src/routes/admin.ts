/* eslint-disable no-console */
import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { chapters, comics, movies, pages, players, user } from '@starye/db/schema'
import { and, count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { serviceAuth } from '../middleware/service-auth'
import { ChapterContentSchema, MangaInfoSchema, MovieInfoSchema } from '../types'
import adminActorsRoutes from './admin-actors'
import adminAuditLogsRoutes from './admin-audit-logs'
import adminCrawlersRoutes from './admin-crawlers'
import adminMoviesRoutes from './admin-movies'
import adminPublishersRoutes from './admin-publishers'
import adminR18WhitelistRoutes from './admin-r18-whitelist'

const admin = new Hono<AppEnv>()

// 挂载子路由
admin.route('/movies', adminMoviesRoutes)
admin.route('/crawlers', adminCrawlersRoutes)
admin.route('/actors', adminActorsRoutes)
admin.route('/publishers', adminPublishersRoutes)
admin.route('/audit-logs', adminAuditLogsRoutes)
admin.route('/r18-whitelist', adminR18WhitelistRoutes)

// 获取用户列表 (仅超级管理员)
admin.get('/users', serviceAuth(['admin']), async (c) => {
  const db = c.get('db')
  const results = await db.query.user.findMany({
    orderBy: (user, { desc }) => [desc(user.createdAt)],
    limit: 100, // 安全限制
  })
  return c.json(results)
})

// 提升/降级用户角色 (仅超级管理员)
// 支持设置的角色: admin, comic_admin, user
admin.patch(
  '/users/:email/role',
  serviceAuth(['admin']),
  zValidator('json', z.object({
    role: z.enum(['admin', 'comic_admin', 'user']),
  })),
  async (c) => {
    const email = c.req.param('email')
    const { role } = c.req.valid('json')
    const db = c.get('db')

    try {
      const result = await db.update(user)
        .set({ role, updatedAt: new Date() })
        .where(eq(user.email, email))
        .returning({ id: user.id, email: user.email, role: user.role })

      if (result.length === 0) {
        return c.json({ success: false, error: 'User not found' }, 404)
      }

      console.log(`[Admin] Updated role for ${email} to ${role}`)
      return c.json({ success: true, user: result[0] })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin] Failed to update role for ${email}:`, message)
      return c.json({ success: false, error: message }, 500)
    }
  },
)

// 修改用户状态 (例如 isAdult) - 允许 admin 和 comic_admin
admin.patch(
  '/users/:email/status',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    isAdult: z.boolean().optional(),
  })),
  async (c) => {
    const email = c.req.param('email')
    const { isAdult } = c.req.valid('json')
    const db = c.get('db')

    if (isAdult === undefined)
      return c.json({ success: true })

    await db.update(user).set({ isAdult, updatedAt: new Date() }).where(eq(user.email, email))
    console.log(`[Admin] Updated isAdult for ${email} to ${isAdult}`)
    return c.json({ success: true })
  },
)

// 获取漫画列表 (管理员视图) - admin, comic_admin
admin.get('/comics', serviceAuth(['admin', 'comic_admin']), async (c) => {
  const db = c.get('db')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const offset = (page - 1) * limit

  const [results, totalResult] = await Promise.all([
    db.query.comics.findMany({
      orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(comics).then(res => res[0].value),
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
})

// 更新漫画信息 - admin, comic_admin
admin.patch(
  '/comics/:id',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['serializing', 'completed']).optional(),
    isR18: z.boolean().optional(),
    metadataLocked: z.boolean().optional(),
    region: z.string().optional(),
    genres: z.array(z.string()).optional(),
  })),
  async (c) => {
    const id = String(c.req.param('id')) // 确保 ID 为字符串
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      console.log(`[Admin] Updating comic ${id} with:`, data)
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
  },
)

// 获取漫画章节列表 (管理后台)
admin.get('/comics/:id/chapters', serviceAuth(['admin', 'comic_admin']), async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const results = await db.query.chapters.findMany({
    where: eq(chapters.comicId, id),
    orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
  })

  return c.json(results)
})

// 获取章节详情 (含图片)
admin.get('/chapters/:id', serviceAuth(['admin', 'comic_admin']), async (c) => {
  const id = c.req.param('id')
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
})

// 删除章节
admin.delete('/chapters/:id', serviceAuth(['admin', 'comic_admin']), async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  await db.delete(chapters).where(eq(chapters.id, id))
  return c.json({ success: true })
})

// 获取漫画已存在的章节列表 (用于爬虫去重)
admin.get(
  '/comics/:slug/existing-chapters',
  serviceAuth(['admin', 'comic_admin']),
  async (c) => {
    const slug = c.req.param('slug')
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
        // 只有当期望值存在且相等时，才视为 "完整"
        expected ? eq(count, expected) : undefined,
      )

    return c.json(result.map(r => r.slug))
  },
)

// 检查章节状态
admin.get(
  '/check-chapter',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('query', z.object({
    comicSlug: z.string(),
    chapterSlug: z.string(),
    sourceCount: z.coerce.number().optional(), // 新增：源站图片数量
  })),
  async (c) => {
    const { comicSlug, chapterSlug, sourceCount } = c.req.valid('query')
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
    // 检查是否有失败的图片 (使用 Placeholder)
    const hasFailures = chapter.pages.some(p => p.imageUrl.includes('placehold.co') || p.imageUrl.includes('failed'))

    // Side Effect: 如果提供了 sourceCount 且匹配，更新 sourcePageCount 以标记为"已验证"
    if (sourceCount && currentCount >= sourceCount && !hasFailures) {
      if (chapter.sourcePageCount !== sourceCount) {
        // 异步更新，不阻塞响应
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
    })
  },
)

// 同步路由 (由爬虫调用) - 允许 admin, comic_admin (或 Service Token)
admin.post(
  '/sync',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.discriminatedUnion('type', [
    z.object({ type: z.literal('manga'), data: MangaInfoSchema }),
    z.object({ type: z.literal('chapter'), data: ChapterContentSchema }),
    z.object({ type: z.literal('movie'), data: MovieInfoSchema }),
  ])),
  async (c) => {
    const payload = c.req.valid('json')
    const db = c.get('db')

    if (payload.type === 'movie') {
      const { data } = payload
      console.log(`[Sync] 🎬 Received movie: ${data.title} (${data.code})`)

      try {
        const { players: playerData, ...movieData } = data
        const movieId = movieData.slug // 使用 slug 作为内部 ID 也是可以的，或者 UUID

        // 1. Upsert Movie
        await db.insert(movies).values({
          ...movieData,
          id: movieId,
          releaseDate: movieData.releaseDate ? new Date(movieData.releaseDate * 1000) : null,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: movies.slug,
          set: {
            ...movieData,
            releaseDate: movieData.releaseDate ? new Date(movieData.releaseDate * 1000) : null,
            updatedAt: new Date(),
          },
        })

        // 2. Sync Players
        if (playerData && playerData.length > 0) {
          await db.delete(players).where(eq(players.movieId, movieId))
          await db.insert(players).values(
            playerData.map(p => ({
              ...p,
              id: crypto.randomUUID(),
              movieId,
            })),
          )
        }

        console.log(`[Sync] ✅ Movie synced: ${data.code}`)
        return c.json({ success: true, id: movieId })
      }
      catch (e: unknown) {
        console.error('[Sync] ❌ Movie Sync Error:', e)
        return c.json({ success: false, error: String(e) }, 500)
      }
    }

    if (payload.type === 'manga') {
      const { data } = payload
      console.log(`[Sync] 📥 Received manga: ${data.title}`, {
        slug: data.slug,
        chapters: data.chapters.length,
        hasCover: !!data.cover,
        hasAuthor: !!data.author,
        status: data.status,
      })

      try {
        // 1. 更新或插入漫画 (Upsert)
        const comicId = data.slug
        console.log(`[Sync] 📝 Upserting comic: ${comicId}`)

        // 类型适配: 确保 status 符合数据库枚举
        const status = (data.status === 'completed' || data.status === 'serializing')
          ? data.status
          : 'serializing' as 'serializing' | 'completed'

        const comicData = {
          title: data.title,
          slug: data.slug,
          coverImage: data.cover,
          author: data.author,
          description: data.description,
          status,
          isR18: data.isR18 ?? true,
          sourceUrl: data.sourceUrl,
          region: data.region,
          genres: data.genres,
        }

        // 1. Check Lock Status & Upsert
        const existing = await db.query.comics.findFirst({
          where: eq(comics.id, comicId),
          columns: { id: true, metadataLocked: true },
        })

        if (existing) {
          if (!existing.metadataLocked) {
            await db.update(comics)
              .set({ ...comicData, updatedAt: new Date() })
              .where(eq(comics.id, comicId))
            console.log(`[Sync] ✓ Comic updated (Metadata Unlocked)`)
          }
          else {
            console.log(`[Sync] 🔒 Comic metadata locked, skipping update.`)
            // Still update timestamp to show activity
            await db.update(comics)
              .set({ updatedAt: new Date() })
              .where(eq(comics.id, comicId))
          }
        }
        else {
          await db.insert(comics).values({ ...comicData, id: comicId })
          console.log(`[Sync] ✓ New Comic inserted`)
        }

        // 2. 同步章节 (删除现有章节，插入新章节)
        // 相比批量 Upsert，这在 SQLite 上更安全且能处理被移除的章节
        if (data.chapters.length > 0) {
          // 理想情况下应使用事务，但 D1 REST API 有限制
          // 这里采用顺序执行

          // A. 删除现有章节
          console.log(`[Sync] 🗑️  Deleting existing chapters for: ${comicId}`)
          await db.delete(chapters).where(eq(chapters.comicId, comicId))

          // B. 准备数据并去重
          const uniqueSlugs = new Set<string>()
          const chapterValues = []

          for (const ch of data.chapters) {
            if (uniqueSlugs.has(ch.slug)) {
              console.warn(`[Sync] ⚠️ Duplicate chapter slug detected: ${ch.slug}, skipping.`)
              continue
            }
            uniqueSlugs.add(ch.slug)
            chapterValues.push({
              id: `${comicId}-${ch.slug}`,
              comicId,
              title: ch.title,
              slug: ch.slug,
              chapterNumber: ch.number,
              sourcePageCount: null,
              sortOrder: ch.number,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          // C. 批量插入 (按块分批，避免触达 D1 限制)
          const chunkSize = 5
          console.log(`[Sync] 📚 Inserting ${chapterValues.length} chapters in ${Math.ceil(chapterValues.length / chunkSize)} batches`)

          for (let i = 0; i < chapterValues.length; i += chunkSize) {
            const chunk = chapterValues.slice(i, i + chunkSize)
            const batchNum = Math.floor(i / chunkSize) + 1
            const totalBatches = Math.ceil(chapterValues.length / chunkSize)
            console.log(`[Sync] 📦 Batch ${batchNum}/${totalBatches}: inserting ${chunk.length} chapters`)
            try {
              await db.insert(chapters).values(chunk)
              console.log(`[Sync] ✅ Batch ${batchNum}/${totalBatches} inserted successfully`)
            }
            catch (batchError: unknown) {
              const errorMsg = batchError instanceof Error ? batchError.message : String(batchError)
              console.error(`[Sync] ❌ Batch ${batchNum}/${totalBatches} failed:`, errorMsg)
              throw batchError // 抛出异常以便外层捕获
            }
          }

          console.log(`[Sync] ✓ All chapters inserted successfully`)
        }

        console.log(`[Sync] ✅ Sync completed for ${data.title}`)
        return c.json({ success: true, message: `Synced ${data.chapters.length} chapters` })
      }
      catch (e: unknown) {
        console.error('[Sync] ❌ Database Error:', {
          manga: data.title,
          slug: data.slug,
          chapters: data.chapters.length,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        })

        const message = e instanceof Error ? e.message : String(e)
        return c.json({
          success: false,
          error: `Database Error: ${message}`,
          manga: data.title,
          details: String(e),
        }, 500)
      }
    }
    else if (payload.type === 'chapter') {
      const { data } = payload
      const chapterId = `${data.comicSlug}-${data.chapterSlug}`
      console.log(`[Sync] 📥 Received chapter pages: ${chapterId} (${data.images.length} pages)`)

      try {
        // 1. 验证章节是否存在 (可选)
        const chapter = await db.query.chapters.findFirst({
          where: eq(chapters.id, chapterId),
        })

        if (!chapter) {
          console.warn(`[Sync] ⚠️ Chapter not found: ${chapterId}. Attempting to create placeholder...`)
          // 如果章节不存在，直接报错，要求先同步漫画信息
          return c.json({ success: false, error: 'Chapter not found. Please sync manga info first.' }, 404)
        }

        // 1.1 更新元数据 (Source Count)
        await db.update(chapters)
          .set({ sourcePageCount: data.images.length, updatedAt: new Date() })
          .where(eq(chapters.id, chapterId))

        // 2. 删除现有页面
        await db.delete(pages).where(eq(pages.chapterId, chapterId))

        // 3. 插入新页面
        if (data.images.length > 0) {
          const pageValues = data.images.map((url, index) => ({
            id: `${chapterId}-${index + 1}`,
            chapterId,
            pageNumber: index + 1,
            imageUrl: url,
            width: data.width || 0,
            height: data.height || 0,
          }))

          const chunkSize = 10 // 页面数据较简单，可以使用更大的 Batch
          for (let i = 0; i < pageValues.length; i += chunkSize) {
            const chunk = pageValues.slice(i, i + chunkSize)
            await db.insert(pages).values(chunk)
          }
        }

        console.log(`[Sync] ✅ Synced ${data.images.length} pages for ${chapterId}`)
        return c.json({ success: true, count: data.images.length })
      }
      catch (e: unknown) {
        console.error(`[Sync] ❌ Failed to sync pages for ${chapterId}:`, e)
        return c.json({ success: false, error: String(e) }, 500)
      }
    }
  },
)

// 管理后台统计信息
admin.get('/stats', serviceAuth(), async (c) => {
  const db = c.get('db')

  // 使用 D1/SQLite 高效计数
  const comicCount = await db.$count(comics)
  const userCount = await db.$count(user)

  return c.json({
    comics: comicCount,
    users: userCount,
    tasks: 0,
  })
})

// 批量查询漫画爬取状态 (用于爬虫增量爬取)
admin.get('/comics/batch-status', serviceAuth(['admin', 'comic_admin']), async (c) => {
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
    // 使用 SQL IN 查询批量获取漫画状态
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

    // 构建响应对象
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
    console.log(`[BatchStatus] 批量查询 ${slugs.length} 个漫画，耗时 ${elapsed}ms`)

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
})

// 更新漫画爬取进度
admin.post(
  '/comics/:slug/progress',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    status: z.enum(['pending', 'partial', 'complete']),
    crawledChapters: z.number(),
    totalChapters: z.number(),
  })),
  async (c) => {
    const slug = c.req.param('slug')
    const { status, crawledChapters, totalChapters } = c.req.valid('json')
    const db = c.get('db')

    try {
      // 检查漫画是否存在
      const comic = await db.query.comics.findFirst({
        where: eq(comics.slug, slug),
        columns: { id: true },
      })

      if (!comic) {
        return c.json({ error: 'Comic not found' }, 404)
      }

      // 更新进度（使用事务保证原子性）
      await db.update(comics)
        .set({
          crawlStatus: status,
          crawledChapters,
          totalChapters,
          lastCrawledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(comics.slug, slug))

      console.log(`[Progress] 更新漫画进度: ${slug}, status=${status}, ${crawledChapters}/${totalChapters}`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Progress] ❌ Failed to update progress for ${slug}:`, message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

// 获取爬取统计信息
admin.get('/comics/crawl-stats', serviceAuth(['admin', 'comic_admin']), async (c) => {
  const db = c.get('db')
  const sinceParam = c.req.query('since')

  try {
    // 基础统计查询
    const allComics = await db.query.comics.findMany({
      columns: {
        crawlStatus: true,
        isSerializing: true,
        lastCrawledAt: true,
      },
    })

    // 过滤时间范围（如果提供）
    let filteredComics = allComics
    if (sinceParam) {
      const sinceDate = new Date(sinceParam)
      filteredComics = allComics.filter(c =>
        c.lastCrawledAt && c.lastCrawledAt >= sinceDate,
      )
    }

    // 统计
    const total = filteredComics.length
    const pending = filteredComics.filter(c => c.crawlStatus === 'pending').length
    const partial = filteredComics.filter(c => c.crawlStatus === 'partial').length
    const complete = filteredComics.filter(c => c.crawlStatus === 'complete').length
    const serializing = filteredComics.filter(c => c.isSerializing).length

    // 获取最近爬取时间
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
})

// 批量操作漫画
admin.post(
  '/comics/bulk-operation',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100),
    operation: z.enum(['update_r18', 'lock_metadata', 'unlock_metadata', 'update_sort_order', 'delete']),
    payload: z.record(z.string(), z.any()).optional(),
  })),
  async (c) => {
    const { ids, operation, payload } = c.req.valid('json')
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

            if (operation !== 'delete' as any) {
              await db.update(comics)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(comics.id, id))
            }

            results.success.push(id)
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.failed.push({ id, reason: message })
          }
        }
      }

      console.log(`[Admin/Comics] ✓ Bulk operation complete: ${results.success.length} success, ${results.failed.length} failed`)

      return c.json(results)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Comics] ❌ Bulk operation failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

// 批量删除章节
admin.post(
  '/comics/:id/chapters/bulk-delete',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    chapterIds: z.array(z.string()).min(1).max(100),
  })),
  async (c) => {
    const comicId = c.req.param('id')
    const { chapterIds } = c.req.valid('json')
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

      console.log(`[Admin/Chapters] ✓ Bulk delete complete: ${results.success.length} success, ${results.failed.length} failed`)

      return c.json(results)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Chapters] ❌ Bulk delete failed:', message)
      return c.json({ error: message }, 500)
    }
  },
)

export default admin
