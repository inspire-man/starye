import { VIDEO_PROBE_POLICY_V1 } from './probe-policy'

export const VIDEO_AVAILABILITY_LAYER_VALUES = ['metadata', 'direct', 'magnet', 'playback'] as const
export type VideoAvailabilityLayer = typeof VIDEO_AVAILABILITY_LAYER_VALUES[number]

export const VIDEO_AVAILABILITY_STATUS_VALUES = ['available', 'unavailable', 'degraded', 'unknown'] as const
export type VideoAvailabilityStatus = typeof VIDEO_AVAILABILITY_STATUS_VALUES[number]

export const VIDEO_AVAILABILITY_REASON_VALUES = [
  'no_source',
  'source_failed',
  'stale',
  'direct_blocked',
  'direct_transport_failed',
  'direct_content_invalid',
  'browser_inconclusive',
  'provider_unconfigured',
  'provider_failed',
  'metadata_unresolved',
  'no_peer',
  'stalled',
  'stream_missing',
  'stream_failed',
  'playback_unverified',
  'playback_failed',
] as const
export type VideoAvailabilityReason = typeof VIDEO_AVAILABILITY_REASON_VALUES[number]

export interface VideoEvidence {
  readonly detail: string
  readonly rows: readonly string[]
  readonly samples: readonly string[]
}

export interface VideoFinding {
  readonly evidence: VideoEvidence
  readonly layer: VideoAvailabilityLayer
  readonly observedAt: number
  readonly policyVersion: string
  readonly reason: VideoAvailabilityReason | null
  readonly sourceId: string
  readonly sourceRevision: number
  readonly status: VideoAvailabilityStatus
}

const FORBIDDEN_EVIDENCE_PATTERN
  = /[?&](?:token|key|signature|sig|auth|password|secret|cookie)=|authorization\s*:|set-cookie\s*:|-----begin|data:(?:video|audio)\/|<html[\s>]/i

function boundedText(value: unknown, maxLength: number, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength)
    throw new Error(code)
  if (FORBIDDEN_EVIDENCE_PATTERN.test(value))
    throw new Error('video_evidence_forbidden')
  return value.trim()
}

function boundedInteger(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(code)
  return value
}

function boundedTextList(value: unknown, maxItems: number, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    throw new Error(code)
  return Object.freeze(value.map(item => boundedText(item, 512, code)))
}

export function validateVideoEvidence(value: unknown): VideoEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('video_evidence_invalid')
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => !['detail', 'rows', 'samples'].includes(key)))
    throw new Error('video_evidence_unknown_field')

  return Object.freeze({
    detail: boundedText(record.detail, 1_024, 'video_evidence_detail_invalid'),
    rows: boundedTextList(record.rows, VIDEO_PROBE_POLICY_V1.maxEvidenceRows, 'video_evidence_rows_invalid'),
    samples: boundedTextList(record.samples, VIDEO_PROBE_POLICY_V1.maxAbnormalSamples, 'video_evidence_samples_invalid'),
  })
}

export function createVideoFinding(input: VideoFinding): VideoFinding {
  if (!(VIDEO_AVAILABILITY_LAYER_VALUES as readonly string[]).includes(input.layer))
    throw new Error('video_finding_layer_invalid')
  if (!(VIDEO_AVAILABILITY_STATUS_VALUES as readonly string[]).includes(input.status))
    throw new Error('video_finding_status_invalid')
  if (input.reason !== null && !(VIDEO_AVAILABILITY_REASON_VALUES as readonly string[]).includes(input.reason))
    throw new Error('video_finding_reason_invalid')
  if (input.status === 'available' && input.reason !== null)
    throw new Error('video_finding_reason_conflict')
  if (input.status !== 'available' && input.reason === null)
    throw new Error('video_finding_reason_required')

  return Object.freeze({
    evidence: validateVideoEvidence(input.evidence),
    layer: input.layer,
    observedAt: boundedInteger(input.observedAt, 0, 4_102_444_800_000, 'video_finding_observed_at_invalid'),
    policyVersion: boundedText(input.policyVersion, 128, 'video_finding_policy_invalid'),
    reason: input.reason,
    sourceId: boundedText(input.sourceId, 128, 'video_finding_source_invalid'),
    sourceRevision: boundedInteger(input.sourceRevision, 0, 1_000_000_000, 'video_finding_revision_invalid'),
    status: input.status,
  })
}
