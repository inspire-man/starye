import * as v from 'valibot'

const TaskIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const CursorSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))

export const CreateCrawlerTaskSchema = v.strictObject({
  template: v.picklist(['movie', 'manga']),
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
  template: v.optional(v.picklist(['movie', 'manga'])),
})

export const CrawlerTaskLogsQuerySchema = v.strictObject({
  cursor: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(50)), '50'),
})
