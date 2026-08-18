import * as v from 'valibot'

const TaskIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const CursorSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^[\w-]{16,256}$/u, 'Invalid opaque cursor'),
)

const OperationSchema = v.picklist(['movie', 'manga', 'repair_players'])
const OperationTargetSchema = v.strictObject({
  id: TaskIdSchema,
  kind: v.picklist(['movie', 'manga']),
})
const CrawlIntentSchema = v.strictObject({ kind: v.literal('crawl') })
const RepairIntentSchema = v.strictObject({
  kind: v.literal('repair_players'),
  reason: v.picklist(['no_source', 'source_failed']),
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  targetIntent: v.literal('restore_playable_sources'),
})
const OperationIntentSchema = v.union([CrawlIntentSchema, RepairIntentSchema])
const IdempotencyKeySchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const PolicyReferenceSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256))
const PolicyVersionSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

export const CreateCrawlerTaskSchema = v.pipe(
  v.strictObject({
    idempotencyKey: v.optional(IdempotencyKeySchema),
    intent: v.optional(OperationIntentSchema),
    operation: v.optional(OperationSchema),
    policyReference: v.optional(PolicyReferenceSchema),
    policyVersion: v.optional(PolicyVersionSchema),
    target: v.optional(OperationTargetSchema),
    template: v.optional(v.picklist(['movie', 'manga'])),
  }),
  v.check(value => Boolean(value.template || value.operation), 'template or operation is required'),
)

const MovieIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

export const CreateRepairPlayersTaskSchema = v.strictObject({
  idempotencyKey: v.optional(IdempotencyKeySchema),
  movieId: MovieIdSchema,
  reason: v.picklist(['no_source', 'source_failed']),
  targetIntent: v.literal('restore_playable_sources'),
})

export const VideoAvailabilityCommandSchema = v.strictObject({
  idempotencyKey: IdempotencyKeySchema,
  movieId: MovieIdSchema,
  reason: v.picklist([
    'no_source',
    'source_failed',
    'stale',
    'direct_blocked',
    'direct_transport_failed',
    'direct_content_invalid',
    'browser_inconclusive',
    'metadata_unresolved',
    'no_peer',
    'stalled',
    'stream_missing',
    'stream_failed',
    'playback_unverified',
    'playback_failed',
  ]),
  sourceKind: v.optional(v.picklist(['direct', 'magnet'])),
})

export const UpdateCrawlerTaskSchema = v.pipe(
  v.strictObject({
    description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(256))),
    intent: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(128))),
  }),
  v.check(value => value.description !== undefined || value.intent !== undefined, 'metadata is empty'),
)

export const SupersedeCrawlerTaskSchema = v.strictObject({
  idempotencyKey: IdempotencyKeySchema,
  intent: OperationIntentSchema,
  operation: v.picklist(['movie', 'manga', 'repair_players']),
  policyReference: PolicyReferenceSchema,
  policyVersion: PolicyVersionSchema,
  target: OperationTargetSchema,
})

export const RetryCrawlerTaskSchema = v.strictObject({
  confirmed: v.literal(true),
})

export const CrawlerTaskIdParamsSchema = v.strictObject({
  taskId: TaskIdSchema,
})

export const CrawlerTaskRunParamsSchema = v.strictObject({
  runId: TaskIdSchema,
  taskId: TaskIdSchema,
})

export const ListCrawlerTasksQuerySchema = v.strictObject({
  cursor: v.optional(CursorSchema),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(50)), '20'),
  lifecycle: v.optional(v.picklist(['active', 'archived', 'superseded'])),
  template: v.optional(v.picklist(['movie', 'manga'])),
})

export const CrawlerTaskLogsQuerySchema = v.strictObject({
  cursor: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(50)), '50'),
})

export const CrawlerTaskCursorSchema = CursorSchema

export const CrawlerTaskAuditQuerySchema = v.strictObject({
  cursor: v.optional(v.pipe(v.string(), v.trim(), v.regex(/^\d{1,12}:[\w-]{1,128}$/u, 'Invalid audit cursor'))),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(50)), '50'),
})
