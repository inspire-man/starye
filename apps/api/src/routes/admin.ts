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

// List Users
admin.get('/users', serviceAuth(), async (c) => {
  const db = c.get('db')
  const results = await db.query.user.findMany({
    orderBy: (user, { desc }) => [desc(user.createdAt)],
    limit: 100, // Safety limit
  })
  return c.json(results)
})

// Promote/Demote User Role
admin.patch(
  '/users/:email/role',
  serviceAuth(),
  zValidator('json', z.object({
    role: z.enum(['admin', 'user']),
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

// List Comics (Admin View)
admin.get('/comics', serviceAuth(), async (c) => {
  const db = c.get('db')
  const results = await db.query.comics.findMany({
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
  })
  return c.json(results)
})

// Update Comic (e.g. toggle R18)
admin.patch(
  '/comics/:id',
  serviceAuth(),
  zValidator('json', z.object({
    isR18: z.boolean().optional(),
    status: z.string().optional(),
  })),
  async (c) => {
    const id = String(c.req.param('id')) // Ensure ID is string
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

// Sync Route (Called by Crawler)
admin.post(
  '/sync',
  serviceAuth(),
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
        // 1. Upsert Comic (Single record, usually safe)
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
          // Let database handle createdAt and updatedAt defaults on insert
        }).onConflictDoUpdate({
          target: comics.id,
          set: {
            title: data.title,
            coverImage: data.cover,
            author: data.author,
            description: data.description,
            status: data.status || 'ongoing',
            updatedAt: new Date(), // Manually update on conflict
          },
        })

        console.log(`[Sync] ✓ Comic upserted successfully`)

        // 2. Sync Chapters (Delete all existing for this comic, then insert new)
        // This is safer than bulk Upsert on SQLite and handles removed chapters.
        if (data.chapters.length > 0) {
          // Transaction would be ideal but D1 REST API has limits.
          // We do it sequentially.

          // A. Delete existing chapters
          console.log(`[Sync] 🗑️  Deleting existing chapters for: ${comicId}`)
          await db.delete(chapters).where(eq(chapters.comicId, comicId))

          // B. Prepare new values with deduplication
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

          // C. Batch insert (SQLite supports standard batch insert fine)
          // We split into chunks of 5 to stay within D1 API limits
          // D1 has stricter limits than standard SQLite
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
              throw batchError // Re-throw to be caught by outer catch
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
        // 1. Verify chapter exists (optional but good)
        // For performance, we might skip this and rely on FK constraints, but explicit check is better for debugging
        const chapter = await db.query.chapters.findFirst({
          where: eq(chapters.id, chapterId),
        })

        if (!chapter) {
          console.warn(`[Sync] ⚠️ Chapter not found: ${chapterId}. Attempting to create placeholder...`)
          // Create placeholder chapter if missing?
          // Or return error. Returning error is safer to ensure consistency.
          // BUT: If the chapter sync happened moments ago, it should be there.
          // If we are running chapter sync independently, we might need to ensure manga exists.
          // Let's create it if missing, but we need title/number which we might not have perfectly.
          // Fallback: Error out.
          return c.json({ success: false, error: 'Chapter not found. Please sync manga info first.' }, 404)
        }

        // 2. Delete existing pages
        await db.delete(pages).where(eq(pages.chapterId, chapterId))

        // 3. Insert new pages
        if (data.images.length > 0) {
          const pageValues = data.images.map((url, index) => ({
            id: `${chapterId}-${index + 1}`,
            chapterId,
            pageNumber: index + 1,
            imageUrl: url,
            width: data.width || 0,
            height: data.height || 0,
          }))

          const chunkSize = 10 // Pages are simple, can do larger chunks
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

// Admin Stats
admin.get('/stats', serviceAuth(), async (c) => {
  const db = c.get('db')

  // Efficient count using D1/SQLite
  const comicCount = await db.$count(comics)
  const userCount = await db.$count(user)

  return c.json({
    comics: comicCount,
    users: userCount,
    tasks: 0,
  })
})

export default admin
