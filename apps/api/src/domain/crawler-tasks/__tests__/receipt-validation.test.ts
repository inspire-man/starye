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

interface PlayerRow {
  movie_id: string
  source_url: string | null
  is_active: number | boolean | null
}

interface SourceStateRow {
  movie_id: string
  source_revision: number
  disposition: 'ready' | 'no_source' | 'source_failed' | 'repairing'
  eligible_count: number
  repairable: number | boolean
  reason_code: string | null
  observed_at: number
}

class Statement {
  private values: unknown[] = []

  constructor(
    private readonly table: 'movie' | 'comic' | 'player' | 'movie_source_state',
    private readonly rows: Row[],
    private readonly players: PlayerRow[],
    private readonly sourceStates: SourceStateRow[],
  ) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async all<T>() {
    const identifiers = this.values.filter(value => typeof value === 'string') as string[]
    if (this.table === 'player') {
      return {
        results: this.players.filter(row => identifiers.includes(row.movie_id)) as T[],
      }
    }
    if (this.table === 'movie_source_state') {
      return {
        results: this.sourceStates.filter(row => identifiers.includes(row.movie_id)) as T[],
      }
    }
    const matched = this.rows.filter((row) => {
      const identity = this.table === 'movie' ? [row.id, row.code] : [row.id, row.slug]
      return identity.some(value => value && identifiers.includes(value))
    })
    return { results: matched as T[] }
  }
}

function database(options: {
  movie?: Row[]
  comic?: Row[]
  players?: PlayerRow[]
  sourceStates?: SourceStateRow[]
}) {
  const rows = options
  return {
    $client: {
      prepare(query: string) {
        const table = query.includes('FROM movie_source_state')
          ? 'movie_source_state'
          : query.includes('FROM player')
            ? 'player'
            : query.includes('FROM movie')
              ? 'movie'
              : 'comic'
        return new Statement(table, rows[table] ?? [], rows.players ?? [], rows.sourceStates ?? [])
      },
    },
  }
}

describe('validateReceiptCandidate', () => {
  it('sUN-064 reads back zero players as no_source and repairable', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['MOV-001'],
        createdCount: 2,
        templateKey: 'movie',
        updatedCount: 1,
      },
      database: database({
        movie: [{ code: 'MOV-001', crawled_players: 0, id: 'movie-1', total_players: 0 }],
        sourceStates: [{
          disposition: 'no_source',
          eligible_count: 0,
          movie_id: 'movie-1',
          observed_at: 1_725_000_000,
          reason_code: 'no_eligible_source',
          repairable: 1,
          source_revision: 4,
        }],
      }),
      templateKey: 'movie',
    })

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        primaryContentId: 'movie-1',
        receiptSchemaVersion: 2,
        source: {
          disposition: 'no_source',
          eligibleCount: 0,
          reasonCode: 'no_eligible_source',
          repairable: true,
          sourceRevision: 4,
        },
      },
    })
  })

  it('counts only active players with non-empty URLs from the canonical movie id', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['MOV-002'],
        createdCount: 99,
        templateKey: 'movie',
        updatedCount: 99,
      },
      database: database({
        movie: [{ code: 'MOV-002', id: 'movie-2' }],
        players: [
          { is_active: 1, movie_id: 'movie-2', source_url: 'https://source.example/ready' },
          { is_active: 0, movie_id: 'movie-2', source_url: 'https://source.example/inactive' },
          { is_active: 1, movie_id: 'movie-2', source_url: '   ' },
        ],
        sourceStates: [{
          disposition: 'ready',
          eligible_count: 1,
          movie_id: 'movie-2',
          observed_at: 1_725_000_001,
          reason_code: null,
          repairable: 0,
          source_revision: 5,
        }],
      }),
      templateKey: 'movie',
    })

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        createdCount: 99,
        primaryContentId: 'movie-2',
        source: {
          disposition: 'ready',
          eligibleCount: 1,
          repairable: false,
          sourceRevision: 5,
        },
        updatedCount: 99,
      },
    })
  })

  it('keeps metadata identity while projecting a bounded source_failed state', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['MOV-003'],
        templateKey: 'movie',
      },
      database: database({
        movie: [{ code: 'MOV-003', id: 'movie-3' }],
        sourceStates: [{
          disposition: 'source_failed',
          eligible_count: 0,
          movie_id: 'movie-3',
          observed_at: 1_725_000_002,
          reason_code: 'source_write_failed',
          repairable: 1,
          source_revision: 6,
        }],
      }),
      templateKey: 'movie',
    })

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        primaryContentId: 'movie-3',
        source: {
          disposition: 'source_failed',
          reasonCode: 'source_write_failed',
          repairable: true,
        },
      },
    })
    expect(JSON.stringify(result)).not.toContain('source.example')
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
