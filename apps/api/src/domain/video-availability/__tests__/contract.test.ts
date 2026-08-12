import { describe, expect, it } from 'vitest'

import {
  aggregateVideoLayer,
  classifyVideoAction,
  validateActionBinding,
} from '../aggregate'
import {
  shouldEscalateToBrowser,
  VIDEO_PROBE_POLICY_V1,
} from '../probe-policy'
import {
  createVideoFinding,
  validateVideoEvidence,
  VIDEO_AVAILABILITY_REASON_VALUES,
} from '../types'

describe('video availability contracts', () => {
  it('keeps metadata, direct, magnet, and playback facts independent', () => {
    const metadata = createVideoFinding({
      evidence: { detail: 'persisted', rows: [], samples: [] },
      layer: 'metadata',
      observedAt: 1_700_000_000,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason: null,
      sourceId: 'movie-1',
      sourceRevision: 7,
      status: 'available',
    })
    const direct = createVideoFinding({
      evidence: { detail: 'range probe', rows: [], samples: [] },
      layer: 'direct',
      observedAt: 1_700_000_000,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason: null,
      sourceId: 'direct-1',
      sourceRevision: 7,
      status: 'available',
    })
    const magnet = createVideoFinding({
      evidence: { detail: 'metadata resolved', rows: [], samples: [] },
      layer: 'magnet',
      observedAt: 1_700_000_000,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason: 'no_peer',
      sourceId: 'magnet-1',
      sourceRevision: 7,
      status: 'degraded',
    })
    const playback = createVideoFinding({
      evidence: { detail: 'no consumption proof', rows: [], samples: [] },
      layer: 'playback',
      observedAt: 1_700_000_000,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason: 'playback_unverified',
      sourceId: 'movie-1',
      sourceRevision: 7,
      status: 'unknown',
    })

    expect(metadata.status).toBe('available')
    expect(direct.status).toBe('available')
    expect(magnet.reason).toBe('no_peer')
    expect(playback.reason).toBe('playback_unverified')
  })

  it('uses the immutable video-source-probe/v1 boundaries exactly', () => {
    expect(VIDEO_PROBE_POLICY_V1).toMatchObject({
      browserTimeoutMs: 15_000,
      directTtlMs: 6 * 60 * 60 * 1000,
      maxAbnormalSamples: 5,
      maxEvidenceRows: 20,
      maxRedirects: 3,
      maxResponseBytes: 64 * 1024,
      metadataTimeoutMs: 30_000,
      progressTimeoutMs: 60_000,
      rangeTimeoutMs: 5_000,
      version: 'video-source-probe/v1',
    })
    expect(VIDEO_PROBE_POLICY_V1.magnetTtlMs).toBe(30 * 60 * 1000)
    expect(shouldEscalateToBrowser('challenge')).toBe(true)
    expect(shouldEscalateToBrowser('contradictory_media')).toBe(true)
    expect(shouldEscalateToBrowser('uncertain_media')).toBe(true)
    expect(shouldEscalateToBrowser('valid_media')).toBe(false)
  })

  it('accepts only bounded redacted evidence', () => {
    expect(validateVideoEvidence({
      detail: 'range response accepted',
      rows: Array.from({ length: 20 }, (_, index) => `row-${index}`),
      samples: Array.from({ length: 5 }, (_, index) => `sample-${index}`),
    }).rows).toHaveLength(20)

    expect(() => validateVideoEvidence({ detail: 'https://media.example/video?token=secret', rows: [], samples: [] })).toThrow('video_evidence_forbidden')
    expect(() => validateVideoEvidence({ detail: 'too many rows', rows: Array.from({ length: 21 }).fill('row'), samples: [] })).toThrow('video_evidence_rows_invalid')
    expect(() => validateVideoEvidence({ detail: 'too many samples', rows: [], samples: Array.from({ length: 6 }).fill('sample') })).toThrow('video_evidence_samples_invalid')
  })

  it.each(VIDEO_AVAILABILITY_REASON_VALUES)('maps %s to a revision-bound action', (reason) => {
    const action = classifyVideoAction({
      movieRevision: 11,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason,
      sourceRevision: 7,
    })

    expect(action.reason).toBe(reason)
    expect(action.movieRevision).toBe(11)
    expect(action.sourceRevision).toBe(7)
    expect(action.policyVersion).toBe(VIDEO_PROBE_POLICY_V1.version)
    expect(action.kind).toMatch(/^(recheck|repair|configure_provider)$/)
  })

  it('rejects action reuse across revisions or policies', () => {
    const action = classifyVideoAction({
      movieRevision: 11,
      policyVersion: VIDEO_PROBE_POLICY_V1.version,
      reason: 'stale',
      sourceRevision: 7,
    })

    expect(() => validateActionBinding(action, { movieRevision: 12, policyVersion: VIDEO_PROBE_POLICY_V1.version, sourceRevision: 7 })).toThrow('video_action_revision_mismatch')
    expect(() => validateActionBinding(action, { movieRevision: 11, policyVersion: 'video-source-probe/v2', sourceRevision: 7 })).toThrow('video_action_policy_mismatch')
  })

  it('preserves detail and determinate status while marking an expired layer stale', () => {
    const findings = [
      createVideoFinding({
        evidence: { detail: 'healthy source', rows: [], samples: [] },
        layer: 'direct',
        observedAt: 1_000,
        policyVersion: VIDEO_PROBE_POLICY_V1.version,
        reason: null,
        sourceId: 'direct-1',
        sourceRevision: 7,
        status: 'available',
      }),
      createVideoFinding({
        evidence: { detail: 'blocked source', rows: [], samples: [] },
        layer: 'direct',
        observedAt: 900,
        policyVersion: VIDEO_PROBE_POLICY_V1.version,
        reason: 'direct_blocked',
        sourceId: 'direct-2',
        sourceRevision: 7,
        status: 'degraded',
      }),
    ]

    const summary = aggregateVideoLayer('direct', findings, 1_000 + VIDEO_PROBE_POLICY_V1.directTtlMs + 1)
    expect(summary).toMatchObject({
      abnormalCount: 1,
      availableCount: 1,
      bestStatus: 'available',
      freshness: 'stale',
      layer: 'direct',
    })
    expect(summary.findings).toHaveLength(2)
    expect(summary.primaryAction?.kind).toBe('recheck')
  })
})
