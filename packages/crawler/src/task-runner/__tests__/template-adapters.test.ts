import { describe, expect, it, vi } from 'vitest'
import { createChapterAvailabilityAdapter } from '../chapter-availability-adapter'
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

  it('selects magnet video operations without changing legacy fallback', () => {
    const movie = { execute: async () => ({ contentIds: [] }), templateKey: 'movie' as const }
    const magnet = { execute: async () => ({ contentIds: [] }), operation: 'video_magnet' as const, templateKey: 'movie' as const }
    const registry = createTemplateAdapterRegistry([movie, magnet])
    const snapshot = {
      entrypoint: 'movie-crawler' as const,
      movieId: 'movie-1',
      movieRevision: 4,
      operation: 'recheck_video_source' as const,
      permissionResource: 'movie' as const,
      policyVersion: 'video-source-probe/v1',
      reason: 'no_peer' as const,
      sourceRevision: 7,
      templateKey: 'movie' as const,
      templateVersion: 1 as const,
    }

    expect(registry.select(snapshot)).toBe(magnet)
    expect(registry.select({ entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 })).toBe(movie)
    expect(() => registry.select({ ...snapshot, reason: 'direct_blocked' } as never)).toThrow('source kind')
  })

  it('uses an explicit source kind to route stale video checks', () => {
    const direct = { execute: async () => ({ contentIds: [] }), operation: 'video_direct' as const, templateKey: 'movie' as const }
    const magnet = { execute: async () => ({ contentIds: [] }), operation: 'video_magnet' as const, templateKey: 'movie' as const }
    const registry = createTemplateAdapterRegistry([direct, magnet])

    expect(registry.select({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      movieRevision: 4,
      operation: 'recheck_video_source',
      permissionResource: 'movie',
      policyVersion: 'video-source-probe/v1',
      reason: 'stale',
      sourceKind: 'magnet',
      sourceRevision: 7,
      templateKey: 'movie',
      templateVersion: 1,
    } as never)).toBe(magnet)
  })

  it('rejects malformed repair snapshot contracts before adapter selection', () => {
    const repair = createRepairPlayersAdapter({ sources: [] })
    const registry = createTemplateAdapterRegistry([repair])
    const snapshot = {
      entrypoint: 'movie-crawler' as const,
      movieId: 'movie-1',
      operation: 'repair_players' as const,
      permissionResource: 'movie' as const,
      reason: 'no_source' as const,
      sourceRevision: 4,
      targetIntent: 'restore_playable_sources' as const,
      templateKey: 'movie' as const,
      templateVersion: 1 as const,
    }

    expect(() => registry.select({ ...snapshot, reason: 'unsupported' as never })).toThrow('contract')
    expect(() => registry.select({ ...snapshot, templateVersion: 2 as never })).toThrow('contract')
  })

  it('fails before discovery when a repair adapter receives a malformed snapshot', async () => {
    const discoverSources = vi.fn(async () => ({ sources: [] }))
    const adapter = createRepairPlayersAdapter({ discoverSources })

    await expect(adapter.execute({
      candidate: {
        attempt: 1,
        runId: 'run-invalid-repair',
        sequence: 2,
        snapshot: {
          entrypoint: 'movie-crawler',
          movieId: 'movie-1',
          operation: 'repair_players',
          permissionResource: 'movie',
          reason: 'unsupported',
          sourceRevision: 4,
          targetIntent: 'restore_playable_sources',
          templateKey: 'movie',
          templateVersion: 1,
        },
      } as never,
      checkpoint: async () => false,
      client: { observeRepairSource: async () => ({ accepted: false, errorCode: 'source_read_failed' }) },
      observe: () => {},
    })).rejects.toThrow('contract')
    expect(discoverSources).not.toHaveBeenCalled()
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

  it('routes chapter page snapshots to the signed page observation boundary', async () => {
    const adapter = createChapterAvailabilityAdapter()
    const observeChapterPages = vi.fn(async () => ({ accepted: true }))
    const result = await adapter.execute({
      candidate: {
        attempt: 1,
        expectedProjectionVersion: 2,
        policyReference: 'availability/chapter-pages',
        policyVersion: 'chapter-page-probe/v1',
        provider: 'local-proof',
        runId: 'chapter-run-1',
        sequence: 3,
        snapshot: {
          chapterId: 'comic-1-chapter-1',
          comicId: 'comic-1',
          entrypoint: 'manga-crawler',
          finding: 'missing_page',
          operation: 'recheck_chapter_pages',
          pageNumbers: [2],
          permissionResource: 'comic',
          policyVersion: 'chapter-page-probe/v1',
          sourceRevision: 4,
          templateKey: 'manga',
          templateVersion: 1,
        },
        target: { id: 'comic-1', kind: 'manga' },
        taskId: 'chapter-task-1',
      },
      checkpoint: async () => false,
      client: { observeChapterPages },
      nextSequence: () => 4,
      observe: vi.fn(),
    })
    expect(result.contentIds).toEqual(['comic-1'])
    expect(observeChapterPages).toHaveBeenCalledWith(expect.objectContaining({ runId: 'chapter-run-1' }), 4)
  })
})
