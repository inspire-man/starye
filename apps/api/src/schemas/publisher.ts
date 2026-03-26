import * as v from 'valibot'
import { PageNumberSchema, SlugSchema, TimestampSchema } from './common'

/**
 * 出版商条目 Schema
 */
export const PublisherItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('出版商 ID')),
    slug: SlugSchema,
    name: v.pipe(v.string(), v.description('出版商名称')),
    logo: v.nullable(v.pipe(v.string(), v.url(), v.description('Logo URL'))),
    movieCount: v.pipe(v.number(), v.integer(), v.minValue(0), v.description('作品数量')),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.examples([
    {
      id: 'pub_123',
      slug: 'publisher-name',
      name: '出版商名称',
      logo: 'https://cdn.example.com/publisher.jpg',
      movieCount: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
    },
  ]),
  v.metadata({ ref: 'PublisherItem' }),
)

export type PublisherItem = v.InferOutput<typeof PublisherItemSchema>

/**
 * 出版商详情 Schema
 */
export const PublisherDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    slug: SlugSchema,
    name: v.string(),
    logo: v.nullable(v.pipe(v.string(), v.url())),
    description: v.nullable(v.string()),
    movieCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'PublisherDetail' }),
)

export type PublisherDetail = v.InferOutput<typeof PublisherDetailSchema>

/**
 * 获取出版商列表的 Query Schema
 */
export const GetPublishersQuerySchema = v.object({
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
  sort: v.optional(
    v.pipe(
      v.picklist(['name', 'movieCount', 'createdAt']),
      v.description('排序字段'),
    ),
    'name',
  ),
})

export type GetPublishersQuery = v.InferOutput<typeof GetPublishersQuerySchema>

/**
 * 获取出版商详情的 Param Schema
 */
export const GetPublisherParamSchema = v.object({
  slug: SlugSchema,
})

/**
 * 出版商列表响应数据 Schema
 */
export const PublishersListDataSchema = v.pipe(
  v.object({
    data: v.array(PublisherItemSchema),
    pagination: v.object({
      page: v.pipe(v.number(), v.integer(), v.minValue(1)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
      total: v.pipe(v.number(), v.integer(), v.minValue(0)),
      totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  }),
  v.metadata({ ref: 'PublishersListData' }),
)

export type PublishersListData = v.InferOutput<typeof PublishersListDataSchema>
