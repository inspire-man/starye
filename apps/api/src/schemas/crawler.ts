import * as v from 'valibot'

/**
 * 章节 Schema（爬虫数据）
 */
export const ChapterSchema = v.object({
  title: v.pipe(v.string(), v.description('章节标题')),
  slug: v.pipe(v.string(), v.description('章节 slug')),
  url: v.pipe(v.string(), v.url(), v.description('章节 URL')),
  number: v.pipe(v.number(), v.description('章节编号')),
})

export type ChapterInput = v.InferOutput<typeof ChapterSchema>

/**
 * 漫画信息 Schema（爬虫数据）
 */
export const MangaInfoSchema = v.object({
  title: v.pipe(v.string(), v.description('漫画标题')),
  slug: v.pipe(v.string(), v.description('漫画 slug')),
  cover: v.optional(v.pipe(v.string(), v.url(), v.description('封面 URL'))),
  author: v.optional(v.pipe(v.string(), v.description('作者'))),
  description: v.optional(v.pipe(v.string(), v.description('简介'))),
  status: v.optional(
    v.union([
      v.picklist(['serializing', 'completed']),
      v.string(),
    ]),
  ),
  isR18: v.optional(v.boolean()),
  sourceUrl: v.optional(v.pipe(v.string(), v.url())),
  region: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  chapters: v.array(ChapterSchema),
})

export type MangaInfoInput = v.InferOutput<typeof MangaInfoSchema>

/**
 * 章节内容 Schema（爬虫数据）
 */
export const ChapterContentSchema = v.object({
  comicSlug: v.pipe(v.string(), v.description('漫画 slug')),
  chapterSlug: v.pipe(v.string(), v.description('章节 slug')),
  title: v.pipe(v.string(), v.description('章节标题')),
  images: v.pipe(
    v.array(v.pipe(v.string(), v.url())),
    v.description('图片 URL 数组（已上传）'),
  ),
  width: v.optional(v.pipe(v.number(), v.description('图片宽度'))),
  height: v.optional(v.pipe(v.number(), v.description('图片高度'))),
})

export type ChapterContentInput = v.InferOutput<typeof ChapterContentSchema>

/**
 * 播放源 Schema（爬虫数据）
 */
export const PlayerInputSchema = v.object({
  sourceName: v.pipe(v.string(), v.description('播放源名称')),
  sourceUrl: v.pipe(v.string(), v.url(), v.description('播放源 URL')),
  quality: v.optional(v.pipe(v.string(), v.description('画质'))),
  sortOrder: v.pipe(v.number(), v.description('排序序号')),
})

/**
 * 影片信息 Schema（爬虫数据）
 */
export const MovieInfoSchema = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.description('影片标题')),
    slug: v.pipe(v.string(), v.description('影片 slug')),
    code: v.pipe(v.string(), v.description('影片番号')),
    description: v.optional(v.pipe(v.string(), v.description('简介'))),
    coverImage: v.optional(v.pipe(v.string(), v.url(), v.description('封面图片 URL'))),
    releaseDate: v.optional(v.pipe(v.number(), v.description('发行日期（Unix 时间戳，秒）'))),
    duration: v.optional(v.pipe(v.number(), v.description('时长（秒）'))),
    sourceUrl: v.pipe(v.string(), v.url(), v.description('源 URL')),
    actors: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    series: v.optional(v.string()),
    publisher: v.optional(v.string()),
    isR18: v.pipe(v.boolean(), v.description('是否为 R18 内容')),
    players: v.array(PlayerInputSchema),
  }),
  v.transform(input => ({
    ...input,
    isR18: input.isR18 ?? true, // 默认为 true
  })),
)

export type MovieInfoInput = v.InferOutput<typeof MovieInfoSchema>
