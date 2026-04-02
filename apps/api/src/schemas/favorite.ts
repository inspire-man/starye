import * as v from 'valibot'
import { IdSchema, TimestampSchema } from './common'

/**
 * 收藏实体类型
 */
export const EntityTypeSchema = v.pipe(
  v.picklist(['actor', 'publisher', 'movie', 'comic']),
  v.description('实体类型'),
)

export type EntityType = v.InferOutput<typeof EntityTypeSchema>

/**
 * 关联实体信息 Schema
 */
export const EntityInfoSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.description('实体名称')),
    cover: v.nullable(v.pipe(v.string(), v.description('封面/头像 URL'))),
    slug: v.pipe(v.string(), v.description('URL slug 或唯一标识')),
  }),
  v.metadata({ ref: 'EntityInfo' }),
)

/**
 * 收藏项 Schema
 */
export const FavoriteItemSchema = v.pipe(
  v.object({
    id: IdSchema,
    userId: v.pipe(v.string(), v.description('用户 ID')),
    entityType: EntityTypeSchema,
    entityId: v.pipe(v.string(), v.description('实体 ID')),
    createdAt: TimestampSchema,
    entity: v.nullable(EntityInfoSchema),
  }),
  v.metadata({ ref: 'FavoriteItem' }),
)

export type FavoriteItem = v.InferOutput<typeof FavoriteItemSchema>

/**
 * 添加收藏请求 Schema
 */
export const AddFavoriteBodySchema = v.object({
  entityType: EntityTypeSchema,
  entityId: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('实体 ID'),
  ),
})

export type AddFavoriteBody = v.InferOutput<typeof AddFavoriteBodySchema>

/**
 * 删除收藏参数 Schema
 */
export const DeleteFavoriteParamSchema = v.object({
  id: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.description('收藏 ID'),
  ),
})

/**
 * 获取收藏列表查询 Schema
 */
export const GetFavoritesQuerySchema = v.object({
  entityType: v.optional(EntityTypeSchema),
  page: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.description('页码，从 1 开始'),
    ),
    '1',
  ),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100),
      v.description('每页条数'),
    ),
    '20',
  ),
})

export type GetFavoritesQuery = v.InferOutput<typeof GetFavoritesQuerySchema>

/**
 * 收藏列表数据 Schema
 */
export const FavoritesListDataSchema = v.pipe(
  v.object({
    data: v.array(FavoriteItemSchema),
    pagination: v.object({
      page: v.pipe(v.number(), v.integer(), v.minValue(1)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1)),
      total: v.pipe(v.number(), v.integer(), v.minValue(0)),
      totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  }),
  v.metadata({ ref: 'FavoritesListData' }),
)

export type FavoritesListData = v.InferOutput<typeof FavoritesListDataSchema>
