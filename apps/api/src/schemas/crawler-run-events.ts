import * as v from 'valibot'

const Identifier = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

const Attempt = v.pipe(v.number(), v.integer(), v.minValue(1))
const Sequence = v.pipe(v.number(), v.integer(), v.minValue(1))
const Timestamp = v.pipe(v.number(), v.integer())

export const CrawlerRunSnapshotSchema = v.strictObject({
  entrypoint: v.picklist(['movie-crawler', 'manga-crawler']),
  permissionResource: v.picklist(['movie', 'comic']),
  templateKey: v.picklist(['movie', 'manga']),
  templateVersion: v.literal(1),
})

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

export const CrawlerRunEventSchema = v.strictObject({
  attempt: Attempt,
  code: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))),
  counts: v.optional(v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)))),
  event_id: Identifier,
  key_id: Identifier,
  level: v.optional(v.picklist(['debug', 'info', 'warn', 'error'])),
  message: v.optional(v.pipe(v.string(), v.maxLength(16_384))),
  nonce: Identifier,
  receipt: v.optional(v.strictObject({
    contentIds: v.pipe(v.array(Identifier), v.minLength(1), v.maxLength(100)),
    createdCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000))),
    templateKey: v.picklist(['movie', 'manga']),
    updatedCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000))),
  })),
  run_id: Identifier,
  sequence: Sequence,
  timestamp: Timestamp,
  type: v.picklist(['heartbeat', 'progress', 'log', 'succeeded', 'failed', 'cancelled']),
})

export type CrawlerRunEvent = v.InferOutput<typeof CrawlerRunEventSchema>
