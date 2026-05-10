/**
 * Phase 1 / AUTH-01: 登录后跨子路径 session 共享骨架
 *
 * 验证：
 * - 同 cookie 下，/movie → /comic → /blog → /dashboard 四处均读到同一 user.id
 * - 手动冒烟（D-19 step 4）的自动化对照
 *
 * 此骨架由 Plan 06（冒烟 + 跨路径 spec）填充断言。
 */

import { expect, test } from '@playwright/test'

// 与 apps/dashboard/e2e/auth-flow.spec.ts:14-22 同款
async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}

async function interceptExternalRedirects(page: any) {
  await page.route('**/auth/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><div id="auth-page">Auth Page</div></body></html>',
    }))
}

test.describe('AUTH-01: 登录后跨子路径 session 共享', () => {
  test.skip('D-19 step 4: 同 cookie 跨 /movie /comic /blog /dashboard 读到同一 user.id', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-1', email: 'author@starye.org', role: 'admin' },
      session: { id: 'session-1' },
    })
    await interceptExternalRedirects(page)
    await page.goto('/')
    // Plan 06 填：切路径 + 断言 window.__session__?.user?.id === 'user-1'
    expect(true).toBe(true)
  })
})
