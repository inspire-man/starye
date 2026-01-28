import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// --- 用户认证 (Better Auth 标准表) ---
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  role: text('role').default('user').notNull(),
  isAdult: integer('is_adult', { mode: 'boolean' }).default(false),
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
  sortOrder: integer('sort_order').default(0), // 人工排序/权重 (越大越靠前)
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

// --- 系统任务 ---
export const jobs = sqliteTable('job', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }),
  status: text('status').default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
})

// --- 关联关系定义 ---

export const userRelations = relations(user, ({ many }) => ({
  posts: many(posts),
  sessions: many(session),
  accounts: many(account),
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
}))

export const playerRelations = relations(players, ({ one }) => ({
  movie: one(movies, {
    fields: [players.movieId],
    references: [movies.id],
  }),
}))
