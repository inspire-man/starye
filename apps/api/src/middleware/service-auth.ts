import type { Env } from '../lib/auth'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export function serviceAuth() {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET

    // 必须确保 secret 存在且长度足够安全
    if (!secret || secret.length < 8) {
      console.error('CRAWLER_SECRET is missing or too weak')
      throw new HTTPException(500, { message: 'Server Configuration Error' })
    }

    if (!token || token !== secret) {
      throw new HTTPException(401, { message: 'Unauthorized Service Access' })
    }

    await next()
  })
}
