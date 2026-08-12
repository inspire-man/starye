import * as v from 'valibot'

const Identifier = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

const Attempt = v.pipe(v.number(), v.integer(), v.minValue(1))
const Sequence = v.pipe(v.number(), v.integer(), v.minValue(1))
const Timestamp = v.pipe(v.number(), v.integer())
const IsoTimestamp = v.pipe(v.string(), v.trim(), v.isoTimestamp())
const Sha = v.pipe(v.string(), v.regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u))
const ProviderWorkflow = v.picklist([
  '.github/workflows/daily-manga-crawl.yml',
  '.github/workflows/daily-movie-crawl.yml',
])
const ProviderTemplate = v.picklist(['movie', 'manga'])
const ProviderRepository = v.literal('inspire-man/starye')
const ProviderRef = v.literal('main')
const ProviderEnvironment = v.literal('starye-org')
const ProviderTarget = v.literal('starye-org')

const RunnerEventFields = {
  event_id: Identifier,
  key_id: Identifier,
  nonce: Identifier,
  timestamp: Timestamp,
}

const RepairReceiptSchema = v.strictObject({
  movieId: Identifier,
  observedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  operation: v.literal('repair_players'),
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  sourceSummary: v.pipe(v.array(v.strictObject({
    eligible: v.boolean(),
    health: v.picklist(['inactive', 'unverified', 'failed']),
    observedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
    reasonCode: v.picklist([
      'source_inactive',
      'source_unverified',
      'source_candidate_invalid',
      'source_read_failed',
      'source_write_failed',
    ]),
    sourceType: v.picklist(['direct', 'magnet', 'TorrServer']),
  })), v.minLength(1), v.maxLength(50)),
})

const OrdinaryCrawlerRunSnapshotSchema = v.strictObject({
  entrypoint: v.picklist(['movie-crawler', 'manga-crawler']),
  permissionResource: v.picklist(['movie', 'comic']),
  templateKey: v.picklist(['movie', 'manga']),
  templateVersion: v.literal(1),
})

const RepairCrawlerRunSnapshotSchema = v.strictObject({
  entrypoint: v.literal('movie-crawler'),
  movieId: Identifier,
  operation: v.literal('repair_players'),
  permissionResource: v.literal('movie'),
  reason: v.picklist(['no_source', 'source_failed']),
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  targetIntent: v.literal('restore_playable_sources'),
  templateKey: v.literal('movie'),
  templateVersion: v.literal(1),
})

export const CrawlerRunSnapshotSchema = v.union([
  OrdinaryCrawlerRunSnapshotSchema,
  RepairCrawlerRunSnapshotSchema,
])

export const CrawlerRunnerControlEnvelopeSchema = v.strictObject({
  event_id: Identifier,
  key_id: Identifier,
  nonce: Identifier,
  timestamp: Timestamp,
})

export const CrawlerRunPollRequestSchema = CrawlerRunnerControlEnvelopeSchema

export const CrawlerRunClaimRequestSchema = v.strictObject({
  attempt: Attempt,
  event_id: Identifier,
  key_id: Identifier,
  nonce: Identifier,
  run_id: Identifier,
  sequence: Sequence,
  timestamp: Timestamp,
})

export const CrawlerScheduleRegisterEventSchema = v.strictObject({
  ...RunnerEventFields,
  environment: ProviderEnvironment,
  ref: ProviderRef,
  repository: ProviderRepository,
  schedule_bucket: v.optional(Identifier),
  scheduled_at: IsoTimestamp,
  target: ProviderTarget,
  template: ProviderTemplate,
  type: v.literal('schedule_register'),
  workflow: ProviderWorkflow,
})

export const CrawlerProviderStartedEventSchema = v.strictObject({
  ...RunnerEventFields,
  attempt: Attempt,
  environment: ProviderEnvironment,
  provider_run_attempt: Attempt,
  provider_run_id: v.pipe(v.string(), v.regex(/^\d{1,20}$/u)),
  ref: ProviderRef,
  repository: ProviderRepository,
  run_id: Identifier,
  sha: Sha,
  target: ProviderTarget,
  template: ProviderTemplate,
  type: v.literal('provider_started'),
  workflow: ProviderWorkflow,
})

export const CrawlerDispatchValidationEventSchema = v.strictObject({
  ...RunnerEventFields,
  attempt: Attempt,
  environment: ProviderEnvironment,
  ref: ProviderRef,
  repository: ProviderRepository,
  run_id: Identifier,
  target: ProviderTarget,
  template: ProviderTemplate,
  type: v.literal('dispatch_validate'),
  workflow: ProviderWorkflow,
})

export const CrawlerRunPollResponseSchema = v.strictObject({
  candidate: v.nullable(v.strictObject({
    attempt: Attempt,
    run_id: Identifier,
    sequence: Sequence,
    snapshot: CrawlerRunSnapshotSchema,
  })),
})

export const CrawlerRunClaimResponseSchema = v.strictObject({
  accepted: v.boolean(),
  reason: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))),
})

export const CrawlerRunLifecycleEventSchema = v.strictObject({
  attempt: Attempt,
  code: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))),
  counts: v.optional(v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)))),
  event_id: Identifier,
  key_id: Identifier,
  level: v.optional(v.picklist(['debug', 'info', 'warn', 'error'])),
  message: v.optional(v.pipe(v.string(), v.maxLength(16_384))),
  nonce: Identifier,
  receipt: v.optional(v.union([
    v.strictObject({
      contentIds: v.pipe(v.array(Identifier), v.minLength(1), v.maxLength(100)),
      createdCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000))),
      templateKey: v.picklist(['movie', 'manga']),
      updatedCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000))),
    }),
    RepairReceiptSchema,
  ])),
  run_id: Identifier,
  sequence: Sequence,
  timestamp: Timestamp,
  type: v.picklist(['heartbeat', 'progress', 'log', 'succeeded', 'failed', 'cancelled']),
})

export const CrawlerRepairSourceObservationEventSchema = v.strictObject({
  ...RunnerEventFields,
  attempt: Attempt,
  observed_at: v.pipe(v.number(), v.integer(), v.minValue(0)),
  operation: v.literal('repair_players'),
  run_id: Identifier,
  sequence: Sequence,
  source_revision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  sources: v.pipe(v.array(v.strictObject({
    health: v.optional(v.picklist(['inactive', 'unverified', 'failed'])),
    isActive: v.optional(v.boolean()),
    quality: v.optional(v.pipe(v.string(), v.maxLength(4096))),
    reasonCode: v.optional(v.picklist([
      'source_inactive',
      'source_unverified',
      'source_candidate_invalid',
      'source_read_failed',
      'source_write_failed',
    ])),
    sortOrder: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    sourceName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4096)),
    sourceType: v.optional(v.picklist(['direct', 'magnet', 'TorrServer'])),
    sourceUrl: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4096)),
  })), v.maxLength(50)),
  timestamp: Timestamp,
  type: v.literal('source_observation'),
})

export const CrawlerAvailabilityObservationEventSchema = v.strictObject({
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
  content_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  event_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
  expected_projection_version: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000_000)),
  freshness: v.picklist(['fresh', 'stale', 'late']),
  key_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
  next_action: v.picklist(['none', 'recheck', 'repair', 'retry', 'ignore']),
  nonce: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
  observation_identity: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
  observed_at: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_102_444_800)),
  policy_reference: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256))),
  policy_version: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  provider: v.picklist(['github-actions', 'local-proof']),
  reason_code: v.picklist([
    'available',
    'no_source',
    'source_failed',
    'transport_failed',
    'content_missing',
    'policy_mismatch',
    'cancelled',
    'provider_failed',
    'observation_invalid',
  ]),
  run_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  sequence: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000_000)),
  source_revision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  status: v.picklist(['available', 'unavailable', 'degraded', 'unknown']),
  summary: v.unknown(),
  target: v.strictObject({
    id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
    kind: v.picklist(['movie', 'manga', 'video', 'chapter', 'image']),
  }),
  task_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  timestamp: v.pipe(v.number(), v.integer()),
  type: v.literal('availability_observation'),
})

export const CrawlerRunEventSchema = v.union([
  CrawlerRunLifecycleEventSchema,
  CrawlerScheduleRegisterEventSchema,
  CrawlerProviderStartedEventSchema,
  CrawlerDispatchValidationEventSchema,
  CrawlerAvailabilityObservationEventSchema,
])

export type CrawlerRunEvent = v.InferOutput<typeof CrawlerRunEventSchema>
export type CrawlerScheduleRegisterEvent = v.InferOutput<typeof CrawlerScheduleRegisterEventSchema>
export type CrawlerProviderStartedEvent = v.InferOutput<typeof CrawlerProviderStartedEventSchema>
