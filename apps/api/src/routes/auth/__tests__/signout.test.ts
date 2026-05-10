/**
 * Phase 1 / AUTH-08: signOut 服务端真实失效测试骨架
 *
 * 验证：
 * - D-15: /api/auth/sign-out 返回 200 + Set-Cookie 清除头（Max-Age=0 或等价）
 * - D-15: auth.api.getSession 在 sign-out 之后返回 null（D1 session 行已删）
 * - D-16: 跨 tab 登出不主动广播 —— 不在本单测范围（需 E2E 双上下文），仅记录 comment
 *
 * 此骨架由 Plan 05 填充断言。当前 it.todo 占位。
 * 路由路径：authRoutes 的 /sign-out 走 catch-all /* 代理到 authInstance.handler
 * （apps/api/src/routes/auth/index.ts:83-87），Plan 05 可以 mock authInstance.handler
 * 返回带 Set-Cookie 的 Response，比起集成 betterAuth() + libsql 更轻量。
 */

import type { createMockAuth, createMockDb, createMockUser } from '../../../test/helpers'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describe, it } from 'vitest'
import { authRoutes } from '../index'

/* eslint-disable test/prefer-lowercase-title -- D-15 matrix identifier must remain uppercase for traceability */
describe('AUTH-08: /api/auth/sign-out server-side invalidation', () => {
  it.todo('D-15 #1: POST /sign-out 返回 200 并回 Set-Cookie 清除头（Max-Age=0）')
  it.todo('D-15 #2: sign-out 后 auth.api.getSession 返回 null')
  it.todo('D-15 #3: sign-out 回给浏览器的 Set-Cookie 精确匹配 starye.session_token=')
})
/* eslint-enable test/prefer-lowercase-title */

// 以下 helper 作为 Plan 05 的起点保留（避免 Plan 05 重复造轮子）
// 参考 apps/api/src/routes/public/progress/__tests__/progress.test.ts:83-94
export function createApp(
  db: ReturnType<typeof createMockDb>,
  auth: ReturnType<typeof createMockAuth>,
  user?: ReturnType<typeof createMockUser> | null,
) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', auth)
    if (user !== undefined)
      c.set('user', user as any)
    await next()
  })
  app.route('/', authRoutes)
  return app
}
