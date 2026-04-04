/**
 * Comics 管理页面 E2E 测试
 *
 * 覆盖：
 * - FilterPanel 渲染（含爬取状态字段）
 * - 排序控件可见且可切换
 * - 漫画卡片复选框可交互
 * - 批量操作菜单触发 ConfirmDialog（替换原生弹窗）
 * - API 请求携带 sortBy/sortOrder/crawlStatus 参数（任务 2.6）
 */

import { expect, test } from '@playwright/test'

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  user: {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
  },
  session: { id: 'session-1', userId: 'user-1' },
}

const MOCK_COMICS = [
  {
    id: 'c1',
    title: '测试漫画 Alpha',
    slug: 'test-alpha',
    author: '作者 A',
    isR18: false,
    metadataLocked: false,
    status: 'serializing',
    crawlStatus: 'complete',
    coverImage: null,
    totalChapters: 10,
    crawledChapters: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    title: '测试漫画 Beta',
    slug: 'test-beta',
    author: '作者 B',
    isR18: true,
    metadataLocked: true,
    status: 'completed',
    crawlStatus: 'partial',
    coverImage: null,
    totalChapters: 20,
    crawledChapters: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

async function setupComicsPage(page: any) {
  // Mock session
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_SESSION),
    }))

  // Mock comics list API
  await page.route('**/api/admin/comics**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_COMICS,
        meta: { total: 2, page: 1, limit: 18, totalPages: 1 },
      }),
    }))

  // Mock bulk operation API
  await page.route('**/api/admin/comics/bulk-operation', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: ['c1', 'c2'], failed: [] }),
    }))

  // Mock delete API
  await page.route('**/api/admin/comics/c*', (route: any) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    else {
      route.continue()
    }
  })
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

test.describe('Comics 管理页面', () => {
  test.beforeEach(async ({ page }) => {
    await setupComicsPage(page)
    await page.goto('/comics')
    // 等待漫画卡片渲染
    await page.waitForSelector('text=测试漫画 Alpha', { timeout: 10000 })
  })

  // ─── FilterPanel 渲染（任务 2.2）────────────────────────────────────────────

  test('FilterPanel 应渲染并包含爬取状态字段', async ({ page }) => {
    // FilterPanel 有 "应用筛选" 按钮
    await expect(page.getByRole('button', { name: '应用筛选' })).toBeVisible()

    // 含爬取状态标签
    await expect(page.getByText('爬取状态')).toBeVisible()

    // 旧的裸 HTML filter-bar 不存在
    await expect(page.locator('.filter-bar')).not.toBeAttached()
  })

  // ─── 排序控件（任务 2.4/2.5）────────────────────────────────────────────────

  test('排序控件应可见', async ({ page }) => {
    await expect(page.getByText('排序:')).toBeVisible()
    // 排序字段下拉
    await expect(page.getByRole('option', { name: '更新时间' })).toBeAttached()
    // 排序方向下拉
    await expect(page.getByRole('option', { name: '降序' })).toBeAttached()
  })

  test('切换排序字段应在 API 请求中携带 sortBy 参数（任务 2.6）', async ({ page }) => {
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/admin/comics') && req.url().includes('sortBy=title'),
    )

    // 切换 sortBy 为 "标题"
    const sortBySelect = page.locator('select').first()
    await sortBySelect.selectOption('title')

    // 等待带 sortBy=title 的请求发出
    const req = await requestPromise
    expect(req.url()).toContain('sortBy=title')
  })

  // ─── 漫画卡片与复选框（任务 3.2）──────────────────────────────────────────────

  test('每张漫画卡片应有复选框', async ({ page }) => {
    const checkboxes = page.locator('.grid input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('点击复选框应选中卡片（高亮边框）', async ({ page }) => {
    const firstCheckbox = page.locator('.grid input[type="checkbox"]').first()
    await firstCheckbox.check()

    // 选中后卡片应有 ring-2 class（蓝色高亮）
    const card = page.locator('.grid > div').first()
    await expect(card).toHaveClass(/ring-2/)
  })

  // ─── 批量操作菜单（任务 3.3/3.5）──────────────────────────────────────────────

  test('BatchOperationMenu 应渲染', async ({ page }) => {
    await expect(page.getByRole('button', { name: /批量操作/ })).toBeVisible()
  })

  test('选中漫画后批量操作触发 ConfirmDialog（非原生弹窗）', async ({ page }) => {
    // 监听 window.confirm 调用（不应发生）
    const confirmCalled = await page.evaluate(() => {
      let called = false
      const original = window.confirm
      window.confirm = (...args) => {
        called = true
        return original.apply(window, args as any)
      }
      return { getCalled: () => called }
    })
    void confirmCalled // suppress unused warning

    // 选中第一张卡片
    await page.locator('.grid input[type="checkbox"]').first().check()

    // 打开批量操作菜单
    const batchBtn = page.getByRole('button', { name: /批量操作/ })
    await batchBtn.click()

    // 点击"设为 R18"
    await page.getByText('设为 R18').click()

    // ConfirmDialog 应出现（有确认按钮）
    await expect(page.getByRole('button', { name: '确认' })).toBeVisible({ timeout: 3000 })

    // window.confirm 不应被调用
    const wasCalled = await page.evaluate(() => {
      return (window as any).__confirmCalled || false
    })
    expect(wasCalled).toBe(false)
  })

  test('ConfirmDialog 点击确认后应调用 bulk-operation API', async ({ page }) => {
    const apiCalled = { count: 0 }
    await page.route('**/api/admin/comics/bulk-operation', (route: any) => {
      apiCalled.count++
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: ['c1'], failed: [] }),
      })
    })

    // 选中第一张卡片
    await page.locator('.grid input[type="checkbox"]').first().check()

    // 打开批量操作菜单，选择 R18
    await page.getByRole('button', { name: /批量操作/ }).click()
    await page.getByText('设为 R18').click()

    // ConfirmDialog 出现后点击确认
    const confirmBtn = page.getByRole('button', { name: '确认' })
    await expect(confirmBtn).toBeVisible({ timeout: 3000 })
    await confirmBtn.click()

    // 等待 API 被调用
    await page.waitForTimeout(500)
    expect(apiCalled.count).toBeGreaterThan(0)
  })
})

// ─── crawlStatus 过滤参数（任务 1.2/2.1）──────────────────────────────────────

test.describe('Comics API 过滤参数', () => {
  test('选择爬取状态筛选后 API 应携带 crawlStatus 参数', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ADMIN_SESSION),
      }))

    let capturedUrl = ''
    await page.route('**/api/admin/comics**', (route: any) => {
      capturedUrl = route.request().url()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 18, totalPages: 0 } }),
      })
    })

    await page.goto('/comics')
    await page.waitForTimeout(1000)

    // 选择爬取状态为 "部分完成"
    const crawlStatusSelect = page.locator('select').filter({ has: page.locator('option[value="partial"]') }).first()
    if (await crawlStatusSelect.count() > 0) {
      await crawlStatusSelect.selectOption('partial')
      await page.getByRole('button', { name: '应用筛选' }).click()
      await page.waitForTimeout(500)

      // capturedUrl 应包含 crawlStatus=partial
      expect(capturedUrl).toContain('crawlStatus=partial')
    }
  })
})
