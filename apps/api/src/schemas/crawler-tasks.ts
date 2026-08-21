import * as v from 'valibot'

const TaskIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const CursorSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^[\w-]{16,256}$/u, 'Invalid opaque cursor'),
)
const IdempotencyKeySchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const PolicyReferenceSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256))
const PolicyVersionSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

const OperationSchema = v.picklist([
  'movie',
  'manga',
  'repair_players',
  'check_video_source',
  'recheck_video_source',
  'repair_video_source',
  'check_comic_chapters',
  'recheck_comic_chapters',
  'repair_comic_chapters',
  'check_chapter_pages',
  'recheck_chapter_pages',
  'repair_chapter_pages',
])
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
const VideoSourceIntentSchema = v.strictObject({
  kind: v.picklist(['check_video_source', 'recheck_video_source', 'repair_video_source']),
  movieRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  policyVersion: PolicyVersionSchema,
  reason: v.picklist([
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
  ]),
  sourceKind: v.optional(v.picklist(['direct', 'magnet'])),
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
})
const ComicChapterIntentSchema = v.pipe(
  v.strictObject({
    chapterIds: v.optional(v.pipe(v.array(TaskIdSchema), v.minLength(1), v.maxLength(200))),
    chapterUrl: v.optional(v.pipe(v.string(), v.url(), v.maxLength(1024))),
    comicId: TaskIdSchema,
    finding: v.picklist(['missing', 'duplicate', 'extra', 'order', 'sequence_gap', 'source_unavailable', 'source_partial', 'source_inconclusive']),
    kind: v.picklist(['check_comic_chapters', 'recheck_comic_chapters', 'repair_comic_chapters']),
    policyVersion: PolicyVersionSchema,
    sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  }),
  v.check(value => value.kind !== 'repair_comic_chapters' || Boolean(value.chapterIds?.length), 'targeted chapter repair requires chapterIds'),
)
const ChapterPageIntentSchema = v.pipe(
  v.strictObject({
    chapterId: TaskIdSchema,
    chapterUrl: v.optional(v.pipe(v.string(), v.url(), v.maxLength(1024))),
    comicId: TaskIdSchema,
    finding: v.picklist(['missing_page', 'duplicate_page_number', 'page_order', 'url_invalid', 'http_failure', 'redirect', 'challenge_html', 'content_type_invalid', 'content_type_missing', 'timeout', 'probe_failed', 'unknown']),
    kind: v.picklist(['check_chapter_pages', 'recheck_chapter_pages', 'repair_chapter_pages']),
    pageIdentities: v.optional(v.pipe(v.array(TaskIdSchema), v.minLength(1), v.maxLength(200))),
    pageNumbers: v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000))), v.minLength(1), v.maxLength(200))),
    policyVersion: PolicyVersionSchema,
    sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  }),
  v.check(value => value.kind !== 'repair_chapter_pages' || Boolean(value.pageIdentities?.length || value.pageNumbers?.length), 'targeted page repair requires page selection'),
)
const OperationIntentSchema = v.union([
  CrawlIntentSchema,
  RepairIntentSchema,
  VideoSourceIntentSchema,
  ComicChapterIntentSchema,
  ChapterPageIntentSchema,
])
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

const ComicChapterAvailabilityCommandSchema = v.pipe(
  v.strictObject({
    chapterIds: v.optional(v.pipe(v.array(TaskIdSchema), v.minLength(1), v.maxLength(200))),
    chapterUrl: v.optional(v.pipe(v.string(), v.url(), v.maxLength(1024))),
    comicId: TaskIdSchema,
    finding: v.picklist(['missing', 'duplicate', 'extra', 'order', 'sequence_gap', 'source_unavailable', 'source_partial', 'source_inconclusive']),
    idempotencyKey: IdempotencyKeySchema,
    operation: v.picklist(['check_comic_chapters', 'recheck_comic_chapters', 'repair_comic_chapters']),
  }),
  v.check(value => value.operation !== 'repair_comic_chapters' || Boolean(value.chapterIds?.length), 'targeted chapter repair requires chapterIds'),
)

const ChapterPageAvailabilityCommandSchema = v.pipe(
  v.strictObject({
    chapterId: TaskIdSchema,
    chapterUrl: v.optional(v.pipe(v.string(), v.url(), v.maxLength(1024))),
    comicId: TaskIdSchema,
    finding: v.picklist(['missing_page', 'duplicate_page_number', 'page_order', 'url_invalid', 'http_failure', 'redirect', 'challenge_html', 'content_type_invalid', 'content_type_missing', 'timeout', 'probe_failed', 'unknown']),
    idempotencyKey: IdempotencyKeySchema,
    operation: v.picklist(['check_chapter_pages', 'recheck_chapter_pages', 'repair_chapter_pages']),
    pageIdentities: v.optional(v.pipe(v.array(TaskIdSchema), v.minLength(1), v.maxLength(200))),
    pageNumbers: v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000))), v.minLength(1), v.maxLength(200))),
  }),
  v.check(value => value.operation !== 'repair_chapter_pages' || Boolean(value.pageIdentities?.length || value.pageNumbers?.length), 'targeted page repair requires page selection'),
)

export const ChapterAvailabilityCommandSchema = v.union([
  ComicChapterAvailabilityCommandSchema,
  ChapterPageAvailabilityCommandSchema,
])

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
  operation: OperationSchema,
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
