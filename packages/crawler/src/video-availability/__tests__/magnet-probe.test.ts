import { describe, expect, it } from 'vitest'
import { classifyMagnetProbe, probeMagnetAvailability } from '../magnet-probe'

describe('magnet availability probe', () => {
  it.each([
    [{ configured: false }, 'provider_unconfigured'],
    [{ configured: true, providerError: true }, 'provider_failed'],
    [{ configured: true, metadataReady: false }, 'metadata_unresolved'],
    [{ configured: true, metadataReady: true, peers: 0, progressBytes: 0 }, 'no_peer'],
    [{ configured: true, metadataReady: true, peers: 2, progressBytes: 0 }, 'stalled'],
    [{ configured: true, metadataReady: true, peers: 2, progressBytes: 1 }, 'stream_missing'],
    [{ configured: true, metadataReady: true, peers: 2, progressBytes: 1, streamReady: true }, 'playback_unverified'],
  ] as const)('keeps provider layers distinct for %j', (facts, reason) => {
    expect(classifyMagnetProbe(facts)).toMatchObject({ reason })
  })

  it('uses bounded polling and cleans up the provider task', async () => {
    let polls = 0
    let cleaned = false
    const result = await probeMagnetAvailability({
      magnet: 'magnet:?xt=urn:btih:fixture',
      provider: {
        add: async () => 'gid-1',
        cleanup: async () => { cleaned = true },
        configured: true,
        status: async () => ({ metadataReady: true, peers: 1, progressBytes: ++polls, streamReady: polls > 1 }),
      },
      pollIntervalMs: 0,
      progressPolls: 2,
    })
    expect(result.reason).toBe('playback_unverified')
    expect(polls).toBe(2)
    expect(cleaned).toBe(true)
    expect(JSON.stringify(result)).not.toContain('magnet:?')
  })
})
