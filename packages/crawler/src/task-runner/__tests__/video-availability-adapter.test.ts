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
}

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
    await expect(adapter.execute({ candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot: { ...snapshot, reason: 'no_peer' } }, checkpoint: async () => false, observe: () => {} })).rejects.toThrow('direct')
    expect(fetch).not.toHaveBeenCalled()
  })
})
