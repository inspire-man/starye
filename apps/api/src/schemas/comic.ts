import * as v from 'valibot'
import { OptionalKeywordSchema, PageNumberSchema, SlugSchema, StatusSchema, TimestampSchema } from './common'

/**
 * 漫画章节 Schema
 */
export const ChapterItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('章节 ID')),
    title: v.pipe(v.string(), v.description('章节标题')),
    chapterNumber: v.pipe(v.string(), v.description('章节编号')),
    sortOrder: v.pipe(v.number(), v.integer(), v.description('排序序号')),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'ChapterItem' }),
)

export type ChapterItem = v.InferOutput<typeof ChapterItemSchema>

/**
 * 漫画条目 Schema（列表项）
 */
export const ComicItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('漫画 ID')),
    slug: SlugSchema,
    title: v.pipe(v.string(), v.description('漫画标题')),
    cover: v.nullable(v.pipe(v.string(), v.url(), v.description('封面图片 URL'))),
    author: v.nullable(v.pipe(v.string(), v.description('作者'))),
    status: StatusSchema,
    genres: v.nullable(v.pipe(v.string(), v.description('类型标签（逗号分隔）'))),
    isR18: v.pipe(v.boolean(), v.description('是否为 R18 内容')),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.examples([
    {
      id: 'cm_one_piece',
      slug: 'one-piece',
      title: '海贼王',
      cover: 'https://cdn.example.com/one-piece.jpg',
      author: '尾田荣一郎',
      status: 'ongoing',
      genres: '冒险,热血,奇幻',
      isR18: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
    },
  ]),
  v.metadata({ ref: 'ComicItem' }),
)

export type ComicItem = v.InferOutput<typeof ComicItemSchema>

/**
 * 漫画详情 Schema（包含章节列表）
 */
export const ComicDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    slug: SlugSchema,
    title: v.string(),
    cover: v.nullable(v.pipe(v.string(), v.url())),
    author: v.nullable(v.string()),
    status: StatusSchema,
    description: v.nullable(v.string()),
    genres: v.nullable(v.string()),
    isR18: v.boolean(),
    sourceUrl: v.nullable(v.pipe(v.string(), v.url())),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    chapters: v.array(ChapterItemSchema),
  }),
  v.metadata({ ref: 'ComicDetail' }),
)

export type ComicDetail = v.InferOutput<typeof ComicDetailSchema>

/**
 * 章节详情 Schema（包含图片列表）
 */
export const ChapterDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    title: v.string(),
    chapterNumber: v.string(),
    images: v.array(v.pipe(v.string(), v.url())),
  }),
  v.metadata({ ref: 'ChapterDetail' }),
)

export type ChapterDetail = v.InferOutput<typeof ChapterDetailSchema>

/**
 * 获取漫画列表的 Query Schema
 */
export const GetComicsQuerySchema = v.object({
  page: v.optional(PageNumberSchema, '1'),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100),
      v.examples([20, 50]),
      v.description('每页条数，最大 100'),
    ),
    '20',
  ),
  category: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['冒险', '热血', '奇幻']),
      v.description('类型筛选'),
    ),
  ),
  status: v.optional(
    v.pipe(
      v.picklist(['serializing', 'completed']),
      v.description('状态筛选：连载中、已完结'),
    ),
  ),
  search: OptionalKeywordSchema,
  sortBy: v.optional(
    v.pipe(
      v.picklist(['createdAt', 'updatedAt', 'title']),
      v.description('排序字段'),
    ),
    'updatedAt',
  ),
  sortOrder: v.optional(
    v.pipe(
      v.picklist(['asc', 'desc']),
      v.description('排序方向'),
    ),
    'desc',
  ),
})

export type GetComicsQuery = v.InferOutput<typeof GetComicsQuerySchema>

/**
 * 获取漫画详情的 Param Schema
 */
export const GetComicParamSchema = v.object({
  slug: SlugSchema,
})

/**
 * 获取章节详情的 Param Schema
 */
export const GetChapterParamSchema = v.object({
  slug: SlugSchema,
  chapterId: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('章节 ID'),
  ),
})

/**
 * 漫画列表响应数据 Schema
 */
export const ComicsListDataSchema = v.pipe(
  v.object({
    data: v.array(ComicItemSchema),
    pagination: v.object({
      page: v.pipe(v.number(), v.integer(), v.minValue(1)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
      total: v.pipe(v.number(), v.integer(), v.minValue(0)),
      totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  }),
  v.metadata({ ref: 'ComicsListData' }),
)

export type ComicsListData = v.InferOutput<typeof ComicsListDataSchema>
