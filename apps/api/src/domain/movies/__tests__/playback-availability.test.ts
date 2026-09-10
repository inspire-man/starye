import { describe, expect, it } from 'vitest'
import { derivePlaybackAvailability } from '../playback-availability'

describe('derivePlaybackAvailability', () => {
  it('does not treat player rows as playable', () => {
    expect(derivePlaybackAvailability({
      hasPlayers: true,
      hasEligibleDirect: true,
      hasEligibleMagnet: false,
      sourceDisposition: 'ready',
      playbackStatus: 'unverified',
      lastCheckedAt: 1_725_000_000,
      now: 1_725_000_100,
    })).toMatchObject({
      status: 'unverified',
      hasPlayers: true,
      nextAction: 'recheck',
    })
  })

  it('returns verified only with playback proof', () => {
    expect(derivePlaybackAvailability({
      hasPlayers: true,
      hasEligibleDirect: true,
      hasEligibleMagnet: false,
      sourceDisposition: 'ready',
      playbackStatus: 'playback_verified',
      lastVerifiedAt: 101,
      lastCheckedAt: 101,
      now: 200,
    })).toMatchObject({
      status: 'verified',
      lastVerifiedAt: 101,
      stale: false,
      nextAction: 'none',
    })
  })

  it('distinguishes failed and magnet-only sources', () => {
    expect(derivePlaybackAvailability({
      hasPlayers: true,
      hasEligibleDirect: true,
      hasEligibleMagnet: false,
      sourceDisposition: 'source_failed',
      playbackStatus: 'unverified',
      availabilityStatus: 'unavailable',
      availabilityReason: 'playback_failed',
      lastCheckedAt: 50,
      now: 60,
    })).toMatchObject({
      status: 'failed',
      failureReason: 'playback_failed',
      nextAction: 'repair',
    })

    expect(derivePlaybackAvailability({
      hasPlayers: true,
      hasEligibleDirect: true,
      hasEligibleMagnet: false,
      sourceDisposition: 'ready',
      playbackStatus: 'unverified',
      playerPlaybackFailed: true,
      playerPlaybackFailureReason: 'playback_failed',
      playerPlaybackFailedAt: 90,
      lastCheckedAt: 50,
      now: 100,
    })).toMatchObject({
      status: 'failed',
      failureReason: 'playback_failed',
      lastCheckedAt: 90,
      nextAction: 'repair',
    })

    expect(derivePlaybackAvailability({
      hasPlayers: true,
      hasEligibleDirect: false,
      hasEligibleMagnet: true,
      sourceDisposition: 'ready',
      playbackStatus: 'unverified',
      lastCheckedAt: 50,
      now: 60,
    })).toMatchObject({
      status: 'magnet_only',
      nextAction: 'recheck',
    })
  })
})
