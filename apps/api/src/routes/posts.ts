import type { AppEnv, SessionUser } from '../types'
import { zValidator } from '@hono/zod-validator'
import { posts as postsTable } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { serviceAuth } from '../middleware/service-auth'

const posts = new Hono<AppEnv>()

// Schema for creating/updating posts
const PostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case'),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  published: z.boolean().default(false),
})

// 1. List Posts (Public + Admin Drafts)
posts.get('/', async (c) => {
  const db = c.get('db')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 10
  const offset = (page - 1) * limit
  const isDraft = c.req.query('draft') === 'true'

  // Determine if user is allowed to see drafts
  let canSeeDrafts = false
  if (isDraft) {
    try {
      const auth = c.get('auth')
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      const user = session?.user as unknown as SessionUser | undefined
      if (user?.role === 'admin') {
        canSeeDrafts = true
      }
    }
    catch {
      // Ignore auth errors, just treat as public
    }
  }

  const conditions = []
  if (!canSeeDrafts) {
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

// 2. Get Post by ID (Admin)
posts.get('/admin/:id', serviceAuth(['admin']), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const post = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.id, id),
  })

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  return c.json({ data: post })
})

// 3. Post Details (Public + Admin Preview)
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

  if (!post.published) {
    // Check auth for unpublished posts
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user as unknown as SessionUser | undefined
    if (user?.role !== 'admin') {
      throw new HTTPException(404, { message: 'Post not found' })
    }
  }

  return c.json({ data: post })
})

// 4. Create Post (Admin)
posts.post(
  '/',
  serviceAuth(['admin']),
  zValidator('json', PostSchema),
  async (c) => {
    const data = c.req.valid('json')
    const db = c.get('db')
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    const id = crypto.randomUUID()

    try {
      await db.insert(postsTable).values({
        id,
        ...data,
        authorId: user.id,
        updatedAt: new Date(),
      })

      return c.json({ success: true, id, slug: data.slug })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.includes('UNIQUE constraint failed')) {
        throw new HTTPException(409, { message: 'Slug already exists' })
      }
      throw new HTTPException(500, { message })
    }
  },
)

// 5. Update Post (Admin)
posts.put(
  '/:id',
  serviceAuth(['admin']),
  zValidator('json', PostSchema.partial()),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const result = await db.update(postsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(postsTable.id, id))
        .returning({ id: postsTable.id })

      if (result.length === 0) {
        throw new HTTPException(404, { message: 'Post not found' })
      }

      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      throw new HTTPException(500, { message })
    }
  },
)

// 6. Delete Post (Admin)
posts.delete(
  '/:id',
  serviceAuth(['admin']),
  async (c) => {
    const id = c.req.param('id')
    const db = c.get('db')

    const result = await db.delete(postsTable)
      .where(eq(postsTable.id, id))
      .returning({ id: postsTable.id })

    if (result.length === 0) {
      throw new HTTPException(404, { message: 'Post not found' })
    }

    return c.json({ success: true })
  },
)

export default posts
