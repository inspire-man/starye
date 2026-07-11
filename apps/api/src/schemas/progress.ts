import * as v from 'valibot'
import { SlugSchema, TimestampSchema } from './common'

export const ProgressContentTypeSchema = v.picklist(['movie', 'comic'])
export type ProgressContentType = v.InferOutput<typeof ProgressContentTypeSchema>

export const SaveReadingProgressSchema = v.object({
  chapterId: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('真实章节 ID'),
  ),
  page: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.description('当前阅读页码'),
  ),
  completed: v.optional(
    v.pipe(v.boolean(), v.description('是否已读完当前章节')),
    false,
  ),
})

export type SaveReadingProgress = v.InferOutput<typeof SaveReadingProgressSchema>

export const GetReadingProgressQuerySchema = v.object({
  chapterId: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.description('章节 ID（查询单个章节进度）'),
    ),
  ),
  comicSlug: v.optional(
    v.pipe(
      SlugSchema,
      v.description('漫画 slug（查询整个漫画的阅读历史）'),
    ),
  ),
})

export type GetReadingProgressQuery = v.InferOutput<typeof GetReadingProgressQuerySchema>

export const SaveWatchingProgressSchema = v.object({
  movieCode: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('影片番号'),
  ),
  currentTime: v.pipe(
    v.number(),
    v.minValue(0),
    v.description('当前播放时间（秒）'),
  ),
  duration: v.optional(
    v.nullable(
      v.pipe(
        v.number(),
        v.minValue(0),
        v.description('影片总时长（秒）'),
      ),
    ),
    null,
  ),
  completed: v.optional(
    v.pipe(v.boolean(), v.description('是否已看完当前影片')),
    false,
  ),
})

export type SaveWatchingProgress = v.InferOutput<typeof SaveWatchingProgressSchema>

export const GetWatchingProgressQuerySchema = v.object({
  movieCode: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.description('影片番号（查询单个影片进度）'),
    ),
  ),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(50),
      v.description('返回条数（无 movieCode 时生效，默认 20，上限 50）'),
    ),
  ),
})

export type GetWatchingProgressQuery = v.InferOutput<typeof GetWatchingProgressQuerySchema>

export const ProgressItemSchema = v.pipe(
  v.object({
    id: v.string(),
    contentType: ProgressContentTypeSchema,
    contentId: v.string(),
    position: v.pipe(v.number(), v.integer(), v.minValue(0)),
    duration: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
    completed: v.boolean(),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'ProgressItem' }),
)

export type ProgressItem = v.InferOutput<typeof ProgressItemSchema>

export const ReadingProgressItemSchema = v.pipe(
  v.object({
    id: v.string(),
    contentType: v.literal('comic'),
    contentId: v.string(),
    chapterId: v.string(),
    comicSlug: v.optional(SlugSchema),
    comicTitle: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    position: v.pipe(v.number(), v.integer(), v.minValue(1)),
    page: v.pipe(v.number(), v.integer(), v.minValue(1)),
    duration: v.null(),
    completed: v.boolean(),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'ReadingProgressItem' }),
)

export type ReadingProgressItem = v.InferOutput<typeof ReadingProgressItemSchema>

export const WatchingProgressItemSchema = v.pipe(
  v.object({
    id: v.string(),
    contentType: v.literal('movie'),
    contentId: v.string(),
    movieCode: v.string(),
    position: v.pipe(v.number(), v.minValue(0)),
    progress: v.pipe(v.number(), v.minValue(0)),
    duration: v.nullable(v.pipe(v.number(), v.minValue(0))),
    completed: v.boolean(),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'WatchingProgressItem' }),
)

export type WatchingProgressItem = v.InferOutput<typeof WatchingProgressItemSchema>

export const WatchingHistoryItemSchema = v.pipe(
  v.object({
    id: v.string(),
    contentType: v.literal('movie'),
    contentId: v.string(),
    movieCode: v.string(),
    title: v.string(),
    coverImage: v.nullable(v.string()),
    isR18: v.boolean(),
    position: v.pipe(v.number(), v.minValue(0)),
    progress: v.pipe(v.number(), v.minValue(0)),
    duration: v.nullable(v.pipe(v.number(), v.minValue(0))),
    completed: v.boolean(),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'WatchingHistoryItem' }),
)

export type WatchingHistoryItem = v.InferOutput<typeof WatchingHistoryItemSchema>
