import type { PlaybackEvidenceRequest, PlaybackEvidenceSummary, PlaybackRejectionHistory } from '../domain/playback-evidence/types'

import * as v from 'valibot'
import {
  PLAYBACK_EVENT_VALUES,
  PLAYBACK_EVIDENCE_SCHEMA_VERSION,
  PLAYBACK_OUTCOME_VALUES,
  PLAYBACK_PROVIDER_STATUS_VALUES,
  PLAYBACK_PROVIDER_VALUES,
  PLAYBACK_REJECTION_VALUES,
  PLAYBACK_REPAIR_STATUS_VALUES,
  PLAYBACK_SOURCE_STATUS_VALUES,
  PLAYBACK_SOURCE_TYPE_VALUES,
  PLAYBACK_STATUS_VALUES,

} from '../domain/playback-evidence/types'

const IdentifierSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const TimestampSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_102_444_800))
const AttemptSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2))
const RevisionSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000))
const FiniteSecondsSchema = v.pipe(v.number(), v.check(value => Number.isFinite(value), 'must be finite'), v.minValue(0), v.maxValue(86_400))
const ViewerPathSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\/(?:movie|dashboard)\/[\w.~-]+(?:\/[\w.~-]+)*$/u),
  v.maxLength(256),
)
const SafeLabelSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const ArtifactReferenceSchema = v.strictObject({
  hash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  reference: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
  stem: v.pipe(v.string(), v.regex(/^[\w.-]{1,192}$/u)),
})

const TupleSchema = v.strictObject({
  attemptNumber: AttemptSchema,
  provider: v.picklist(PLAYBACK_PROVIDER_VALUES),
  runId: IdentifierSchema,
  taskId: IdentifierSchema,
})

const ProviderSchema = v.strictObject({
  provider: v.picklist(PLAYBACK_PROVIDER_VALUES),
  status: v.picklist(PLAYBACK_PROVIDER_STATUS_VALUES),
})

const RepairSchema = v.strictObject({
  sourceRevision: RevisionSchema,
  status: v.picklist(PLAYBACK_REPAIR_STATUS_VALUES),
})

const SourceSchema = v.strictObject({
  revision: RevisionSchema,
  sourceType: v.picklist(PLAYBACK_SOURCE_TYPE_VALUES),
  status: v.picklist(PLAYBACK_SOURCE_STATUS_VALUES),
})

const ViewerSchema = v.strictObject({
  path: ViewerPathSchema,
  targetLabel: SafeLabelSchema,
})

const EventSchema = v.strictObject({
  event: v.picklist(PLAYBACK_EVENT_VALUES),
  observed: v.boolean(),
  observedAt: v.nullable(TimestampSchema),
})

const EventTimelineSchema = v.pipe(
  v.array(EventSchema),
  v.length(PLAYBACK_EVENT_VALUES.length),
  v.check((events) => {
    const names = events.map(event => event.event)
    return new Set(names).size === PLAYBACK_EVENT_VALUES.length
      && PLAYBACK_EVENT_VALUES.every(event => names.includes(event))
  }, 'event timeline must contain one observation for each allowlisted event'),
)

const ProgressSchema = v.strictObject({
  currentTimeAfter: FiniteSecondsSchema,
  currentTimeBefore: FiniteSecondsSchema,
  currentTimeDelta: FiniteSecondsSchema,
})

const PlaybackSchema = v.strictObject({
  canplay: v.boolean(),
  error: v.boolean(),
  playing: v.boolean(),
  progress: ProgressSchema,
  status: v.picklist(PLAYBACK_STATUS_VALUES),
})

export const PlaybackEvidenceRequestSchema = v.strictObject({
  contentId: IdentifierSchema,
  events: EventTimelineSchema,
  observedAt: TimestampSchema,
  playback: PlaybackSchema,
  provider: ProviderSchema,
  repair: RepairSchema,
  schemaVersion: v.literal(PLAYBACK_EVIDENCE_SCHEMA_VERSION),
  source: SourceSchema,
  sourceRevision: RevisionSchema,
  tuple: TupleSchema,
  viewer: ViewerSchema,
})

export const PlaybackEvidenceSummarySchema = v.strictObject({
  ...PlaybackEvidenceRequestSchema.entries,
  artifact: ArtifactReferenceSchema,
  outcome: v.picklist(PLAYBACK_OUTCOME_VALUES),
})

export const PlaybackRejectionHistorySchema = v.strictObject({
  contentId: IdentifierSchema,
  observedAt: TimestampSchema,
  outcome: v.picklist(PLAYBACK_REJECTION_VALUES),
  sourceRevision: RevisionSchema,
  tuple: TupleSchema,
})

export type PlaybackEvidenceRequestOutput = v.InferOutput<typeof PlaybackEvidenceRequestSchema> & PlaybackEvidenceRequest
export type PlaybackEvidenceSummaryOutput = v.InferOutput<typeof PlaybackEvidenceSummarySchema> & PlaybackEvidenceSummary
export type PlaybackRejectionHistoryOutput = v.InferOutput<typeof PlaybackRejectionHistorySchema> & PlaybackRejectionHistory

export const PlaybackEvidenceResponseSchema = PlaybackEvidenceSummarySchema
