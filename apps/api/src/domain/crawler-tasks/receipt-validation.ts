import type { SourceCandidate } from '../movies/source-contract'
import type { CrawlerRunReceiptCandidate, CrawlerTaskTemplateKey, ValidatedCrawlerRunReceipt } from './types'
import { deriveSourceReadiness } from '../movies/source-contract'
import { CRAWLER_RECEIPT_SCHEMA_VERSION } from './types'

interface D1Statement {
  all: <T>() => Promise<{ results?: T[] }>
  bind: (...values: unknown[]) => D1Statement
}

interface ReceiptValidationDatabase {
  readonly $client: {
    prepare: (query: string) => D1Statement
  }
}

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
    | { readonly ok: true, readonly receipt: ValidatedCrawlerRunReceipt }

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
  readonly candidate: CrawlerRunReceiptCandidate | undefined
  readonly database: ReceiptValidationDatabase
  readonly templateKey: CrawlerTaskTemplateKey
}): Promise<ReceiptValidationResult> {
  const candidate = input.candidate
  if (!candidate || candidate.templateKey !== input.templateKey)
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
