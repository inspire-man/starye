import * as v from 'valibot'
import { SlugSchema, TimestampSchema } from './common'

/**
 * 保存阅读进度 Schema
 */
export const SaveReadingProgressSchema = v.object({
  chapterId: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('章节 ID'),
  ),
  page: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.description('当前页码'),
  ),
})

export type SaveReadingProgress = v.InferOutput<typeof SaveReadingProgressSchema>

/**
 * 获取阅读进度 Query Schema
 */
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
      v.description('漫画 slug（查询整个漫画的进度历史）'),
    ),
  ),
})

export type GetReadingProgressQuery = v.InferOutput<typeof GetReadingProgressQuerySchema>

/**
 * 阅读进度条目 Schema
 */
export const ReadingProgressItemSchema = v.pipe(
  v.object({
    id: v.string(),
    chapterId: v.string(),
    page: v.pipe(v.number(), v.integer(), v.minValue(1)),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'ReadingProgressItem' }),
)

export type ReadingProgressItem = v.InferOutput<typeof ReadingProgressItemSchema>

/**
 * 保存观看进度 Schema
 */
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
  duration: v.pipe(
    v.number(),
    v.minValue(0),
    v.description('影片总时长（秒）'),
  ),
})

export type SaveWatchingProgress = v.InferOutput<typeof SaveWatchingProgressSchema>

/**
 * 获取观看进度 Query Schema
 */
export const GetWatchingProgressQuerySchema = v.object({
  movieCode: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.description('影片番号（查询单个影片进度）'),
    ),
  ),
})

export type GetWatchingProgressQuery = v.InferOutput<typeof GetWatchingProgressQuerySchema>

/**
 * 观看进度条目 Schema
 */
export const WatchingProgressItemSchema = v.pipe(
  v.object({
    id: v.string(),
    movieCode: v.string(),
    currentTime: v.pipe(v.number(), v.minValue(0)),
    duration: v.pipe(v.number(), v.minValue(0)),
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'WatchingProgressItem' }),
)

export type WatchingProgressItem = v.InferOutput<typeof WatchingProgressItemSchema>
