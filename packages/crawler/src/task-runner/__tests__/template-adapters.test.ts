import { describe, expect, it } from 'vitest'
import { createControlledAdapter } from '../controlled-adapter'
import { createRepairPlayersAdapter } from '../repair-adapter'
import { createTemplateAdapterRegistry } from '../template-adapters'

describe('task runner template registry', () => {
  it('accepts only matching movie and manga snapshots', () => {
    const movie = { execute: async () => ({ contentIds: [] }), templateKey: 'movie' as const }
    const manga = { execute: async () => ({ contentIds: [] }), templateKey: 'manga' as const }
    const registry = createTemplateAdapterRegistry([movie, manga])
    expect(registry.select({ entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 })).toBe(movie)
    expect(() => registry.select({ entrypoint: 'manga-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 })).toThrow('does not match')
  })

  it('keeps the controlled cancellation adapter out of the public registry', async () => {
    const controlled = createControlledAdapter([])
    expect(controlled.templateKey).toBe('movie')
    await expect(controlled.execute({ candidate: {} as never, checkpoint: async () => true, observe: () => {} })).resolves.toEqual({ contentIds: [] })
  })

  it('selects repair_players by operation before the movie template fallback', () => {
    const movie = { execute: async () => ({ contentIds: [] }), templateKey: 'movie' as const }
    const manga = { execute: async () => ({ contentIds: [] }), templateKey: 'manga' as const }
    const repair = createRepairPlayersAdapter({ sources: [] })
    const registry = createTemplateAdapterRegistry([movie, manga, repair])

    expect(registry.select({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 4,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })).toBe(repair)
    expect(() => registry.select({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 4,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    } as never)).toThrow('operation is missing')
  })

  it('fails closed when a repair operation has no dedicated adapter', () => {
    const movie = { execute: async () => ({ contentIds: [] }), templateKey: 'movie' as const }
    const registry = createTemplateAdapterRegistry([movie])
    expect(() => registry.select({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'source_failed',
      sourceRevision: 4,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })).toThrow('Unsupported runner operation')
  })

  it('returns only the bounded authoritative repair receipt from the adapter', async () => {
    const rawSource = 'https://source.example/raw-sentinel.m3u8'
    const client = {
      observeRepairSource: async () => ({
        accepted: true,
        readback: {
          movieId: 'movie-1',
          observedAt: 1_720_000_000,
          sourceRevision: 8,
          sources: [{ eligible: true, health: 'unverified' as const, observedAt: 1_720_000_000, reasonCode: 'source_unverified' as const, sourceType: 'direct' as const }],
          summary: { eligibleCount: 1, sourceCount: 1 },
        },
        receipt: {
          movieId: 'movie-1',
          observedAt: 1_720_000_000,
          operation: 'repair_players' as const,
          sourceRevision: 8,
          sourceSummary: [{ eligible: true, health: 'unverified' as const, observedAt: 1_720_000_000, reasonCode: 'source_unverified' as const, sourceType: 'direct' as const }],
        },
      }),
    }
    const adapter = createRepairPlayersAdapter({
      sources: [{ sourceName: 'line-1', sourceType: 'direct', sourceUrl: rawSource }],
    })

    const result = await adapter.execute({
      candidate: {
        attempt: 1,
        runId: 'run-1',
        sequence: 2,
        snapshot: {
          entrypoint: 'movie-crawler',
          movieId: 'movie-1',
          operation: 'repair_players',
          permissionResource: 'movie',
          reason: 'no_source',
          sourceRevision: 7,
          targetIntent: 'restore_playable_sources',
          templateKey: 'movie',
          templateVersion: 1,
        },
      },
      checkpoint: async () => false,
      client,
      nextSequence: () => 3,
      observe: () => {},
    })

    expect(result).toEqual({
      contentIds: [],
      repairReceipt: {
        movieId: 'movie-1',
        observedAt: 1_720_000_000,
        operation: 'repair_players',
        sourceRevision: 8,
        sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 1_720_000_000, reasonCode: 'source_unverified', sourceType: 'direct' }],
      },
    })
    expect(JSON.stringify(result)).not.toContain(rawSource)
  })

  it('fails an empty repair source set before sending an observation', async () => {
    let observationCalls = 0
    let sequenceCalls = 0
    const adapter = createRepairPlayersAdapter({ sources: [] })

    const result = await adapter.execute({
      candidate: {
        attempt: 1,
        runId: 'run-empty-repair',
        sequence: 2,
        snapshot: {
          entrypoint: 'movie-crawler',
          movieId: 'movie-1',
          operation: 'repair_players',
          permissionResource: 'movie',
          reason: 'no_source',
          sourceRevision: 7,
          targetIntent: 'restore_playable_sources',
          templateKey: 'movie',
          templateVersion: 1,
        },
      },
      checkpoint: async () => false,
      client: {
        observeRepairSource: async () => {
          observationCalls += 1
          throw new Error('observation should not be sent')
        },
      },
      nextSequence: () => {
        sequenceCalls += 1
        return 3
      },
      observe: () => {},
    })

    expect(result).toEqual({ contentIds: [], failureCode: 'receipt_missing' })
    expect(observationCalls).toBe(0)
    expect(sequenceCalls).toBe(0)
  })
})
