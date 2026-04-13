import * as v from 'valibot'
import { OptionalKeywordSchema, PageNumberSchema, TimestampSchema } from './common'

/**
 * 播放源 Schema
 */
export const PlayerItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('播放源 ID')),
    name: v.pipe(v.string(), v.description('播放源名称')),
    url: v.pipe(v.string(), v.url(), v.description('播放地址')),
    sortOrder: v.pipe(v.number(), v.integer(), v.description('排序序号')),
  }),
  v.metadata({ ref: 'PlayerItem' }),
)

export type PlayerItem = v.InferOutput<typeof PlayerItemSchema>

/**
 * 影片条目 Schema（列表项）
 */
export const MovieItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('影片 ID')),
    code: v.pipe(v.string(), v.description('影片番号')),
    title: v.pipe(v.string(), v.description('影片标题')),
    cover: v.nullable(v.pipe(v.string(), v.url(), v.description('封面图片 URL'))),
    actors: v.nullable(v.pipe(v.string(), v.description('演员列表（逗号分隔）'))),
    publisher: v.nullable(v.pipe(v.string(), v.description('出版商'))),
    genres: v.nullable(v.pipe(v.string(), v.description('类型标签（逗号分隔）'))),
    series: v.nullable(v.pipe(v.string(), v.description('系列名称'))),
    releaseDate: v.nullable(v.pipe(v.string(), v.description('发行日期'))),
    isR18: v.pipe(v.boolean(), v.description('是否为 R18 内容')),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.examples([
    {
      id: 'mv_example',
      code: 'ABC-123',
      title: '示例影片',
      cover: 'https://cdn.example.com/movie.jpg',
      actors: '演员A,演员B',
      publisher: '示例出版社',
      genres: '剧情,动作',
      series: '示例系列',
      releaseDate: '2026-01-15',
      isR18: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
    },
  ]),
  v.metadata({ ref: 'MovieItem' }),
)

export type MovieItem = v.InferOutput<typeof MovieItemSchema>

/**
 * 影片详情 Schema（包含播放源和相关影片）
 */
export const MovieDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    code: v.string(),
    title: v.string(),
    cover: v.nullable(v.pipe(v.string(), v.url())),
    actors: v.nullable(v.string()),
    publisher: v.nullable(v.string()),
    genres: v.nullable(v.string()),
    series: v.nullable(v.string()),
    releaseDate: v.nullable(v.string()),
    description: v.nullable(v.string()),
    isR18: v.boolean(),
    sourceUrl: v.nullable(v.pipe(v.string(), v.url())),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    players: v.array(PlayerItemSchema),
    relatedMovies: v.array(MovieItemSchema),
  }),
  v.metadata({ ref: 'MovieDetail' }),
)

export type MovieDetail = v.InferOutput<typeof MovieDetailSchema>

/**
 * 获取影片列表的 Query Schema
 */
export const GetMoviesQuerySchema = v.object({
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
  actor: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['演员A', '演员B']),
      v.description('演员筛选'),
    ),
  ),
  publisher: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['出版社A']),
      v.description('出版商筛选'),
    ),
  ),
  genre: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['剧情', '动作', '喜剧']),
      v.description('类型筛选'),
    ),
  ),
  series: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['示例系列']),
      v.description('系列名称筛选'),
    ),
  ),
  search: OptionalKeywordSchema,
  yearFrom: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^(20\d{2})$/, '年份格式错误，支持 2000-2099'),
      v.description('年份起（范围 2000-2099）'),
    ),
  ),
  yearTo: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^(20\d{2})$/, '年份格式错误，支持 2000-2099'),
      v.description('年份止（范围 2000-2099）'),
    ),
  ),
  durationMin: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+$/, '必须为正整数'),
      v.description('最短时长（分钟）'),
    ),
  ),
  durationMax: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+$/, '必须为正整数'),
      v.description('最长时长（分钟）'),
    ),
  ),
  sortBy: v.optional(
    v.pipe(
      v.picklist(['releaseDate', 'createdAt', 'updatedAt', 'title']),
      v.description('排序字段'),
    ),
    'releaseDate',
  ),
  sortOrder: v.optional(
    v.pipe(
      v.picklist(['asc', 'desc']),
      v.description('排序方向'),
    ),
    'desc',
  ),
})

export type GetMoviesQuery = v.InferOutput<typeof GetMoviesQuerySchema>

/**
 * 获取影片详情的 Param Schema
 */
export const GetMovieParamSchema = v.object({
  code: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('影片番号'),
  ),
})

/**
 * 影片列表响应数据 Schema
 */
export const MoviesListDataSchema = v.pipe(
  v.object({
    data: v.array(MovieItemSchema),
    pagination: v.object({
      page: v.pipe(v.number(), v.integer(), v.minValue(1)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
      total: v.pipe(v.number(), v.integer(), v.minValue(0)),
      totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  }),
  v.metadata({ ref: 'MoviesListData' }),
)

export type MoviesListData = v.InferOutput<typeof MoviesListDataSchema>
