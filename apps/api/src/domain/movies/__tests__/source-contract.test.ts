import type { ValidatedCrawlerRunReceipt } from '../../crawler-tasks/types'

import { crawlerRuns, movieSourceStates } from '@starye/db/schema'

import { describe, expect, it } from 'vitest'
import {
  createReadinessProjection,
  derivePlaybackProof,
  deriveSourceReadiness,
  SOURCE_REASON_CODES,
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

  it('maps the projection to the movie_source_state contract and preserves identity', () => {
    const movieId = 'movie-identity-1'
    const source = deriveSourceReadiness({
      candidates: [{ isActive: true, sourceUrl: 'source-a' }],
      observedAt: 5,
      sourceRevision: 9,
    })
    const receipt: ValidatedCrawlerRunReceipt = {
      createdCount: 1,
      primaryContentId: movieId,
      receiptSchemaVersion: 2,
      source,
      templateKey: 'movie',
      updatedCount: 0,
    }

    expect({
      disposition: source.disposition,
      eligibleCount: source.eligibleCount,
      observedAt: source.observedAt,
      reasonCode: source.reasonCode,
      repairable: source.repairable,
      sourceRevision: source.sourceRevision,
    }).toEqual({
      disposition: 'ready',
      eligibleCount: 1,
      observedAt: 5,
      reasonCode: null,
      repairable: false,
      sourceRevision: 9,
    })
    expect(receipt.primaryContentId).toBe(movieId)
    expect(receipt.source?.sourceRevision).toBe(source.sourceRevision)
    expect(movieSourceStates.movieId.name).toBe('movie_id')
    expect(movieSourceStates.sourceRevision.name).toBe('source_revision')
    expect(movieSourceStates.disposition.name).toBe('disposition')
    expect(movieSourceStates.eligibleCount.name).toBe('eligible_count')
    expect(movieSourceStates.repairable.name).toBe('repairable')
    expect(movieSourceStates.reasonCode.name).toBe('reason_code')
    expect(movieSourceStates.observedAt.name).toBe('observed_at')
    expect(movieSourceStates.disposition.enumValues).toEqual(['ready', 'no_source', 'source_failed', 'repairing'])
    expect(movieSourceStates.reasonCode.enumValues).toEqual(SOURCE_REASON_CODES)
    expect(crawlerRuns.receiptSchemaVersion.name).toBe('receipt_schema_version')
    expect(crawlerRuns.receiptPrimaryContentId.name).toBe('receipt_primary_content_id')
    expect(crawlerRuns.receiptSourceRevision.name).toBe('receipt_source_revision')
  })

  it('keeps persisted metadata and receipt independent from source and playback state', () => {
    const projection = createReadinessProjection({
      contentId: 'movie-no-source',
      metadata: { observedAt: 6, persisted: true },
      receipt: { persisted: true, primaryContentId: 'movie-no-source', schemaVersion: 2 },
      source: { candidates: [], observedAt: 6, sourceRevision: 10 },
    })

    expect(projection.metadata.persisted).toBe(true)
    expect(projection.receipt.persisted).toBe(true)
    expect(projection.source).toMatchObject({ disposition: 'no_source', eligibleCount: 0, repairable: true })
    expect(projection.playback.status).toBe('unverified')
    expect(JSON.stringify(projection)).not.toContain('playback_verified')
  })
})
