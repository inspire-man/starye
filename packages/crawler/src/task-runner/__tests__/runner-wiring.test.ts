import type { VideoRunnerSnapshot } from '../runner-client'
import { describe, expect, it, vi } from 'vitest'
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
    await expect(magnet.execute({ candidate: { attempt: 1, runId: 'run-2', sequence: 1, snapshot: directSnapshot }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow('magnet')
    expect(fetch).not.toHaveBeenCalled()
    expect(providerAdd).not.toHaveBeenCalled()
  })

  it('returns bounded provider failure when magnet provider config is absent', async () => {
    const adapters = createServerVideoAvailabilityAdapters({ magnet: { source: 'magnet:?xt=urn:btih:fixture' } }, {
      fetch: vi.fn(),
      resolve: async () => [],
    })
    const magnet = adapters.find(adapter => adapter.operation === 'video_magnet')!
    const result = await magnet.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot: { ...magnetSnapshot, reason: 'provider_unconfigured' } }, checkpoint: async () => false, observe: () => {} })

    expect(result.availabilityObservation).toMatchObject({ nextAction: 'retry', reasonCode: 'provider_failed', status: 'unknown' })
    expect(JSON.stringify(result)).not.toContain('magnet:?')
  })
})
