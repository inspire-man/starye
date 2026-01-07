import type { AppEnv } from '../types'
import process from 'node:process'
import { createDb } from '@starye/db'
import { createMiddleware } from 'hono/factory'
import { createAuth } from '../lib/auth'

export function databaseMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    try {
      const db = createDb(c.env.DB)
      c.set('db', db)

      // Lazy auth creation
      const auth = createAuth(c.env, c.req.raw)
      c.set('auth', auth)
    }
    catch (e: unknown) {
      console.error('Failed to initialize DB or Auth:', e)
      const message = e instanceof Error ? e.message : 'Unknown initialization error'
      const stack = e instanceof Error && process.env.NODE_ENV === 'development' ? e.stack : undefined

      return c.json({
        success: false,
        error: `Initialization Error: ${message}`,
        stack,
      }, 500)
    }

    await next()
  })
}
