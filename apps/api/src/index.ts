import type { Database } from '@starye/db'
import type { Auth, Env } from './lib/auth'
import process from 'node:process'
import { zValidator } from '@hono/zod-validator'
import { createDb } from '@starye/db'
import { chapters, comics } from '@starye/db/schema'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { getAllowedOrigins } from './config'
import { createAuth } from './lib/auth'

import { serviceAuth } from './middleware/service-auth'

const ChapterSchema = z.object({
  title: z.string(),
  slug: z.string(),
  url: z.string(),
  number: z.number(),
})

const MangaInfoSchema = z.object({
  title: z.string(),
  slug: z.string(),
  cover: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  chapters: z.array(ChapterSchema),
})

interface Variables {
  db: Database
  auth: Auth
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// Middleware
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = getAllowedOrigins(c.env)
      return allowed.includes(origin) ? origin : allowed[0]
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Database & Auth Injection
app.use(async (c, next) => {
  try {
    const db = createDb(c.env.DB)
    c.set('db', db)

    // Lazy auth creation or try-catch
    const auth = createAuth(c.env, c.req.raw)
    c.set('auth', auth)
  }
  catch (e: any) {
    console.error('Failed to initialize DB or Auth:', e)
    // We don't throw here to allow health check to pass if it doesn't use auth,
    // but better to fail safely for routes that need it.
    // However, for debugging 1101, let's allow it to proceed and fail later or return error now.
    return c.json({
      success: false,
      error: `Initialization Error: ${e.message}`,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
    }, 500)
  }

  await next()
})

// ... existing code ...

// Global Error Handler
app.onError((err, c) => {
  console.error('[API Error]', err)
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: err.message,
    }, err.status)
  }
  return c.json({
    success: false,
    error: 'Internal Server Error',
  }, 500)
})

// --- Routes ---

// ...

// List Comics (For Search Indexing & Frontend)
app.get('/api/comics', async (c) => {
  const db = c.get('db')
  const results = await db.query.comics.findMany({
    columns: {
      title: true,
      slug: true,
      coverImage: true,
      author: true,
      description: true,
    },
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
  })
  return c.json(results)
})

// Sync Route (Called by Crawler)
app.post(
  '/api/admin/sync',
  serviceAuth(),
  zValidator('json', z.object({
    type: z.literal('manga'),
    data: MangaInfoSchema,
  })),
  async (c) => {
    const { data } = c.req.valid('json')
    const db = c.get('db')

    // eslint-disable-next-line no-console
    console.log(`[Sync] Received manga: ${data.title} (${data.chapters.length} chapters)`)

    // 1. Upsert Comic
    const comicId = data.slug
    await db.insert(comics).values({
      id: comicId,
      title: data.title,
      slug: data.slug,
      coverImage: data.cover,
      author: data.author,
      description: data.description,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: comics.id,
      set: {
        title: data.title,
        coverImage: data.cover,
        author: data.author,
        description: data.description,
        updatedAt: new Date(),
      },
    })

    // 2. Upsert Chapters
    if (data.chapters.length > 0) {
      const chapterValues = data.chapters.map(ch => ({
        id: `${comicId}-${ch.slug}`,
        comicId,
        title: ch.title,
        slug: ch.slug,
        chapterNumber: ch.number,
        sortOrder: ch.number,
        updatedAt: new Date(),
      }))

      // Batch insert
      await db.insert(chapters).values(chapterValues).onConflictDoUpdate({
        target: chapters.id,
        set: {
          title: sql`excluded.title`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date(),
        },
      })
    }

    return c.json({ success: true, message: `Synced ${data.chapters.length} chapters` })
  },
)

// Better Auth Routes
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = c.get('auth')
  return auth.handler(c.req.raw)
})

// Health Check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'starye-api',
    timestamp: new Date().toISOString(),
  })
})

export default app
export type AppType = typeof app
