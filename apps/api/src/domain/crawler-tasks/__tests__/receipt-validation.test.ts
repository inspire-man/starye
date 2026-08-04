import { describe, expect, it } from 'vitest'
import { validateReceiptCandidate } from '../receipt-validation'

interface Row {
  id: string
  code?: string
  slug?: string
  total_players?: number | null
  crawled_players?: number | null
  total_chapters?: number | null
  crawled_chapters?: number | null
}

class Statement {
  private values: unknown[] = []

  constructor(private readonly table: 'movie' | 'comic', private readonly rows: Row[]) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async all<T>() {
    const identifiers = this.values.filter(value => typeof value === 'string') as string[]
    const matched = this.rows.filter((row) => {
      const identity = this.table === 'movie' ? [row.id, row.code] : [row.id, row.slug]
      return identity.some(value => value && identifiers.includes(value))
    })
    return { results: matched as T[] }
  }
}

function database(rows: { movie?: Row[], comic?: Row[] }) {
  return {
    $client: {
      prepare(query: string) {
        const table = query.includes('FROM movie') ? 'movie' : 'comic'
        return new Statement(table, rows[table] ?? [])
      },
    },
  }
}

describe('validateReceiptCandidate', () => {
  it('accepts a persisted movie even when the crawler found no players', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['MOV-001'],
        createdCount: 2,
        templateKey: 'movie',
        updatedCount: 1,
      },
      database: database({
        movie: [{ code: 'MOV-001', crawled_players: 0, id: 'movie-1', total_players: 0 }],
      }),
      templateKey: 'movie',
    })

    expect(result).toEqual({
      ok: true,
      receipt: {
        createdCount: 2,
        primaryContentId: 'movie-1',
        templateKey: 'movie',
        updatedCount: 1,
      },
    })
  })

  it('re-queries manga by slug and verifies a non-empty chapter aggregate', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['manga-slug'],
        createdCount: 1,
        templateKey: 'manga',
        updatedCount: 3,
      },
      database: database({
        comic: [{ crawled_chapters: 4, id: 'comic-1', slug: 'manga-slug', total_chapters: 4 }],
      }),
      templateKey: 'manga',
    })

    expect(result).toEqual({
      ok: true,
      receipt: {
        createdCount: 1,
        primaryContentId: 'comic-1',
        templateKey: 'manga',
        updatedCount: 3,
      },
    })
  })

  it.each([
    { candidate: { contentIds: [], templateKey: 'movie' as const }, name: 'empty candidate' },
    { candidate: { contentIds: ['missing'], templateKey: 'movie' as const }, name: 'missing row' },
    { candidate: { contentIds: ['comic-1'], templateKey: 'movie' as const }, name: 'wrong-template row' },
  ])('$name is receipt_missing', async ({ candidate }) => {
    const result = await validateReceiptCandidate({
      candidate,
      database: database({
        comic: [{ crawled_chapters: 1, id: 'comic-1', slug: 'comic-1', total_chapters: 1 }],
        movie: [{ crawled_players: 0, code: 'MOV-001', id: 'movie-1', total_players: 0 }],
      }),
      templateKey: 'movie',
    })

    expect(result).toEqual({ ok: false, reason: 'receipt_missing' })
  })
})
