/* eslint-disable no-console */
import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { chapters, comics } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { serviceAuth } from '../middleware/service-auth'
import { MangaInfoSchema } from '../types'

const admin = new Hono<AppEnv>()

// Sync Route (Called by Crawler)
admin.post(
  '/sync',
  serviceAuth(),
  zValidator('json', z.object({
    type: z.literal('manga'),
    data: MangaInfoSchema,
  })),
  async (c) => {
    const { data } = c.req.valid('json')
    const db = c.get('db')

    console.log(`[Sync] 📥 Received manga: ${data.title}`, {
      slug: data.slug,
      chapters: data.chapters.length,
      hasCover: !!data.cover,
      hasAuthor: !!data.author,
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
        // Let database handle createdAt and updatedAt defaults on insert
      }).onConflictDoUpdate({
        target: comics.id,
        set: {
          title: data.title,
          coverImage: data.cover,
          author: data.author,
          description: data.description,
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
            // Let database handle createdAt and updatedAt defaults
          })
        }

        // C. Batch insert (SQLite supports standard batch insert fine)
        // We split into chunks of 10 to stay within D1 API limits
        // D1 has stricter limits than standard SQLite
        const chunkSize = 10
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
  },
)

export default admin
