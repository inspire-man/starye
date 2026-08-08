import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { createServerReadinessProjection } from '../../../../domain/movies/source-contract'
import { ReadinessProjectionSchema } from '../../../../schemas/movie'
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

    expect(result?.readiness.metadata).toMatchObject({ contentId: 'movie-1', persisted: true })
    expect(result?.readiness.source).toMatchObject({ disposition, reasonCode })
    expect(result?.readiness.source.eligibleCount).toBe(0)
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
      metadataObservedAt: 1,
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
  })
})
