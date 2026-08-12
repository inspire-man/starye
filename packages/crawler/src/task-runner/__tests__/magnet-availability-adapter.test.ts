import { describe, expect, it, vi } from 'vitest'
import { createMagnetAvailabilityAdapter } from '../magnet-availability-adapter'

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

describe('magnet availability adapter', () => {
  it('emits a bounded magnet observation without promoting stream to playback', async () => {
    const adapter = createMagnetAvailabilityAdapter({
      magnet: 'magnet:?xt=urn:btih:fixture',
      provider: {
        add: async () => 'gid-1',
        cleanup: async () => {},
        configured: true,
        status: async () => ({ metadataReady: true, peers: 1, progressBytes: 1, streamReady: true }),
      },
    })
    const result = await adapter.execute({
      candidate: { attempt: 1, runId: 'run-1', sequence: 1, snapshot },
      checkpoint: async () => false,
      observe: () => {},
    })
    expect(result.availabilityObservation).toMatchObject({
      freshness: 'fresh',
      nextAction: 'recheck',
      reasonCode: 'content_missing',
      status: 'unknown',
    })
    expect(JSON.stringify(result)).not.toContain('magnet:?')
  })

  it('rejects revision and policy mismatch before provider I/O', async () => {
    const add = vi.fn(async () => 'gid-1')
    const adapter = createMagnetAvailabilityAdapter({
      magnet: 'magnet:?xt=urn:btih:fixture',
      provider: { add, cleanup: async () => {}, configured: true, status: async () => ({ metadataReady: true }) },
    })
    await expect(adapter.execute({
      candidate: { attempt: 1, policyVersion: 'wrong', runId: 'run-1', sequence: 1, snapshot, sourceRevision: 7 },
      checkpoint: async () => false,
      observe: () => {},
    })).rejects.toThrow('binding')
    expect(add).not.toHaveBeenCalled()
  })
})
