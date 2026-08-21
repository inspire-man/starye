import { describe, expect, it } from 'vitest'
import { validateReceiptCandidate } from '../receipt-validation'
import { createCrawlerTaskSnapshot } from '../template-registry'

interface Row {
  id: string
  code?: string
  slug?: string
  total_players?: number | null
  crawled_players?: number | null
  total_chapters?: number | null
  crawled_chapters?: number | null
}

interface ChapterCurrentRow {
  chapter_id: string
  source_revision: number
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

interface ObservationRow {
  movie_id: string
  source_revision: number
  source_ordinal: number
  source_type: 'direct' | 'magnet' | 'TorrServer'
  health: 'inactive' | 'unverified' | 'failed'
  observed_at: number
  reason_code: 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
  eligible: number | boolean
}

class Statement {
  private values: unknown[] = []

  constructor(
    private readonly table: 'movie' | 'comic' | 'player' | 'movie_source_state' | 'chapter_page_availability_current' | 'chapter_completeness_current',
    private readonly rows: Row[],
    private readonly players: PlayerRow[],
    private readonly sourceStates: SourceStateRow[],
    private readonly chapterCurrent: ChapterCurrentRow[],
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
    if (this.table === 'chapter_page_availability_current' || this.table === 'chapter_completeness_current') {
      return {
        results: this.chapterCurrent.filter(row => identifiers.includes(row.chapter_id)) as T[],
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
  observations?: ObservationRow[]
  chapterCurrent?: ChapterCurrentRow[]
}) {
  const rows = options
  return {
    $client: {
      prepare(query: string) {
        const table = query.includes('FROM movie_source_state')
          ? 'movie_source_state'
          : query.includes('FROM chapter_page_availability_current')
            ? 'chapter_page_availability_current'
            : query.includes('FROM chapter_completeness_current')
              ? 'chapter_completeness_current'
              : query.includes('FROM player')
                ? 'player'
                : query.includes('FROM movie')
                  ? 'movie'
                  : 'comic'
        return new Statement(table, rows[table as keyof typeof rows] as Row[] ?? [], rows.players ?? [], rows.sourceStates ?? [], rows.chapterCurrent ?? [])
      },
    },
    query: {
      movieSourceStates: {
        async findFirst() {
          const row = rows.sourceStates?.[0]
          if (!row)
            return undefined
          return {
            disposition: row.disposition,
            observedAt: row.observed_at,
            reasonCode: row.reason_code,
            sourceRevision: row.source_revision,
          }
        },
      },
      movieSourceObservations: {
        async findMany() {
          return (rows.observations ?? []).map(row => ({
            eligible: row.eligible,
            health: row.health,
            movieId: row.movie_id,
            observedAt: row.observed_at,
            operation: 'repair_players' as const,
            reasonCode: row.reason_code,
            sourceOrdinal: row.source_ordinal,
            sourceRevision: row.source_revision,
            sourceType: row.source_type,
          }))
        },
      },
      players: {
        async findMany() {
          return (rows.players ?? []).map(row => ({
            isActive: row.is_active,
            sourceUrl: row.source_url,
          }))
        },
      },
    },
  }
}

describe('validateReceiptCandidate', () => {
  it('creates a server-owned repair_players snapshot bound to one movie and one revision', () => {
    expect(createCrawlerTaskSnapshot({
      movieId: 'movie-repair-1',
      operation: 'repair_players',
      reason: 'no_source',
      sourceRevision: 9,
      targetIntent: 'restore_playable_sources',
    } as never)).toEqual({
      entrypoint: 'movie-crawler',
      movieId: 'movie-repair-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 9,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
  })

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

  it('accepts a chapter page receipt only after same-revision page current readback', async () => {
    const snapshot = createCrawlerTaskSnapshot({
      chapterId: 'comic-1-chapter-1',
      comicId: 'comic-1',
      finding: 'missing_page',
      operation: 'check_chapter_pages',
      policyVersion: 'chapter-page-probe/v1',
      sourceRevision: 4,
    })
    const result = await validateReceiptCandidate({
      candidate: {
        contentIds: ['comic-1'],
        templateKey: 'manga',
      },
      database: database({
        chapterCurrent: [{ chapter_id: 'comic-1-chapter-1', source_revision: 4 }],
      }),
      snapshot,
      templateKey: 'manga',
    })

    expect(result).toEqual({
      ok: true,
      receipt: {
        createdCount: 0,
        primaryContentId: 'comic-1',
        receiptSchemaVersion: 2,
        templateKey: 'manga',
        updatedCount: 1,
      },
    })
  })

  it('accepts only repair receipts whose authoritative readback matches the same movie revision and observedAt', async () => {
    const result = await validateReceiptCandidate({
      candidate: {
        movieId: 'movie-repair-7',
        observedAt: 1_725_000_111,
        operation: 'repair_players',
        request: { token: 'request-raw-sentinel' },
        runner: { stdout: 'runner-raw-sentinel' },
        signature: 'signature-raw-sentinel',
        source: { body: 'source-raw-sentinel' },
        sourceRevision: 11,
        sourceSummary: [
          {
            eligible: true,
            health: 'unverified',
            observedAt: 1_725_000_111,
            reasonCode: 'source_unverified',
            sourceType: 'direct',
          },
        ],
      } as never,
      database: database({
        movie: [{ code: 'MOV-REPAIR-7', id: 'movie-repair-7' }],
        observations: [{
          eligible: 1,
          health: 'unverified',
          movie_id: 'movie-repair-7',
          observed_at: 1_725_000_111,
          reason_code: 'source_unverified',
          source_ordinal: 0,
          source_revision: 11,
          source_type: 'direct',
        }],
        players: [{ is_active: 1, movie_id: 'movie-repair-7', source_url: 'https://source.example/raw-sentinel' }],
        sourceStates: [{
          disposition: 'ready',
          eligible_count: 1,
          movie_id: 'movie-repair-7',
          observed_at: 1_725_000_111,
          reason_code: null,
          repairable: 0,
          source_revision: 11,
        }],
      }) as never,
      templateKey: 'movie',
    } as never)

    expect(result).toEqual({
      ok: true,
      receipt: {
        movieId: 'movie-repair-7',
        observedAt: 1_725_000_111,
        operation: 'repair_players',
        sourceRevision: 11,
        sourceSummary: [
          {
            eligible: true,
            health: 'unverified',
            observedAt: 1_725_000_111,
            reasonCode: 'source_unverified',
            sourceType: 'direct',
          },
        ],
      },
    })
    expect(JSON.stringify(result)).not.toContain('raw-sentinel')
  })

  it.each([
    {
      candidate: {
        movieId: 'movie-repair-8',
        observedAt: 1_725_000_112,
        operation: 'movie',
        sourceRevision: 12,
        sourceSummary: [],
      },
      name: 'wrong operation',
    },
    {
      candidate: {
        movieId: 'movie-repair-8',
        observedAt: 1_725_000_112,
        operation: 'repair_players',
        sourceRevision: 12,
      },
      name: 'missing summary',
    },
    {
      candidate: {
        movieId: 'movie-repair-8',
        observedAt: 1_725_000_112,
        operation: 'repair_players',
        sourceRevision: 12,
        sourceSummary: [
          {
            eligible: true,
            health: 'unverified',
            observedAt: 1_725_000_112,
            reasonCode: 'source_unverified',
            sourceType: 'direct',
          },
        ],
      },
      name: 'revision mismatch',
      sourceRevision: 13,
    },
    {
      candidate: {
        contentIds: ['MOV-REPAIR-8'],
        createdCount: 1,
        sourceRevision: 12,
        templateKey: 'movie',
      },
      name: 'ordinary receipt masquerading as repair',
      snapshot: {
        movieId: 'movie-repair-8',
        operation: 'repair_players',
        reason: 'source_failed',
        sourceRevision: 12,
        targetIntent: 'restore_playable_sources',
      },
    },
  ])('$name fails closed for repair validation', async ({ candidate, snapshot, sourceRevision = 12 }) => {
    const result = await validateReceiptCandidate({
      candidate: candidate as never,
      database: database({
        movie: [{ code: 'MOV-REPAIR-8', id: 'movie-repair-8' }],
        observations: [{
          eligible: 1,
          health: 'unverified',
          movie_id: 'movie-repair-8',
          observed_at: 1_725_000_112,
          reason_code: 'source_unverified',
          source_ordinal: 0,
          source_revision: sourceRevision,
          source_type: 'direct',
        }],
        players: [{ is_active: 1, movie_id: 'movie-repair-8', source_url: 'https://source.example/repair-8' }],
        sourceStates: [{
          disposition: 'ready',
          eligible_count: 1,
          movie_id: 'movie-repair-8',
          observed_at: 1_725_000_112,
          reason_code: null,
          repairable: 0,
          source_revision: sourceRevision,
        }],
      }) as never,
      snapshot: snapshot ? createCrawlerTaskSnapshot(snapshot as never) : undefined,
      templateKey: 'movie',
    } as never)

    expect(result).toEqual({ ok: false, reason: 'receipt_missing' })
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
