import type { Database } from '@starye/db'
import type { SourceCandidate, SourceHealthProjection } from '../movies/source-contract'
import type { ChapterPageTaskSnapshot, ComicChapterTaskSnapshot, CrawlerReceiptUnion, CrawlerRunReceiptCandidate, CrawlerTaskSnapshotUnion, CrawlerTaskTemplateKey, RepairPlayersReceipt } from './types'
import { deriveSourceReadiness } from '../movies/source-contract'
import { readRepairSourceReadback } from '../movies/source-reconciliation'
import { readCrawlerTaskSnapshot } from './template-registry'
import { CRAWLER_RECEIPT_SCHEMA_VERSION } from './types'

type ReceiptValidationDatabase = Pick<Database, '$client' | 'query'>

interface MovieReceiptRow {
  readonly code: string | null
  readonly id: string
}

interface PlayerReceiptRow {
  readonly is_active: boolean | number | null
  readonly source_url: string | null
}

interface SourceStateReceiptRow {
  readonly disposition: 'ready' | 'no_source' | 'repairing' | 'source_failed'
  readonly reason_code: string | null
  readonly source_revision: number | null
  readonly observed_at: number | null
}

interface ComicReceiptRow {
  readonly crawled_chapters: number | null
  readonly id: string
  readonly slug: string | null
  readonly total_chapters: number | null
}

export type ReceiptValidationResult
  = | { readonly ok: false, readonly reason: 'receipt_missing' }
    | { readonly ok: true, readonly receipt: CrawlerReceiptUnion }

function safeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000
    ? value
    : fallback
}

function safeTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4_000_000_000
    ? value
    : fallback
}

function safeRevision(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000
    ? value
    : 0
}

function candidateIds(candidate: CrawlerRunReceiptCandidate): string[] {
  return [...new Set(candidate.contentIds
    .map(value => value.trim())
    .filter(Boolean))].slice(0, 100)
}

function hasComicAggregate(row: ComicReceiptRow): boolean {
  return Math.max(Number(row.total_chapters ?? 0), Number(row.crawled_chapters ?? 0)) > 0
}

function missing(): ReceiptValidationResult {
  return { ok: false, reason: 'receipt_missing' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSourceHealthProjection(value: unknown): value is SourceHealthProjection {
  return isRecord(value)
    && typeof value.eligible === 'boolean'
    && (value.health === 'inactive' || value.health === 'unverified' || value.health === 'failed')
    && safeTimestamp(value.observedAt, -1) >= 0
    && (value.reasonCode === 'source_inactive'
      || value.reasonCode === 'source_unverified'
      || value.reasonCode === 'source_candidate_invalid'
      || value.reasonCode === 'source_read_failed'
      || value.reasonCode === 'source_write_failed')
    && (value.sourceType === 'direct' || value.sourceType === 'magnet' || value.sourceType === 'TorrServer')
}

interface RepairReceiptCandidate {
  readonly movieId: string
  readonly observedAt: number
  readonly operation: 'repair_players'
  readonly sourceRevision: number
  readonly sourceSummary: readonly SourceHealthProjection[]
}

function asRepairReceiptCandidate(candidate: unknown): RepairReceiptCandidate | undefined {
  const observedAt = isRecord(candidate) ? candidate.observedAt : undefined
  const sourceRevision = isRecord(candidate) ? candidate.sourceRevision : undefined
  if (!isRecord(candidate)
    || candidate.operation !== 'repair_players'
    || typeof candidate.movieId !== 'string'
    || candidate.movieId.trim().length === 0
    || typeof observedAt !== 'number'
    || !Number.isSafeInteger(observedAt)
    || observedAt < 0
    || typeof sourceRevision !== 'number'
    || !Number.isSafeInteger(sourceRevision)
    || sourceRevision < 0
    || !Array.isArray(candidate.sourceSummary)
    || candidate.sourceSummary.length === 0
    || !candidate.sourceSummary.every(isSourceHealthProjection)) {
    return undefined
  }

  return {
    movieId: candidate.movieId.trim(),
    observedAt,
    operation: 'repair_players',
    sourceRevision,
    sourceSummary: candidate.sourceSummary,
  }
}

function repairReceiptFromReadback(candidate: RepairReceiptCandidate, readback: Awaited<ReturnType<typeof readRepairSourceReadback>>): RepairPlayersReceipt | undefined {
  if (readback.movieId !== candidate.movieId
    || readback.sourceRevision !== candidate.sourceRevision
    || readback.observedAt !== candidate.observedAt
    || readback.sources.length !== candidate.sourceSummary.length) {
    return undefined
  }

  const summary = readback.sources.map(source => ({
    eligible: source.eligible,
    health: source.health,
    observedAt: source.observedAt,
    reasonCode: source.reasonCode,
    sourceType: source.sourceType,
  }))

  for (let index = 0; index < summary.length; index += 1) {
    const expected = candidate.sourceSummary[index]
    const actual = summary[index]
    if (!expected
      || expected.eligible !== actual.eligible
      || expected.health !== actual.health
      || expected.observedAt !== actual.observedAt
      || expected.reasonCode !== actual.reasonCode
      || expected.sourceType !== actual.sourceType) {
      return undefined
    }
  }

  return {
    movieId: readback.movieId,
    observedAt: readback.observedAt,
    operation: 'repair_players',
    sourceRevision: readback.sourceRevision,
    sourceSummary: summary,
  }
}

async function readMovieSource(
  database: ReceiptValidationDatabase,
  movieId: string,
): Promise<ReturnType<typeof deriveSourceReadiness>> {
  const observedAt = Math.floor(Date.now() / 1000)
  try {
    const [playersResult, sourceStateResult] = await Promise.all([
      database.$client.prepare(`
        SELECT is_active, source_url
        FROM player
        WHERE movie_id = ?
        ORDER BY sort_order ASC, id ASC
      `).bind(movieId).all<PlayerReceiptRow>(),
      database.$client.prepare(`
        SELECT disposition, eligible_count, repairable, reason_code, source_revision, observed_at
        FROM movie_source_state
        WHERE movie_id = ?
        LIMIT 1
      `).bind(movieId).all<SourceStateReceiptRow>(),
    ])
    const state = sourceStateResult.results?.[0]
    const candidates: SourceCandidate[] = (playersResult.results ?? []).map(player => ({
      isActive: player.is_active === true || player.is_active === 1,
      sourceUrl: player.source_url,
    }))

    return deriveSourceReadiness({
      candidates,
      failure: state?.disposition === 'source_failed' ? { reasonCode: state.reason_code } : undefined,
      observedAt: safeTimestamp(state?.observed_at, observedAt),
      repairRequested: state?.disposition === 'repairing',
      sourceRevision: safeRevision(state?.source_revision),
    })
  }
  catch {
    return deriveSourceReadiness({
      candidates: [],
      failure: { reasonCode: 'source_read_failed' },
      observedAt,
      sourceRevision: 0,
    })
  }
}

/**
 * Re-validates runner-controlled IDs against the template-owned content table.
 * The returned receipt contains only fields derived from this API boundary.
 */
export async function validateReceiptCandidate(input: {
  readonly candidate: CrawlerRunReceiptCandidate | RepairReceiptCandidate | undefined
  readonly database: ReceiptValidationDatabase
  readonly snapshot?: CrawlerTaskSnapshotUnion | unknown
  readonly templateKey: CrawlerTaskTemplateKey
}): Promise<ReceiptValidationResult> {
  const candidate = input.candidate
  if (!candidate)
    return missing()

  const snapshot = input.snapshot === undefined
    ? undefined
    : readCrawlerTaskSnapshot(input.snapshot)
  if (snapshot && !snapshot.ok)
    return missing()
  const snapshotValue = snapshot?.ok ? snapshot.snapshot : undefined

  const repairCandidate = asRepairReceiptCandidate(candidate)
  if (repairCandidate) {
    if (input.templateKey !== 'movie')
      return missing()
    if (snapshot && snapshot.operation !== 'repair_players')
      return missing()

    try {
      const readback = await readRepairSourceReadback({
        db: input.database as unknown as Parameters<typeof readRepairSourceReadback>[0]['db'],
        movieId: repairCandidate.movieId,
        sourceRevision: repairCandidate.sourceRevision,
      })
      const receipt = repairReceiptFromReadback(repairCandidate, readback)
      return receipt ? { ok: true, receipt } : missing()
    }
    catch {
      return missing()
    }
  }

  if (!('templateKey' in candidate) || candidate.templateKey !== input.templateKey)
    return missing()
  if (snapshot && snapshot.operation === 'repair_players')
    return missing()

  const ids = candidateIds(candidate)
  if (ids.length === 0)
    return missing()

  const placeholders = ids.map(() => '?').join(', ')
  if (input.templateKey === 'movie') {
    const rows = await input.database.$client.prepare(`
      SELECT id, code
      FROM movie
      WHERE id IN (${placeholders}) OR code IN (${placeholders})
      ORDER BY id ASC
      LIMIT 1
    `).bind(...ids, ...ids).all<MovieReceiptRow>()
    const row = rows.results?.[0]
    if (!row || !row.id)
      return missing()

    const source = await readMovieSource(input.database, row.id)

    return {
      ok: true,
      receipt: {
        createdCount: safeCount(candidate.createdCount, 1),
        primaryContentId: row.id,
        receiptSchemaVersion: CRAWLER_RECEIPT_SCHEMA_VERSION,
        source,
        templateKey: input.templateKey,
        updatedCount: safeCount(candidate.updatedCount, 0),
      },
    }
  }

  if (snapshotValue && 'comicId' in snapshotValue
    && 'operation' in snapshotValue
    && (snapshotValue.operation === 'check_comic_chapters'
      || snapshotValue.operation === 'recheck_comic_chapters'
      || snapshotValue.operation === 'repair_comic_chapters'
      || snapshotValue.operation === 'check_chapter_pages'
      || snapshotValue.operation === 'recheck_chapter_pages'
      || snapshotValue.operation === 'repair_chapter_pages')) {
    const chapterSnapshot = snapshotValue as ComicChapterTaskSnapshot | ChapterPageTaskSnapshot
    const comicId = chapterSnapshot.comicId
    const contentId = ids.includes(comicId) ? comicId : undefined
    if (!contentId)
      return missing()
    const isComicChapterSnapshot = chapterSnapshot.operation === 'check_comic_chapters'
      || chapterSnapshot.operation === 'recheck_comic_chapters'
      || chapterSnapshot.operation === 'repair_comic_chapters'
    const currentQuery = isComicChapterSnapshot
      ? input.database.$client.prepare(`
          SELECT source_revision
          FROM chapter_completeness_current
          WHERE comic_id = ? AND source_revision = ?
          LIMIT 1
        `).bind(comicId, chapterSnapshot.sourceRevision)
      : input.database.$client.prepare(`
          SELECT source_revision
          FROM chapter_page_availability_current
          WHERE chapter_id = ? AND source_revision = ?
          LIMIT 1
        `).bind((chapterSnapshot as ChapterPageTaskSnapshot).chapterId, chapterSnapshot.sourceRevision)
    const current = await currentQuery.all<{ source_revision: number }>()
    if (!current.results?.[0])
      return missing()
    return {
      ok: true,
      receipt: {
        createdCount: safeCount(candidate.createdCount, 0),
        primaryContentId: contentId,
        receiptSchemaVersion: CRAWLER_RECEIPT_SCHEMA_VERSION,
        templateKey: 'manga',
        updatedCount: safeCount(candidate.updatedCount, 1),
      },
    }
  }

  const rows = await input.database.$client.prepare(`
    SELECT id, slug, total_chapters, crawled_chapters
    FROM comic
    WHERE id IN (${placeholders}) OR slug IN (${placeholders})
    ORDER BY id ASC
    LIMIT 1
  `).bind(...ids, ...ids).all<ComicReceiptRow>()
  const row = rows.results?.[0]
  if (!row || !row.id || !hasComicAggregate(row))
    return missing()

  return {
    ok: true,
    receipt: {
      createdCount: safeCount(candidate.createdCount, 1),
      primaryContentId: row.id,
      templateKey: input.templateKey,
      updatedCount: safeCount(candidate.updatedCount, 0),
    },
  }
}
