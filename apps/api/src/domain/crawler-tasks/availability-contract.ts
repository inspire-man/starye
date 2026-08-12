import type { BoundedAvailabilityEvidence } from './evidence-contract'
import { validateBoundedAvailabilityEvidence } from './evidence-contract'

export const AVAILABILITY_TARGET_KIND_VALUES = ['movie', 'manga', 'video', 'chapter', 'image'] as const
export type AvailabilityTargetKind = typeof AVAILABILITY_TARGET_KIND_VALUES[number]
export const AVAILABILITY_STATUS_VALUES = ['available', 'unavailable', 'degraded', 'unknown'] as const
export type AvailabilityStatus = typeof AVAILABILITY_STATUS_VALUES[number]
export const AVAILABILITY_FRESHNESS_VALUES = ['fresh', 'stale', 'late'] as const
export type AvailabilityFreshness = typeof AVAILABILITY_FRESHNESS_VALUES[number]
export const AVAILABILITY_REASON_VALUES = [
  'available',
  'no_source',
  'source_failed',
  'transport_failed',
  'content_missing',
  'policy_mismatch',
  'cancelled',
  'provider_failed',
  'observation_invalid',
] as const
export type AvailabilityReasonCode = typeof AVAILABILITY_REASON_VALUES[number]
export const AVAILABILITY_NEXT_ACTION_VALUES = ['none', 'recheck', 'repair', 'retry', 'ignore'] as const
export type AvailabilityNextAction = typeof AVAILABILITY_NEXT_ACTION_VALUES[number]
export type AvailabilityProvider = 'github-actions' | 'local-proof'

export interface AvailabilityTarget {
  readonly kind: AvailabilityTargetKind
  readonly id: string
}

export interface AvailabilityTuple {
  readonly taskId: string
  readonly runId: string
  readonly attemptNumber: number
  readonly provider: AvailabilityProvider
  readonly target: AvailabilityTarget
  readonly contentId: string
}

export interface AvailabilityObservation extends AvailabilityTuple {
  readonly sourceRevision: number
  readonly policyVersion: string
  readonly observationIdentity: string
  readonly eventSequence: number
  readonly observedAt: number
  readonly freshness: AvailabilityFreshness
  readonly status: AvailabilityStatus
  readonly reasonCode: AvailabilityReasonCode
  readonly nextAction: AvailabilityNextAction
  readonly summary: BoundedAvailabilityEvidence
}

export interface AvailabilityCurrentProjection extends AvailabilityObservation {
  readonly projectionVersion: number
}

export interface AvailabilityCasInput {
  readonly observation: AvailabilityObservation
  readonly current: AvailabilityCurrentProjection | null
  readonly expectedProjectionVersion: number
  readonly expectedSourceRevision: number
  readonly expectedPolicyVersion: string
  readonly expectedTuple: AvailabilityTuple
}

export const AVAILABILITY_REJECTION_VALUES = ['late', 'stale', 'duplicate', 'conflict'] as const
export type AvailabilityRejectionCode = typeof AVAILABILITY_REJECTION_VALUES[number]

export type AvailabilityCasResult
  = | {
    readonly accepted: true
    readonly projection: AvailabilityCurrentProjection
    readonly authoritativeReadback: AvailabilityCurrentProjection
  }
  | {
    readonly accepted: false
    readonly code: AvailabilityRejectionCode
    readonly authoritativeReadback: AvailabilityCurrentProjection | null
  }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: string): void {
  if (Object.keys(value).some(key => !keys.includes(key)))
    throw new Error(code)
}

function boundedString(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max)
    throw new Error(code)
  return value.trim()
}

function boundedInteger(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(code)
  return value
}

function validateTarget(value: unknown): AvailabilityTarget {
  if (!isRecord(value))
    throw new Error('availability_target_invalid')
  exactKeys(value, ['id', 'kind'], 'availability_target_unknown_field')
  if (!(AVAILABILITY_TARGET_KIND_VALUES as readonly string[]).includes(value.kind as string))
    throw new Error('availability_target_invalid')
  return Object.freeze({
    id: boundedString(value.id, 128, 'availability_target_invalid'),
    kind: value.kind as AvailabilityTargetKind,
  })
}

function validateTuple(value: unknown): AvailabilityTuple {
  if (!isRecord(value))
    throw new Error('availability_tuple_invalid')
  exactKeys(value, ['attemptNumber', 'contentId', 'provider', 'runId', 'target', 'taskId'], 'availability_tuple_unknown_field')
  if (value.provider !== 'github-actions' && value.provider !== 'local-proof')
    throw new Error('availability_tuple_invalid')
  return Object.freeze({
    attemptNumber: boundedInteger(value.attemptNumber, 1, 1_000_000, 'availability_tuple_invalid'),
    contentId: boundedString(value.contentId, 128, 'availability_tuple_invalid'),
    provider: value.provider,
    runId: boundedString(value.runId, 128, 'availability_tuple_invalid'),
    target: validateTarget(value.target),
    taskId: boundedString(value.taskId, 128, 'availability_tuple_invalid'),
  })
}

export function validateAvailabilityObservation(value: unknown): AvailabilityObservation {
  if (!isRecord(value))
    throw new Error('availability_observation_invalid')
  exactKeys(value, [
    'attemptNumber',
    'contentId',
    'eventSequence',
    'freshness',
    'nextAction',
    'observationIdentity',
    'observedAt',
    'policyVersion',
    'provider',
    'reasonCode',
    'runId',
    'sourceRevision',
    'status',
    'summary',
    'target',
    'taskId',
  ], 'availability_observation_unknown_field')
  const tuple = validateTuple({
    attemptNumber: value.attemptNumber,
    contentId: value.contentId,
    provider: value.provider,
    runId: value.runId,
    target: value.target,
    taskId: value.taskId,
  })
  if (!(AVAILABILITY_FRESHNESS_VALUES as readonly string[]).includes(value.freshness as string)
    || !(AVAILABILITY_STATUS_VALUES as readonly string[]).includes(value.status as string)
    || !(AVAILABILITY_REASON_VALUES as readonly string[]).includes(value.reasonCode as string)
    || !(AVAILABILITY_NEXT_ACTION_VALUES as readonly string[]).includes(value.nextAction as string)) {
    throw new Error('availability_observation_enum_invalid')
  }
  return Object.freeze({
    ...tuple,
    eventSequence: boundedInteger(value.eventSequence, 1, 1_000_000_000, 'availability_observation_invalid'),
    freshness: value.freshness as AvailabilityFreshness,
    nextAction: value.nextAction as AvailabilityNextAction,
    observationIdentity: boundedString(value.observationIdentity, 256, 'availability_observation_invalid'),
    observedAt: boundedInteger(value.observedAt, 0, 4_102_444_800, 'availability_observation_invalid'),
    policyVersion: boundedString(value.policyVersion, 128, 'availability_observation_invalid'),
    reasonCode: value.reasonCode as AvailabilityReasonCode,
    sourceRevision: boundedInteger(value.sourceRevision, 0, 1_000_000, 'availability_observation_invalid'),
    status: value.status as AvailabilityStatus,
    summary: validateBoundedAvailabilityEvidence(value.summary),
  })
}

function sameTuple(left: AvailabilityTuple, right: AvailabilityTuple): boolean {
  return left.taskId === right.taskId
    && left.runId === right.runId
    && left.attemptNumber === right.attemptNumber
    && left.provider === right.provider
    && left.target.kind === right.target.kind
    && left.target.id === right.target.id
    && left.contentId === right.contentId
}

export function classifyAvailabilityCas(input: AvailabilityCasInput): AvailabilityCasResult {
  const observation = validateAvailabilityObservation(input.observation)
  const current = input.current
  const expectedProjectionVersion = boundedInteger(input.expectedProjectionVersion, 0, 1_000_000_000, 'availability_cas_invalid')
  const expectedSourceRevision = boundedInteger(input.expectedSourceRevision, 0, 1_000_000, 'availability_cas_invalid')
  const expectedPolicyVersion = boundedString(input.expectedPolicyVersion, 128, 'availability_cas_invalid')
  const expectedTuple = validateTuple(input.expectedTuple)

  if (current && current.observationIdentity === observation.observationIdentity) {
    return { accepted: false, authoritativeReadback: current, code: 'duplicate' }
  }
  if (!sameTuple(observation, expectedTuple)) {
    return { accepted: false, authoritativeReadback: current, code: 'conflict' }
  }
  if (observation.freshness === 'late' || (current && observation.observedAt < current.observedAt)) {
    return { accepted: false, authoritativeReadback: current, code: 'late' }
  }
  if (observation.sourceRevision < expectedSourceRevision
    || (current && observation.sourceRevision < current.sourceRevision)) {
    return { accepted: false, authoritativeReadback: current, code: 'stale' }
  }
  if (observation.policyVersion !== expectedPolicyVersion
    || (current && observation.policyVersion !== current.policyVersion)) {
    return { accepted: false, authoritativeReadback: current, code: 'conflict' }
  }
  if (current && current.projectionVersion !== expectedProjectionVersion) {
    return { accepted: false, authoritativeReadback: current, code: 'stale' }
  }

  const projection: AvailabilityCurrentProjection = Object.freeze({
    ...observation,
    projectionVersion: expectedProjectionVersion + 1,
  })
  return { accepted: true, authoritativeReadback: projection, projection }
}
