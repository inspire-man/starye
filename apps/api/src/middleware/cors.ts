import type { Env } from '../lib/auth'
import { cors } from 'hono/cors'
import { getAllowedOrigins } from '../config'

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const allowed = getAllowedOrigins(c.env as Env)
      return allowed.includes(origin) ? origin : allowed[0]
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-service-token'],
  })
}
