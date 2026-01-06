import type { Database } from '@starye/db'
import type { Auth, Env } from './lib/auth'
import { createDb } from '@starye/db'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { getAllowedOrigins } from './config'
import { createAuth } from './lib/auth'
import { serviceAuth } from './middleware/service-auth'

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
  const db = createDb(c.env.DB)
  const auth = createAuth(c.env, c.req.raw)

  c.set('db', db)
  c.set('auth', auth)

  await next()
})

// Global Error Handler
app.onError((err, c) => {
  console.error(`[API Error] ${err}`)
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

// Service Protected Route (Example for Crawler)
app.post('/api/admin/sync', serviceAuth(), async (c) => {
  return c.json({ success: true, message: 'Sync received' })
})

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
