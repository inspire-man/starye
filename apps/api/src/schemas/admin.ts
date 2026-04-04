import * as v from 'valibot'
import { ChapterContentSchema, MangaInfoSchema, MovieInfoSchema } from './crawler'

/**
 * Admin 演员列表查询 Schema
 */
export const GetAdminActorsQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)), '1'),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)), '50'),
  search: v.optional(v.pipe(v.string(), v.trim())),
  onlyPending: v.optional(v.picklist(['true', 'false'])),
  crawlStatus: v.optional(v.picklist(['complete', 'pending', 'failed', 'no-link'])),
  nationality: v.optional(v.pipe(v.string(), v.trim())),
  sortBy: v.optional(v.picklist(['movieCount', 'name', 'createdAt'])),
  sortOrder: v.optional(v.picklist(['asc', 'desc'])),
})

/**
 * Admin 更新演员 Schema
 */
export const UpdateActorSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim())),
  bio: v.optional(v.pipe(v.string(), v.trim())),
  avatar: v.optional(v.pipe(v.string(), v.url())),
  birthDate: v.optional(v.pipe(v.string(), v.trim())),
  height: v.optional(v.number()),
  measurements: v.optional(v.pipe(v.string(), v.trim())),
  nationality: v.optional(v.pipe(v.string(), v.trim())),
  socialLinks: v.optional(v.record(v.string(), v.pipe(v.string(), v.url()))),
  twitter: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  instagram: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  blog: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  wikiUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
})

/**
 * Admin 合并演员 Schema
 */
export const MergeActorsSchema = v.object({
  sourceId: v.pipe(v.string(), v.trim(), v.minLength(1)),
  targetId: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

/**
 * Admin 创建演员 Schema
 */
export const CreateActorSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

/**
 * Admin 添加演员别名 Schema
 */
export const AddActorAliasSchema = v.object({
  alias: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
})

/**
 * Admin 批量删除 Schema
 */
export const BatchDeleteSchema = v.object({
  ids: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(100)),
})

/**
 * Admin 批量删除章节 Schema
 */
export const BatchDeleteChaptersSchema = v.object({
  chapterIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(100)),
})

/**
 * Admin 审计日志查询 Schema
 */
export const GetAuditLogsQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)), '1'),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)), '50'),
  userId: v.optional(v.pipe(v.string(), v.trim())),
  resourceType: v.optional(v.pipe(v.string(), v.trim())),
  resourceId: v.optional(v.pipe(v.string(), v.trim())),
  action: v.optional(v.pipe(v.string(), v.trim())),
  startDate: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  endDate: v.optional(v.pipe(v.string(), v.isoTimestamp())),
})

/**
 * Admin 审计日志导出 Schema
 */
export const ExportAuditLogsQuerySchema = v.object({
  format: v.optional(v.picklist(['csv', 'json']), 'json'),
  userId: v.optional(v.pipe(v.string(), v.trim())),
  resourceType: v.optional(v.pipe(v.string(), v.trim())),
  action: v.optional(v.pipe(v.string(), v.trim())),
  dateFrom: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  dateTo: v.optional(v.pipe(v.string(), v.isoTimestamp())),
})

/**
 * Admin 爬虫操作 Schema
 */
export const CrawlerActionSchema = v.object({
  type: v.picklist(['comic', 'movie']),
  url: v.optional(v.pipe(v.string(), v.url())),
})

/**
 * Admin 影片筛选 Schema
 */
export const MovieFilterSchema = v.object({
  page: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)), '1'),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)), '20'),
  isR18: v.optional(v.union([v.picklist(['true', 'false', 'all']), v.literal('')]), 'all'),
  crawlStatus: v.optional(v.union([v.picklist(['pending', 'partial', 'complete']), v.literal('')])),
  metadataLocked: v.optional(v.union([v.picklist(['true', 'false']), v.literal('')])),
  actor: v.optional(v.pipe(v.string(), v.trim())),
  publisher: v.optional(v.pipe(v.string(), v.trim())),
  genre: v.optional(v.pipe(v.string(), v.trim())),
  releaseDateFrom: v.optional(v.pipe(v.string(), v.trim())),
  releaseDateTo: v.optional(v.pipe(v.string(), v.trim())),
  createdAtFrom: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  createdAtTo: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  search: v.optional(v.pipe(v.string(), v.trim())),
  sortBy: v.optional(v.picklist(['releaseDate', 'createdAt', 'updatedAt', 'sortOrder', 'title']), 'updatedAt'),
  sortOrder: v.optional(v.picklist(['asc', 'desc']), 'desc'),
  hasPlayers: v.optional(v.union([v.picklist(['true', 'false']), v.literal('')])),
})

export type MovieFilter = v.InferOutput<typeof MovieFilterSchema>

/**
 * Admin 出版商列表查询 Schema
 */
export const GetAdminPublishersQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)), '1'),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)), '50'),
  search: v.optional(v.pipe(v.string(), v.trim())),
  onlyPending: v.optional(v.picklist(['true', 'false'])),
  crawlStatus: v.optional(v.picklist(['complete', 'pending', 'no-link', 'failed'])),
  country: v.optional(v.pipe(v.string(), v.trim())),
  sortBy: v.optional(v.picklist(['movieCount', 'name', 'createdAt'])),
  sortOrder: v.optional(v.picklist(['asc', 'desc'])),
})

/**
 * Admin 更新出版商 Schema
 */
export const UpdatePublisherSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim())),
  description: v.optional(v.pipe(v.string(), v.trim())),
  logo: v.optional(v.pipe(v.string(), v.url())),
  website: v.optional(v.pipe(v.string(), v.url())),
  foundedYear: v.optional(v.pipe(v.number(), v.integer())),
  twitter: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  instagram: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  wikiUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  parentPublisher: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  brandSeries: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
})

/**
 * Admin 创建出版商 Schema
 */
export const CreatePublisherSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

/**
 * Admin 合并出版商 Schema
 */
export const MergePublishersSchema = v.object({
  sourceId: v.pipe(v.string(), v.trim(), v.minLength(1)),
  targetId: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

/**
 * Admin R18 白名单 Schema
 */
export const AddR18WhitelistSchema = v.pipe(
  v.object({
    userId: v.optional(v.pipe(v.string(), v.trim())),
    email: v.optional(v.pipe(v.string(), v.email(), v.trim())),
  }),
  v.check(data => !!data.userId || !!data.email, '必须提供 userId 或 email'),
)

/**
 * Admin 漫画爬取 Schema
 */
export const CrawlComicSchema = v.object({
  url: v.pipe(v.string(), v.url()),
})

/**
 * Admin 更新用户角色 Schema
 */
export const UpdateUserRoleSchema = v.object({
  role: v.picklist(['admin', 'comic_admin', 'user']),
})

/**
 * Admin 更新用户状态 Schema
 */
export const UpdateUserStatusSchema = v.object({
  isAdult: v.optional(v.boolean()),
})

/**
 * Admin 更新漫画元数据 Schema
 */
export const UpdateComicMetadataSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim())),
  author: v.optional(v.pipe(v.string(), v.trim())),
  description: v.optional(v.pipe(v.string(), v.trim())),
  cover: v.optional(v.pipe(v.string(), v.url())),
  status: v.optional(v.picklist(['serializing', 'completed'])),
  region: v.optional(v.pipe(v.string(), v.trim())),
  genres: v.optional(v.array(v.string())),
})

/**
 * Admin 获取章节信息 Query Schema
 */
export const GetChapterInfoQuerySchema = v.object({
  comicSlug: v.pipe(v.string(), v.trim(), v.minLength(1)),
  chapterSlug: v.pipe(v.string(), v.trim(), v.minLength(1)),
  sourceCount: v.optional(v.pipe(v.string(), v.toNumber(), v.integer())),
})

/**
 * Admin 提交爬虫数据 Schema（Union type）
 */

export const SubmitCrawlerDataSchema = v.union([
  v.object({ type: v.literal('manga'), data: MangaInfoSchema }),
  v.object({ type: v.literal('chapter'), data: ChapterContentSchema }),
  v.object({ type: v.literal('movie'), data: MovieInfoSchema }),
])

/**
 * Admin 更新漫画统计 Schema
 */
export const UpdateComicStatsSchema = v.object({
  comicSlug: v.pipe(v.string(), v.trim(), v.minLength(1)),
  crawledChapters: v.pipe(v.number(), v.integer(), v.minValue(0)),
  totalChapters: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

/**
 * Admin 更新漫画进度 Schema
 */
export const UpdateComicProgressSchema = v.object({
  status: v.picklist(['pending', 'partial', 'complete']),
  crawledChapters: v.pipe(v.number(), v.integer(), v.minValue(0)),
  totalChapters: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

/**
 * Admin 批量操作漫画 Schema
 */
export const BatchOperationComicsSchema = v.object({
  ids: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(100)),
  operation: v.picklist(['update_r18', 'lock_metadata', 'unlock_metadata', 'update_sort_order', 'delete']),
  payload: v.optional(v.record(v.string(), v.any())),
})

/**
 * Admin 更新影片元数据 Schema
 */
export const UpdateMovieMetadataSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim())),
  description: v.optional(v.pipe(v.string(), v.trim())),
  coverImage: v.optional(v.pipe(v.string(), v.url())),
  isR18: v.optional(v.boolean()),
  metadataLocked: v.optional(v.boolean()),
  sortOrder: v.optional(v.number()),
  actors: v.optional(v.array(v.string())),
  genres: v.optional(v.array(v.string())),
  publisher: v.optional(v.pipe(v.string(), v.trim())),
  releaseDate: v.optional(v.pipe(v.string(), v.trim())),
  duration: v.optional(v.number()),
})

/**
 * Admin 添加播放源 Schema
 */
export const AddPlayerSchema = v.object({
  sourceName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  sourceUrl: v.pipe(v.string(), v.url()),
  quality: v.optional(v.pipe(v.string(), v.trim())),
})

/**
 * Admin 更新播放源 Schema
 */
export const UpdatePlayerSchema = v.object({
  sourceName: v.optional(v.pipe(v.string(), v.trim())),
  sourceUrl: v.optional(v.pipe(v.string(), v.url())),
  quality: v.optional(v.pipe(v.string(), v.trim())),
})

/**
 * Admin 批量关联演员 Schema
 */
export const BatchAssociateActorsSchema = v.object({
  movieIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(100)),
})

/**
 * Admin 更新影片排序 Schema
 */
export const UpdateMovieSortOrderSchema = v.object({
  sortOrder: v.pipe(v.number(), v.integer()),
})

/**
 * Admin 批量操作影片 Schema
 */
export const BatchOperationMoviesSchema = v.object({
  ids: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(100)),
  operation: v.picklist(['update_r18', 'lock_metadata', 'unlock_metadata', 'update_sort_order', 'delete']),
  payload: v.optional(v.any()),
})

/**
 * Admin 批量导入播放源 Schema
 */
export const BatchImportPlayersSchema = v.object({
  players: v.array(
    v.object({
      sourceName: v.pipe(v.string(), v.trim()),
      sourceUrl: v.pipe(v.string(), v.url()),
      quality: v.optional(v.pipe(v.string(), v.trim())),
    }),
  ),
})

/**
 * Admin 更新影片演员关联 Schema
 */
export const UpdateMovieActorsSchema = v.object({
  actors: v.array(
    v.object({
      id: v.pipe(v.string(), v.trim(), v.minLength(1)),
      sortOrder: v.pipe(v.number(), v.integer()),
    }),
  ),
})

/**
 * Admin 更新影片出版商关联 Schema
 */
export const UpdateMoviePublishersSchema = v.object({
  publishers: v.array(
    v.object({
      id: v.pipe(v.string(), v.trim()),
      sortOrder: v.pipe(v.number(), v.integer()),
    }),
  ),
})

/**
 * Admin 批量查询演员状态 Schema
 */
export const BatchQueryActorStatusSchema = v.object({
  ids: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

export type BatchQueryActorStatus = v.InferOutput<typeof BatchQueryActorStatusSchema>

/**
 * Admin 获取待爬取演员列表 Schema
 */
export const GetPendingActorsQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(200)), '150'),
})

export type GetPendingActorsQuery = v.InferOutput<typeof GetPendingActorsQuerySchema>

/**
 * Admin 同步演员详情 Schema
 */
export const SyncActorDetailsSchema = v.object({
  source: v.optional(v.picklist(['javbus', 'seesaawiki', 'manual'])),
  sourceId: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  sourceUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  avatar: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  cover: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  bio: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  birthDate: v.optional(v.nullable(v.number())), // Unix时间戳
  height: v.optional(v.nullable(v.number())),
  measurements: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  cupSize: v.optional(v.nullable(v.pipe(v.string(), v.trim()))), // 添加罩杯字段
  nationality: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  bloodType: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  debutDate: v.optional(v.nullable(v.number())), // 添加出道日期
  retireDate: v.optional(v.nullable(v.number())), // 添加退役日期
  aliases: v.optional(v.nullable(v.array(v.pipe(v.string(), v.trim())))), // 添加别名数组
  twitter: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  instagram: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  blog: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  wikiUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
})

export type SyncActorDetails = v.InferOutput<typeof SyncActorDetailsSchema>

/**
 * Admin 批量查询出版商状态 Schema
 */
export const BatchQueryPublisherStatusSchema = v.object({
  ids: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

export type BatchQueryPublisherStatus = v.InferOutput<typeof BatchQueryPublisherStatusSchema>

/**
 * Admin 获取待爬取出版商列表 Schema
 */
export const GetPendingPublishersQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(200)), '100'),
})

export type GetPendingPublishersQuery = v.InferOutput<typeof GetPendingPublishersQuerySchema>

/**
 * Admin 同步出版商详情 Schema
 */
export const SyncPublisherDetailsSchema = v.object({
  source: v.optional(v.picklist(['javbus', 'seesaawiki', 'manual'])),
  sourceId: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  sourceUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  logo: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  website: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  description: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  foundedYear: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  country: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  twitter: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  instagram: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  wikiUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  parentPublisher: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
  brandSeries: v.optional(v.nullable(v.pipe(v.string(), v.trim()))),
})

export type SyncPublisherDetails = v.InferOutput<typeof SyncPublisherDetailsSchema>

/**
 * Admin 批量同步演员 Schema
 */
export const BatchSyncActorsSchema = v.object({
  actors: v.pipe(
    v.array(
      v.object({
        name: v.pipe(v.string(), v.trim(), v.minLength(1)),
        sourceUrl: v.pipe(v.string(), v.url()),
        sourceId: v.optional(v.pipe(v.string(), v.trim())), // URL 中的 ID，用作 slug
      }),
    ),
    v.minLength(1),
    v.maxLength(200),
  ),
})

export type BatchSyncActors = v.InferOutput<typeof BatchSyncActorsSchema>

/**
 * Admin 批量同步出版商 Schema
 */
export const BatchSyncPublishersSchema = v.object({
  publishers: v.pipe(
    v.array(
      v.object({
        name: v.pipe(v.string(), v.trim(), v.minLength(1)),
        sourceUrl: v.pipe(v.string(), v.url()),
        sourceId: v.optional(v.pipe(v.string(), v.trim())), // URL 中的 ID，用作 slug
      }),
    ),
    v.minLength(1),
    v.maxLength(200),
  ),
})

export type BatchSyncPublishers = v.InferOutput<typeof BatchSyncPublishersSchema>
