import { describe, expect, it } from 'vitest'

import {
  createReadinessProjection,
  derivePlaybackProof,
  deriveSourceReadiness,
} from '../source-contract'

describe('movie source contract', () => {
  it('derives ready from one active player with a trimmed source', () => {
    const source = deriveSourceReadiness({
      candidates: [{ isActive: true, sourceUrl: '  source-a  ' }],
      observedAt: 1_700_000_000,
      sourceRevision: 7,
    })

    expect(source).toEqual({
      disposition: 'ready',
      eligibleCount: 1,
      observedAt: 1_700_000_000,
      reasonCode: null,
      repairable: false,
      sourceRevision: 7,
    })

    const projection = createReadinessProjection({
      contentId: 'movie-1',
      metadata: { observedAt: 1_700_000_000, persisted: true },
      source: {
        candidates: [{ isActive: true, sourceUrl: 'source-a' }],
        observedAt: 1_700_000_000,
        sourceRevision: 7,
      },
    })

    expect(projection.source.disposition).toBe('ready')
    expect(projection.playback.status).toBe('unverified')
    expect(projection.metadata.persisted).toBe(true)
  })

  it.each([
    { candidates: [], name: 'empty players' },
    { candidates: [{ isActive: false, sourceUrl: 'source-a' }], name: 'inactive players' },
    { candidates: [{ isActive: true, sourceUrl: '   ' }], name: 'blank sourceUrl' },
  ])('$name is repairable no_source', ({ candidates }) => {
    expect(deriveSourceReadiness({ candidates, observedAt: 2, sourceRevision: 3 })).toEqual({
      disposition: 'no_source',
      eligibleCount: 0,
      observedAt: 2,
      reasonCode: 'no_eligible_source',
      repairable: true,
      sourceRevision: 3,
    })
  })

  it('uses bounded write/read failure codes without exposing exception text', () => {
    const projection = createReadinessProjection({
      contentId: 'movie-2',
      metadata: { observedAt: 3, persisted: true },
      source: {
        candidates: [],
        failure: { error: 'raw exception with token=hidden', reasonCode: 'source_write_failed' },
        observedAt: 3,
        sourceRevision: 4,
      },
      receipt: { persisted: true, primaryContentId: 'movie-2', schemaVersion: 2 },
    })

    expect(projection.metadata.persisted).toBe(true)
    expect(projection.source).toMatchObject({
      disposition: 'source_failed',
      eligibleCount: 0,
      reasonCode: 'source_write_failed',
      repairable: true,
    })
    expect(JSON.stringify(projection)).not.toContain('raw exception')
    expect(JSON.stringify(projection)).not.toContain('token=hidden')
  })

  it('keeps playback unverified until browser evidence proves progress', () => {
    expect(derivePlaybackProof(undefined)).toEqual({ status: 'unverified' })
    expect(derivePlaybackProof({ currentTime: 0, playing: true })).toEqual({ status: 'unverified' })
    expect(derivePlaybackProof({ currentTime: 12, playing: false })).toEqual({ status: 'unverified' })

    expect(derivePlaybackProof({ currentTime: 12, observedAt: 4, playing: true })).toEqual({
      evidence: { currentTime: 12, observedAt: 4 },
      status: 'playback_verified',
    })
  })
})
