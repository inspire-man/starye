import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
import { foreignKey, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// --- 用户认证 (Better Auth 标准表) ---
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  role: text('role').default('user').notNull(),
  isAdult: integer('is_adult', { mode: 'boolean' }).default(false),
  isR18Verified: integer('is_r18_verified', { mode: 'boolean' }).default(false).notNull(), // R18 白名单标记
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type User = InferSelectModel<typeof user>
export type NewUser = InferInsertModel<typeof user>

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id),
})

export type Session = InferSelectModel<typeof session>

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Account = InferSelectModel<typeof account>

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// --- 博客内容 ---
export const posts = sqliteTable('post', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content'), // HTML 或 Markdown 格式，由 contentFormat 决定
  excerpt: text('excerpt'),
  coverImage: text('cover_image'),
  published: integer('published', { mode: 'boolean' }).default(false),
  authorId: text('author_id').references(() => user.id),
  // 内容格式：'html'（wangEditor 输出）或 'markdown'（存量数据兼容）
  contentFormat: text('content_format').default('html'),
  // 系列相关字段
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  series: text('series'), // 系列 slug，如 ts-fullstack-ai-chronicle
  seriesOrder: integer('series_order'), // 系列内排序序号（从 1 开始）
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type Post = InferSelectModel<typeof posts>

// --- 媒体资源 (R2) ---
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(), // R2 存储 Key
  url: text('url').notNull(), // 公开 CDN 地址 (原图)
  variants: text('variants', { mode: 'json' }), // 缩略图变体 JSON: { thumb: "url", preview: "url" }
  mimeType: text('mime_type'),
  size: integer('size'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type Media = InferSelectModel<typeof media>

// --- 漫画业务 ---
export const comics = sqliteTable('comic', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  author: text('author'),
  description: text('description'), // 漫画简介
  coverImage: text('cover_image'),
  sourceUrl: text('source_url').unique(), // 源 URL，用于追更
  status: text('status', { enum: ['serializing', 'completed'] }).default('serializing'), // serializing: 连载中, completed: 已完结
  region: text('region'), // 地区
  genres: text('genres', { mode: 'json' }), // 题材/标签
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  metadataLocked: integer('metadata_locked', { mode: 'boolean' }).default(false).notNull(), // 锁定元数据，防止爬虫覆盖
  sortOrder: integer('sort_order').default(0), // 人工排序/权重 (越大越靠前)
  // 爬取状态字段
  crawlStatus: text('crawl_status', { enum: ['pending', 'partial', 'complete'] }).default('pending'), // pending: 未爬取, partial: 部分完成, complete: 完全完成
  lastCrawledAt: integer('last_crawled_at', { mode: 'timestamp' }), // 最后爬取时间
  totalChapters: integer('total_chapters').default(0), // 总章节数
  crawledChapters: integer('crawled_chapters').default(0), // 已爬取章节数
  isSerializing: integer('is_serializing', { mode: 'boolean' }).default(true), // 是否连载中（用于判断是否需要持续更新）
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type Comic = InferSelectModel<typeof comics>
export type NewComic = InferInsertModel<typeof comics>

export const chapters = sqliteTable('chapter', {
  id: text('id').primaryKey(),
  comicId: text('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  chapterNumber: integer('chapter_number'),
  sourcePageCount: integer('source_page_count'), // 源站图片数量 (用于完整性校验)
  sortOrder: integer('sort_order').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type Chapter = InferSelectModel<typeof chapters>
export type NewChapter = InferInsertModel<typeof chapters>

/** Immutable source chapter set captured before a manga sync mutates stored rows. */
export const comicChapterSourceSnapshots = sqliteTable('comic_chapter_source_snapshot', {
  id: text('id').primaryKey(),
  comicId: text('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  sourceUrl: text('source_url'),
  terminalState: text('terminal_state', {
    enum: ['complete', 'partial', 'unavailable', 'inconclusive'],
  }).notNull(),
  sourceCount: integer('source_count').notNull(),
  rowCount: integer('row_count').notNull(),
  snapshotIdentity: text('snapshot_identity').notNull(),
  sourceFingerprint: text('source_fingerprint').notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_comic_chapter_source_snapshot_revision').on(table.comicId, table.sourceRevision),
  uniqueIndex('idx_comic_chapter_source_snapshot_identity').on(table.snapshotIdentity),
  uniqueIndex('idx_comic_chapter_source_snapshot_fingerprint').on(table.comicId, table.sourceFingerprint),
  index('idx_comic_chapter_source_snapshot_observed').on(table.comicId, table.observedAt),
])

export type ComicChapterSourceSnapshot = InferSelectModel<typeof comicChapterSourceSnapshots>
export type NewComicChapterSourceSnapshot = InferInsertModel<typeof comicChapterSourceSnapshots>

/** Source rows are retained verbatim enough to audit duplicates and source ordering. */
export const comicChapterSourceRows = sqliteTable('comic_chapter_source_row', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => comicChapterSourceSnapshots.id, { onDelete: 'cascade' }),
  comicId: text('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
  sourceOrdinal: integer('source_ordinal').notNull(),
  identity: text('identity').notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  chapterNumber: integer('chapter_number'),
  sourceUrl: text('source_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_comic_chapter_source_row_ordinal').on(table.snapshotId, table.sourceOrdinal),
  index('idx_comic_chapter_source_row_identity').on(table.snapshotId, table.identity),
  index('idx_comic_chapter_source_row_comic').on(table.comicId, table.snapshotId),
])

export type ComicChapterSourceRow = InferSelectModel<typeof comicChapterSourceRows>
export type NewComicChapterSourceRow = InferInsertModel<typeof comicChapterSourceRows>

export const pages = sqliteTable('page', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  imageUrl: text('image_url').notNull(),
  width: integer('width'),
  height: integer('height'),
})

export type Page = InferSelectModel<typeof pages>

/** Append-only bounded chapter completeness facts. */
export const chapterCompletenessObservations = sqliteTable('chapter_completeness_observation', {
  id: text('id').primaryKey(),
  comicId: text('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
  snapshotId: text('snapshot_id').notNull().references(() => comicChapterSourceSnapshots.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  status: text('status', { enum: ['complete', 'partial', 'unavailable', 'inconclusive'] }).notNull(),
  reasonCode: text('reason_code').notNull(),
  countsJson: text('counts_json', { mode: 'json' }).notNull(),
  findingsJson: text('findings_json', { mode: 'json' }).notNull(),
  observationIdentity: text('observation_identity').notNull(),
  eventSequence: integer('event_sequence').notNull().default(0),
  taskId: text('task_id'),
  runId: text('run_id'),
  attemptNumber: integer('attempt_number'),
  provider: text('provider', { enum: ['github-actions', 'local-proof', 'sync'] }).notNull().default('sync'),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_chapter_completeness_observation_identity').on(table.observationIdentity),
  index('idx_chapter_completeness_observation_comic_revision').on(table.comicId, table.sourceRevision),
  index('idx_chapter_completeness_observation_tuple').on(table.runId, table.attemptNumber, table.eventSequence),
])

export type ChapterCompletenessObservation = InferSelectModel<typeof chapterCompletenessObservations>
export type NewChapterCompletenessObservation = InferInsertModel<typeof chapterCompletenessObservations>

/** Current chapter completeness projection, promoted only by a newer source revision/observation. */
export const chapterCompletenessCurrent = sqliteTable('chapter_completeness_current', {
  comicId: text('comic_id').primaryKey().references(() => comics.id, { onDelete: 'cascade' }),
  snapshotId: text('snapshot_id').notNull().references(() => comicChapterSourceSnapshots.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  status: text('status', { enum: ['complete', 'partial', 'unavailable', 'inconclusive'] }).notNull(),
  terminalState: text('terminal_state', { enum: ['complete', 'partial', 'unavailable', 'inconclusive'] }).notNull().default('complete'),
  reasonCode: text('reason_code').notNull(),
  countsJson: text('counts_json', { mode: 'json' }).notNull(),
  findingsJson: text('findings_json', { mode: 'json' }).notNull(),
  observationIdentity: text('observation_identity').notNull(),
  projectionVersion: integer('projection_version').notNull().default(0),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_chapter_completeness_current_observation').on(table.observationIdentity),
  index('idx_chapter_completeness_current_revision').on(table.comicId, table.sourceRevision),
])

export type ChapterCompletenessCurrent = InferSelectModel<typeof chapterCompletenessCurrent>
export type NewChapterCompletenessCurrent = InferInsertModel<typeof chapterCompletenessCurrent>

/** Append-only bounded per-page image probe facts. */
export const chapterPageAvailabilityObservations = sqliteTable('chapter_page_availability_observation', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  policyVersion: text('policy_version').notNull(),
  pageNumber: integer('page_number').notNull(),
  pageIdentity: text('page_identity').notNull(),
  status: text('status', { enum: ['available', 'unavailable', 'unknown', 'degraded'] }).notNull(),
  reasonCode: text('reason_code').notNull(),
  httpStatus: integer('http_status'),
  contentType: text('content_type'),
  urlIdentity: text('url_identity').notNull(),
  summaryJson: text('summary_json', { mode: 'json' }).notNull(),
  observationIdentity: text('observation_identity').notNull(),
  eventSequence: integer('event_sequence').notNull().default(0),
  taskId: text('task_id'),
  runId: text('run_id'),
  attemptNumber: integer('attempt_number'),
  provider: text('provider', { enum: ['github-actions', 'local-proof', 'integrity'] }).notNull().default('integrity'),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_chapter_page_availability_observation_identity').on(table.observationIdentity),
  index('idx_chapter_page_availability_observation_chapter_revision').on(table.chapterId, table.sourceRevision),
  index('idx_chapter_page_availability_observation_page').on(table.chapterId, table.pageNumber),
])

export type ChapterPageAvailabilityObservation = InferSelectModel<typeof chapterPageAvailabilityObservations>
export type NewChapterPageAvailabilityObservation = InferInsertModel<typeof chapterPageAvailabilityObservations>

/** Current page availability projection for Reader/Dashboard readback. */
export const chapterPageAvailabilityCurrent = sqliteTable('chapter_page_availability_current', {
  chapterId: text('chapter_id').primaryKey().references(() => chapters.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  policyVersion: text('policy_version').notNull(),
  status: text('status', { enum: ['available', 'unavailable', 'degraded', 'unknown'] }).notNull(),
  expectedPageCount: integer('expected_page_count').notNull(),
  storedPageCount: integer('stored_page_count').notNull(),
  availablePageCount: integer('available_page_count').notNull(),
  unavailablePageCount: integer('unavailable_page_count').notNull(),
  unknownPageCount: integer('unknown_page_count').notNull(),
  findingsJson: text('findings_json', { mode: 'json' }).notNull(),
  samplesJson: text('samples_json', { mode: 'json' }).notNull(),
  observationIdentity: text('observation_identity').notNull(),
  projectionVersion: integer('projection_version').notNull().default(0),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_chapter_page_availability_current_observation').on(table.observationIdentity),
  index('idx_chapter_page_availability_current_revision').on(table.chapterId, table.sourceRevision),
])

export type ChapterPageAvailabilityCurrent = InferSelectModel<typeof chapterPageAvailabilityCurrent>
export type NewChapterPageAvailabilityCurrent = InferInsertModel<typeof chapterPageAvailabilityCurrent>

// --- 电影业务 ---
export const movies = sqliteTable('movie', {
  id: text('id').primaryKey(),
  title: text('title').notNull(), // 电影标题
  slug: text('slug').notNull().unique(), // URL Slug
  code: text('code').notNull().unique(), // 番号 (如: SSIS-123)
  description: text('description'), // 简介
  coverImage: text('cover_image'), // 封面图
  previewImages: text('preview_images', { mode: 'json' }).$type<string[]>(), // 影片概览图
  releaseDate: integer('release_date', { mode: 'timestamp' }), // 发布日期
  duration: integer('duration'), // 时长（分钟）
  sourceUrl: text('source_url').unique(), // 源 URL，用于追更
  // 元数据
  actors: text('actors', { mode: 'json' }), // 演员列表 string[]
  genres: text('genres', { mode: 'json' }), // 题材/标签 string[]
  series: text('series'), // 系列名称
  publisher: text('publisher'), // 片商/发行商
  // R18 标记 (默认 true)
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  // 管理字段
  metadataLocked: integer('metadata_locked', { mode: 'boolean' }).default(false).notNull(), // 锁定元数据，防止爬虫覆盖
  sortOrder: integer('sort_order').default(0), // 人工排序/权重 (越大越靠前)
  viewCount: integer('view_count').default(0).notNull(), // 累计观看次数（用于热门排序）
  // 爬取状态字段
  crawlStatus: text('crawl_status', { enum: ['pending', 'partial', 'complete'] }).default('complete'), // pending: 未爬取, partial: 部分完成, complete: 完全完成
  lastCrawledAt: integer('last_crawled_at', { mode: 'timestamp' }), // 最后爬取时间
  totalPlayers: integer('total_players').default(0), // 总播放源数量
  crawledPlayers: integer('crawled_players').default(0), // 已爬取播放源数量
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type Movie = InferSelectModel<typeof movies>
export type NewMovie = InferInsertModel<typeof movies>

/** Server-owned current source/readiness projection keyed by the canonical movie identity. */
export const movieSourceStates = sqliteTable('movie_source_state', {
  movieId: text('movie_id').primaryKey().references(() => movies.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull().default(0),
  disposition: text('disposition', {
    enum: ['ready', 'no_source', 'source_failed', 'repairing'],
  }).notNull(),
  eligibleCount: integer('eligible_count').notNull().default(0),
  repairable: integer('repairable', { mode: 'boolean' }).notNull().default(true),
  reasonCode: text('reason_code', {
    enum: ['no_eligible_source', 'repair_requested', 'source_candidate_invalid', 'source_read_failed', 'source_write_failed'],
  }),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
}, table => [
  index('idx_movie_source_state_disposition').on(table.disposition),
])

export type MovieSourceState = InferSelectModel<typeof movieSourceStates>
export type NewMovieSourceState = InferInsertModel<typeof movieSourceStates>

export const players = sqliteTable('player', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(), // 源名称 (如: "云播", "磁力")
  sourceUrl: text('source_url').notNull(), // 播放链接或磁力链接
  quality: text('quality'), // 画质 (HD, SD 等)
  sortOrder: integer('sort_order').notNull(), // 排序
  averageRating: integer('average_rating', { mode: 'number' }), // 平均评分（0-100）
  ratingCount: integer('rating_count').default(0), // 评分人数
  reportCount: integer('report_count').default(0), // 失效上报次数
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否有效（超过上报阈值后自动置 false）
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, table => [
  index('idx_player_rating').on(table.averageRating),
  index('idx_player_active').on(table.isActive),
])

export type Player = InferSelectModel<typeof players>
export type NewPlayer = InferInsertModel<typeof players>

// --- 女优表 ---
export const actors = sqliteTable('actor', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL Slug
  avatar: text('avatar'), // 头像
  cover: text('cover'), // 封面大图
  bio: text('bio'), // 简介
  birthDate: integer('birth_date', { mode: 'timestamp' }), // 生日
  height: integer('height'), // 身高 (cm)
  measurements: text('measurements'), // 三围
  cupSize: text('cup_size'), // 罩杯
  bloodType: text('blood_type'), // 血型
  nationality: text('nationality'), // 国籍
  debutDate: integer('debut_date', { mode: 'timestamp' }), // 出道日期
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否活跃
  retireDate: integer('retire_date', { mode: 'timestamp' }), // 引退日期
  socialLinks: text('social_links', { mode: 'json' }), // 社交媒体链接 { twitter, instagram, etc }
  aliases: text('aliases', { mode: 'json' }), // 别名列表 string[]
  blog: text('blog'), // 博客链接
  twitter: text('twitter'), // Twitter handle
  instagram: text('instagram'), // Instagram handle
  wikiUrl: text('wiki_url'), // SeesaaWiki 页面 URL
  movieCount: integer('movie_count').default(0).notNull(), // 作品数量
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  // 爬虫字段
  source: text('source').default('javbus').notNull(), // 'javbus' | 'javdb' | 'seesaawiki'
  sourceId: text('source_id').default('').notNull(), // 原站 ID
  sourceUrl: text('source_url'), // 详情页 URL
  hasDetailsCrawled: integer('has_details_crawled', { mode: 'boolean' }).default(false), // 是否已爬取详情
  crawlFailureCount: integer('crawl_failure_count').default(0), // 失败次数
  lastCrawlAttempt: integer('last_crawl_attempt', { mode: 'timestamp' }), // 最后尝试时间
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

// 女优表索引
export const actorsIndexes = {
  uniqueSourceId: uniqueIndex('idx_actor_source_id').on(actors.source, actors.sourceId),
}

export type Actor = InferSelectModel<typeof actors>
export type NewActor = InferInsertModel<typeof actors>

// --- 厂商表 ---
export const publishers = sqliteTable('publisher', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL Slug
  logo: text('logo'), // Logo
  website: text('website'), // 官网
  description: text('description'), // 简介
  foundedYear: integer('founded_year'), // 成立年份
  country: text('country'), // 国家
  twitter: text('twitter'), // Twitter handle
  instagram: text('instagram'), // Instagram handle
  wikiUrl: text('wiki_url'), // SeesaaWiki 页面 URL
  parentPublisher: text('parent_publisher'), // 母公司/品牌
  brandSeries: text('brand_series'), // 品牌系列标识
  movieCount: integer('movie_count').default(0).notNull(), // 作品数量
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  // 爬虫字段
  source: text('source').default('javbus').notNull(), // 'javbus' | 'javdb' | 'seesaawiki'
  sourceId: text('source_id').default('').notNull(), // 原站 ID
  sourceUrl: text('source_url'), // 详情页 URL
  hasDetailsCrawled: integer('has_details_crawled', { mode: 'boolean' }).default(false), // 是否已爬取详情
  crawlFailureCount: integer('crawl_failure_count').default(0), // 失败次数
  lastCrawlAttempt: integer('last_crawl_attempt', { mode: 'timestamp' }), // 最后尝试时间
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

// 厂商表索引
export const publishersIndexes = {
  uniqueSourceId: uniqueIndex('idx_publisher_source_id').on(publishers.source, publishers.sourceId),
}

export type Publisher = InferSelectModel<typeof publishers>
export type NewPublisher = InferInsertModel<typeof publishers>

// --- 电影-女优关联表 ---
export const movieActors = sqliteTable('movie_actor', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0), // 保持原站顺序
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, table => [
  uniqueIndex('idx_movie_actor').on(table.movieId, table.actorId),
  index('idx_movie_actor_actor_id').on(table.actorId),
])

export type MovieActor = InferSelectModel<typeof movieActors>
export type NewMovieActor = InferInsertModel<typeof movieActors>

// --- 电影-厂商关联表 ---
export const moviePublishers = sqliteTable('movie_publisher', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  publisherId: text('publisher_id').notNull().references(() => publishers.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, table => [
  uniqueIndex('idx_movie_pub').on(table.movieId, table.publisherId),
  index('idx_movie_pub_publisher_id').on(table.publisherId),
])

export type MoviePublisher = InferSelectModel<typeof moviePublishers>
export type NewMoviePublisher = InferInsertModel<typeof moviePublishers>

// --- 系统任务 ---
export const jobs = sqliteTable('job', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }),
  status: text('status').default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
})

// --- 受控爬虫任务领域 ---
export const crawlerTasks = sqliteTable('crawler_task', {
  id: text('id').primaryKey(),
  templateKey: text('template_key', { enum: ['movie', 'manga'] }).notNull(),
  operation: text('operation', { enum: ['movie', 'manga', 'repair_players'] }).notNull().default('movie'),
  templateVersion: integer('template_version').notNull(),
  requestedByUserId: text('requested_by_user_id').notNull().references(() => user.id),
  requestSnapshotJson: text('request_snapshot_json', { mode: 'json' }).notNull(),
  idempotencyKey: text('idempotency_key'),
  latestRunId: text('latest_run_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_task_requester_idempotency').on(table.requestedByUserId, table.idempotencyKey),
  index('idx_crawler_task_requester_created').on(table.requestedByUserId, table.createdAt),
  index('idx_crawler_task_template_updated').on(table.templateKey, table.updatedAt),
])

export type CrawlerTask = InferSelectModel<typeof crawlerTasks>
export type NewCrawlerTask = InferInsertModel<typeof crawlerTasks>

export const crawlerRuns = sqliteTable('crawler_run', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id),
  attemptNumber: integer('attempt_number').notNull(),
  status: text('status', {
    enum: ['queued', 'dispatching', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled'],
  }).notNull(),
  stateVersion: integer('state_version').notNull().default(0),
  lastEventSequence: integer('last_event_sequence').notNull().default(0),
  leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp' }),
  lastHeartbeatAt: integer('last_heartbeat_at', { mode: 'timestamp' }),
  cancelRequestedAt: integer('cancel_requested_at', { mode: 'timestamp' }),
  failureCode: text('failure_code'),
  receiptSummaryJson: text('receipt_summary_json', { mode: 'json' }),
  // Versioned canonical receipt boundary; legacy JSON remains the audit payload.
  receiptSchemaVersion: integer('receipt_schema_version'),
  receiptPrimaryContentId: text('receipt_primary_content_id'),
  receiptSourceRevision: integer('receipt_source_revision'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  terminalAt: integer('terminal_at', { mode: 'timestamp' }),
}, table => [
  uniqueIndex('idx_crawler_run_task_attempt').on(table.taskId, table.attemptNumber),
  uniqueIndex('idx_crawler_run_task_pair').on(table.taskId, table.id),
  index('idx_crawler_run_task_created').on(table.taskId, table.createdAt),
  index('idx_crawler_run_status_lease_expiry').on(table.status, table.leaseExpiresAt),
])

export type CrawlerRun = InferSelectModel<typeof crawlerRuns>
export type NewCrawlerRun = InferInsertModel<typeof crawlerRuns>

/** Append-only, bounded availability facts for one task/run/attempt tuple. */
export const crawlerAvailabilityObservations = sqliteTable('crawler_availability_observation', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  attemptNumber: integer('attempt_number').notNull(),
  provider: text('provider', { enum: ['github-actions', 'local-proof'] }).notNull(),
  targetKind: text('target_kind', { enum: ['movie', 'manga', 'video', 'chapter', 'image'] }).notNull(),
  targetId: text('target_id').notNull(),
  contentId: text('content_id').notNull(),
  sourceRevision: integer('source_revision').notNull(),
  policyVersion: text('policy_version').notNull(),
  observationIdentity: text('observation_identity').notNull(),
  eventSequence: integer('event_sequence').notNull(),
  freshness: text('freshness', { enum: ['fresh', 'stale', 'late'] }).notNull(),
  status: text('status', { enum: ['available', 'unavailable', 'degraded', 'unknown'] }).notNull(),
  reasonCode: text('reason_code').notNull(),
  nextAction: text('next_action', { enum: ['none', 'recheck', 'repair', 'retry', 'ignore'] }).notNull(),
  summaryJson: text('summary_json', { mode: 'json' }).notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_availability_observation_identity').on(table.observationIdentity),
  uniqueIndex('idx_crawler_availability_observation_event').on(table.runId, table.attemptNumber, table.eventSequence),
  index('idx_crawler_availability_observation_task_attempt').on(table.taskId, table.runId, table.attemptNumber),
  index('idx_crawler_availability_observation_target_revision').on(table.targetKind, table.targetId, table.contentId, table.sourceRevision),
  index('idx_crawler_availability_observation_observed').on(table.observedAt),
  foreignKey({
    columns: [table.taskId, table.runId],
    foreignColumns: [crawlerRuns.taskId, crawlerRuns.id],
  }),
])

export type CrawlerAvailabilityObservation = InferSelectModel<typeof crawlerAvailabilityObservations>
export type NewCrawlerAvailabilityObservation = InferInsertModel<typeof crawlerAvailabilityObservations>

/** One bounded current row per target/content identity; promotion is revision/policy CAS guarded by the API contract. */
export const crawlerAvailabilityCurrent = sqliteTable('crawler_availability_current', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  attemptNumber: integer('attempt_number').notNull(),
  provider: text('provider', { enum: ['github-actions', 'local-proof'] }).notNull(),
  targetKind: text('target_kind', { enum: ['movie', 'manga', 'video', 'chapter', 'image'] }).notNull(),
  targetId: text('target_id').notNull(),
  contentId: text('content_id').notNull(),
  sourceRevision: integer('source_revision').notNull(),
  policyVersion: text('policy_version').notNull(),
  observationIdentity: text('observation_identity').notNull(),
  eventSequence: integer('event_sequence').notNull(),
  projectionVersion: integer('projection_version').notNull().default(0),
  freshness: text('freshness', { enum: ['fresh', 'stale', 'late'] }).notNull(),
  status: text('status', { enum: ['available', 'unavailable', 'degraded', 'unknown'] }).notNull(),
  reasonCode: text('reason_code').notNull(),
  nextAction: text('next_action', { enum: ['none', 'recheck', 'repair', 'retry', 'ignore'] }).notNull(),
  summaryJson: text('summary_json', { mode: 'json' }).notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_availability_current_target').on(table.targetKind, table.targetId, table.contentId),
  uniqueIndex('idx_crawler_availability_current_observation').on(table.observationIdentity),
  index('idx_crawler_availability_current_task_attempt').on(table.taskId, table.runId, table.attemptNumber),
  index('idx_crawler_availability_current_target_revision').on(table.targetKind, table.targetId, table.contentId, table.sourceRevision),
  index('idx_crawler_availability_current_policy_version').on(table.policyVersion, table.projectionVersion),
  foreignKey({
    columns: [table.taskId, table.runId],
    foreignColumns: [crawlerRuns.taskId, crawlerRuns.id],
  }),
])

export type CrawlerAvailabilityCurrent = InferSelectModel<typeof crawlerAvailabilityCurrent>
export type NewCrawlerAvailabilityCurrent = InferInsertModel<typeof crawlerAvailabilityCurrent>

/** The first valid terminal playback fact for one fresh tuple/content/revision. */
export const playbackEvidenceSummaries = sqliteTable('playback_evidence_summary', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => crawlerRuns.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  provider: text('provider', { enum: ['github-actions'] }).notNull(),
  contentId: text('content_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  evidenceIdentity: text('evidence_identity').notNull(),
  evidenceHash: text('evidence_hash').notNull(),
  playbackStatus: text('playback_status', { enum: ['playback_verified'] }).notNull(),
  summaryJson: text('summary_json', { mode: 'json' }).notNull(),
  artifactReference: text('artifact_reference').notNull(),
  artifactStem: text('artifact_stem').notNull(),
  artifactHash: text('artifact_hash').notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_playback_evidence_summary_tuple').on(
    table.taskId,
    table.runId,
    table.attemptNumber,
    table.provider,
    table.contentId,
    table.sourceRevision,
  ),
  uniqueIndex('idx_playback_evidence_summary_content_revision').on(table.contentId, table.sourceRevision),
  uniqueIndex('idx_playback_evidence_summary_identity').on(table.evidenceIdentity),
  index('idx_playback_evidence_summary_run_observed').on(table.runId, table.observedAt),
  foreignKey({
    columns: [table.taskId, table.runId],
    foreignColumns: [crawlerRuns.taskId, crawlerRuns.id],
  }).onDelete('cascade'),
])

export type PlaybackEvidenceSummaryRow = InferSelectModel<typeof playbackEvidenceSummaries>
export type NewPlaybackEvidenceSummaryRow = InferInsertModel<typeof playbackEvidenceSummaries>

/** Append-only bounded rejection facts; raw evidence and media are never stored here. */
export const playbackEvidenceRejections = sqliteTable('playback_evidence_rejection', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => crawlerRuns.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  provider: text('provider', { enum: ['github-actions'] }).notNull(),
  contentId: text('content_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
  evidenceIdentity: text('evidence_identity').notNull(),
  evidenceHash: text('evidence_hash').notNull(),
  artifactReference: text('artifact_reference').notNull(),
  artifactStem: text('artifact_stem').notNull(),
  artifactHash: text('artifact_hash').notNull(),
  outcome: text('outcome', { enum: ['duplicate', 'conflict', 'stale', 'late', 'ignored'] }).notNull(),
  reasonCode: text('reason_code').notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_playback_evidence_rejection_tuple').on(
    table.taskId,
    table.runId,
    table.attemptNumber,
    table.provider,
    table.contentId,
    table.sourceRevision,
  ),
  index('idx_playback_evidence_rejection_run_created').on(table.runId, table.createdAt),
  index('idx_playback_evidence_rejection_outcome_created').on(table.outcome, table.createdAt),
  foreignKey({
    columns: [table.taskId, table.runId],
    foreignColumns: [crawlerRuns.taskId, crawlerRuns.id],
  }).onDelete('cascade'),
])

export type PlaybackEvidenceRejectionRow = InferSelectModel<typeof playbackEvidenceRejections>
export type NewPlaybackEvidenceRejectionRow = InferInsertModel<typeof playbackEvidenceRejections>

/** Append-only, bounded per-source facts keyed by the crawler event identity. */
export const movieSourceObservations = sqliteTable('movie_source_observation', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  operation: text('operation', { enum: ['source_read', 'repair_players'] }).notNull(),
  runId: text('run_id').notNull().references(() => crawlerRuns.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  sequence: integer('sequence').notNull(),
  eventId: text('event_id').notNull(),
  sourceRevision: integer('source_revision').notNull(),
  sourceOrdinal: integer('source_ordinal').notNull(),
  sourceType: text('source_type', { enum: ['direct', 'magnet', 'TorrServer'] }).notNull(),
  health: text('health', { enum: ['inactive', 'unverified', 'failed'] }).notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  reasonCode: text('reason_code', {
    enum: ['source_inactive', 'source_unverified', 'source_candidate_invalid', 'source_read_failed', 'source_write_failed'],
  }).notNull(),
  eligible: integer('eligible', { mode: 'boolean' }).notNull(),
}, table => [
  uniqueIndex('idx_movie_source_observation_identity').on(
    table.movieId,
    table.sourceRevision,
    table.operation,
    table.runId,
    table.attemptNumber,
    table.sequence,
    table.eventId,
    table.sourceOrdinal,
  ),
  uniqueIndex('idx_movie_source_observation_run_event_source').on(
    table.runId,
    table.eventId,
    table.sourceOrdinal,
  ),
  index('idx_movie_source_observation_movie_revision').on(table.movieId, table.sourceRevision),
])

export type MovieSourceObservation = InferSelectModel<typeof movieSourceObservations>
export type NewMovieSourceObservation = InferInsertModel<typeof movieSourceObservations>

/** Immutable GitHub Actions identity and bounded provider facts for one application run attempt. */
export const crawlerRunProviderAssociations = sqliteTable('crawler_run_provider_association', {
  runId: text('run_id').primaryKey().references(() => crawlerRuns.id),
  applicationAttempt: integer('application_attempt').notNull(),
  provider: text('provider', { enum: ['github-actions', 'local-proof'] }).notNull(),
  templateKey: text('template_key', { enum: ['movie', 'manga'] }).notNull(),
  target: text('target').notNull(),
  workflow: text('workflow').notNull(),
  repository: text('repository').notNull(),
  ref: text('ref').notNull(),
  environment: text('environment').notNull(),
  crawlerEntrypoint: text('crawler_entrypoint').notNull(),
  providerRunId: text('provider_run_id'),
  providerRunAttempt: integer('provider_run_attempt'),
  sha: text('sha'),
  providerStatus: text('provider_status'),
  providerConclusion: text('provider_conclusion'),
  reconciliationWindowEndsAt: integer('reconciliation_window_ends_at', { mode: 'timestamp' }),
  safeFactsJson: text('safe_facts_json', { mode: 'json' }),
  scheduleBucket: text('schedule_bucket'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_provider_run_attempt').on(table.providerRunId, table.providerRunAttempt),
  uniqueIndex('idx_crawler_provider_application_run_attempt').on(table.runId, table.applicationAttempt),
  uniqueIndex('idx_crawler_provider_schedule_bucket').on(table.templateKey, table.target, table.workflow, table.scheduleBucket),
  index('idx_crawler_provider_reconciliation_window').on(table.reconciliationWindowEndsAt),
])

export type CrawlerRunProviderAssociation = InferSelectModel<typeof crawlerRunProviderAssociations>
export type NewCrawlerRunProviderAssociation = InferInsertModel<typeof crawlerRunProviderAssociations>

export const crawlerRunTransitions = sqliteTable('crawler_run_transition', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  sequence: integer('sequence').notNull(),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  reasonCode: text('reason_code').notNull(),
  safeSummary: text('safe_summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_run_transition_run_sequence').on(table.runId, table.sequence),
])

export type CrawlerRunTransition = InferSelectModel<typeof crawlerRunTransitions>
export type NewCrawlerRunTransition = InferInsertModel<typeof crawlerRunTransitions>

export const crawlerTemplateLeases = sqliteTable('crawler_template_lease', {
  templateKey: text('template_key', { enum: ['movie', 'manga'] }).primaryKey(),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  renewedAt: integer('renewed_at', { mode: 'timestamp' }).notNull(),
})

export type CrawlerTemplateLease = InferSelectModel<typeof crawlerTemplateLeases>
export type NewCrawlerTemplateLease = InferInsertModel<typeof crawlerTemplateLeases>

export const crawlerRunnerEvents = sqliteTable('crawler_runner_event', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  eventId: text('event_id').notNull(),
  nonce: text('nonce').notNull(),
  sequence: integer('sequence').notNull(),
  bodySha256: text('body_sha256').notNull(),
  keyId: text('key_id').notNull(),
  outcome: text('outcome', { mode: 'json' }).notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_runner_event_run_event').on(table.runId, table.eventId),
  uniqueIndex('idx_crawler_runner_event_run_nonce').on(table.runId, table.nonce),
])

export type CrawlerRunnerEvent = InferSelectModel<typeof crawlerRunnerEvents>
export type NewCrawlerRunnerEvent = InferInsertModel<typeof crawlerRunnerEvents>

export const crawlerRunLogs = sqliteTable('crawler_run_log', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  sequence: integer('sequence').notNull(),
  level: text('level', { enum: ['debug', 'info', 'warn', 'error'] }).notNull(),
  code: text('code').notNull(),
  safeMessage: text('safe_message').notNull(),
  countsJson: text('counts_json', { mode: 'json' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_crawler_run_log_run_sequence').on(table.runId, table.sequence),
  index('idx_crawler_run_log_expiry').on(table.expiresAt),
])

export type CrawlerRunLog = InferSelectModel<typeof crawlerRunLogs>
export type NewCrawlerRunLog = InferInsertModel<typeof crawlerRunLogs>

// --- 审计日志 ---
export const auditLogs = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id), // 操作者
  userEmail: text('user_email').notNull(), // 冗余存储，便于查询
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, BULK_UPDATE, BULK_DELETE
  resourceType: text('resource_type').notNull(), // comic, movie, chapter, player, actor, publisher, user
  resourceId: text('resource_id'), // 资源 ID（批量操作时为 null）
  resourceIdentifier: text('resource_identifier'), // 资源标识符（slug, code 等）
  affectedCount: integer('affected_count').default(1), // 批量操作影响的数量
  changes: text('changes', { mode: 'json' }), // 变更详情 JSON { before: {...}, after: {...} }
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type AuditLog = InferSelectModel<typeof auditLogs>
export type NewAuditLog = InferInsertModel<typeof auditLogs>

// --- 用户进度 ---
export const progress = sqliteTable('progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  contentType: text('content_type', { enum: ['movie', 'comic'] }).notNull(),
  contentId: text('content_id').notNull(),
  position: integer('position').notNull(), // 统一进度位置：movie=秒，comic=页码
  duration: integer('duration'), // movie 总时长（秒）；comic 固定为 null
  completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_progress_user_content').on(table.userId, table.contentType, table.contentId),
  index('idx_progress_user_updated_at').on(table.userId, table.updatedAt),
  index('idx_progress_content_lookup').on(table.contentType, table.contentId),
])

export type Progress = InferSelectModel<typeof progress>
export type NewProgress = InferInsertModel<typeof progress>

// --- 用户收藏 ---
export const userFavorites = sqliteTable('user_favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['actor', 'publisher', 'movie', 'comic'] }).notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_user_favorites_user_entity').on(table.userId, table.entityType, table.entityId),
  index('idx_user_favorites_entity_type').on(table.entityType),
  index('idx_user_favorites_entity_id').on(table.entityId),
])

export type UserFavorite = InferSelectModel<typeof userFavorites>
export type NewUserFavorite = InferInsertModel<typeof userFavorites>

// --- 播放源评分 ---
export const ratings = sqliteTable('ratings', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().$type<1 | 2 | 3 | 4 | 5>(), // 1-5 星
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_ratings_player_user').on(table.playerId, table.userId),
  index('idx_ratings_player').on(table.playerId),
  index('idx_ratings_user').on(table.userId),
  index('idx_ratings_created_at').on(table.createdAt),
])

export type Rating = InferSelectModel<typeof ratings>
export type NewRating = InferInsertModel<typeof ratings>

// --- Aria2 配置 ---
export const aria2Configs = sqliteTable('aria2_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  rpcUrl: text('rpc_url').notNull(),
  secret: text('secret'), // 加密存储的密钥
  useProxy: integer('use_proxy', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

export type Aria2Config = InferSelectModel<typeof aria2Configs>
export type NewAria2Config = InferInsertModel<typeof aria2Configs>

// --- Quant 用户级 AI 配置 ---
export const quantAiConfigs = sqliteTable('quant_ai_config', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'] }).notNull(),
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  responseMode: text('response_mode', { enum: ['stream', 'json'] }).notNull().default('stream'),
  generationTimeoutMs: integer('generation_timeout_ms').notNull().default(300000),
  encryptedApiKey: text('encrypted_api_key'),
  apiKeyHint: text('api_key_hint'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

export type QuantAiConfig = InferSelectModel<typeof quantAiConfigs>
export type NewQuantAiConfig = InferInsertModel<typeof quantAiConfigs>

// --- Quant 用户级因子配置 ---
export const quantFactorConfigs = sqliteTable('quant_factor_config', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  weightsJson: text('weights_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

export type QuantFactorConfig = InferSelectModel<typeof quantFactorConfigs>
export type NewQuantFactorConfig = InferInsertModel<typeof quantFactorConfigs>

// --- 量化工作台 ---
export const quantWatchlist = sqliteTable('quant_watchlist', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  tsCode: text('ts_code').notNull(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_quant_watchlist_user_ts_code').on(table.userId, table.tsCode),
  index('idx_quant_watchlist_user_created_at').on(table.userId, table.createdAt),
])

export type QuantWatchlist = InferSelectModel<typeof quantWatchlist>
export type NewQuantWatchlist = InferInsertModel<typeof quantWatchlist>

export const quantResearchMarkers = sqliteTable('quant_research_marker', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  tsCode: text('ts_code').notNull(),
  status: text('status', { enum: ['unreviewed', 'priority', 'paused', 'excluded'] }).notNull().default('unreviewed'),
  note: text('note'),
  reviewDate: text('review_date'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_quant_research_marker_user_ts_code').on(table.userId, table.tsCode),
  index('idx_quant_research_marker_user_status').on(table.userId, table.status),
])

export type QuantResearchMarker = InferSelectModel<typeof quantResearchMarkers>
export type NewQuantResearchMarker = InferInsertModel<typeof quantResearchMarkers>

export const quantDailyBars = sqliteTable('quant_daily_bar', {
  id: text('id').primaryKey(),
  tsCode: text('ts_code').notNull(),
  tradeDate: text('trade_date').notNull(),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  preClose: real('pre_close'),
  change: real('change'),
  pctChg: real('pct_chg'),
  volume: real('volume').notNull(),
  amount: real('amount'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_quant_daily_bar_identity').on(table.tsCode, table.tradeDate),
  index('idx_quant_daily_bar_ts_code_date').on(table.tsCode, table.tradeDate),
])

export type QuantDailyBar = InferSelectModel<typeof quantDailyBars>
export type NewQuantDailyBar = InferInsertModel<typeof quantDailyBars>

export const quantScanSnapshots = sqliteTable('quant_scan_snapshot', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['completed', 'partial'] }).notNull(),
  factorVersion: text('factor_version').notNull(),
  inputTsCodesJson: text('input_ts_codes_json').notNull(),
  fromDate: text('from_date').notNull(),
  toDate: text('to_date').notNull(),
  candidateCount: integer('candidate_count').notNull(),
  candidatesJson: text('candidates_json').notNull(),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_quant_scan_snapshot_user_generated_at').on(table.userId, table.generatedAt),
  index('idx_quant_scan_snapshot_user_status_generated').on(table.userId, table.status, table.generatedAt),
])

export type QuantScanSnapshot = InferSelectModel<typeof quantScanSnapshots>
export type NewQuantScanSnapshot = InferInsertModel<typeof quantScanSnapshots>

export const quantSyncState = sqliteTable('quant_sync_state', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['running', 'completed', 'partial', 'rejected'] }).notNull(),
  runId: text('run_id'),
  leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp' }),
  fromDate: text('from_date').notNull(),
  toDate: text('to_date').notNull(),
  requestedCount: integer('requested_count').notNull().default(0),
  writtenCount: integer('written_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  reasonCode: text('reason_code'),
  reason: text('reason'),
  snapshotId: text('snapshot_id'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

export type QuantSyncState = InferSelectModel<typeof quantSyncState>
export type NewQuantSyncState = InferInsertModel<typeof quantSyncState>

export const quantResearchRuns = sqliteTable('quant_research_run', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tsCode: text('ts_code').notNull(),
  name: text('name'),
  status: text('status', { enum: ['ready', 'partial', 'insufficient_data'] }).notNull(),
  reportVersion: text('report_version').notNull(),
  sourceSnapshotId: text('source_snapshot_id'),
  reportJson: text('report_json').notNull(),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_quant_research_run_user_generated_at').on(table.userId, table.generatedAt),
  index('idx_quant_research_run_user_ts_code_generated_at').on(table.userId, table.tsCode, table.generatedAt),
])

export type QuantResearchRun = InferSelectModel<typeof quantResearchRuns>
export type NewQuantResearchRun = InferInsertModel<typeof quantResearchRuns>

export const quantResearchSummaries = sqliteTable('quant_research_summary', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  researchRunId: text('research_run_id').notNull().references(() => quantResearchRuns.id, { onDelete: 'cascade' }),
  summaryVersion: text('summary_version').notNull(),
  reportVersion: text('report_version').notNull(),
  provider: text('provider', { enum: ['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'] }).notNull(),
  model: text('model').notNull(),
  summaryJson: text('summary_json').notNull(),
  citedEvidenceKeysJson: text('cited_evidence_keys_json').notNull(),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_quant_research_summary_user_run_generated_at').on(table.userId, table.researchRunId, table.generatedAt),
  index('idx_quant_research_summary_user_generated_at').on(table.userId, table.generatedAt),
])

export type QuantResearchSummary = InferSelectModel<typeof quantResearchSummaries>
export type NewQuantResearchSummary = InferInsertModel<typeof quantResearchSummaries>

export const quantDecisionRecords = sqliteTable('quant_decision_record', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  researchRunId: text('research_run_id').notNull().references(() => quantResearchRuns.id, { onDelete: 'cascade' }),
  tsCode: text('ts_code').notNull(),
  action: text('action', { enum: ['watch', 'plan-buy', 'holding', 'sold'] }).notNull(),
  note: text('note'),
  snapshotJson: text('snapshot_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  uniqueIndex('idx_quant_decision_record_user_run').on(table.userId, table.researchRunId),
  index('idx_quant_decision_record_user_ts_code_updated_at').on(table.userId, table.tsCode, table.updatedAt),
])

export type QuantDecisionRecord = InferSelectModel<typeof quantDecisionRecords>
export type NewQuantDecisionRecord = InferInsertModel<typeof quantDecisionRecords>

export const quantDecisionAssessments = sqliteTable('quant_decision_assessment', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  researchRunId: text('research_run_id').notNull().references(() => quantResearchRuns.id, { onDelete: 'cascade' }),
  tsCode: text('ts_code').notNull(),
  mode: text('mode', { enum: ['buy', 'holding'] }).notNull(),
  currentPrice: real('current_price').notNull(),
  costBasis: real('cost_basis'),
  quantity: real('quantity'),
  snapshotJson: text('snapshot_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_quant_decision_assessment_user_ts_code_created_at').on(table.userId, table.tsCode, table.createdAt),
  index('idx_quant_decision_assessment_user_run_created_at').on(table.userId, table.researchRunId, table.createdAt),
])

export type QuantDecisionAssessment = InferSelectModel<typeof quantDecisionAssessments>
export type NewQuantDecisionAssessment = InferInsertModel<typeof quantDecisionAssessments>

export const quantCandidateAiSessions = sqliteTable('quant_candidate_ai_session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  snapshotId: text('snapshot_id').notNull(),
  snapshotGeneratedAt: integer('snapshot_generated_at', { mode: 'timestamp' }).notNull(),
  fromDate: text('from_date').notNull(),
  toDate: text('to_date').notNull(),
  scopeKey: text('scope_key').notNull(),
  candidateCodesJson: text('candidate_codes_json').notNull(),
  briefingJson: text('briefing_json').notNull(),
  questionsJson: text('questions_json').notNull(),
  provider: text('provider', { enum: ['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'] }).notNull(),
  model: text('model').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => [
  index('idx_quant_candidate_ai_session_user_created_at').on(table.userId, table.createdAt),
  index('idx_quant_candidate_ai_session_user_snapshot_generated_at').on(table.userId, table.snapshotGeneratedAt),
])

export type QuantCandidateAiSession = InferSelectModel<typeof quantCandidateAiSessions>
export type NewQuantCandidateAiSession = InferInsertModel<typeof quantCandidateAiSessions>

// --- 评分关联关系 ---
export const ratingsRelations = relations(ratings, ({ one }) => ({
  player: one(players, {
    fields: [ratings.playerId],
    references: [players.id],
  }),
  user: one(user, {
    fields: [ratings.userId],
    references: [user.id],
  }),
}))

// Aria2 配置关联关系
export const aria2ConfigsRelations = relations(aria2Configs, ({ one }) => ({
  user: one(user, {
    fields: [aria2Configs.userId],
    references: [user.id],
  }),
}))

export const quantAiConfigsRelations = relations(quantAiConfigs, ({ one }) => ({
  user: one(user, {
    fields: [quantAiConfigs.userId],
    references: [user.id],
  }),
}))

export const quantFactorConfigsRelations = relations(quantFactorConfigs, ({ one }) => ({
  user: one(user, {
    fields: [quantFactorConfigs.userId],
    references: [user.id],
  }),
}))

export const quantWatchlistRelations = relations(quantWatchlist, ({ one }) => ({
  user: one(user, {
    fields: [quantWatchlist.userId],
    references: [user.id],
  }),
}))

export const quantResearchMarkersRelations = relations(quantResearchMarkers, ({ one }) => ({
  user: one(user, {
    fields: [quantResearchMarkers.userId],
    references: [user.id],
  }),
}))

export const quantScanSnapshotsRelations = relations(quantScanSnapshots, ({ one }) => ({
  user: one(user, {
    fields: [quantScanSnapshots.userId],
    references: [user.id],
  }),
}))

export const quantSyncStateRelations = relations(quantSyncState, ({ one }) => ({
  user: one(user, {
    fields: [quantSyncState.userId],
    references: [user.id],
  }),
}))

export const quantResearchRunsRelations = relations(quantResearchRuns, ({ one, many }) => ({
  user: one(user, {
    fields: [quantResearchRuns.userId],
    references: [user.id],
  }),
  summaries: many(quantResearchSummaries),
  decisionRecords: many(quantDecisionRecords),
  decisionAssessments: many(quantDecisionAssessments),
}))

export const quantResearchSummariesRelations = relations(quantResearchSummaries, ({ one }) => ({
  user: one(user, {
    fields: [quantResearchSummaries.userId],
    references: [user.id],
  }),
  researchRun: one(quantResearchRuns, {
    fields: [quantResearchSummaries.researchRunId],
    references: [quantResearchRuns.id],
  }),
}))

export const quantDecisionRecordsRelations = relations(quantDecisionRecords, ({ one }) => ({
  user: one(user, {
    fields: [quantDecisionRecords.userId],
    references: [user.id],
  }),
  researchRun: one(quantResearchRuns, {
    fields: [quantDecisionRecords.researchRunId],
    references: [quantResearchRuns.id],
  }),
}))

export const quantDecisionAssessmentsRelations = relations(quantDecisionAssessments, ({ one }) => ({
  user: one(user, {
    fields: [quantDecisionAssessments.userId],
    references: [user.id],
  }),
  researchRun: one(quantResearchRuns, {
    fields: [quantDecisionAssessments.researchRunId],
    references: [quantResearchRuns.id],
  }),
}))

export const quantCandidateAiSessionsRelations = relations(quantCandidateAiSessions, ({ one }) => ({
  user: one(user, {
    fields: [quantCandidateAiSessions.userId],
    references: [user.id],
  }),
}))

// --- 关联关系定义 ---

export const userRelations = relations(user, ({ many }) => ({
  posts: many(posts),
  sessions: many(session),
  accounts: many(account),
  progress: many(progress),
  favorites: many(userFavorites),
  ratings: many(ratings),
  aria2Config: many(aria2Configs),
  quantAiConfigs: many(quantAiConfigs),
  quantFactorConfigs: many(quantFactorConfigs),
  quantWatchlists: many(quantWatchlist),
  quantResearchMarkers: many(quantResearchMarkers),
  quantScanSnapshots: many(quantScanSnapshots),
  quantSyncStates: many(quantSyncState),
  quantResearchRuns: many(quantResearchRuns),
  quantResearchSummaries: many(quantResearchSummaries),
  quantDecisionRecords: many(quantDecisionRecords),
  quantDecisionAssessments: many(quantDecisionAssessments),
  quantCandidateAiSessions: many(quantCandidateAiSessions),
  crawlerTasks: many(crawlerTasks),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const postRelations = relations(posts, ({ one }) => ({
  author: one(user, {
    fields: [posts.authorId],
    references: [user.id],
  }),
}))

export const comicRelations = relations(comics, ({ many, one }) => ({
  chapters: many(chapters),
  chapterSourceSnapshots: many(comicChapterSourceSnapshots),
  chapterCompletenessObservations: many(chapterCompletenessObservations),
  chapterCompletenessCurrent: one(chapterCompletenessCurrent),
}))

export const chapterRelations = relations(chapters, ({ one, many }) => ({
  comic: one(comics, {
    fields: [chapters.comicId],
    references: [comics.id],
  }),
  pages: many(pages),
  pageAvailabilityObservations: many(chapterPageAvailabilityObservations),
  pageAvailabilityCurrent: one(chapterPageAvailabilityCurrent),
}))

export const pageRelations = relations(pages, ({ one }) => ({
  chapter: one(chapters, {
    fields: [pages.chapterId],
    references: [chapters.id],
  }),
}))

export const comicChapterSourceSnapshotRelations = relations(comicChapterSourceSnapshots, ({ one, many }) => ({
  comic: one(comics, {
    fields: [comicChapterSourceSnapshots.comicId],
    references: [comics.id],
  }),
  rows: many(comicChapterSourceRows),
  completenessObservations: many(chapterCompletenessObservations),
  completenessCurrent: many(chapterCompletenessCurrent),
}))

export const comicChapterSourceRowRelations = relations(comicChapterSourceRows, ({ one }) => ({
  snapshot: one(comicChapterSourceSnapshots, {
    fields: [comicChapterSourceRows.snapshotId],
    references: [comicChapterSourceSnapshots.id],
  }),
  comic: one(comics, {
    fields: [comicChapterSourceRows.comicId],
    references: [comics.id],
  }),
}))

export const chapterCompletenessObservationRelations = relations(chapterCompletenessObservations, ({ one }) => ({
  comic: one(comics, {
    fields: [chapterCompletenessObservations.comicId],
    references: [comics.id],
  }),
  snapshot: one(comicChapterSourceSnapshots, {
    fields: [chapterCompletenessObservations.snapshotId],
    references: [comicChapterSourceSnapshots.id],
  }),
}))

export const chapterCompletenessCurrentRelations = relations(chapterCompletenessCurrent, ({ one }) => ({
  comic: one(comics, {
    fields: [chapterCompletenessCurrent.comicId],
    references: [comics.id],
  }),
  snapshot: one(comicChapterSourceSnapshots, {
    fields: [chapterCompletenessCurrent.snapshotId],
    references: [comicChapterSourceSnapshots.id],
  }),
}))

export const chapterPageAvailabilityObservationRelations = relations(chapterPageAvailabilityObservations, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterPageAvailabilityObservations.chapterId],
    references: [chapters.id],
  }),
}))

export const chapterPageAvailabilityCurrentRelations = relations(chapterPageAvailabilityCurrent, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterPageAvailabilityCurrent.chapterId],
    references: [chapters.id],
  }),
}))

export const movieRelations = relations(movies, ({ many, one }) => ({
  players: many(players),
  movieActors: many(movieActors),
  moviePublishers: many(moviePublishers),
  sourceState: one(movieSourceStates),
  sourceObservations: many(movieSourceObservations),
  playbackEvidenceSummaries: many(playbackEvidenceSummaries),
  playbackEvidenceRejections: many(playbackEvidenceRejections),
}))

export const movieSourceStateRelations = relations(movieSourceStates, ({ one }) => ({
  movie: one(movies, {
    fields: [movieSourceStates.movieId],
    references: [movies.id],
  }),
}))

export const playerRelations = relations(players, ({ one, many }) => ({
  movie: one(movies, {
    fields: [players.movieId],
    references: [movies.id],
  }),
  ratings: many(ratings),
}))

export const actorRelations = relations(actors, ({ many }) => ({
  movieActors: many(movieActors),
}))

export const publisherRelations = relations(publishers, ({ many }) => ({
  moviePublishers: many(moviePublishers),
}))

export const movieActorRelations = relations(movieActors, ({ one }) => ({
  movie: one(movies, {
    fields: [movieActors.movieId],
    references: [movies.id],
  }),
  actor: one(actors, {
    fields: [movieActors.actorId],
    references: [actors.id],
  }),
}))

export const moviePublisherRelations = relations(moviePublishers, ({ one }) => ({
  movie: one(movies, {
    fields: [moviePublishers.movieId],
    references: [movies.id],
  }),
  publisher: one(publishers, {
    fields: [moviePublishers.publisherId],
    references: [publishers.id],
  }),
}))

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
}))

export const crawlerTaskRelations = relations(crawlerTasks, ({ many, one }) => ({
  requester: one(user, {
    fields: [crawlerTasks.requestedByUserId],
    references: [user.id],
  }),
  runs: many(crawlerRuns),
  availabilityObservations: many(crawlerAvailabilityObservations),
  availabilityCurrent: many(crawlerAvailabilityCurrent),
  playbackEvidenceSummaries: many(playbackEvidenceSummaries),
  playbackEvidenceRejections: many(playbackEvidenceRejections),
}))

export const crawlerRunRelations = relations(crawlerRuns, ({ many, one }) => ({
  task: one(crawlerTasks, {
    fields: [crawlerRuns.taskId],
    references: [crawlerTasks.id],
  }),
  transitions: many(crawlerRunTransitions),
  availabilityObservations: many(crawlerAvailabilityObservations),
  availabilityCurrent: many(crawlerAvailabilityCurrent),
  runnerEvents: many(crawlerRunnerEvents),
  logs: many(crawlerRunLogs),
  providerAssociation: one(crawlerRunProviderAssociations),
  templateLease: one(crawlerTemplateLeases),
  sourceObservations: many(movieSourceObservations),
  playbackEvidenceSummaries: many(playbackEvidenceSummaries),
  playbackEvidenceRejections: many(playbackEvidenceRejections),
}))

export const crawlerAvailabilityObservationRelations = relations(crawlerAvailabilityObservations, ({ one }) => ({
  task: one(crawlerTasks, {
    fields: [crawlerAvailabilityObservations.taskId],
    references: [crawlerTasks.id],
  }),
  run: one(crawlerRuns, {
    fields: [crawlerAvailabilityObservations.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerAvailabilityCurrentRelations = relations(crawlerAvailabilityCurrent, ({ one }) => ({
  task: one(crawlerTasks, {
    fields: [crawlerAvailabilityCurrent.taskId],
    references: [crawlerTasks.id],
  }),
  run: one(crawlerRuns, {
    fields: [crawlerAvailabilityCurrent.runId],
    references: [crawlerRuns.id],
  }),
}))

export const playbackEvidenceSummaryRelations = relations(playbackEvidenceSummaries, ({ one }) => ({
  task: one(crawlerTasks, {
    fields: [playbackEvidenceSummaries.taskId],
    references: [crawlerTasks.id],
  }),
  run: one(crawlerRuns, {
    fields: [playbackEvidenceSummaries.runId],
    references: [crawlerRuns.id],
  }),
  movie: one(movies, {
    fields: [playbackEvidenceSummaries.contentId],
    references: [movies.id],
  }),
}))

export const playbackEvidenceRejectionRelations = relations(playbackEvidenceRejections, ({ one }) => ({
  task: one(crawlerTasks, {
    fields: [playbackEvidenceRejections.taskId],
    references: [crawlerTasks.id],
  }),
  run: one(crawlerRuns, {
    fields: [playbackEvidenceRejections.runId],
    references: [crawlerRuns.id],
  }),
  movie: one(movies, {
    fields: [playbackEvidenceRejections.contentId],
    references: [movies.id],
  }),
}))

export const movieSourceObservationRelations = relations(movieSourceObservations, ({ one }) => ({
  movie: one(movies, {
    fields: [movieSourceObservations.movieId],
    references: [movies.id],
  }),
  run: one(crawlerRuns, {
    fields: [movieSourceObservations.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerRunProviderAssociationRelations = relations(crawlerRunProviderAssociations, ({ one }) => ({
  run: one(crawlerRuns, {
    fields: [crawlerRunProviderAssociations.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerRunTransitionRelations = relations(crawlerRunTransitions, ({ one }) => ({
  run: one(crawlerRuns, {
    fields: [crawlerRunTransitions.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerTemplateLeaseRelations = relations(crawlerTemplateLeases, ({ one }) => ({
  run: one(crawlerRuns, {
    fields: [crawlerTemplateLeases.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerRunnerEventRelations = relations(crawlerRunnerEvents, ({ one }) => ({
  run: one(crawlerRuns, {
    fields: [crawlerRunnerEvents.runId],
    references: [crawlerRuns.id],
  }),
}))

export const crawlerRunLogRelations = relations(crawlerRunLogs, ({ one }) => ({
  run: one(crawlerRuns, {
    fields: [crawlerRunLogs.runId],
    references: [crawlerRuns.id],
  }),
}))

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(user, {
    fields: [progress.userId],
    references: [user.id],
  }),
}))

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(user, {
    fields: [userFavorites.userId],
    references: [user.id],
  }),
}))

// --- 系统配置 ---
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

export type SystemSetting = InferSelectModel<typeof systemSettings>
export type NewSystemSetting = InferInsertModel<typeof systemSettings>
