import type { Database } from '@starye/db'
import type { SourceHealthReasonCode, SourceReadinessProjection, SourceType } from './source-contract'
import { movieSourceObservations, movieSourceStates, players } from '@starye/db/schema'
import { and, eq } from 'drizzle-orm'
import { clearGatewayCacheGroup } from '../../lib/gateway-cache'
import { deriveSourceReadiness, isEligiblePlayer, projectSourceHealth } from './source-contract'

export interface SourcePlayerInput {
  readonly isActive?: boolean
  readonly quality?: string
  readonly sortOrder?: number
  readonly sourceName: string
  readonly sourceUrl: string
}

export interface RepairSourceObservationInput extends SourcePlayerInput {
  readonly health?: 'inactive' | 'unverified' | 'failed'
  readonly reasonCode?: SourceHealthReasonCode
  readonly sourceType?: SourceType | null
}

export interface AcceptRepairSourceObservationInput {
  readonly db: Database
  readonly movieId: string
  readonly operation: 'repair_players'
  readonly runId: string
  readonly attemptNumber: number
  readonly sequence: number
  readonly eventId: string
  /** The revision in the server-owned movie_source_state before this observation. */
  readonly expectedSourceRevision: number
  readonly observedAt?: Date
  readonly now?: () => Date
  readonly sources: readonly RepairSourceObservationInput[]
  readonly gatewayCache?: KVNamespace
  readonly clearApiDetailCache?: () => Promise<void>
  readonly clearGatewayCacheGroup?: (group: 'movies') => Promise<number | void>
}

export interface RepairSourceReadback {
  readonly movieId: string
  readonly sourceRevision: number
  readonly observedAt: number
  readonly sources: ReadonlyArray<{
    readonly eligible: boolean
    readonly health: 'inactive' | 'unverified' | 'failed'
    readonly observedAt: number
    readonly reasonCode: SourceHealthReasonCode
    readonly sourceType: SourceType
  }>
  readonly summary: {
    readonly sourceCount: number
    readonly eligibleCount: number
  }
}

export interface ReadRepairSourceReadbackInput {
  readonly db: Database
  readonly movieId: string
  readonly sourceRevision: number
}

export type RepairObservationOutcome = 'accepted' | 'duplicate' | 'stale' | 'source_failed'
export type RepairObservationErrorCode = 'source_stale' | 'source_write_failed' | 'source_read_failed'

export interface RepairSourceObservationResult {
  readonly outcome: RepairObservationOutcome
  readonly repairable: boolean
  readonly errorCode?: RepairObservationErrorCode
  readonly source: SourceReadinessProjection
  readonly readback: RepairSourceReadback | null
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

interface PersistedSourceObservation {
  readonly movieId: string
  readonly operation: 'source_read' | 'repair_players'
  readonly sourceRevision: number
  readonly sourceOrdinal: number
  readonly sourceType: SourceType
  readonly health: 'inactive' | 'unverified' | 'failed'
  readonly observedAt: Date | number
  readonly reasonCode: SourceHealthReasonCode
  readonly eligible: boolean | number
}

type ReconciliationDb = Pick<Database, 'query' | 'insert' | 'update' | 'delete'>

const MAX_REPAIR_SOURCE_ROWS = 50
const MAX_REPAIR_FIELD_LENGTH = 4096

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

function stateProjection(state: ExistingSourceState | undefined, fallbackObservedAt: number): SourceReadinessProjection {
  if (!state) {
    return deriveSourceReadiness({
      candidates: [],
      observedAt: fallbackObservedAt,
      sourceRevision: 0,
    })
  }

  return {
    disposition: state.disposition,
    eligibleCount: 0,
    observedAt: observedSeconds(state.observedAt, fallbackObservedAt),
    reasonCode: state.reasonCode as SourceReadinessProjection['reasonCode'],
    repairable: state.disposition !== 'ready',
    sourceRevision: boundedRevision(state.sourceRevision),
  }
}

function validBoundedValue(value: string): boolean {
  return value.length <= MAX_REPAIR_FIELD_LENGTH
}

function validIdentifier(value: string): boolean {
  return value.trim().length > 0 && validBoundedValue(value)
}

function inferSourceType(source: RepairSourceObservationInput): SourceType {
  if (source.sourceType === 'direct' || source.sourceType === 'magnet' || source.sourceType === 'TorrServer')
    return source.sourceType
  return source.sourceUrl.trim().toLowerCase().startsWith('magnet:') ? 'magnet' : 'direct'
}

function normalizedRepairSources(sources: readonly RepairSourceObservationInput[]): RepairSourceObservationInput[] {
  if (sources.length > MAX_REPAIR_SOURCE_ROWS)
    throw new Error('repair source row limit exceeded')

  return sources.map((source) => {
    if (!validBoundedValue(source.sourceUrl))
      throw new Error('repair source URL is not bounded')
    return {
      ...source,
      sourceName: source.sourceName.trim().slice(0, 200),
      sourceUrl: source.sourceUrl.trim(),
      sourceType: inferSourceType(source),
    }
  })
}

function sourceHealthRows(sources: readonly RepairSourceObservationInput[], observedAt: number) {
  return sources.map((source) => {
    const isActive = source.isActive === undefined ? true : source.isActive
    const projection = projectSourceHealth({
      health: source.health,
      isActive,
      observedAt,
      reasonCode: source.reasonCode,
      sourceType: inferSourceType(source),
      sourceUrl: source.sourceUrl,
    })
    return {
      ...projection,
      eligible: projection.health !== 'failed' && isEligiblePlayer({ isActive, sourceUrl: source.sourceUrl }),
    }
  })
}

function sourceReadinessFromRows(
  sources: readonly RepairSourceObservationInput[],
  healthRows: ReturnType<typeof sourceHealthRows>,
  observedAt: number,
  sourceRevision: number,
): SourceReadinessProjection {
  const candidates = sources.map(source => ({
    isActive: source.isActive === undefined ? true : source.isActive,
    sourceUrl: source.sourceUrl,
  }))
  const allFailed = healthRows.length > 0 && healthRows.every(row => row.health === 'failed')
  return deriveSourceReadiness({
    candidates,
    failure: allFailed ? { reasonCode: 'source_read_failed' } : undefined,
    observedAt,
    sourceRevision,
  })
}

async function readObservationIdentity(
  db: ReconciliationDb,
  input: Pick<AcceptRepairSourceObservationInput, 'movieId' | 'runId' | 'eventId'>,
): Promise<PersistedSourceObservation | undefined> {
  const row = await db.query.movieSourceObservations.findFirst({
    where: and(
      eq(movieSourceObservations.movieId, input.movieId),
      eq(movieSourceObservations.runId, input.runId),
      eq(movieSourceObservations.eventId, input.eventId),
    ),
  })
  return row as PersistedSourceObservation | undefined
}

async function readPersistedObservations(
  db: ReconciliationDb,
  movieId: string,
  sourceRevision: number,
): Promise<PersistedSourceObservation[]> {
  const rows = await db.query.movieSourceObservations.findMany({
    where: and(
      eq(movieSourceObservations.movieId, movieId),
      eq(movieSourceObservations.sourceRevision, sourceRevision),
    ),
    orderBy: (table, { asc }) => [asc(table.sourceOrdinal)],
    limit: MAX_REPAIR_SOURCE_ROWS,
  })
  return (rows as PersistedSourceObservation[]).filter(row => row.movieId === movieId && row.sourceRevision === sourceRevision)
}

function boundedReadbackSource(row: PersistedSourceObservation) {
  return {
    eligible: row.eligible === true || row.eligible === 1,
    health: row.health,
    observedAt: observedSeconds(row.observedAt, 0),
    reasonCode: row.reasonCode,
    sourceType: row.sourceType,
  }
}

async function readState(db: ReconciliationDb, movieId: string): Promise<ExistingSourceState | undefined> {
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

async function readPlayers(db: ReconciliationDb, movieId: string): Promise<ReadbackPlayer[]> {
  const rows = await db.query.players.findMany({
    where: eq(players.movieId, movieId),
    columns: { isActive: true, sourceUrl: true },
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
  })
  return rows as ReadbackPlayer[]
}

/**
 * Reads only persisted source facts for one movie/revision. Player rows are
 * checked as part of the authoritative readback, but their raw URLs never
 * leave this module.
 */
export async function readRepairSourceReadback(input: Omit<ReadRepairSourceReadbackInput, 'db'> & { readonly db: ReconciliationDb }): Promise<RepairSourceReadback> {
  const state = await readState(input.db, input.movieId)
  if (!state || boundedRevision(state.sourceRevision) !== boundedRevision(input.sourceRevision))
    throw new Error('source readback revision mismatch')

  const playersRows = await readPlayers(input.db, input.movieId)
  if (playersRows.length > MAX_REPAIR_SOURCE_ROWS)
    throw new Error('source readback row limit exceeded')

  const observations = await readPersistedObservations(input.db, input.movieId, input.sourceRevision)
  const sources = observations.map(boundedReadbackSource)
  const observedAt = observedSeconds(state.observedAt, 0)
  return {
    movieId: input.movieId,
    sourceRevision: boundedRevision(state.sourceRevision),
    observedAt,
    sources,
    summary: {
      sourceCount: sources.length,
      eligibleCount: sources.filter(source => source.eligible).length,
    },
  }
}

function failedObservationResult(
  source: SourceReadinessProjection,
  errorCode: RepairObservationErrorCode,
): RepairSourceObservationResult {
  return {
    outcome: 'source_failed',
    repairable: true,
    errorCode,
    source,
    readback: null,
  }
}

/**
 * Accepts one server-validated repair observation. All player, fact, and
 * current-projection writes share one D1 transaction; public output is built
 * only from the committed state and bounded observation facts.
 */
export async function acceptRepairSourceObservation(
  input: AcceptRepairSourceObservationInput,
): Promise<RepairSourceObservationResult> {
  const now = input.now ?? (() => new Date())
  const observedAtDate = input.observedAt ?? now()
  const observedAt = seconds(observedAtDate)
  const currentRevision = boundedRevision(input.expectedSourceRevision)
  let persistedState: ExistingSourceState | undefined

  if (input.operation !== 'repair_players'
    || !validIdentifier(input.movieId)
    || !validIdentifier(input.runId)
    || !validIdentifier(input.eventId)
    || !Number.isSafeInteger(input.attemptNumber)
    || input.attemptNumber < 1
    || !Number.isSafeInteger(input.sequence)
    || input.sequence < 1
    || !Number.isSafeInteger(input.expectedSourceRevision)
    || input.expectedSourceRevision < 0) {
    return failedObservationResult(failureProjection('source_write_failed', currentRevision, observedAt), 'source_write_failed')
  }

  let sources: RepairSourceObservationInput[]
  try {
    sources = normalizedRepairSources(input.sources)
  }
  catch (error) {
    console.error('[SourceReconciliation] bounded repair observation rejected', error)
    return failedObservationResult(failureProjection('source_write_failed', currentRevision, observedAt), 'source_write_failed')
  }

  try {
    const writeResult = await input.db.transaction(async (tx) => {
      persistedState = await readState(tx, input.movieId)
      const existingObservation = await readObservationIdentity(tx, input)
      if (existingObservation) {
        return { kind: 'duplicate' as const, revision: boundedRevision(existingObservation.sourceRevision) }
      }

      const persistedRevision = boundedRevision(persistedState?.sourceRevision)
      if (persistedRevision !== currentRevision) {
        return { kind: 'stale' as const, revision: persistedRevision }
      }

      const nextRevision = currentRevision + 1
      const healthRows = sourceHealthRows(sources, observedAt)
      const source = sourceReadinessFromRows(sources, healthRows, observedAt, nextRevision)

      if (persistedState) {
        const updateResult = await tx.update(movieSourceStates)
          .set({
            sourceRevision: source.sourceRevision,
            disposition: source.disposition,
            eligibleCount: source.eligibleCount,
            repairable: source.repairable,
            reasonCode: source.reasonCode,
            observedAt: observedAtDate,
          })
          .where(and(
            eq(movieSourceStates.movieId, input.movieId),
            eq(movieSourceStates.sourceRevision, currentRevision),
          ))
        const changes = (updateResult as { meta?: { changes?: number } } | undefined)?.meta?.changes
        if (changes === 0)
          return { kind: 'stale' as const, revision: boundedRevision((await readState(tx, input.movieId))?.sourceRevision) }
      }
      else {
        await tx.insert(movieSourceStates).values({
          movieId: input.movieId,
          sourceRevision: source.sourceRevision,
          disposition: source.disposition,
          eligibleCount: source.eligibleCount,
          repairable: source.repairable,
          reasonCode: source.reasonCode,
          observedAt: observedAtDate,
        })
      }

      await tx.delete(players).where(eq(players.movieId, input.movieId))
      const playerValues = sources.map((source, index) => ({
        id: crypto.randomUUID(),
        movieId: input.movieId,
        sourceName: source.sourceName.trim().slice(0, 200) || 'repair-source',
        sourceUrl: source.sourceUrl.trim(),
        quality: source.quality?.slice(0, 200) ?? null,
        sortOrder: source.sortOrder ?? index,
        isActive: source.isActive !== false,
      }))
      if (playerValues.length > 0)
        await tx.insert(players).values(playerValues)

      const observationValues = healthRows.map((health, sourceOrdinal) => ({
        id: crypto.randomUUID(),
        movieId: input.movieId,
        operation: input.operation,
        runId: input.runId,
        attemptNumber: input.attemptNumber,
        sequence: input.sequence,
        eventId: input.eventId,
        sourceRevision: nextRevision,
        sourceOrdinal,
        sourceType: health.sourceType,
        health: health.health,
        observedAt: observedAtDate,
        reasonCode: health.reasonCode,
        eligible: health.eligible,
      }))
      if (observationValues.length > 0)
        await tx.insert(movieSourceObservations).values(observationValues)

      return { kind: 'accepted' as const, revision: nextRevision, source }
    })

    const resultSource = writeResult.kind === 'accepted'
      ? writeResult.source
      : stateProjection(persistedState, observedAt)
    let readback: RepairSourceReadback | null = null
    try {
      readback = await readRepairSourceReadback({
        db: input.db,
        movieId: input.movieId,
        sourceRevision: writeResult.revision,
      })
    }
    catch (error) {
      console.error('[SourceReconciliation] authoritative repair readback failed', error)
      return failedObservationResult(failureProjection('source_read_failed', writeResult.revision, observedAt), 'source_read_failed')
    }

    if (writeResult.kind !== 'accepted') {
      return {
        outcome: writeResult.kind,
        repairable: true,
        errorCode: writeResult.kind === 'stale' ? 'source_stale' : undefined,
        source: resultSource,
        readback,
      }
    }

    try {
      if (input.clearApiDetailCache)
        await input.clearApiDetailCache()
      if (input.clearGatewayCacheGroup)
        await input.clearGatewayCacheGroup('movies')
      else
        await clearGatewayCacheGroup(input.gatewayCache, 'movies')
    }
    catch (error) {
      console.error('[SourceReconciliation] repair cache invalidation failed', error)
      return failedObservationResult(failureProjection('source_read_failed', writeResult.revision, observedAt), 'source_read_failed')
    }

    return {
      outcome: 'accepted',
      repairable: writeResult.source.repairable,
      source: writeResult.source,
      readback,
    }
  }
  catch (error) {
    console.error('[SourceReconciliation] repair observation write failed', error)
    return failedObservationResult(failureProjection('source_write_failed', currentRevision, observedAt), 'source_write_failed')
  }
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
