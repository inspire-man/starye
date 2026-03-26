import * as v from 'valibot'
import { PageNumberSchema, SlugSchema, TimestampSchema } from './common'

/**
 * 演员条目 Schema
 */
export const ActorItemSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.description('演员 ID')),
    slug: SlugSchema,
    name: v.pipe(v.string(), v.description('演员姓名')),
    avatar: v.nullable(v.pipe(v.string(), v.url(), v.description('头像 URL'))),
    nationality: v.nullable(v.pipe(v.string(), v.description('国籍'))),
    birthDate: v.nullable(v.pipe(v.string(), v.description('出生日期'))),
    movieCount: v.pipe(v.number(), v.integer(), v.minValue(0), v.description('作品数量')),
    isActive: v.pipe(v.boolean(), v.description('是否活跃')),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.examples([
    {
      id: 'actor_123',
      slug: 'actor-name',
      name: '演员姓名',
      avatar: 'https://cdn.example.com/actor.jpg',
      nationality: '日本',
      birthDate: '1990-01-01',
      movieCount: 50,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
    },
  ]),
  v.metadata({ ref: 'ActorItem' }),
)

export type ActorItem = v.InferOutput<typeof ActorItemSchema>

/**
 * 演员详情 Schema
 */
export const ActorDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    slug: SlugSchema,
    name: v.string(),
    avatar: v.nullable(v.pipe(v.string(), v.url())),
    nationality: v.nullable(v.string()),
    birthDate: v.nullable(v.string()),
    biography: v.nullable(v.string()),
    movieCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    isActive: v.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  }),
  v.metadata({ ref: 'ActorDetail' }),
)

export type ActorDetail = v.InferOutput<typeof ActorDetailSchema>

/**
 * 获取演员列表的 Query Schema
 */
export const GetActorsQuerySchema = v.object({
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
  nationality: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.examples(['日本', '韩国', '中国']),
      v.description('国籍筛选'),
    ),
  ),
  isActive: v.optional(
    v.pipe(
      v.string(),
      v.transform(input => input === 'true'),
      v.boolean(),
      v.description('是否活跃筛选'),
    ),
  ),
  hasDetails: v.optional(
    v.pipe(
      v.string(),
      v.transform(input => input === 'true'),
      v.boolean(),
      v.description('是否有详细信息筛选'),
    ),
  ),
})

export type GetActorsQuery = v.InferOutput<typeof GetActorsQuerySchema>

/**
 * 获取演员详情的 Param Schema
 */
export const GetActorParamSchema = v.object({
  slug: SlugSchema,
})

/**
 * 演员列表响应数据 Schema
 */
export const ActorsListDataSchema = v.pipe(
  v.object({
    data: v.array(ActorItemSchema),
    pagination: v.object({
      page: v.pipe(v.number(), v.integer(), v.minValue(1)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
      total: v.pipe(v.number(), v.integer(), v.minValue(0)),
      totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  }),
  v.metadata({ ref: 'ActorsListData' }),
)

export type ActorsListData = v.InferOutput<typeof ActorsListDataSchema>

/**
 * 演员合作关系项 Schema
 */
export const ActorRelationItemSchema = v.pipe(
  v.object({
    partnerId: v.pipe(v.string(), v.description('合作伙伴 ID')),
    partnerName: v.pipe(v.string(), v.description('合作伙伴名称')),
    partnerSlug: v.pipe(v.string(), v.description('合作伙伴 slug')),
    partnerAvatar: v.nullable(v.pipe(v.string(), v.url(), v.description('合作伙伴头像'))),
    collaborationCount: v.pipe(v.number(), v.integer(), v.minValue(1), v.description('合作次数')),
    sharedMovieIds: v.pipe(v.array(v.string()), v.description('共同作品 ID 列表')),
  }),
  v.metadata({ ref: 'ActorRelationItem' }),
)

export type ActorRelationItem = v.InferOutput<typeof ActorRelationItemSchema>

/**
 * 获取演员关系的 Param Schema
 */
export const GetActorRelationsParamSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.description('演员 ID')),
})

/**
 * 获取演员关系的 Query Schema
 */
export const GetActorRelationsQuerySchema = v.object({
  minCollaborations: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(20),
      v.description('最小合作次数，默认 3'),
    ),
    '3',
  ),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(50),
      v.description('返回结果数量限制，默认 20'),
    ),
    '20',
  ),
})

export type GetActorRelationsQuery = v.InferOutput<typeof GetActorRelationsQuerySchema>

/**
 * 演员关系列表数据 Schema
 */
export const ActorRelationsDataSchema = v.pipe(
  v.object({
    actorId: v.pipe(v.string(), v.description('演员 ID')),
    relations: v.pipe(v.array(ActorRelationItemSchema), v.description('合作关系列表')),
    meta: v.object({
      totalPartners: v.pipe(v.number(), v.integer(), v.minValue(0), v.description('合作伙伴总数')),
      minCollaborations: v.pipe(v.number(), v.integer(), v.description('最小合作次数筛选条件')),
    }),
  }),
  v.metadata({ ref: 'ActorRelationsData' }),
)

export type ActorRelationsData = v.InferOutput<typeof ActorRelationsDataSchema>
