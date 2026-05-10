/**
 * Phase 1 / AUTH-02: Nuxt blog SSR session hydrate 骨架
 *
 * 验证：
 * - D-01: SSR 预取 /api/auth/get-session → 注入 useState('session')
 * - D-03: SSR fetch 3s 超时 / 5xx → 降级匿名不阻塞渲染
 * - 客户端 hydrate 后 authClient.useSession() 无闪烁
 *
 * 此骨架由 Plan 03（Nuxt SSR 通道）填充断言。当前以 test.skip 占位，
 * 确保 Plan 03 不需新建文件即可转绿。
 */

import { expect, test } from '@playwright/test'

// 与 apps/dashboard/e2e/auth-flow.spec.ts:14-22 同款 mockSession
async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}

test.describe('AUTH-02: Nuxt blog SSR session hydrate', () => {
  test.skip('D-01: SSR HTML 预取 session 后 useState 含用户标记', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-1', email: 'author@starye.org', role: 'admin' },
      session: { id: 'session-1' },
    })
    await page.goto('/')
    const html = await page.content()
    expect(html).toContain('user-1') // 占位；Plan 03 根据实际 DOM 选择器调整
  })

  test.skip('D-03: /api/auth/get-session 3s 超时时 SSR 降级为匿名不抛错', async ({ page }) => {
    // 模拟超时：route.abort('timedout') 或延迟 > 3s
    await page.route('**/api/auth/get-session', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 5000))
      await route.abort('timedout')
    })
    const response = await page.goto('/')
    expect(response?.status()).toBe(200) // SSR 不因 session fetch 失败而 500
  })

  test.skip('AUTH-02 hydrate: 客户端 useSession() 复用 useState 不二次拉取', async ({ page }) => {
    // Plan 03 填：断言客户端 hydrate 期间只有 1 次 /api/auth/get-session 请求
    await mockSession(page, null)
    await page.goto('/')
  })
})
