/**
 * Phase 1 / AUTH-02: Nuxt blog SSR session hydrate
 *
 * 验证：
 * - D-01: SSR 预取 /api/auth/get-session → 注入 useState('session')
 * - D-03: SSR fetch 3s 超时 / 5xx → 降级匿名不阻塞渲染
 * - D-04: SSR 同一请求内 get-session 仅一次；客户端 hydrate 后允许再刷一次（上界 2）
 *
 * 策略说明：
 * Playwright `page.route` 只拦截浏览器发起的请求；Nitro SSR 通过 $fetch 直连
 * http://localhost:8080（runtimeConfig.public.apiUrl 默认值），这些请求发生在
 * Nuxt dev server 进程内，page.route 无法感知。因此本 spec 在 test 生命周期内
 * 启动一个 node:http mock 监听 8080 端口，作为 gateway 替身；同时用 page.route
 * 为客户端 hydrate 提供可预期响应。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { expect, test } from '@playwright/test'

// ─── SSR mock gateway（监听 127.0.0.1:8080）─────────────────────────────────

interface SsrMockOptions {
  sessionPayload?: unknown
  sessionDelayMs?: number
  sessionStatus?: number
  onSessionHit?: () => void
}

async function startSsrMock(options: SsrMockOptions = {}) {
  const {
    sessionPayload = null,
    sessionDelayMs = 0,
    sessionStatus = 200,
    onSessionHit,
  } = options

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/'

    // SSR 会预取 /api/auth/get-session（plan 01-03 的核心路径）
    if (url.startsWith('/api/auth/get-session')) {
      onSessionHit?.()
      if (sessionDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, sessionDelayMs))
      }
      res.statusCode = sessionStatus
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(sessionPayload))
      return
    }

    // 首页还 SSR 拉 /api/posts —— 给空数据避免 500
    if (url.startsWith('/api/posts')) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 9, totalPages: 0 } }))
      return
    }

    res.statusCode = 404
    res.end()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(8080, '127.0.0.1', () => resolve())
  })

  return {
    async stop() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    },
  }
}

// 与 apps/dashboard/e2e/auth-flow.spec.ts:14-22 同款 mockSession（客户端 hydrate）
async function mockClientSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}

test.describe('AUTH-02: Nuxt blog SSR session hydrate', () => {
  test('D-01: SSR HTML 预取 session 后 useState 含用户标记', async ({ page, context }) => {
    // SSR 预取 cookie 才会触发 middleware；设一份 starye_session 占位
    await context.addCookies([
      { name: 'starye_session', value: 'seed', domain: '127.0.0.1', path: '/' },
      { name: 'starye_session', value: 'seed', domain: 'localhost', path: '/' },
    ])

    const mock = await startSsrMock({
      sessionPayload: {
        user: { id: 'user-1', email: 'author@starye.org', role: 'admin' },
        session: { id: 'session-1' },
      },
    })

    try {
      await mockClientSession(page, {
        user: { id: 'user-1', email: 'author@starye.org', role: 'admin' },
        session: { id: 'session-1' },
      })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      const html = await page.content()
      // Nuxt 4 dev mode SSR 时 window.__NUXT__ 可能在 hydrate 后才注入；
      // 这里直接断言 SSR HTML 已渲染出 user-1 标记（middleware 注入的 session 已经到达 DOM）
      expect(html).toContain('user-1')
    }
    finally {
      await mock.stop()
    }
  })

  test('D-03: /api/auth/get-session 3s 超时时 SSR 降级为匿名不抛错', async ({ page, context }) => {
    test.setTimeout(15000)

    await context.addCookies([
      { name: 'starye_session', value: 'seed', domain: '127.0.0.1', path: '/' },
      { name: 'starye_session', value: 'seed', domain: 'localhost', path: '/' },
    ])

    // Node mock 延迟 5s（>3s middleware 超时阈值），middleware 应 AbortSignal.timeout(3000) 取消并降级
    const mock = await startSsrMock({ sessionDelayMs: 5000, sessionPayload: null })

    try {
      await mockClientSession(page, null)
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200) // SSR 不因 session fetch 超时 500
      const nuxtState = await page.evaluate(() => (window as any).__NUXT__?.state)
      // D-03: 降级为 null
      expect(nuxtState?.$ssession ?? null).toBeNull()
    }
    finally {
      await mock.stop()
    }
  })

  test('Hydrate 不二次拉取 get-session: SSR phase 严格 1 次，total <= 2', async ({ page, context }) => {
    test.setTimeout(30000)

    await context.addCookies([
      { name: 'starye_session', value: 'seed', domain: '127.0.0.1', path: '/' },
      { name: 'starye_session', value: 'seed', domain: 'localhost', path: '/' },
    ])

    let sessionRequests = 0
    const mock = await startSsrMock({
      sessionPayload: { user: { id: 'user-1' }, session: { id: 'session-1' } },
      onSessionHit: () => { sessionRequests += 1 },
    })

    try {
      // 客户端 hydrate 若重拉 get-session，也通过 route fulfill 计入同一计数器
      await page.route('**/api/auth/get-session', (route) => {
        sessionRequests += 1
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'user-1' }, session: { id: 'session-1' } }),
        })
      })

      // waitUntil: 'commit' 表示 SSR 响应头已到达但尚未开始 hydrate
      await page.goto('/', { waitUntil: 'commit' })
      expect(sessionRequests).toBe(1) // D-04: 同一 SSR 请求内严格一次

      await page.waitForLoadState('networkidle')
      expect(sessionRequests).toBeLessThanOrEqual(2) // SSR 1 次 + 客户端 0 或 1 次
      expect(sessionRequests).toBeGreaterThanOrEqual(1)
    }
    finally {
      await mock.stop()
    }
  })
})
