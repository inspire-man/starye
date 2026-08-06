import type { Database } from '@starye/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptRepairSourceObservation,
  readRepairSourceReadback,
} from '../source-reconciliation'

interface FakeState {
  sourceState: any
  players: any[]
  observations: any[]
}

const observationInput = {
  db: undefined as unknown as Database,
  movieId: 'movie-1',
  operation: 'repair_players' as const,
  runId: 'run-1',
  attemptNumber: 1,
  sequence: 1,
  eventId: 'event-1',
  expectedSourceRevision: 0,
  observedAt: new Date(1710000000 * 1000),
  sources: [
    { sourceName: 'direct', sourceUrl: 'https://source.example/raw-sentinel', sourceType: 'direct' as const, isActive: true },
    { sourceName: 'magnet', sourceUrl: 'magnet:?xt=urn:btih/raw-sentinel', sourceType: 'magnet' as const, isActive: true },
    { sourceName: 'inactive', sourceUrl: 'https://inactive.example/raw-sentinel', sourceType: 'TorrServer' as const, isActive: false },
    { sourceName: 'blank', sourceUrl: '   ', sourceType: 'direct' as const, isActive: true },
  ],
}

function createFakeDb(options: {
  sourceRevision?: number
  players?: any[]
  observations?: any[]
  failWrite?: boolean
  failReadback?: boolean
} = {}): Database {
  const state: FakeState = {
    sourceState: options.sourceRevision === undefined
      ? null
      : {
          movieId: 'movie-1',
          sourceRevision: options.sourceRevision,
          disposition: 'no_source',
          eligibleCount: 0,
          repairable: true,
          reasonCode: 'no_eligible_source',
          observedAt: new Date(1710000000 * 1000),
        },
    players: [...(options.players ?? [])],
    observations: [...(options.observations ?? [])],
  }

  const insertChain = {
    values: vi.fn().mockImplementation((values: any) => {
      if (options.failWrite)
        throw new Error('DB constraint error token=raw')
      const rows = Array.isArray(values) ? values : [values]
      if (rows[0]?.eventId)
        state.observations.push(...rows)
      else if (rows[0]?.sourceName)
        state.players = rows
      else if (rows[0]?.disposition)
        state.sourceState = rows[0]
      return insertChain
    }),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  }

  const nativeClient = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({}),
    }),
    batch: vi.fn().mockImplementation(async (statements: readonly unknown[]) => {
      if (options.failWrite)
        throw new Error('D1 batch constraint error token=raw')

      const eligibleSources = observationInput.sources.filter(source => source.isActive !== false && source.sourceUrl.trim().length > 0)
      const nextRevision = (state.sourceState?.sourceRevision ?? 0) + 1
      state.sourceState = {
        ...(state.sourceState ?? { movieId: 'movie-1' }),
        sourceRevision: nextRevision,
        disposition: eligibleSources.length > 0 ? 'ready' : 'no_source',
        eligibleCount: eligibleSources.length,
        repairable: eligibleSources.length === 0,
        reasonCode: eligibleSources.length > 0 ? null : 'no_eligible_source',
        observedAt: new Date(1710000000 * 1000),
      }
      state.players = observationInput.sources.map((source, index) => ({
        isActive: source.isActive !== false,
        sourceUrl: source.sourceUrl.trim(),
        sortOrder: index,
      }))
      state.observations = observationInput.sources.map((source, sourceOrdinal) => ({
        movieId: 'movie-1',
        operation: 'repair_players',
        runId: 'run-1',
        eventId: 'event-1',
        sourceRevision: nextRevision,
        sourceOrdinal,
        sourceType: source.sourceType ?? 'direct',
        health: source.isActive === false ? 'inactive' : 'unverified',
        observedAt: new Date(1710000000 * 1000),
        reasonCode: source.isActive === false
          ? 'source_inactive'
          : source.sourceUrl.trim().length > 0 ? 'source_unverified' : 'source_candidate_invalid',
        eligible: source.isActive !== false && source.sourceUrl.trim().length > 0,
      }))
      return statements.map(() => ({ meta: { changes: 1 } }))
    }),
  }

  const db = {
    query: {
      movieSourceStates: {
        findFirst: vi.fn().mockImplementation(async () => state.sourceState),
      },
      movieSourceObservations: {
        findFirst: vi.fn().mockImplementation(async () => state.observations[0]),
        findMany: vi.fn().mockImplementation(async () => state.observations),
      },
      players: {
        findMany: vi.fn().mockImplementation(async () => {
          if (options.failReadback)
            throw new Error('readback exception token=raw')
          return [...state.players]
        }),
      },
    },
    transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(db)),
    $client: nativeClient,
    run: vi.fn().mockReturnValue({ getQuery: vi.fn().mockReturnValue({ sql: '', params: [] }) }),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          state.sourceState = { ...state.sourceState }
          return { meta: { changes: 1 } }
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(async () => {
        state.players = []
      }),
    }),
  }

  return db as unknown as Database
}

describe('repair source reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts one movie observation, increments revision, and returns persisted bounded readback', async () => {
    const db = createFakeDb()
    const result = await acceptRepairSourceObservation({ ...observationInput, db })

    expect(result.outcome).toBe('accepted')
    expect(result.readback).toMatchObject({ movieId: 'movie-1', sourceRevision: 1 })
    expect(result.readback?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'direct', health: 'unverified', eligible: true }),
      expect.objectContaining({ sourceType: 'magnet', health: 'unverified', eligible: true }),
      expect.objectContaining({ sourceType: 'TorrServer', health: 'inactive', eligible: false }),
      expect.objectContaining({ reasonCode: 'source_candidate_invalid', eligible: false }),
    ]))
    expect(JSON.stringify(result)).not.toContain('raw-sentinel')
  })

  it('returns duplicate for an exact event replay without another revision', async () => {
    const db = createFakeDb({
      sourceRevision: 1,
      observations: [{
        movieId: 'movie-1',
        operation: 'repair_players',
        runId: 'run-1',
        eventId: 'event-1',
        sourceRevision: 1,
        sourceOrdinal: 0,
        sourceType: 'direct',
        health: 'unverified',
        observedAt: new Date(1710000000 * 1000),
        reasonCode: 'source_unverified',
        eligible: true,
      }],
    })
    const result = await acceptRepairSourceObservation({ ...observationInput, db, expectedSourceRevision: 1 })

    expect(result.outcome).toBe('duplicate')
    expect(result.readback?.sourceRevision).toBe(1)
  })

  it('returns stale for an older expected revision and keeps current projection', async () => {
    const db = createFakeDb({ sourceRevision: 3 })
    const result = await acceptRepairSourceObservation({ ...observationInput, db, expectedSourceRevision: 2 })

    expect(result.outcome).toBe('stale')
    expect(result.errorCode).toBe('source_stale')
    expect(result.source.sourceRevision).toBe(3)
  })

  it('maps write and authoritative readback failures to bounded results', async () => {
    const writeResult = await acceptRepairSourceObservation({ ...observationInput, db: createFakeDb({ failWrite: true }) })
    expect(writeResult).toMatchObject({ outcome: 'source_failed', errorCode: 'source_write_failed', repairable: true })
    expect(JSON.stringify(writeResult)).not.toContain('DB constraint error')

    const readResult = await acceptRepairSourceObservation({ ...observationInput, db: createFakeDb({ failReadback: true }) })
    expect(readResult).toMatchObject({ outcome: 'source_failed', errorCode: 'source_read_failed', repairable: true })
    expect(JSON.stringify(readResult)).not.toContain('readback exception')
  })

  it('clears API detail and Gateway movies cache only after accepted readback', async () => {
    const clearApiDetailCache = vi.fn().mockResolvedValue(undefined)
    const clearGatewayCache = vi.fn().mockResolvedValue(1)
    const result = await acceptRepairSourceObservation({
      ...observationInput,
      db: createFakeDb(),
      clearApiDetailCache,
      clearGatewayCacheGroup: clearGatewayCache,
    })

    expect(result.outcome).toBe('accepted')
    expect(clearApiDetailCache).toHaveBeenCalledOnce()
    expect(clearGatewayCache).toHaveBeenCalledWith('movies')
  })

  it('readback is authoritative for one movie and one persisted revision', async () => {
    const db = createFakeDb({
      sourceRevision: 4,
      observations: [{
        movieId: 'movie-1',
        operation: 'repair_players',
        runId: 'run-4',
        eventId: 'event-4',
        sourceRevision: 4,
        sourceOrdinal: 0,
        sourceType: 'magnet',
        health: 'unverified',
        observedAt: new Date(1710000000 * 1000),
        reasonCode: 'source_unverified',
        eligible: true,
      }],
    })
    const readback = await readRepairSourceReadback({ db, movieId: 'movie-1', sourceRevision: 4 })

    expect(readback).toMatchObject({ movieId: 'movie-1', sourceRevision: 4 })
    expect(readback.sources).toEqual([expect.objectContaining({ sourceType: 'magnet', health: 'unverified' })])
  })
})
