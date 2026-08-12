import type { VideoRunnerSnapshot } from '../runner-client'
import { describe, expect, it, vi } from 'vitest'
import { createVideoAvailabilityAdapter } from '../video-availability-adapter'

const snapshot = {
  entrypoint: 'movie-crawler' as const,
  movieId: 'movie-1',
  movieRevision: 4,
  operation: 'recheck_video_source' as const,
  permissionResource: 'movie' as const,
  policyVersion: 'video-source-probe/v1',
  reason: 'direct_transport_failed' as const,
  sourceRevision: 7,
  templateKey: 'movie' as const,
  templateVersion: 1 as const,
} satisfies VideoRunnerSnapshot

describe('direct video availability adapter', () => {
  it('emits bounded uncertain observations without raw URLs', async () => {
    const adapter = createVideoAvailabilityAdapter({
      fetch: async () => { throw new Error('dns') },
      resolve: async () => ['203.0.113.10'],
      sources: ['https://media.example/signed.m3u8?token=secret'],
    })
    const result = await adapter.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot }, checkpoint: async () => false, observe: () => {} })
    expect(result.availabilityObservation).toMatchObject({ freshness: 'fresh', nextAction: 'recheck', status: 'unknown' })
    expect(JSON.stringify(result)).not.toContain('media.example')
    expect(JSON.stringify(result)).not.toContain('token')
  })

  it('rejects direct/magnet and revision binding mismatches before I/O', async () => {
    const fetch = vi.fn(async () => new Response(''))
    const adapter = createVideoAvailabilityAdapter({ fetch, resolve: async () => ['203.0.113.10'], sources: ['https://media.example/video'] })
    await expect(adapter.execute({ candidate: { attempt: 1, policyVersion: 'wrong', runId: 'run-1', sequence: 1, snapshot }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow('binding')
    await expect(adapter.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot: { ...snapshot, reason: 'no_peer' as const } }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow('direct')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps empty and mixed direct source summaries conservative and redacted', async () => {
    const empty = createVideoAvailabilityAdapter({ fetch: vi.fn(), resolve: async () => ['203.0.113.10'], sources: [] })
    const emptyResult = await empty.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot }, checkpoint: async () => false, observe: () => {} })
    expect(emptyResult.availabilityObservation).toMatchObject({ nextAction: 'recheck', reasonCode: 'no_source', status: 'unavailable' })

    const mixed = createVideoAvailabilityAdapter({
      fetch: async url => String(url).includes('good')
        ? new Response('#EXTM3U', { headers: { 'content-type': 'application/vnd.apple.mpegurl' }, status: 200 })
        : Promise.reject(new Error('timeout')),
      resolve: async () => ['203.0.113.10'],
      sources: ['https://good.example/watch.m3u8?token=secret', 'https://bad.example/watch?cookie=secret'],
    })
    const mixedResult = await mixed.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot }, checkpoint: async () => false, observe: () => {} })
    expect(mixedResult.availabilityObservation).toMatchObject({
      nextAction: 'recheck',
      reasonCode: 'transport_failed',
      status: 'degraded',
      summary: { counts: { available: 1, checked: 2, configured: 2, unknown: 1 } },
    })
    expect(JSON.stringify(mixedResult)).not.toMatch(/good\.example|bad\.example|token|cookie/u)
  })
})
