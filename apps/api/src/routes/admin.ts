/* eslint-disable no-console */
import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { chapters, comics, pages, user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { serviceAuth } from '../middleware/service-auth'
import { ChapterContentSchema, MangaInfoSchema } from '../types'

const admin = new Hono<AppEnv>()

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
    catch (e: any) {
      console.error(`[Admin] Failed to update role for ${email}:`, e.message)
      return c.json({ success: false, error: e.message }, 500)
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
  const results = await db.query.comics.findMany({
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
  })
  return c.json(results)
})

// 更新漫画信息 - admin, comic_admin
admin.patch(
  '/comics/:id',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.object({
    isR18: z.boolean().optional(),
    status: z.string().optional(),
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
    catch (e: any) {
      console.error(`[Admin] Failed to update comic ${id}:`, e.message)
      return c.json({ success: false, error: e.message }, 500)
    }
  },
)

// 同步路由 (由爬虫调用) - 允许 admin, comic_admin (或 Service Token)
admin.post(
  '/sync',
  serviceAuth(['admin', 'comic_admin']),
  zValidator('json', z.discriminatedUnion('type', [
    z.object({ type: z.literal('manga'), data: MangaInfoSchema }),
    z.object({ type: z.literal('chapter'), data: ChapterContentSchema }),
  ])),
  async (c) => {
    const payload = c.req.valid('json')
    const db = c.get('db')

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

        await db.insert(comics).values({
          id: comicId,
          title: data.title,
          slug: data.slug,
          coverImage: data.cover,
          author: data.author,
          description: data.description,
          status: data.status || 'ongoing',
          isR18: data.isR18 ?? true,
          // 插入时由数据库处理 createdAt/updatedAt 默认值
        }).onConflictDoUpdate({
          target: comics.id,
          set: {
            title: data.title,
            coverImage: data.cover,
            author: data.author,
            description: data.description,
            status: data.status || 'ongoing',
            updatedAt: new Date(), // 冲突时手动更新时间
          },
        })

        console.log(`[Sync] ✓ Comic upserted successfully`)

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

export default admin
