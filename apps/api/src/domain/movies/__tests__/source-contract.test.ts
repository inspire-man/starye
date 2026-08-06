import type { ValidatedCrawlerRunReceipt } from '../../crawler-tasks/types'

import { crawlerRuns, movieSourceStates } from '@starye/db/schema'
import * as v from 'valibot'

import { describe, expect, it } from 'vitest'
import {
  createReadinessProjection,
  derivePlaybackProof,
  deriveSourceReadiness,
  projectSourceHealth,
  SOURCE_HEALTH_REASON_CODES,
  SOURCE_REASON_CODES,
} from '../source-contract'
import {
  CreateRepairPlayersTaskSchema,
} from '../../../schemas/crawler-tasks'
import type {
  RepairPlayersReceipt,
  RepairPlayersTaskSnapshot,
} from '../../crawler-tasks/types'

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

  it.each([
    {
      input: { isActive: true, observedAt: 7, sourceType: 'direct' as const, sourceUrl: 'https://internal.example/player' },
      expected: { eligible: true, health: 'unverified', reasonCode: 'source_unverified' },
      name: 'active direct source',
    },
    {
      input: { isActive: true, observedAt: 8, sourceType: 'magnet' as const, sourceUrl: 'magnet:?xt=hidden' },
      expected: { eligible: true, health: 'unverified', reasonCode: 'source_unverified' },
      name: 'magnet defaults to unverified',
    },
    {
      input: { isActive: false, observedAt: 9, sourceType: 'TorrServer' as const, sourceUrl: 'http://private/source' },
      expected: { eligible: false, health: 'inactive', reasonCode: 'source_inactive' },
      name: 'inactive source remains visible but ineligible',
    },
    {
      input: { health: 'failed' as const, isActive: true, observedAt: 10, reasonCode: 'source_read_failed', sourceType: 'direct' as const, sourceUrl: 'http://private/source' },
      expected: { eligible: false, health: 'failed', reasonCode: 'source_read_failed' },
      name: 'failed source exposes only bounded reason',
    },
  ])('$name produces a bounded source health projection', ({ input, expected }) => {
    const projection = projectSourceHealth(input)

    expect(projection).toMatchObject(expected)
    expect(Object.keys(projection).sort()).toEqual(['eligible', 'health', 'observedAt', 'reasonCode', 'sourceType'])
    expect(JSON.stringify(projection)).not.toContain('private')
    expect(SOURCE_HEALTH_REASON_CODES).toContain(projection.reasonCode)
  })

  it('keeps source health separate from readiness and playback proof', () => {
    const health = projectSourceHealth({
      isActive: false,
      observedAt: 11,
      sourceType: 'direct',
      sourceUrl: 'source-hidden',
    })
    const readiness = deriveSourceReadiness({
      candidates: [{ isActive: false, sourceUrl: 'source-hidden' }],
      observedAt: 11,
      sourceRevision: 12,
    })

    expect(health.health).toBe('inactive')
    expect(health.eligible).toBe(false)
    expect(readiness.disposition).toBe('no_source')
    expect(derivePlaybackProof({ playing: true, currentTime: 0 }).status).toBe('unverified')
  })

  it('accepts only the fixed single-movie repair command', () => {
    expect(v.safeParse(CreateRepairPlayersTaskSchema, {
      movieId: 'movie-1',
      reason: 'no_source',
      targetIntent: 'restore_playable_sources',
    }).success).toBe(true)

    for (const candidate of [
      { movieId: 'movie-1', reason: 'ready', targetIntent: 'restore_playable_sources' },
      { movieId: 'movie-1', reason: 'source_failed', targetIntent: 'choose_magnet' },
      { movieId: 'movie-1', reason: 'source_failed', targetIntent: 'restore_playable_sources', workflow: 'arbitrary.yml' },
    ]) {
      expect(v.safeParse(CreateRepairPlayersTaskSchema, candidate).success).toBe(false)
    }
  })

  it('discriminates repair snapshots and receipts from ordinary movie receipts', () => {
    const snapshot: RepairPlayersTaskSnapshot = {
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'source_failed',
      sourceRevision: 12,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    }
    const receipt: RepairPlayersReceipt = {
      movieId: snapshot.movieId,
      observedAt: 13,
      operation: snapshot.operation,
      sourceRevision: snapshot.sourceRevision,
      sourceSummary: [projectSourceHealth({
        isActive: true,
        observedAt: 13,
        sourceType: 'direct',
        sourceUrl: 'raw-source-is-not-exposed',
      })],
    }

    expect(snapshot.operation).toBe('repair_players')
    expect(receipt.operation).toBe('repair_players')
    expect(JSON.stringify(receipt)).not.toContain('raw-source-is-not-exposed')
    expect((receipt as { templateKey?: string }).templateKey).toBeUndefined()
    expect((receipt as { contentIds?: string[] }).contentIds).toBeUndefined()
  })
})
