import * as v from 'valibot'

/**
 * 分页参数 Schema
 * 用于所有列表接口的分页查询
 */
export const PaginationSchema = v.pipe(
  v.object({
    page: v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.examples([1, 2, 10]),
      v.description('当前页码，从 1 开始'),
    ),
    limit: v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100),
      v.examples([10, 20, 50]),
      v.description('每页条数，最大 100'),
    ),
  }),
  v.metadata({ ref: 'PaginationParams' }),
)

export type PaginationParams = v.InferOutput<typeof PaginationSchema>

/**
 * Slug Schema
 * URL 友好的资源标识符，只允许小写字母、数字和连字符
 */
export const SlugSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(100),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  v.examples(['one-piece', 'naruto-shippuden', 'detective-conan']),
  v.description('URL 友好的资源标识符'),
  v.metadata({ ref: 'Slug' }),
)

export type Slug = v.InferOutput<typeof SlugSchema>

/**
 * ISO 时间戳 Schema
 */
export const TimestampSchema = v.pipe(
  v.string(),
  v.isoTimestamp(),
  v.description('ISO 8601 格式的时间戳'),
  v.metadata({ ref: 'Timestamp' }),
)

export type Timestamp = v.InferOutput<typeof TimestampSchema>

/**
 * 可选的 ISO 时间戳
 */
export const OptionalTimestampSchema = v.optional(TimestampSchema)

/**
 * 分页元信息 Schema
 */
export const PaginationMetaSchema = v.pipe(
  v.object({
    current: v.pipe(v.number(), v.integer(), v.minValue(1), v.description('当前页码')),
    total: v.pipe(v.number(), v.integer(), v.minValue(0), v.description('总页数')),
    hasNext: v.pipe(v.boolean(), v.description('是否有下一页')),
  }),
  v.metadata({ ref: 'PaginationMeta' }),
)

export type PaginationMeta = v.InferOutput<typeof PaginationMetaSchema>

/**
 * 页码 Schema（单独使用）
 */
export const PageNumberSchema = v.pipe(
  v.string(),
  v.toNumber(),
  v.integer(),
  v.minValue(1),
  v.examples([1, 5, 10]),
  v.description('页码，从 1 开始'),
)

/**
 * 每页条数 Schema（单独使用）
 */
export const LimitSchema = v.pipe(
  v.string(),
  v.toNumber(),
  v.integer(),
  v.minValue(1),
  v.maxValue(100),
  v.examples([10, 20, 50]),
  v.description('每页条数，最大 100'),
)

/**
 * 可选的搜索关键词 Schema
 */
export const OptionalKeywordSchema = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.maxLength(100),
    v.description('搜索关键词'),
  ),
)

/**
 * ID Schema（MongoDB ObjectId 格式）
 */
export const ObjectIdSchema = v.pipe(
  v.string(),
  v.regex(/^[a-f\d]{24}$/i),
  v.description('MongoDB ObjectId'),
)

/**
 * 状态枚举 Schema
 */
export const StatusSchema = v.pipe(
  v.picklist(['ongoing', 'completed', 'hiatus']),
  v.description('内容状态：连载中、已完结、休刊'),
)

export type Status = v.InferOutput<typeof StatusSchema>

/**
 * 通用 ID Schema
 */
export const IdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.description('实体 ID'),
)

export type Id = v.InferOutput<typeof IdSchema>
