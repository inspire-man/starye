import type { CrawlerRunReceiptCandidate, CrawlerTaskTemplateKey, ValidatedCrawlerRunReceipt } from './types'

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
  readonly crawled_players: number | null
  readonly id: string
  readonly total_players: number | null
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

function candidateIds(candidate: CrawlerRunReceiptCandidate): string[] {
  return [...new Set(candidate.contentIds
    .map(value => value.trim())
    .filter(Boolean))].slice(0, 100)
}

function hasMovieAggregate(row: MovieReceiptRow): boolean {
  return Math.max(Number(row.total_players ?? 0), Number(row.crawled_players ?? 0)) > 0
}

function hasComicAggregate(row: ComicReceiptRow): boolean {
  return Math.max(Number(row.total_chapters ?? 0), Number(row.crawled_chapters ?? 0)) > 0
}

function missing(): ReceiptValidationResult {
  return { ok: false, reason: 'receipt_missing' }
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
      SELECT id, code, total_players, crawled_players
      FROM movie
      WHERE id IN (${placeholders}) OR code IN (${placeholders})
      ORDER BY id ASC
      LIMIT 1
    `).bind(...ids, ...ids).all<MovieReceiptRow>()
    const row = rows.results?.[0]
    if (!row || !row.id || !hasMovieAggregate(row))
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
