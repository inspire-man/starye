/**
 * Phase 1 / AUTH-08: signOut 服务端真实失效测试
 *
 * 验证：
 * - D-15: /api/auth/sign-out 返回 200 + Set-Cookie 清除头（Max-Age=0 或等价）
 * - D-15: auth.api.getSession 在 sign-out 之后返回 null（D1 session 行已删）
 * - D-16: 跨 tab 登出不主动广播 —— 不在本单测范围（需 E2E 双上下文），仅记录 comment
 * - D-17: 不引入 BroadcastChannel / visibilitychange 跨 tab 登出广播；同浏览器其他 tab 下一次带 cookie 请求时由 401 + 前端 redirect 自然回收（由 Phase 2 `requireAuth` 中间件承接）
 *
 * Plan 05 实装：采用 mock authInstance.handler 路径（轻量，< 1s），不集成 betterAuth() + libsql。
 * 路由路径：authRoutes 的 /sign-out 走 catch-all /* 代理到 authInstance.handler
 * （apps/api/src/routes/auth/index.ts:83-87）
 */

import type { Auth } from '../../../lib/auth'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createMockDb, createMockUser } from '../../../test/helpers'
import { authRoutes } from '../index'

/**
 * 构造一个 mock Better Auth handler：
 * - /sign-out POST → 200 + Set-Cookie 清除头；把内部 session 状态切为 null
 * - 其他路径 → 503（不关心）
 */
function createSignOutCapableAuth(initialSession: any): Auth {
  let currentSession = initialSession

  const handler = vi.fn(async (req: Request) => {
    const url = new URL(req.url)
    if (url.pathname.endsWith('/sign-out')) {
      currentSession = null
      return new Response(null, {
        status: 200,
        headers: {
          // better-auth 1.6.x 的 Set-Cookie 模式：prefix + 清除 attributes
          'set-cookie': 'starye.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
        },
      })
    }
    return new Response('not mocked', { status: 503 })
  })

  return {
    api: {
      getSession: vi.fn(async () => currentSession),
    },
    handler,
  } as unknown as Auth
}

/**
 * 创建测试 app，注入 mock db / auth / user
 * 参考 apps/api/src/routes/public/progress/__tests__/progress.test.ts:83-94
 */
export function createApp(
  db: ReturnType<typeof createMockDb>,
  auth: Auth,
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

/* eslint-disable test/prefer-lowercase-title -- D-15 matrix identifier must remain uppercase for traceability */
describe('AUTH-08: /api/auth/sign-out server-side invalidation', () => {
  it('D-15 #1: POST /sign-out 返回 200 并回 Set-Cookie 清除头（Max-Age=0）', async () => {
    const db = createMockDb()
    const user = createMockUser({ id: 'u1' })
    const auth = createSignOutCapableAuth({ user, session: { id: 's1' } })
    const app = createApp(db, auth, user)

    const res = await app.request('/sign-out', { method: 'POST' })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('starye.session_token=')
    expect(setCookie).toContain('Max-Age=0')
  })

  it('D-15 #2: sign-out 后 auth.api.getSession 返回 null', async () => {
    const db = createMockDb()
    const user = createMockUser({ id: 'u1' })
    const auth = createSignOutCapableAuth({ user, session: { id: 's1' } })
    const app = createApp(db, auth, user)

    // 先调一次 getSession，确认初始有值
    expect(await auth.api.getSession({ headers: new Headers() } as any)).not.toBeNull()

    // 执行登出
    await app.request('/sign-out', { method: 'POST' })

    // 再调 getSession，确认已失效
    expect(await auth.api.getSession({ headers: new Headers() } as any)).toBeNull()
  })

  it('D-15 #3: sign-out 回给浏览器的 Set-Cookie 精确匹配 starye.session_token=', async () => {
    const db = createMockDb()
    const user = createMockUser({ id: 'u1' })
    const auth = createSignOutCapableAuth({ user, session: { id: 's1' } })
    const app = createApp(db, auth, user)

    const res = await app.request('/sign-out', { method: 'POST' })
    const setCookie = res.headers.get('set-cookie') ?? ''
    // 清除 cookie 的三种常见表达之一必须出现
    const clearsCookie = /starye\.session_token=(?:;|\s*Max-Age=0|\s*Expires=Thu,\s*01\s*Jan\s*1970)/i.test(setCookie)
    expect(clearsCookie).toBe(true)
  })
})
/* eslint-enable test/prefer-lowercase-title */
