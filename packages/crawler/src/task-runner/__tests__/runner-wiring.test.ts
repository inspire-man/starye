import type { VideoRunnerSnapshot } from '../runner-client'
import { describe, expect, it, vi } from 'vitest'
import { createLocalRunnerAdapterRegistry } from '../../../../../scripts/local-task-runner'
import { createServerVideoAvailabilityAdapters } from '../video-runner-wiring'

const directSnapshot = {
  entrypoint: 'movie-crawler',
  movieId: 'movie-1',
  movieRevision: 4,
  operation: 'recheck_video_source',
  permissionResource: 'movie',
  policyVersion: 'video-source-probe/v1',
  reason: 'direct_transport_failed',
  sourceRevision: 7,
  templateKey: 'movie',
  templateVersion: 1,
} satisfies VideoRunnerSnapshot

const magnetSnapshot = { ...directSnapshot, reason: 'no_peer' as const }

describe('real runner video adapter wiring', () => {
  it('keeps legacy local adapters while selecting both Phase 26 source kinds', () => {
    const registry = createLocalRunnerAdapterRegistry({
      apiBaseUrl: 'http://localhost:8080',
      callbackKeyId: 'key',
      callbackSecret: 'secret',
      crawler: { manga: {}, movie: {}, repairPlayers: { sources: [] } },
      videoAvailability: {
        direct: { sources: [] },
        magnet: { source: 'magnet:?xt=urn:btih:fixture' },
      },
    })

    expect(registry.select(directSnapshot).operation).toBe('video_direct')
    expect(registry.select(magnetSnapshot).operation).toBe('video_magnet')
    expect(registry.select({ entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 }).templateKey).toBe('movie')
    expect(registry.select({ entrypoint: 'manga-crawler', permissionResource: 'comic', templateKey: 'manga', templateVersion: 1 }).templateKey).toBe('manga')
    expect(registry.select({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 7,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    }).operation).toBe('repair_players')
  })

  it('constructs matching direct and magnet adapters from server-owned config', async () => {
    const fetch = vi.fn(async () => new Response('#EXTM3U', {
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      status: 200,
    }))
    const providerAdd = vi.fn(async () => 'gid-1')
    const adapters = createServerVideoAvailabilityAdapters({
      direct: { sources: ['https://media.example/signed.m3u8?token=secret'] },
      magnet: {
        source: 'magnet:?xt=urn:btih:secret-fixture',
        provider: { rpcUrl: 'http://127.0.0.1:6800/jsonrpc', secret: 'provider-secret' },
      },
    }, {
      fetch,
      provider: {
        add: providerAdd,
        cleanup: async () => {},
        configured: true,
        status: async () => ({ metadataReady: true, peers: 2, progressBytes: 1024, streamReady: true }),
      },
      resolve: async () => ['203.0.113.10'],
    })

    const direct = adapters.find(adapter => adapter.operation === 'video_direct')!
    const magnet = adapters.find(adapter => adapter.operation === 'video_magnet')!
    const directResult = await direct.execute({ candidate: { attempt: 1, runId: 'run-direct', sequence: 1, snapshot: directSnapshot }, checkpoint: async () => false, observe: () => {} })
    const magnetResult = await magnet.execute({ candidate: { attempt: 1, runId: 'run-magnet', sequence: 1, snapshot: magnetSnapshot }, checkpoint: async () => false, observe: () => {} })

    expect(directResult.availabilityObservation).toMatchObject({ status: 'available' })
    expect(magnetResult.availabilityObservation).toMatchObject({ status: 'unknown' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(providerAdd).toHaveBeenCalledTimes(1)
    expect(JSON.stringify([directResult, magnetResult])).not.toMatch(/media\.example|magnet:\?|provider-secret|token/u)
  })

  it('rejects cross-kind snapshots before provider I/O', async () => {
    const fetch = vi.fn(async () => new Response(''))
    const providerAdd = vi.fn(async () => 'gid-1')
    const adapters = createServerVideoAvailabilityAdapters({
      direct: { sources: ['https://media.example/video'] },
      magnet: { source: 'magnet:?xt=urn:btih:fixture' },
    }, {
      fetch,
      provider: { add: providerAdd, cleanup: async () => {}, configured: true, status: async () => ({}) },
      resolve: async () => ['203.0.113.10'],
    })

    const direct = adapters.find(adapter => adapter.operation === 'video_direct')!
    const magnet = adapters.find(adapter => adapter.operation === 'video_magnet')!
    await expect(direct.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot: magnetSnapshot }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow('direct')
    await expect(magnet.execute({ candidate: { attempt: 1, runId: 'run-2', sequence: 1, snapshot: directSnapshot }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow(/magnet/iu)
    expect(fetch).not.toHaveBeenCalled()
    expect(providerAdd).not.toHaveBeenCalled()
  })

  it('returns bounded provider failure when magnet provider config is absent', async () => {
    const adapters = createServerVideoAvailabilityAdapters({ magnet: { source: 'magnet:?xt=urn:btih:fixture' } }, {
      fetch: vi.fn(),
      resolve: async () => [],
    })
    const magnet = adapters.find(adapter => adapter.operation === 'video_magnet')!
    const result = await magnet.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot: { ...magnetSnapshot, reason: 'provider_unconfigured' as const } }, checkpoint: async () => false, observe: () => {} })

    expect(result.availabilityObservation).toMatchObject({ nextAction: 'retry', reasonCode: 'provider_failed', status: 'unknown' })
    expect(JSON.stringify(result)).not.toContain('magnet:?')
  })
})
