/**
 * Phase 1 / AUTH-01: 登录后跨子路径 session 共享
 *
 * 验证：
 * - dashboard 单 app 在注入 mock session 后，SPA 真的消费了 /api/auth/get-session（至少一次）
 * - 如果 dashboard 首页已暴露 [data-user-id]，进一步比对 user.id === 'user-1'（强断言）
 * - 跨 /movie /comic /blog 的真实跨 app 验证由 D-19 step 4 手动 checklist 覆盖
 *
 * W1 修订：用 sessionRequests 计数器代替恒真断言（原骨架里的 true===true 占位）。
 * 失败信号可由 "SPA 未消费 session" 这一真实行为缺失触发。
 */

import { expect, test } from '@playwright/test'

// 与 apps/dashboard/e2e/auth-flow.spec.ts:14-22 同款，保留顶部定义不删除
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

// 留作跨文件约束：mockSession 顶部定义保留（与 auth-flow.spec.ts 同款），活用例用内联 route + 计数器
void mockSession

test.describe('AUTH-01: 登录后跨子路径 session 共享', () => {
  test('D-19 step 4: 同 cookie 跨 /movie /comic /blog /dashboard 读到同一 user.id', async ({ page }) => {
    // 注意：dashboard e2e 单独起服务，movie/comic/blog 不在本进程内
    // 本用例验证 dashboard 单 app 读 session 成功；跨 app 真实跳转由 D-19 step 4 手动覆盖

    // W1 修订：用计数器代替恒真断言。SPA 真的读 session 才会让 sessionRequests 递增。
    // 注意顺序：Playwright route 匹配是"后注册优先"，必须让 `**/api/auth/get-session`
    // 的专属 handler 比 `**/auth/**` 的通配 handler **后注册**，否则 get-session 请求
    // 会被 interceptExternalRedirects 的 HTML fallback 抢走，sessionRequests 恒为 0。
    let sessionRequests = 0
    await interceptExternalRedirects(page)
    await page.route('**/api/auth/get-session', (route) => {
      sessionRequests += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-1', email: 'author@starye.org', role: 'admin' },
          session: { id: 'session-1' },
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 核心断言 1：SPA 至少打过一次 /api/auth/get-session（Better Auth 客户端消费 session）
    // 这条断言在 SPA 没读 session / session 未消费时会失败 —— 非恒真
    expect(sessionRequests).toBeGreaterThanOrEqual(1)

    // 核心断言 2：若 dashboard 首页已暴露 [data-user-id] 则额外比对 user.id（强断言）
    // 若未暴露，上面的 sessionRequests 断言已足以锚定 AUTH-01 "SPA 读到 session" 的不变量
    const userId = await page.evaluate(() =>
      document.querySelector('[data-user-id]')?.getAttribute('data-user-id') ?? null,
    )
    if (userId !== null) {
      expect(userId).toBe('user-1')
    }
  })
})
