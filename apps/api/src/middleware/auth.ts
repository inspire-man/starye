import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { createAuth } from '../lib/auth'

export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = createAuth(c.env, c.req.raw)
    c.set('auth', auth)

    // 自动获取并设置用户信息到 context（如果已登录）
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      if (session?.user) {
        c.set('user', session.user as unknown as SessionUser)
      }
    }
    catch {
      // 忽略错误，用户未登录
    }

    await next()
  })
}
