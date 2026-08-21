import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { chapters, comics, movies, pages } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { persistChapterCompletenessProjection, persistChapterSourceSnapshot, readStoredChapterIdentities } from '../../../domain/chapter-completeness'
import { reconcileMovieSources } from '../../../domain/movies/source-reconciliation'
import { clearGatewayCacheGroup } from '../../../lib/gateway-cache'

interface NativeD1Statement {
  bind: (...values: unknown[]) => NativeD1Statement
}

interface NativeD1Result {
  readonly meta?: { readonly changes?: number }
}

interface NativeD1Client {
  batch: (statements: readonly NativeD1Statement[]) => Promise<readonly NativeD1Result[]>
  prepare: (query: string) => NativeD1Statement
}

function nativeD1Client(db: unknown): NativeD1Client | undefined {
  const client = (db as { $client?: unknown }).$client as NativeD1Client | undefined
  return client && typeof client.prepare === 'function' && typeof client.batch === 'function'
    ? client
    : undefined
}

async function replaceChapterPagesAtomically(
  db: unknown,
  chapterId: string,
  pageValues: readonly { readonly chapterId: string, readonly height: number, readonly id: string, readonly imageUrl: string, readonly pageNumber: number, readonly width: number }[],
): Promise<boolean> {
  const client = nativeD1Client(db)
  if (!client)
    return false
  const observedAt = Math.floor(Date.now() / 1000)
  const insertStatements: NativeD1Statement[] = []
  for (let offset = 0; offset < pageValues.length; offset += 80) {
    const chunk = pageValues.slice(offset, offset + 80)
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const values = chunk.flatMap(page => [page.id, page.chapterId, page.pageNumber, page.imageUrl, page.width, page.height])
    insertStatements.push(client.prepare(`
      INSERT INTO page (id, chapter_id, page_number, image_url, width, height)
      VALUES ${placeholders}
    `).bind(...values))
  }
  const statements: NativeD1Statement[] = [
    client.prepare('DELETE FROM page WHERE chapter_id = ?').bind(chapterId),
    ...insertStatements,
    client.prepare(`
      UPDATE chapter
      SET source_page_count = ?, updated_at = ?
      WHERE id = ?
    `).bind(pageValues.length, observedAt, chapterId),
  ]
  const result = await client.batch(statements)
  if ((result.at(-1)?.meta?.changes ?? 0) !== 1)
    throw new Error('chapter_page_metadata_update_failed')
  return true
}

/**
 * 同步电影数据
 */
export async function syncMovieData(c: Context<AppEnv>, payload: any) {
  const { data } = payload
  const db = c.get('db')

  // console.log(`[Sync] 🎬 Received movie: ${data.title} (${data.code})`)

  try {
    const hasPlayers = Object.hasOwn(data, 'players')
    const { players: playerData, ...movieData } = data
    const requestedMovieId = movieData.slug

    // 1. Upsert Movie
    await db.insert(movies).values({
      ...movieData,
      id: requestedMovieId,
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

    const persistedMovie = await db.query.movies.findFirst({
      where: eq(movies.slug, movieData.slug),
      columns: { id: true },
    })
    if (!persistedMovie?.id) {
      return c.json({
        disposition: 'source_failed',
        error: 'source_read_failed',
        id: requestedMovieId,
        reasonCode: 'source_read_failed',
        repairable: true,
        success: false,
      }, 500)
    }

    const sourceResult = await reconcileMovieSources({
      db,
      movieId: persistedMovie.id,
      players: hasPlayers ? playerData : undefined,
    })
    await clearGatewayCacheGroup(c.env.CACHE, 'movies')

    return c.json({ success: true, id: persistedMovie.id, source: sourceResult.source })
  }
  catch (error) {
    console.error('[Sync] ❌ Movie Sync Error: sync_failed', error instanceof Error ? error.name : 'unknown')
    return c.json({ success: false, error: 'sync_failed' }, 500)
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

    // 2. Snapshot source chapters before upserting any stored chapter rows.
    const observedAt = Math.floor(Date.now() / 1000)
    const sourceSnapshot = await persistChapterSourceSnapshot(db, {
      comicId,
      observedAt,
      sourceRows: data.chapters.map((chapter: any, sourceOrdinal: number) => ({
        chapterNumber: chapter.number,
        sourceOrdinal,
        sourceUrl: chapter.url,
        slug: chapter.slug,
        title: chapter.title,
      })),
      sourceUrl: data.sourceUrl,
      terminalState: data.sourceTerminalState ?? (data.chapters.length > 0 ? 'complete' : 'unavailable'),
    })

    // Empty/unavailable and inconclusive source results retain known chapters.
    if (sourceSnapshot.rows.length > 0 && sourceSnapshot.terminalState !== 'unavailable' && sourceSnapshot.terminalState !== 'inconclusive') {
      const chapterValues = sourceSnapshot.rows.map(ch => ({
        id: `${comicId}-${ch.slug ?? ch.sourceOrdinal}`,
        comicId,
        title: ch.title,
        slug: ch.slug ?? `source-${ch.sourceOrdinal}`,
        chapterNumber: ch.chapterNumber,
        sourcePageCount: null,
        sortOrder: ch.chapterNumber ?? ch.sourceOrdinal,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
      for (const chapterValue of chapterValues) {
        try {
          const insert = db.insert(chapters).values(chapterValue)
          if (typeof insert.onConflictDoUpdate === 'function') {
            await insert.onConflictDoUpdate({
              target: chapters.id,
              set: {
                title: chapterValue.title,
                chapterNumber: chapterValue.chapterNumber,
                sortOrder: chapterValue.sortOrder,
                updatedAt: new Date(),
              },
            })
          }
          else if (typeof insert.onConflictDoNothing === 'function') {
            await insert.onConflictDoNothing({ target: chapters.id })
          }
          else {
            await insert
          }
        }
        catch (batchError: unknown) {
          const errorMsg = batchError instanceof Error ? batchError.message : String(batchError)
          console.error(`[Sync] Chapter upsert failed:`, errorMsg)
          throw batchError
        }
      }
    }

    const storedChapters = await readStoredChapterIdentities(db, comicId)
    const completeness = await persistChapterCompletenessProjection(db, sourceSnapshot, storedChapters)

    // console.log(`[Sync] ✅ Sync completed for ${data.title}`)
    return c.json({
      completeness,
      sourceRevision: sourceSnapshot.sourceRevision,
      success: true,
      message: `Synced ${data.chapters.length} chapters`,
    })
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
  const incomingCount = data.images.length

  // console.log(`[Sync] 📥 Received chapter pages: ${chapterId} (${data.images.length} pages)`)

  try {
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      with: {
        pages: {
          orderBy: (page, { asc }) => [asc(page.pageNumber)],
        },
      },
    })

    if (!chapter) {
      console.warn(`[Sync] ⚠️ Chapter not found: ${chapterId}. Attempting to create placeholder...`)
      return c.json({ success: false, error: 'Chapter not found. Please sync manga info first.' }, 404)
    }

    const existingPageCount = chapter.pages.length
    const baseline = Math.max(existingPageCount, chapter.sourcePageCount ?? 0)
    const existingPagesSnapshot = chapter.pages.map(page => ({
      id: page.id,
      chapterId,
      pageNumber: page.pageNumber,
      imageUrl: page.imageUrl,
      width: page.width ?? 0,
      height: page.height ?? 0,
    }))

    if (incomingCount === 0) {
      return c.json({
        success: false,
        error: 'Incoming chapter page set is empty; refusing to overwrite existing pages.',
        chapterId,
        existingPageCount,
        baseline,
      }, 409)
    }

    if (incomingCount < baseline) {
      return c.json({
        success: false,
        error: 'Incoming chapter page set regressed below current baseline; refusing to overwrite existing pages.',
        chapterId,
        incomingCount,
        existingPageCount,
        baseline,
      }, 409)
    }

    const pageValues = data.images.map((url: string, index: number) => ({
      id: `${chapterId}-${index + 1}`,
      chapterId,
      pageNumber: index + 1,
      imageUrl: url,
      width: data.width || 0,
      height: data.height || 0,
    }))

    try {
      const atomicallyReplaced = await replaceChapterPagesAtomically(db, chapterId, pageValues)
      if (!atomicallyReplaced) {
        const chunkSize = 10
        await db.delete(pages).where(eq(pages.chapterId, chapterId))
        for (let i = 0; i < pageValues.length; i += chunkSize) {
          const chunk = pageValues.slice(i, i + chunkSize)
          await db.insert(pages).values(chunk)
        }
        await db.update(chapters)
          .set({ sourcePageCount: incomingCount, updatedAt: new Date() })
          .where(eq(chapters.id, chapterId))
      }
    }
    catch (replacementError) {
      if (nativeD1Client(db))
        throw replacementError
      // Best-effort rollback to preserve prior readable state when replacement fails mid-flight.
      const chunkSize = 10
      if (existingPagesSnapshot.length > 0) {
        await db.delete(pages).where(eq(pages.chapterId, chapterId))
        for (let i = 0; i < existingPagesSnapshot.length; i += chunkSize) {
          const originalChunk = existingPagesSnapshot.slice(i, i + chunkSize)
          await db.insert(pages).values(originalChunk)
        }
      }
      throw replacementError
    }

    // console.log(`[Sync] ✅ Synced ${data.images.length} pages for ${chapterId}`)
    return c.json({ success: true, count: incomingCount })
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
