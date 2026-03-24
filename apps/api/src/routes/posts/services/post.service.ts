import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { posts as postsTable } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'

export interface GetPostsOptions {
  db: Database
  page?: number
  pageSize?: number
  showDrafts?: boolean
}

export interface GetPostsResult {
  data: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    coverImage: string | null
    published: boolean | null
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
  } = options

  const conditions: SQL[] = []
  if (!showDrafts) {
    conditions.push(eq(postsTable.published, true))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

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
      orderBy: [desc(postsTable.createdAt)],
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

  return post
}

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

export interface DeletePostOptions {
  db: Database
  id: string
}

export async function deletePost(options: DeletePostOptions) {
  const { db, id } = options

  await db.delete(postsTable).where(eq(postsTable.id, id))
}
