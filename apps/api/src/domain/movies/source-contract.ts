import type { PlaybackProofBinding } from '../playback-evidence/types'

import * as v from 'valibot'
import { PlaybackEvidenceSummarySchema } from '../../schemas/playback-evidence'
import { isSafePlaybackEvidence } from '../playback-evidence/redaction'

export const SOURCE_CONTRACT_VERSION = 1 as const

export const SOURCE_TYPES = ['direct', 'magnet', 'TorrServer'] as const
export type SourceType = typeof SOURCE_TYPES[number]

export const SOURCE_HEALTH_VALUES = ['inactive', 'unverified', 'failed'] as const
export type SourceHealth = typeof SOURCE_HEALTH_VALUES[number]

export const SOURCE_HEALTH_REASON_CODES = [
  'source_inactive',
  'source_unverified',
  'source_candidate_invalid',
  'source_read_failed',
  'source_write_failed',
] as const
export type SourceHealthReasonCode = typeof SOURCE_HEALTH_REASON_CODES[number]

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
  readonly sourceType?: SourceType | null | undefined
}

export interface SourceHealthInput {
  readonly health?: unknown
  readonly isActive: boolean | null | undefined
  readonly observedAt: number
  readonly reasonCode?: unknown
  readonly sourceType?: SourceType | null | undefined
  readonly sourceUrl: string | null | undefined
}

export interface SourceHealthProjection {
  readonly eligible: boolean
  readonly health: SourceHealth
  readonly observedAt: number
  readonly reasonCode: SourceHealthReasonCode
  readonly sourceType: SourceType
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

export interface ServerSourceState {
  readonly disposition: SourceDisposition
  readonly eligibleCount: number
  readonly observedAt: Date | number | null | undefined
  readonly reasonCode: SourceReasonCode | null
  readonly repairable: boolean
  readonly sourceRevision: number
}

export interface ServerReadinessProjectionInput {
  readonly contentId: string
  readonly metadataObservedAt: Date | number | null | undefined
  readonly playbackEvidence?: unknown
  readonly receipt?: Partial<ReceiptProjection>
  readonly sourceState?: ServerSourceState | null
}

export function isEligiblePlayer(candidate: SourceCandidate): boolean {
  return candidate.isActive === true
    && typeof candidate.sourceUrl === 'string'
    && candidate.sourceUrl.trim().length > 0
}

function isSourceHealthReasonCode(value: unknown): value is SourceHealthReasonCode {
  return typeof value === 'string'
    && (SOURCE_HEALTH_REASON_CODES as readonly string[]).includes(value)
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === 'string'
    && (SOURCE_TYPES as readonly string[]).includes(value)
}

/** Projects one server-owned source row without exposing its raw source material. */
export function projectSourceHealth(input: SourceHealthInput): SourceHealthProjection {
  const sourceType = isSourceType(input.sourceType) ? input.sourceType : 'direct'
  const eligible = input.health !== 'failed' && isEligiblePlayer(input)

  if (input.health === 'failed') {
    return {
      eligible: false,
      health: 'failed',
      observedAt: input.observedAt,
      reasonCode: isSourceHealthReasonCode(input.reasonCode)
        && input.reasonCode !== 'source_inactive'
        && input.reasonCode !== 'source_unverified'
        ? input.reasonCode
        : 'source_read_failed',
      sourceType,
    }
  }

  if (input.isActive !== true) {
    return {
      eligible: false,
      health: 'inactive',
      observedAt: input.observedAt,
      reasonCode: 'source_inactive',
      sourceType,
    }
  }

  return {
    eligible,
    health: 'unverified',
    observedAt: input.observedAt,
    reasonCode: eligible ? 'source_unverified' : 'source_candidate_invalid',
    sourceType,
  }
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

export function derivePlaybackProof(evidence: unknown, binding: PlaybackProofBinding = {}): PlaybackProjection {
  if (!isSafePlaybackEvidence(evidence))
    return { status: 'unverified' }

  const parsed = v.safeParse(PlaybackEvidenceSummarySchema, evidence)
  if (!parsed.success)
    return { status: 'unverified' }

  const candidate = parsed.output
  const observedEvents = new Map(candidate.events.map(event => [event.event, event]))
  const progress = candidate.playback.progress
  const progressDelta = progress.currentTimeAfter - progress.currentTimeBefore
  const eventGate = observedEvents.get('canplay')?.observed === true
    && observedEvents.get('playing')?.observed === true
    && observedEvents.get('error')?.observed === false
  const tupleMatches = (binding.taskId === undefined || candidate.tuple.taskId === binding.taskId)
    && (binding.runId === undefined || candidate.tuple.runId === binding.runId)
    && (binding.attemptNumber === undefined || candidate.tuple.attemptNumber === binding.attemptNumber)
    && (binding.provider === undefined || candidate.tuple.provider === binding.provider)
    && (binding.contentId === undefined || candidate.contentId === binding.contentId)
    && (binding.sourceRevision === undefined || candidate.sourceRevision === binding.sourceRevision)
  const evidenceInWindow = (binding.now === undefined || (
    (binding.windowStartedAt === undefined || candidate.observedAt >= binding.windowStartedAt)
    && (binding.windowEndsAt === undefined || candidate.observedAt <= binding.windowEndsAt)
  ))
  const internallyConsistent = candidate.outcome === 'accepted'
    && candidate.provider.status === 'succeeded'
    && (candidate.repair.status === 'validated' || candidate.repair.status === 'succeeded')
    && candidate.source.status === 'ready'
    && candidate.source.revision === candidate.sourceRevision
    && candidate.repair.sourceRevision === candidate.sourceRevision
    && candidate.playback.status === 'playback_verified'
    && candidate.playback.canplay === true
    && candidate.playback.playing === true
    && candidate.playback.error === false
    && eventGate
    && progress.currentTimeAfter >= progress.currentTimeBefore
    && Math.abs(progress.currentTimeDelta - progressDelta) < 0.001
    && progress.currentTimeDelta >= 1
    && tupleMatches
    && evidenceInWindow

  if (!internallyConsistent)
    return { status: 'unverified' }

  return {
    evidence: { currentTime: progress.currentTimeAfter, observedAt: candidate.observedAt },
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
    playback: derivePlaybackProof(input.playbackEvidence, {
      contentId: input.contentId,
      sourceRevision: input.source.sourceRevision,
    }),
    receipt: {
      persisted: input.receipt?.persisted ?? false,
      primaryContentId: input.receipt?.primaryContentId ?? null,
      schemaVersion: input.receipt?.schemaVersion ?? null,
    },
    source: deriveSourceReadiness(input.source),
  }
}

function toEpochSeconds(value: Date | number | null | undefined): number | null {
  if (value instanceof Date) {
    const seconds = Math.floor(value.getTime() / 1000)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

function normalizedSourceState(
  state: ServerSourceState | null | undefined,
  fallbackObservedAt: number,
): SourceReadinessProjection {
  if (!state) {
    return deriveSourceReadiness({
      candidates: [],
      failure: { reasonCode: 'source_read_failed' },
      observedAt: fallbackObservedAt,
      sourceRevision: 0,
    })
  }

  const observedAt = toEpochSeconds(state.observedAt) ?? fallbackObservedAt
  const sourceRevision = Number.isSafeInteger(state.sourceRevision) && state.sourceRevision >= 0
    ? state.sourceRevision
    : 0
  const eligibleCount = Number.isSafeInteger(state.eligibleCount) && state.eligibleCount >= 0
    ? state.eligibleCount
    : 0

  return {
    disposition: state.disposition,
    eligibleCount,
    observedAt,
    reasonCode: isSourceReasonCode(state.reasonCode) ? state.reasonCode : null,
    repairable: state.repairable === true,
    sourceRevision,
  }
}

/** Projects persisted API facts without deriving readiness from player rows. */
export function createServerReadinessProjection(input: ServerReadinessProjectionInput): ReadinessProjection {
  const fallbackObservedAt = toEpochSeconds(input.metadataObservedAt) ?? Math.floor(Date.now() / 1000)
  const primaryContentId = input.receipt?.primaryContentId === input.contentId
    ? input.contentId
    : null
  const source = normalizedSourceState(input.sourceState, fallbackObservedAt)

  return {
    metadata: {
      contentId: input.contentId,
      observedAt: toEpochSeconds(input.metadataObservedAt),
      persisted: true,
    },
    playback: derivePlaybackProof(input.playbackEvidence, {
      contentId: input.contentId,
      sourceRevision: source.sourceRevision,
    }),
    receipt: {
      persisted: input.receipt?.persisted === true && primaryContentId !== null,
      primaryContentId,
      schemaVersion: primaryContentId === null ? null : (input.receipt?.schemaVersion ?? null),
    },
    source,
  }
}
