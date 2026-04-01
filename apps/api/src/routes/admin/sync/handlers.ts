import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { chapters, comics, movies, pages, players } from '@starye/db/schema'
import { eq } from 'drizzle-orm'

/**
 * 同步电影数据
 */
export async function syncMovieData(c: Context<AppEnv>, payload: any) {
  const { data } = payload
  const db = c.get('db')

  // console.log(`[Sync] 🎬 Received movie: ${data.title} (${data.code})`)

  try {
    const { players: playerData, ...movieData } = data
    const movieId = movieData.slug

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
        playerData.map((p: any) => ({
          ...p,
          id: crypto.randomUUID(),
          movieId,
        })),
      )
    }

    // console.log(`[Sync] ✅ Movie synced: ${data.code}`)
    return c.json({ success: true, id: movieId })
  }
  catch (e: unknown) {
    console.error('[Sync] ❌ Movie Sync Error:', e)
    return c.json({ success: false, error: String(e) }, 500)
  }
}

/**
 * 同步漫画数据
 */
export async function syncMangaData(c: Context<AppEnv>, payload: any) {
  const { data } = payload
  const db = c.get('db')

  // console.log(`[Sync] 📥 Received manga: ${data.title}`, {
  //   slug: data.slug,
  //   chapters: data.chapters.length,
  //   hasCover: !!data.cover,
  //   hasAuthor: !!data.author,
  //   status: data.status,
  // })

  try {
    const comicId = data.slug
    // console.log(`[Sync] 📝 Upserting comic: ${comicId}`)

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
        // console.log(`[Sync] ✓ Comic updated (Metadata Unlocked)`)
      }
      else {
        // console.log(`[Sync] 🔒 Comic metadata locked, skipping update.`)
        await db.update(comics)
          .set({ updatedAt: new Date() })
          .where(eq(comics.id, comicId))
      }
    }
    else {
      await db.insert(comics).values({ ...comicData, id: comicId })
      // console.log(`[Sync] ✓ New Comic inserted`)
    }

    // 2. 同步章节
    if (data.chapters.length > 0) {
      // console.log(`[Sync] 🗑️  Deleting existing chapters for: ${comicId}`)
      await db.delete(chapters).where(eq(chapters.comicId, comicId))

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

      const chunkSize = 5
      // console.log(`[Sync] 📚 Inserting ${chapterValues.length} chapters in ${Math.ceil(chapterValues.length / chunkSize)} batches`)

      for (let i = 0; i < chapterValues.length; i += chunkSize) {
        const chunk = chapterValues.slice(i, i + chunkSize)
        const batchNum = Math.floor(i / chunkSize) + 1
        const totalBatches = Math.ceil(chapterValues.length / chunkSize)
        // console.log(`[Sync] 📦 Batch ${batchNum}/${totalBatches}: inserting ${chunk.length} chapters`)
        try {
          await db.insert(chapters).values(chunk)
          // console.log(`[Sync] ✅ Batch ${batchNum}/${totalBatches} inserted successfully`)
        }
        catch (batchError: unknown) {
          const errorMsg = batchError instanceof Error ? batchError.message : String(batchError)
          console.error(`[Sync] ❌ Batch ${batchNum}/${totalBatches} failed:`, errorMsg)
          throw batchError
        }
      }

      // console.log(`[Sync] ✓ All chapters inserted successfully`)
    }

    // console.log(`[Sync] ✅ Sync completed for ${data.title}`)
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

/**
 * 同步章节页面数据
 */
export async function syncChapterData(c: Context<AppEnv>, payload: any) {
  const { data } = payload
  const db = c.get('db')
  const chapterId = `${data.comicSlug}-${data.chapterSlug}`

  // console.log(`[Sync] 📥 Received chapter pages: ${chapterId} (${data.images.length} pages)`)

  try {
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
    })

    if (!chapter) {
      console.warn(`[Sync] ⚠️ Chapter not found: ${chapterId}. Attempting to create placeholder...`)
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
      const pageValues = data.images.map((url: string, index: number) => ({
        id: `${chapterId}-${index + 1}`,
        chapterId,
        pageNumber: index + 1,
        imageUrl: url,
        width: data.width || 0,
        height: data.height || 0,
      }))

      const chunkSize = 10
      for (let i = 0; i < pageValues.length; i += chunkSize) {
        const chunk = pageValues.slice(i, i + chunkSize)
        await db.insert(pages).values(chunk)
      }
    }

    // console.log(`[Sync] ✅ Synced ${data.images.length} pages for ${chapterId}`)
    return c.json({ success: true, count: data.images.length })
  }
  catch (e: unknown) {
    console.error(`[Sync] ❌ Failed to sync pages for ${chapterId}:`, e)
    return c.json({ success: false, error: String(e) }, 500)
  }
}

/**
 * 统一的同步入口
 */
export async function syncCrawlerData(c: Context<AppEnv>) {
  const payload = (c.req as any).valid('json')

  if (payload.type === 'movie') {
    return syncMovieData(c, payload)
  }

  if (payload.type === 'manga') {
    return syncMangaData(c, payload)
  }

  if (payload.type === 'chapter') {
    return syncChapterData(c, payload)
  }

  return c.json({ success: false, error: 'Unknown sync type' }, 400)
}
