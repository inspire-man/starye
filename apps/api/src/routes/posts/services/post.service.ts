import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { posts as postsTable } from '@starye/db/schema'
import { and, asc, count, desc, eq, gt, like, lt, or, sql } from 'drizzle-orm'

// --- TOC 提取工具 ---

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4E00-\u9FFF-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * 从 HTML 字符串中提取 h2/h3 标题，生成 TOC 数组，并将 id 属性注入标题标签。
 * 仅处理 contentFormat === 'html' 的文章。
 */
export function extractTocFromHtml(html: string): { toc: TocItem[], processedHtml: string } {
  const toc: TocItem[] = []

  const processedHtml = html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_, tag: string, attrs: string, content: string) => {
      const level = (tag.toLowerCase() === 'h2' ? 2 : 3) as 2 | 3
      const text = content.replace(/<[^>]*>/g, '').trim()
      if (!text)
        return `<${tag}${attrs}>${content}</${tag}>`
      const id = slugify(text) || `heading-${toc.length + 1}`
      toc.push({ id, text, level })
      // 移除已有 id 属性后注入新 id
      const newAttrs = attrs.replace(/\s*id="[^"]*"/gi, '')
      return `<${tag}${newAttrs} id="${id}">${content}</${tag}>`
    },
  )

  return { toc, processedHtml }
}

// --- getPosts ---

export interface GetPostsOptions {
  db: Database
  page?: number
  pageSize?: number
  showDrafts?: boolean
  series?: string
  tag?: string
  q?: string
}

export interface GetPostsResult {
  data: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    coverImage: string | null
    published: boolean | null
    tags: string[] | null
    series: string | null
    seriesOrder: number | null
    contentFormat: string | null
    createdAt: Date | null
    updatedAt: Date | null
    author: {
      name: string | null
      image: string | null
    } | null
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getPosts(options: GetPostsOptions): Promise<GetPostsResult> {
  const {
    db,
    page = 1,
    pageSize = 10,
    showDrafts = false,
    series,
    tag,
    q,
  } = options

  const conditions: SQL[] = []

  if (!showDrafts)
    conditions.push(eq(postsTable.published, true))

  if (series)
    conditions.push(eq(postsTable.series, series))

  if (tag) {
    // 使用 json_each 匹配 JSON 数组中的标签值
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${postsTable.tags}) WHERE value = ${tag})`,
    )
  }

  if (q) {
    const searchTerm = `%${q}%`
    conditions.push(
      or(
        like(postsTable.title, searchTerm),
        like(postsTable.excerpt, searchTerm),
      )!,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 系列过滤时按 seriesOrder 升序排列，否则按创建时间倒序
  const orderByClause = series
    ? [asc(postsTable.seriesOrder)]
    : [desc(postsTable.createdAt)]

  const [results, totalResult] = await Promise.all([
    db.query.posts.findMany({
      where: whereClause,
      columns: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        published: true,
        tags: true,
        series: true,
        seriesOrder: true,
        contentFormat: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        author: {
          columns: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: orderByClause,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ value: count() }).from(postsTable).where(whereClause).then(res => res[0]?.value ?? 0),
  ])

  return {
    data: results,
    meta: {
      total: totalResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(totalResult / pageSize),
    },
  }
}

// --- getPostById ---

export interface GetPostByIdOptions {
  db: Database
  id: string
}

export async function getPostById(options: GetPostByIdOptions) {
  const { db, id } = options

  const post = await db.query.posts.findFirst({
    where: eq(postsTable.id, id),
  })

  return post
}

// --- getPostBySlug（带 TOC 提取） ---

export interface GetPostBySlugOptions {
  db: Database
  slug: string
}

export async function getPostBySlug(options: GetPostBySlugOptions) {
  const { db, slug } = options

  const post = await db.query.posts.findFirst({
    where: eq(postsTable.slug, slug),
    with: {
      author: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  })

  if (!post)
    return null

  // 仅对 HTML 格式文章提取 TOC 并注入标题 id
  if (post.content && post.contentFormat === 'html') {
    const { toc, processedHtml } = extractTocFromHtml(post.content)
    return { ...post, content: processedHtml, toc }
  }

  return { ...post, toc: [] as TocItem[] }
}

// --- getAdjacentPosts ---

export interface AdjacentPost {
  title: string
  slug: string
}

export interface GetAdjacentPostsOptions {
  db: Database
  slug: string
}

export async function getAdjacentPosts(options: GetAdjacentPostsOptions): Promise<{ prev: AdjacentPost | null, next: AdjacentPost | null }> {
  const { db, slug } = options

  const current = await db.query.posts.findFirst({
    where: and(eq(postsTable.slug, slug), eq(postsTable.published, true)),
    columns: { id: true, series: true, seriesOrder: true, createdAt: true },
  })

  if (!current)
    return { prev: null, next: null }

  if (current.series && current.seriesOrder !== null) {
    // 按系列内 seriesOrder 查询相邻文章
    const [prevPost, nextPost] = await Promise.all([
      db.query.posts.findFirst({
        where: and(
          eq(postsTable.series, current.series),
          eq(postsTable.published, true),
          eq(postsTable.seriesOrder, current.seriesOrder - 1),
        ),
        columns: { title: true, slug: true },
      }),
      db.query.posts.findFirst({
        where: and(
          eq(postsTable.series, current.series),
          eq(postsTable.published, true),
          eq(postsTable.seriesOrder, current.seriesOrder + 1),
        ),
        columns: { title: true, slug: true },
      }),
    ])
    return {
      prev: prevPost ?? null,
      next: nextPost ?? null,
    }
  }

  // 按全局 createdAt 时序查询相邻文章
  const [prevPost, nextPost] = await Promise.all([
    db.select({ title: postsTable.title, slug: postsTable.slug })
      .from(postsTable)
      .where(and(
        eq(postsTable.published, true),
        lt(postsTable.createdAt, current.createdAt!),
      ))
      .orderBy(desc(postsTable.createdAt))
      .limit(1)
      .then(r => r[0] ?? null),
    db.select({ title: postsTable.title, slug: postsTable.slug })
      .from(postsTable)
      .where(and(
        eq(postsTable.published, true),
        gt(postsTable.createdAt, current.createdAt!),
      ))
      .orderBy(asc(postsTable.createdAt))
      .limit(1)
      .then(r => r[0] ?? null),
  ])

  return { prev: prevPost, next: nextPost }
}

// --- createPost ---

export interface CreatePostOptions {
  db: Database
  data: {
    title: string
    slug: string
    content?: string
    excerpt?: string
    coverImage?: string | null
    published?: boolean
    authorId: string
    contentFormat?: string
    tags?: string[] | null
    series?: string | null
    seriesOrder?: number | null
  }
}

export async function createPost(options: CreatePostOptions) {
  const { db, data } = options

  const id = crypto.randomUUID()

  const [post] = await db.insert(postsTable).values({
    id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return post
}

// --- updatePost ---

export interface UpdatePostOptions {
  db: Database
  id: string
  data: {
    title?: string
    slug?: string
    content?: string
    excerpt?: string
    coverImage?: string | null
    published?: boolean
    contentFormat?: string
    tags?: string[] | null
    series?: string | null
    seriesOrder?: number | null
  }
}

export async function updatePost(options: UpdatePostOptions) {
  const { db, id, data } = options

  const [post] = await db.update(postsTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, id))
    .returning()

  return post
}

// --- deletePost ---

export interface DeletePostOptions {
  db: Database
  id: string
}

export async function deletePost(options: DeletePostOptions) {
  const { db, id } = options

  await db.delete(postsTable).where(eq(postsTable.id, id))
}
