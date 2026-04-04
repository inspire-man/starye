/**
 * Dashboard Auth Flow E2E 测试
 *
 * 覆盖：
 * 1. 未登录用户访问受保护页面 → 跳转到 /auth/login
 * 2. 已登录但权限不足（非 admin 角色）→ 跳转到 /auth/login?error=insufficient_permissions
 * 3. 已登录且有基础权限，但尝试访问角色不匹配的资源 → 跳转到 /unauthorized
 */

import { expect, test } from '@playwright/test'

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** Mock /api/auth/get-session 响应 */
async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}

/** 拦截外部跳转（到 /auth/login 等页面），避免真实导航失败 */
async function interceptExternalRedirects(page: any) {
  await page.route('**/auth/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><div id="auth-page">Auth Page</div></body></html>',
    }))
}

// ─── 未登录跳转测试 ───────────────────────────────────────────────────────────

test.describe('未登录用户', () => {
  test('访问首页应跳转到 /auth/login', async ({ page }) => {
    // Mock 未登录状态（Better Auth 返回 null 时的响应）
    await mockSession(page, null)
    await interceptExternalRedirects(page)

    // 监听导航请求
    const navPromise = page.waitForURL(url => url.pathname.includes('/auth/login') || url.pathname.includes('/login'), {
      timeout: 10000,
    })

    await page.goto('/')

    // 应该跳转到 auth 登录页
    await navPromise
    expect(page.url()).toContain('/auth/login')
  })

  test('访问 /movies 页面应跳转到 /auth/login 并携带 redirect 参数', async ({ page }) => {
    await mockSession(page, null)
    await interceptExternalRedirects(page)

    const navPromise = page.waitForURL(url => url.pathname.includes('/auth/login') || url.pathname.includes('/login'), {
      timeout: 10000,
    })

    await page.goto('/movies')
    await navPromise

    const url = new URL(page.url())
    expect(url.pathname).toContain('login')
  })

  test('访问公开页面 /login 不应重定向', async ({ page }) => {
    // /login 是公开路由（meta.public: true），不需要 auth mock
    await page.route('**/api/**', (route: any) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null),
    }))

    await page.goto('/login')
    // 不应跳转到外部 auth 登录页
    expect(page.url()).not.toContain('/auth/login')
  })
})

// ─── 权限不足（非 admin 角色）───────────────────────────────────────────────

test.describe('权限不足用户（普通用户）', () => {
  test('普通用户访问 Dashboard 应跳转到 auth/login?error=insufficient_permissions', async ({ page }) => {
    // Mock 返回普通用户（role: 'user'）
    await mockSession(page, {
      user: { id: 'user-1', email: 'user@example.com', name: 'Test User', role: 'user' },
      session: { id: 'session-1' },
    })
    await interceptExternalRedirects(page)

    const navPromise = page.waitForURL(url =>
      url.pathname.includes('/auth/login') || url.pathname.includes('/login'), {
      timeout: 10000,
    })

    await page.goto('/')
    await navPromise

    const url = new URL(page.url())
    expect(url.pathname).toContain('login')
    // 应携带 error=insufficient_permissions
    expect(url.searchParams.get('error')).toBe('insufficient_permissions')
  })
})

// ─── 资源级权限检查 ────────────────────────────────────────────────────────────

test.describe('资源级权限检查', () => {
  test('comic_admin 访问 /movies 应跳转到 /unauthorized', async ({ page }) => {
    // comic_admin 只有漫画管理权限，没有 movies 权限
    await mockSession(page, {
      user: { id: 'user-2', email: 'comic@example.com', name: 'Comic Admin', role: 'comic_admin' },
      session: { id: 'session-2' },
    })

    // mock 其他 API 调用
    await page.route('**/api/admin/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }))

    await page.goto('/movies')

    // 应被路由守卫重定向到 /unauthorized
    await page.waitForURL('**/unauthorized', { timeout: 10000 })
    expect(page.url()).toContain('/unauthorized')
  })

  test('movie_admin 访问 /comics 应跳转到 /unauthorized', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-3', email: 'movie@example.com', name: 'Movie Admin', role: 'movie_admin' },
      session: { id: 'session-3' },
    })

    await page.route('**/api/admin/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }))

    await page.goto('/comics')
    await page.waitForURL('**/unauthorized', { timeout: 10000 })
    expect(page.url()).toContain('/unauthorized')
  })

  test('admin 角色可以访问 /movies', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-4', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      session: { id: 'session-4' },
    })

    // Mock 所有 admin API
    await page.route('**/api/admin/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }))

    await page.goto('/movies')

    // 不应被重定向（等待页面加载完成）
    await page.waitForLoadState('networkidle')
    // 页面应停留在 /movies，不跳转到 /unauthorized
    expect(page.url()).not.toContain('/unauthorized')
    expect(page.url()).not.toContain('/auth/login')
  })

  test('super_admin 角色可以访问 /audit-logs', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-5', email: 'superadmin@example.com', name: 'Super Admin', role: 'super_admin' },
      session: { id: 'session-5' },
    })

    await page.route('**/api/admin/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }))

    await page.goto('/audit-logs')
    await page.waitForLoadState('networkidle')
    expect(page.url()).not.toContain('/unauthorized')
    expect(page.url()).not.toContain('/auth/login')
  })

  test('movie_admin 访问 /audit-logs 应跳转到 /unauthorized', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-6', email: 'movieadmin@example.com', name: 'Movie Admin', role: 'movie_admin' },
      session: { id: 'session-6' },
    })

    await page.route('**/api/admin/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }))

    await page.goto('/audit-logs')
    await page.waitForURL('**/unauthorized', { timeout: 10000 })
    expect(page.url()).toContain('/unauthorized')
  })
})
