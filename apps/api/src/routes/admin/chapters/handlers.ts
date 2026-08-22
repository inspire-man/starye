import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { chapters, pages } from '@starye/db/schema'
import { and, count, eq } from 'drizzle-orm'
import { persistChapterPageAvailability, readChapterCompletenessCurrent, readChapterSourceSnapshots, readStoredChapterIdentities, redactChapterUrl } from '../../../domain/chapter-completeness'

const INTEGRITY_PROBE_TIMEOUT_MS = 3000
const PROBE_OK_STATUS_UPPER_BOUND = 400

interface IntegrityFailure {
  pageNumber: number
  url: string
  status?: number
  reason: string
}

function isIpv4Literal(hostname: string): boolean {
  const segments = hostname.split('.')
  if (segments.length !== 4) {
    return false
  }

  return segments.every((segment) => {
    if (!/^\d+$/.test(segment)) {
      return false
    }

    const value = Number(segment)
    return value >= 0 && value <= 255
  })
}

function isBlockedIpv4(hostname: string): boolean {
  if (!isIpv4Literal(hostname)) {
    return false
  }

  const [first, second] = hostname.split('.').map(Number)

  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
  // CGNAT and benchmark/test ranges are also non-routable enough to reject here.
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 198 && (second === 18 || second === 19))
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
}

export function isProbeableExternalImageUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const protocol = url.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false
    }

    const hostname = url.hostname.toLowerCase()
    if (!hostname) {
      return false
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false
    }

    if (isBlockedIpv4(hostname) || isBlockedIpv6(hostname)) {
      return false
    }

    return true
  }
  catch {
    return false
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = INTEGRITY_PROBE_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
    })
  }
  finally {
    clearTimeout(timeout)
  }
}

async function probeExternalImageUrl(url: string): Promise<{ ok: boolean, status?: number, reason?: string }> {
  try {
    const headResponse = await fetchWithTimeout(url, { method: 'HEAD' })
    if (headResponse.status < PROBE_OK_STATUS_UPPER_BOUND) {
      return { ok: true, status: headResponse.status }
    }

    if (headResponse.status === 405 || headResponse.status === 501) {
      const getResponse = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      })

      return getResponse.status < PROBE_OK_STATUS_UPPER_BOUND
        ? { ok: true, status: getResponse.status }
        : { ok: false, status: getResponse.status, reason: `http_${getResponse.status}` }
    }

    return { ok: false, status: headResponse.status, reason: `http_${headResponse.status}` }
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }

    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'probe_failed',
    }
  }
}

/**
 * 获取漫画章节列表（管理后台）
 */
export async function getComicChapters(c: Context<AppEnv>) {
  const id = c.req.param('id')!
  const db = c.get('db')

  const [results, snapshots] = await Promise.all([
    db.query.chapters.findMany({
      where: eq(chapters.comicId, id),
      orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
    }),
    readChapterSourceSnapshots(db, id, 1),
  ])
  const sourceRows = snapshots[0]?.rows ?? []
  const sourceUrlBySlug = new Map(sourceRows.map(row => [row.slug, row.sourceUrl]))

  return c.json(results.map(chapter => ({
    ...chapter,
    sourceUrl: sourceUrlBySlug.get(chapter.slug) ?? null,
  })))
}

/** Read the authoritative source/stored chapter comparison for one comic. */
export async function getComicChapterCompleteness(c: Context<AppEnv>) {
  const comicId = c.req.param('id')!
  const db = c.get('db')
  const [current, history, stored] = await Promise.all([
    readChapterCompletenessCurrent(db, comicId),
    readChapterSourceSnapshots(db, comicId),
    readStoredChapterIdentities(db, comicId),
  ])
  const currentProjection = current
    ? {
        comicId: current.comicId,
        snapshotId: current.snapshotId,
        sourceRevision: current.sourceRevision,
        status: current.status,
        terminalState: current.terminalState,
        reasonCode: current.reasonCode,
        counts: current.countsJson,
        findings: current.findingsJson,
        observationIdentity: current.observationIdentity,
        projectionVersion: current.projectionVersion,
        observedAt: current.observedAt,
        updatedAt: current.updatedAt,
      }
    : null
  const boundedHistory = history.map(snapshot => ({
    ...snapshot,
    sourceUrl: redactChapterUrl(snapshot.sourceUrl) ?? null,
    rows: snapshot.rows.slice(0, 100).map(row => ({
      chapterNumber: row.chapterNumber,
      identity: row.identity,
      slug: row.slug,
      sourceOrdinal: row.sourceOrdinal,
      sourceUrl: redactChapterUrl(row.sourceUrl) ?? null,
      title: row.title,
    })),
    rowsTruncated: snapshot.rows.length > 100,
  }))
  return c.json({
    comicId,
    current: currentProjection,
    history: boundedHistory,
    storedCount: stored.length,
  })
}

/** Read chapter completeness plus bounded page availability current state. */
export async function getChapterCompleteness(c: Context<AppEnv>) {
  const id = c.req.param('id')!
  const db = c.get('db')
  const chapter = await db.query.chapters.findFirst({ where: eq(chapters.id, id) })
  if (!chapter)
    return c.json({ success: false, error: 'Chapter not found' }, 404)
  const [comicCurrent, pageCurrent] = await Promise.all([
    readChapterCompletenessCurrent(db, chapter.comicId),
    db.query.chapterPageAvailabilityCurrent?.findFirst
      ? db.query.chapterPageAvailabilityCurrent.findFirst({ where: (current: any, operators: any) => operators.eq(current.chapterId, id) })
      : Promise.resolve(null),
  ])
  return c.json({ success: true, data: { chapterId: id, comicCurrent: comicCurrent ?? null, pageCurrent: pageCurrent ?? null } })
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
 * 显式只读的章节外链完整性探测
 */
export async function getChapterIntegrity(c: Context<AppEnv>) {
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
    return c.json({ success: false, error: 'Chapter not found' }, 404)
  }

  // New databases persist bounded page observations/current projection. Legacy
  // fixtures keep the original read-only response shape for compatibility.
  if (typeof db.query.chapterPageAvailabilityCurrent?.findFirst === 'function') {
    const source = await readChapterCompletenessCurrent(db, chapter.comicId)
    const current = await persistChapterPageAvailability(db, {
      chapterId: id,
      observedAt: Math.floor(Date.now() / 1000),
      provider: 'integrity',
      sourceRevision: source?.sourceRevision ?? 0,
    }, chapter)
    return c.json({
      success: true,
      data: {
        chapterId: id,
        title: chapter.title,
        totalPages: current.storedPageCount,
        checkedPages: current.storedPageCount,
        okCount: current.availablePageCount,
        failureCount: current.unavailablePageCount,
        unknownCount: current.unknownPageCount,
        status: current.status,
        sourceRevision: current.sourceRevision,
        projectionVersion: current.projectionVersion,
        findings: current.findingsJson,
        samples: current.samplesJson,
        failures: current.samplesJson,
      },
    })
  }

  const blockedPages = chapter.pages
    .filter(page => !isProbeableExternalImageUrl(page.imageUrl))
    .map(page => ({
      pageNumber: page.pageNumber,
      url: page.imageUrl,
      reason: 'blocked_by_url_guard',
    }))

  if (blockedPages.length > 0) {
    return c.json({
      success: false,
      error: 'Chapter contains non-probeable external image URLs',
      chapterId: id,
      blockedCount: blockedPages.length,
      blockedPages,
    }, 400)
  }

  const failures: IntegrityFailure[] = []
  let okCount = 0

  for (const page of chapter.pages) {
    const result = await probeExternalImageUrl(page.imageUrl)
    if (result.ok) {
      okCount++
      continue
    }

    failures.push({
      pageNumber: page.pageNumber,
      url: page.imageUrl,
      status: result.status,
      reason: result.reason || 'probe_failed',
    })
  }

  const totalPages = chapter.pages.length
  const status = totalPages === 0
    ? 'empty'
    : failures.length === 0
      ? 'healthy'
      : okCount === 0
        ? 'failed'
        : 'degraded'

  return c.json({
    success: true,
    data: {
      chapterId: id,
      title: chapter.title,
      totalPages,
      checkedPages: totalPages,
      okCount,
      failureCount: failures.length,
      status,
      failures,
    },
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
