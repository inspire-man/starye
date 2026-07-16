/**
 * requireAuth 中间件测试
 *
 * 覆盖：D-04（ADMIN_GITHUB_ID 白名单短路）、ACCESS-02/03（role 检查）
 */

import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from '../guard'

// 构造一个最小化的 mock auth 对象
function makeMockAuth(user: Record<string, unknown> | null) {
  return {
    api: {
      getSession: async () => user ? { user } : null,
    },
  }
}

// 构造测试用 app，注入 mock auth 和 env
function makeApp(
  user: Record<string, unknown> | null,
  env: Partial<AppEnv['Bindings']> = {},
) {
  const app = new Hono<AppEnv>()

  // 注入 mock auth 到 context
  app.use('*', async (c, next) => {
    c.set('auth', makeMockAuth(user) as any)
    await next()
  })

  return { app, env }
}

describe('requireAuth - 匿名用户', () => {
  it('无 session 时返回 401', async () => {
    const { app, env } = makeApp(null)
    app.get('/test', requireAuth(['admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(401)
  })
})

describe('requireAuth - role 检查', () => {
  it('role 不匹配时返回 403', async () => {
    const { app, env } = makeApp({ id: '1', role: 'user', githubId: null })
    app.get('/test', requireAuth(['admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(403)
  })

  it('role 为 admin 时通过', async () => {
    const { app, env } = makeApp({ id: '1', role: 'admin', githubId: null })
    app.get('/test', requireAuth(['admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(200)
  })

  it('role 为 super_admin 时通过', async () => {
    const { app, env } = makeApp({ id: '1', role: 'super_admin', githubId: null })
    app.get('/test', requireAuth(['admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(200)
  })
})

describe('requireAuth - ADMIN_GITHUB_ID 白名单短路（D-04）', () => {
  it('githubId 命中白名单时，即使 role 为 user 也通过', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: '12345678' },
      { ADMIN_GITHUB_ID: '12345678' } as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    // 白名单短路尚未实现，此测试应当失败（RED 阶段）
    expect(res.status).toBe(200)
  })

  it('githubId 不在白名单时，走原有 role 检查', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: '99999999' },
      { ADMIN_GITHUB_ID: '12345678' } as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(403)
  })

  it('admin_github_id 未配置时，白名单短路不生效', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: '12345678' },
      {} as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(403)
  })

  it('githubId 为 null 时，白名单短路不生效', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: null },
      { ADMIN_GITHUB_ID: '12345678' } as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    expect(res.status).toBe(403)
  })

  it('白名单支持逗号分隔多个 ID', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: '67890' },
      { ADMIN_GITHUB_ID: '12345,67890,11111' } as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    // 白名单短路尚未实现，此测试应当失败（RED 阶段）
    expect(res.status).toBe(200)
  })

  it('白名单 ID 前后有空格时仍能匹配', async () => {
    const { app, env } = makeApp(
      { id: '1', role: 'user', githubId: '12345' },
      { ADMIN_GITHUB_ID: ' 12345 , 67890 ' } as any,
    )
    app.get('/test', requireAuth(['admin', 'super_admin']), c => c.text('ok'))

    const res = await app.fetch(
      new Request('http://localhost/test'),
      env as any,
    )
    // 白名单短路尚未实现，此测试应当失败（RED 阶段）
    expect(res.status).toBe(200)
  })
})
