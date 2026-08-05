export const SOURCE_CONTRACT_VERSION = 1 as const

export const SOURCE_REASON_CODES = [
  'no_eligible_source',
  'repair_requested',
  'source_candidate_invalid',
  'source_read_failed',
  'source_write_failed',
] as const

export type SourceReasonCode = typeof SOURCE_REASON_CODES[number]
export type SourceDisposition = 'no_source' | 'ready' | 'repairing' | 'source_failed'
export type PlaybackProofStatus = 'playback_verified' | 'unverified'

export interface SourceCandidate {
  readonly isActive: boolean | null | undefined
  readonly sourceUrl: string | null | undefined
}

export interface SourceFailureInput {
  readonly error?: unknown
  readonly reasonCode?: unknown
}

export interface SourceReadinessInput {
  readonly candidates: readonly SourceCandidate[]
  readonly failure?: SourceFailureInput
  readonly observedAt: number
  readonly repairRequested?: boolean
  readonly sourceRevision: number
}

export interface SourceReadinessProjection {
  readonly disposition: SourceDisposition
  readonly eligibleCount: number
  readonly observedAt: number
  readonly reasonCode: SourceReasonCode | null
  readonly repairable: boolean
  readonly sourceRevision: number
}

export interface MetadataProjection {
  readonly contentId: string
  readonly observedAt: number | null
  readonly persisted: boolean
}

export interface PlaybackEvidence {
  readonly currentTime: number
  readonly observedAt?: number
}

export interface PlaybackProjection {
  readonly evidence?: PlaybackEvidence
  readonly status: PlaybackProofStatus
}

export interface ReceiptProjection {
  readonly persisted: boolean
  readonly primaryContentId: string | null
  readonly schemaVersion: number | null
}

export interface ReadinessProjection {
  readonly metadata: MetadataProjection
  readonly playback: PlaybackProjection
  readonly receipt: ReceiptProjection
  readonly source: SourceReadinessProjection
}

export interface ReadinessProjectionInput {
  readonly contentId: string
  readonly metadata: MetadataProjection
  readonly playbackEvidence?: unknown
  readonly receipt?: Partial<ReceiptProjection>
  readonly source: SourceReadinessInput
}

export function isEligiblePlayer(candidate: SourceCandidate): boolean {
  return candidate.isActive === true
    && typeof candidate.sourceUrl === 'string'
    && candidate.sourceUrl.trim().length > 0
}

function isSourceReasonCode(value: unknown): value is SourceReasonCode {
  return typeof value === 'string'
    && (SOURCE_REASON_CODES as readonly string[]).includes(value)
}

function failureReasonCode(failure: SourceFailureInput | undefined): SourceReasonCode {
  return isSourceReasonCode(failure?.reasonCode) && failure.reasonCode !== 'no_eligible_source'
    ? failure.reasonCode
    : 'source_read_failed'
}

export function deriveSourceReadiness(input: SourceReadinessInput): SourceReadinessProjection {
  const eligibleCount = input.candidates.filter(isEligiblePlayer).length

  if (input.failure) {
    return {
      disposition: 'source_failed',
      eligibleCount,
      observedAt: input.observedAt,
      reasonCode: failureReasonCode(input.failure),
      repairable: true,
      sourceRevision: input.sourceRevision,
    }
  }

  if (input.repairRequested) {
    return {
      disposition: 'repairing',
      eligibleCount,
      observedAt: input.observedAt,
      reasonCode: 'repair_requested',
      repairable: true,
      sourceRevision: input.sourceRevision,
    }
  }

  if (eligibleCount === 0) {
    return {
      disposition: 'no_source',
      eligibleCount,
      observedAt: input.observedAt,
      reasonCode: 'no_eligible_source',
      repairable: true,
      sourceRevision: input.sourceRevision,
    }
  }

  return {
    disposition: 'ready',
    eligibleCount,
    observedAt: input.observedAt,
    reasonCode: null,
    repairable: false,
    sourceRevision: input.sourceRevision,
  }
}

export function derivePlaybackProof(evidence: unknown): PlaybackProjection {
  if (!evidence || typeof evidence !== 'object')
    return { status: 'unverified' }

  const candidate = evidence as { currentTime?: unknown, observedAt?: unknown, playing?: unknown }
  if (candidate.playing !== true || typeof candidate.currentTime !== 'number' || !Number.isFinite(candidate.currentTime) || candidate.currentTime <= 0)
    return { status: 'unverified' }

  const observedAt = typeof candidate.observedAt === 'number' && Number.isFinite(candidate.observedAt)
    ? candidate.observedAt
    : undefined

  return {
    evidence: observedAt === undefined
      ? { currentTime: candidate.currentTime }
      : { currentTime: candidate.currentTime, observedAt },
    status: 'playback_verified',
  }
}

export function createReadinessProjection(input: ReadinessProjectionInput): ReadinessProjection {
  return {
    metadata: {
      contentId: input.contentId,
      observedAt: input.metadata.observedAt,
      persisted: input.metadata.persisted,
    },
    playback: derivePlaybackProof(input.playbackEvidence),
    receipt: {
      persisted: input.receipt?.persisted ?? false,
      primaryContentId: input.receipt?.primaryContentId ?? null,
      schemaVersion: input.receipt?.schemaVersion ?? null,
    },
    source: deriveSourceReadiness(input.source),
  }
}
