import * as v from 'valibot'

const Identifier = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

export const CrawlerRunEventSchema = v.strictObject({
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1)),
  code: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))),
  counts: v.optional(v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)))),
  event_id: Identifier,
  key_id: Identifier,
  level: v.optional(v.picklist(['debug', 'info', 'warn', 'error'])),
  message: v.optional(v.pipe(v.string(), v.maxLength(16_384))),
  nonce: Identifier,
  receipt: v.optional(v.strictObject({
    contentIds: v.pipe(v.array(Identifier), v.minLength(1), v.maxLength(100)),
    templateKey: v.picklist(['movie', 'manga']),
  })),
  run_id: Identifier,
  sequence: v.pipe(v.number(), v.integer(), v.minValue(1)),
  timestamp: v.pipe(v.number(), v.integer()),
  type: v.picklist(['heartbeat', 'progress', 'log', 'succeeded', 'failed', 'cancelled']),
})

export type CrawlerRunEvent = v.InferOutput<typeof CrawlerRunEventSchema>
