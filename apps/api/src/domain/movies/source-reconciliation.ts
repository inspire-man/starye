import type { Database } from '@starye/db'
import type { SourceReadinessProjection } from './source-contract'
import { movieSourceStates, players } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { deriveSourceReadiness } from './source-contract'

export interface SourcePlayerInput {
  readonly isActive?: boolean
  readonly quality?: string
  readonly sortOrder?: number
  readonly sourceName: string
  readonly sourceUrl: string
}

export interface ReconcileMovieSourcesInput {
  readonly db: Database
  readonly movieId: string
  readonly now?: () => Date
  readonly players?: readonly SourcePlayerInput[]
}

export interface ReconcileMovieSourcesResult {
  readonly source: SourceReadinessProjection
}

interface ExistingSourceState {
  readonly disposition: 'ready' | 'no_source' | 'source_failed' | 'repairing'
  readonly reasonCode: string | null
  readonly sourceRevision: number
  readonly observedAt: Date | number
}

interface ReadbackPlayer {
  readonly isActive: boolean | number | null
  readonly sourceUrl: string | null
}

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function boundedRevision(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000
    ? value
    : 0
}

function observedSeconds(value: Date | number | null | undefined, fallback: number): number {
  if (value instanceof Date)
    return seconds(value)
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback
}

function asCandidates(rows: readonly ReadbackPlayer[]) {
  return rows.map(row => ({
    isActive: row.isActive === true || row.isActive === 1,
    sourceUrl: row.sourceUrl,
  }))
}

function failureProjection(reasonCode: 'source_read_failed' | 'source_write_failed', revision: number, observedAt: number) {
  return deriveSourceReadiness({
    candidates: [],
    failure: { reasonCode },
    observedAt,
    sourceRevision: revision,
  })
}

async function readState(db: Database, movieId: string): Promise<ExistingSourceState | undefined> {
  const row = await db.query.movieSourceStates.findFirst({
    where: eq(movieSourceStates.movieId, movieId),
    columns: {
      disposition: true,
      reasonCode: true,
      sourceRevision: true,
      observedAt: true,
    },
  })
  return row as ExistingSourceState | undefined
}

async function readPlayers(db: Database, movieId: string): Promise<ReadbackPlayer[]> {
  const rows = await db.query.players.findMany({
    where: eq(players.movieId, movieId),
    columns: { isActive: true, sourceUrl: true },
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
  })
  return rows as ReadbackPlayer[]
}

async function persistState(
  db: Database,
  movieId: string,
  source: SourceReadinessProjection,
  observedAt: Date,
): Promise<void> {
  await db.insert(movieSourceStates).values({
    movieId,
    sourceRevision: source.sourceRevision,
    disposition: source.disposition,
    eligibleCount: source.eligibleCount,
    repairable: source.repairable,
    reasonCode: source.reasonCode,
    observedAt,
  }).onConflictDoUpdate({
    target: movieSourceStates.movieId,
    set: {
      sourceRevision: source.sourceRevision,
      disposition: source.disposition,
      eligibleCount: source.eligibleCount,
      repairable: source.repairable,
      reasonCode: source.reasonCode,
      observedAt,
    },
  })
}

function uniquePlayers(input: readonly SourcePlayerInput[]): SourcePlayerInput[] {
  const seen = new Set<string>()
  const result: SourcePlayerInput[] = []
  for (const player of input) {
    const sourceUrl = typeof player.sourceUrl === 'string' ? player.sourceUrl.trim() : ''
    if (!sourceUrl || player.isActive === false || seen.has(sourceUrl))
      continue
    seen.add(sourceUrl)
    result.push({ ...player, sourceUrl })
  }
  return result
}

/**
 * Replaces source rows only for an explicit player result, then derives the
 * source projection from fresh rows keyed by the canonical movie id.
 */
export async function reconcileMovieSources(input: ReconcileMovieSourcesInput): Promise<ReconcileMovieSourcesResult> {
  const now = input.now ?? (() => new Date())
  const observedAtDate = now()
  const observedAt = seconds(observedAtDate)
  let existingState: ExistingSourceState | undefined
  let stateReadFailed = false

  try {
    existingState = await readState(input.db, input.movieId)
  }
  catch {
    stateReadFailed = true
  }

  const previousRevision = boundedRevision(existingState?.sourceRevision)
  const sourceRevision = input.players === undefined ? previousRevision : previousRevision + 1
  let operation: 'source_read_failed' | 'source_write_failed' = 'source_read_failed'

  try {
    if (input.players !== undefined) {
      operation = 'source_write_failed'
      await input.db.delete(players).where(eq(players.movieId, input.movieId))
      const values = uniquePlayers(input.players).map((player, index) => ({
        id: crypto.randomUUID(),
        movieId: input.movieId,
        sourceName: player.sourceName,
        sourceUrl: player.sourceUrl,
        quality: player.quality ?? null,
        sortOrder: player.sortOrder ?? index,
        ...(player.isActive !== undefined ? { isActive: player.isActive } : {}),
      }))
      if (values.length > 0)
        await input.db.insert(players).values(values)
    }

    operation = 'source_read_failed'
    const readback = await readPlayers(input.db, input.movieId)
    const source = deriveSourceReadiness({
      candidates: asCandidates(readback),
      failure: stateReadFailed ? { reasonCode: 'source_read_failed' } : undefined,
      observedAt: input.players === undefined
        ? observedSeconds(existingState?.observedAt, observedAt)
        : observedAt,
      repairRequested: existingState?.disposition === 'repairing',
      sourceRevision,
    })

    if (input.players !== undefined) {
      operation = 'source_write_failed'
      await persistState(input.db, input.movieId, source, observedAtDate)
    }

    return { source }
  }
  catch {
    const source = failureProjection(operation, sourceRevision, observedAt)
    try {
      await persistState(input.db, input.movieId, source, observedAtDate)
    }
    catch {
      // The bounded projection remains the caller-visible result if D1 is unavailable.
    }
    return { source }
  }
}
