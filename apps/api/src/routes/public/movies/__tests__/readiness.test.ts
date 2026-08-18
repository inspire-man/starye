import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { createServerReadinessProjection } from '../../../../domain/movies/source-contract'
import { MovieAvailabilityReadbackSchema, ReadinessProjectionSchema } from '../../../../schemas/movie'
import { getMovieByIdentifier } from '../../../movies/services/movie.service'
import { publicMoviesRoutes } from '../index'

function makeSourceState(overrides: Record<string, unknown> = {}) {
  return {
    movieId: 'movie-1',
    sourceRevision: 4,
    disposition: 'no_source' as const,
    eligibleCount: 0,
    repairable: true,
    reasonCode: 'no_eligible_source' as const,
    observedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  }
}

function makeMovie(sourceState = makeSourceState(), players: unknown[] = []) {
  return {
    id: 'movie-1',
    title: 'Test Movie',
    slug: 'test-movie',
    code: 'TEST-001',
    description: null,
    coverImage: null,
    releaseDate: null,
    duration: null,
    sourceUrl: null,
    actors: [],
    genres: null,
    series: null,
    publisher: null,
    isR18: false,
    metadataLocked: false,
    sortOrder: 0,
    viewCount: 0,
    crawlStatus: 'complete',
    lastCrawledAt: new Date('2026-08-05T00:00:00.000Z'),
    totalPlayers: players.length,
    crawledPlayers: players.length,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
    sourceState,
    movieActors: [],
    moviePublishers: [],
    players,
  }
}

function makeDb(movie: ReturnType<typeof makeMovie>, players: unknown[] = movie.players) {
  return {
    query: {
      movies: { findFirst: async () => movie },
      players: { findMany: async () => players },
      ratings: { findMany: async () => [] },
    },
  } as any
}

function makeAuthoritativeDb(movie: ReturnType<typeof makeMovie>, sourceKind?: 'direct' | 'magnet', provider: 'github-actions' | 'local-proof' = 'github-actions') {
  const current = {
    attempt_number: 2,
    content_id: 'movie-1',
    event_sequence: 4,
    freshness: 'fresh',
    id: 'current-1',
    next_action: 'none',
    observation_identity: 'availability-current-1',
    observed_at: 1_786_000_010,
    policy_version: 'video-source-probe/v1',
    projection_version: 3,
    provider,
    reason_code: 'available',
    run_id: 'run-2',
    source_revision: 4,
    status: 'available',
    summary_json: JSON.stringify({ counts: { available: 1, checked: 1 }, samples: [] }),
    target_id: 'movie-1',
    target_kind: 'movie',
    task_id: 'task-2',
    updated_at: 1_786_000_010,
  }
  const old = {
    ...current,
    event_sequence: 3,
    freshness: 'stale',
    next_action: 'recheck',
    observation_identity: 'availability-old-1',
    observed_at: 1_785_000_000,
    reason_code: 'content_missing',
    run_id: 'run-1',
    source_revision: 3,
    status: 'degraded',
    summary_json: JSON.stringify({ counts: { available: 0, checked: 1 }, samples: [{ code: 'content_missing' }] }),
    task_id: 'task-1',
  }
  const db = makeDb(movie) as any
  db.$client = {
    prepare: (sql: string) => {
      const statement = {
        all: async () => {
          if (sql.includes('FROM crawler_task AS task')) {
            return { results: [{
              attempt_number: 2,
              provider,
              receipt_schema_version: 2,
              receipt_summary_json: JSON.stringify({ movieId: 'movie-1', observedAt: 1_786_000_000, sourceRevision: 4 }),
              request_snapshot_json: JSON.stringify({
                intent: {
                  policyVersion: 'video-source-probe/v1',
                  reason: sourceKind === 'magnet' ? 'stale' : 'direct_transport_failed',
                  ...(sourceKind ? { sourceKind } : {}),
                  sourceRevision: 4,
                },
                policyVersion: 'video-source-probe/v1',
                target: { id: 'movie-1', kind: 'movie' },
              }),
              run_id: 'run-2',
              task_id: 'task-2',
            }] }
          }
          if (sql.includes('FROM crawler_availability_current'))
            return { results: [current] }
          if (sql.includes('FROM crawler_availability_observation'))
            return { results: [current, old] }
          if (sql.includes('FROM playback_evidence_summary') || sql.includes('FROM playback_evidence_rejection'))
            return { results: [] }
          return { results: [] }
        },
        bind: () => statement,
      }
      return statement
    },
  }
  return db
}

function makePublicApp(db: any) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    await next()
  })
  app.route('/', publicMoviesRoutes)
  return app
}

describe('movie readiness projection', () => {
  it('keeps public code lookup and service slug lookup on one movie identity and shape', async () => {
    const movie = makeMovie(makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }), [
      { id: 'player-1', sourceName: 'trusted', sourceUrl: 'https://media.example/movie.m3u8', isActive: true, sortOrder: 0 },
    ])
    const publicResponse = await makePublicApp(makeDb(movie)).request('/TEST-001')
    const publicBody = await publicResponse.json() as any
    const serviceMovie = await getMovieByIdentifier({
      db: makeDb(movie),
      identifier: 'test-movie',
      isAdult: true,
    })

    expect(publicResponse.status).toBe(200)
    expect(publicBody.data.primaryContentId).toBe('movie-1')
    expect(v.parse(MovieAvailabilityReadbackSchema, publicBody.data.availability)).toEqual(publicBody.data.availability)
    expect(Object.keys(publicBody.data.availability.current).sort()).toEqual(['direct', 'magnet', 'metadata', 'playback'])
    expect(publicBody.data.availability.current).toMatchObject({
      direct: null,
      magnet: null,
      metadata: { persisted: false, sourceRevision: 4 },
      playback: { status: 'unverified', tuple: null },
    })
    expect(serviceMovie?.primaryContentId).toBe('movie-1')
    expect(serviceMovie?.readiness).toEqual(publicBody.data.readiness)
  })

  it.each([
    ['no_source', 'no_eligible_source'],
    ['source_failed', 'source_write_failed'],
    ['repairing', 'repair_requested'],
  ] as const)('keeps metadata persisted independent from %s', async (disposition, reasonCode) => {
    const movie = makeMovie(makeSourceState({ disposition, reasonCode }), [
      { id: 'player-1', sourceName: 'candidate', sourceUrl: 'https://media.example/movie.m3u8', isActive: true, sortOrder: 0 },
    ])
    const result = await getMovieByIdentifier({ db: makeDb(movie), identifier: 'TEST-001', isAdult: true })

    expect(result?.readiness.metadata).toMatchObject({ contentId: 'movie-1', persisted: false })
    expect(result?.readiness.source).toMatchObject({ disposition, reasonCode })
    expect(result?.readiness.source.eligibleCount).toBe(0)
  })

  it('does not synthesize metadata persistence from movie timestamps or source success', async () => {
    const movie = makeMovie(makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }))
    const result = await getMovieByIdentifier({ db: makeDb(movie), identifier: 'TEST-001', isAdult: true })

    expect(movie.updatedAt).toBeInstanceOf(Date)
    expect(result?.readiness.metadata).toEqual({ contentId: 'movie-1', observedAt: null, persisted: false })
  })

  it('returns same-revision current and bounded old-revision history from authoritative D1 facts', async () => {
    const movie = makeMovie(makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }))
    const result = await getMovieByIdentifier({ db: makeAuthoritativeDb(movie), identifier: 'TEST-001', isAdult: true })

    expect(result?.availability.current.metadata).toEqual({ observedAt: 1_786_000_000, persisted: true, sourceRevision: 4 })
    expect(result?.availability.current.direct).toMatchObject({ sourceRevision: 4, status: 'available' })
    expect(result?.availability.current.magnet).toBeNull()
    expect(result?.availability.current.playback).toEqual({
      status: 'unverified',
      tuple: { attemptNumber: 2, provider: 'github-actions', runId: 'run-2', taskId: 'task-2' },
    })
    expect(result?.availability.history).toEqual([
      expect.objectContaining({ layer: 'direct', fact: expect.objectContaining({ freshness: 'stale', sourceRevision: 3 }) }),
    ])
    expect(result?.readiness.metadata.persisted).toBe(true)
    expect(JSON.stringify(result?.availability)).not.toMatch(/request_snapshot|receipt_summary|sourceUrl|secret|token/u)
  })

  it('reads a local-proof availability tuple through the public movie contract', async () => {
    const movie = makeMovie(makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }))
    const response = await makePublicApp(makeAuthoritativeDb(movie, 'magnet', 'local-proof')).request('/TEST-001')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(v.parse(MovieAvailabilityReadbackSchema, body.data.availability)).toEqual(body.data.availability)
    expect(body.data.availability.current.magnet).toMatchObject({ sourceRevision: 4, status: 'available' })
    expect(body.data.availability.current.direct).toBeNull()
    expect(body.data.availability.current.playback).toEqual({
      status: 'unverified',
      tuple: { attemptNumber: 2, provider: 'local-proof', runId: 'run-2', taskId: 'task-2' },
    })
  })

  it('keeps ready playback unverified and accepts verified playback only with explicit evidence', async () => {
    const result = await getMovieByIdentifier({
      db: makeDb(makeMovie(makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }), [
        { id: 'player-1', sourceName: 'trusted', sourceUrl: 'https://media.example/movie.m3u8', isActive: true, sortOrder: 0 },
      ])),
      identifier: 'TEST-001',
      isAdult: true,
    })

    expect(result?.readiness.playback).toEqual({ status: 'unverified' })

    const verified = createServerReadinessProjection({
      contentId: 'movie-1',
      metadata: { observedAt: 1, persisted: true },
      playbackEvidence: {
        artifact: { hash: 'a'.repeat(64), reference: 'phase24/task-24/run-24/attempt-1', stem: 'task-24_run-24_attempt-1' },
        contentId: 'movie-1',
        events: [
          { event: 'canplay', observed: true, observedAt: 3 },
          { event: 'playing', observed: true, observedAt: 4 },
          { event: 'waiting', observed: false, observedAt: null },
          { event: 'stalled', observed: false, observedAt: null },
          { event: 'error', observed: false, observedAt: null },
        ],
        observedAt: 5,
        outcome: 'accepted',
        playback: {
          canplay: true,
          error: false,
          playing: true,
          progress: { currentTimeAfter: 12, currentTimeBefore: 10.5, currentTimeDelta: 1.5 },
          status: 'playback_verified',
        },
        provider: { provider: 'github-actions', status: 'succeeded' },
        repair: { sourceRevision: 4, status: 'succeeded' },
        schemaVersion: 1,
        source: { revision: 4, sourceType: 'direct', status: 'ready' },
        sourceRevision: 4,
        tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-24', taskId: 'task-24' },
        viewer: { path: '/movie/movie-1', targetLabel: 'selected-production-target' },
      },
      sourceState: makeSourceState({ disposition: 'ready', eligibleCount: 1, repairable: false, reasonCode: null }),
    })
    expect(verified.playback).toEqual({
      status: 'playback_verified',
      evidence: { currentTime: 12, observedAt: 5 },
    })
  })

  it('keeps the readiness DTO bounded and schema-valid', async () => {
    const movie = makeMovie(makeSourceState({ disposition: 'source_failed', reasonCode: 'source_read_failed' }))
    const response = await makePublicApp(makeDb(movie)).request('/TEST-001')
    const body = await response.json() as any
    const readiness = body.data.readiness

    expect(v.parse(ReadinessProjectionSchema, readiness)).toEqual(readiness)
    expect(Object.keys(readiness).sort()).toEqual(['metadata', 'playback', 'receipt', 'source'])
    expect(JSON.stringify(readiness)).not.toContain('raw exception')
    expect(JSON.stringify(readiness)).not.toContain('workflow')
    expect(JSON.stringify(readiness)).not.toContain('token')
    expect(JSON.stringify(readiness)).not.toContain('signed')
    const serializedAvailability = JSON.stringify(body.data.availability)
    expect(serializedAvailability).not.toMatch(/sourceUrl|rpcUrl|secret|token|cookie|Authorization|workflow/u)
  })
})
