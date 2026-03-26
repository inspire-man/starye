import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
  content: text('content'), // Markdown 格式
  excerpt: text('excerpt'),
  coverImage: text('cover_image'),
  published: integer('published', { mode: 'boolean' }).default(false),
  authorId: text('author_id').references(() => user.id),
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

export const pages = sqliteTable('page', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  imageUrl: text('image_url').notNull(),
  width: integer('width'),
  height: integer('height'),
})

export type Page = InferSelectModel<typeof pages>

// --- 电影业务 ---
export const movies = sqliteTable('movie', {
  id: text('id').primaryKey(),
  title: text('title').notNull(), // 电影标题
  slug: text('slug').notNull().unique(), // URL Slug
  code: text('code').notNull().unique(), // 番号 (如: SSIS-123)
  description: text('description'), // 简介
  coverImage: text('cover_image'), // 封面图
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

export const players = sqliteTable('player', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(), // 源名称 (如: "云播", "磁力")
  sourceUrl: text('source_url').notNull(), // 播放链接或磁力链接
  quality: text('quality'), // 画质 (HD, SD 等)
  sortOrder: integer('sort_order').notNull(), // 排序
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

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
  movieCount: integer('movie_count').default(0).notNull(), // 作品数量
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  // 爬虫字段
  source: text('source').default('javbus').notNull(), // 'javbus' | 'javdb'
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
  movieCount: integer('movie_count').default(0).notNull(), // 作品数量
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  // 爬虫字段
  source: text('source').default('javbus').notNull(), // 'javbus' | 'javdb'
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
})

// 电影-女优关联表索引
export const movieActorsIndexes = {
  uniqueMovieActor: uniqueIndex('idx_movie_actor').on(movieActors.movieId, movieActors.actorId),
  actorIdx: index('idx_movie_actor_actor_id').on(movieActors.actorId), // 反向查询索引（普通索引）
}

export type MovieActor = InferSelectModel<typeof movieActors>
export type NewMovieActor = InferInsertModel<typeof movieActors>

// --- 电影-厂商关联表 ---
export const moviePublishers = sqliteTable('movie_publisher', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  publisherId: text('publisher_id').notNull().references(() => publishers.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})

// 电影-厂商关联表索引
export const moviePublishersIndexes = {
  uniqueMoviePublisher: uniqueIndex('idx_movie_pub').on(moviePublishers.movieId, moviePublishers.publisherId),
  publisherIdx: index('idx_movie_pub_publisher_id').on(moviePublishers.publisherId), // 反向查询索引（普通索引）
}

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
export const readingProgress = sqliteTable('reading_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(), // 当前阅读页码
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

// 阅读进度表索引
export const readingProgressIndexes = {
  userChapterIdx: uniqueIndex('idx_reading_progress_user_chapter').on(readingProgress.userId, readingProgress.chapterId),
}

export type ReadingProgress = InferSelectModel<typeof readingProgress>
export type NewReadingProgress = InferInsertModel<typeof readingProgress>

export const watchingProgress = sqliteTable('watching_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  movieCode: text('movie_code').notNull().references(() => movies.code, { onDelete: 'cascade' }),
  progress: integer('progress').notNull(), // 播放进度（秒）
  duration: integer('duration'), // 总时长（秒）
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
})

// 观看进度表索引
export const watchingProgressIndexes = {
  userMovieIdx: uniqueIndex('idx_watching_progress_user_movie').on(watchingProgress.userId, watchingProgress.movieCode),
}

export type WatchingProgress = InferSelectModel<typeof watchingProgress>
export type NewWatchingProgress = InferInsertModel<typeof watchingProgress>

// --- 用户收藏 ---
export const userFavorites = sqliteTable('user_favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['actor', 'publisher', 'movie', 'comic'] }).notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, table => ({
  userEntityIdx: uniqueIndex('idx_user_favorites_user_entity').on(table.userId, table.entityType, table.entityId),
  entityTypeIdx: index('idx_user_favorites_entity_type').on(table.entityType),
  entityIdIdx: index('idx_user_favorites_entity_id').on(table.entityId),
}))

export type UserFavorite = InferSelectModel<typeof userFavorites>
export type NewUserFavorite = InferInsertModel<typeof userFavorites>

// --- 关联关系定义 ---

export const userRelations = relations(user, ({ many }) => ({
  posts: many(posts),
  sessions: many(session),
  accounts: many(account),
  readingProgress: many(readingProgress),
  watchingProgress: many(watchingProgress),
  favorites: many(userFavorites),
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

export const comicRelations = relations(comics, ({ many }) => ({
  chapters: many(chapters),
}))

export const chapterRelations = relations(chapters, ({ one, many }) => ({
  comic: one(comics, {
    fields: [chapters.comicId],
    references: [comics.id],
  }),
  pages: many(pages),
}))

export const pageRelations = relations(pages, ({ one }) => ({
  chapter: one(chapters, {
    fields: [pages.chapterId],
    references: [chapters.id],
  }),
}))

export const movieRelations = relations(movies, ({ many }) => ({
  players: many(players),
  movieActors: many(movieActors),
  moviePublishers: many(moviePublishers),
}))

export const playerRelations = relations(players, ({ one }) => ({
  movie: one(movies, {
    fields: [players.movieId],
    references: [movies.id],
  }),
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

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  user: one(user, {
    fields: [readingProgress.userId],
    references: [user.id],
  }),
  chapter: one(chapters, {
    fields: [readingProgress.chapterId],
    references: [chapters.id],
  }),
}))

export const watchingProgressRelations = relations(watchingProgress, ({ one }) => ({
  user: one(user, {
    fields: [watchingProgress.userId],
    references: [user.id],
  }),
  movie: one(movies, {
    fields: [watchingProgress.movieCode],
    references: [movies.code],
  }),
}))

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(user, {
    fields: [userFavorites.userId],
    references: [user.id],
  }),
}))
