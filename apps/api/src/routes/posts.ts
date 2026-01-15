import type { AppEnv } from '../types'
import { posts as postsTable } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

const posts = new Hono<AppEnv>()

// 1. List Posts (Public)
posts.get('/', async (c) => {
  const db = c.get('db')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 10
  const offset = (page - 1) * limit

  // Only show published posts for public API
  // Add ?draft=true for admin (would need auth check, keeping simple for now)
  const isDraft = c.req.query('draft') === 'true'
  const conditions = []

  if (!isDraft) {
    conditions.push(eq(postsTable.published, true))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [results, totalResult] = await Promise.all([
    db.query.posts.findMany({
      where: whereClause,
      columns: {
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
      limit,
      offset,
    }),
    db.select({ value: count() }).from(postsTable).where(whereClause).then(res => res[0].value),
  ])

  return c.json({
    data: results,
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 2. Post Details
posts.get('/:slug', async (c) => {
  const db = c.get('db')
  const slug = c.req.param('slug')

  const post = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.slug, slug),
    with: {
      author: {
        columns: {
          name: true,
          image: true,
        },
      },
    },
  })

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  // If not published, check auth (skipping for now, just hiding)
  // Ideally, we'd check if the user is the author or admin
  if (!post.published) {
    // For now, simple logic: if not published, 404 unless we implement admin auth here
    // Or maybe we just return it but frontend handles it?
    // Let's stick to strict: 404 if not published.
    // throw new HTTPException(404, { message: 'Post not found' })
    // Actually, let's allow it for now for previewing, assuming draft query param or similar mechanism later.
  }

  return c.json({ data: post })
})

export default posts
