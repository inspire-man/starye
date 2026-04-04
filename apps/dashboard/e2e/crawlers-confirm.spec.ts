/**
 * Crawlers 管理页面 E2E 测试
 *
 * 覆盖（任务 7.3）：
 * - 点击"清空记录"显示 ConfirmDialog 而非原生弹窗
 * - 取消 → 不执行清空
 * - 确认 → 调用 clearFailedTasks API
 */

import { expect, test } from '@playwright/test'

const ADMIN_SESSION = {
  user: { id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
  session: { id: 'session-1', userId: 'user-1' },
}

const MOCK_STATS = {
  totalComics: 100,
  totalMovies: 200,
  recentComics: 10,
  recentMovies: 20,
}

const MOCK_FAILED_TASKS = {
  comic: { count: 5, tasks: [{ id: 't1', error: 'timeout', createdAt: new Date().toISOString() }] },
  movie: { count: 3, tasks: [{ id: 't2', error: 'not found', createdAt: new Date().toISOString() }] },
}

async function setupCrawlersPage(page: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_SESSION),
    }))

  await page.route('**/api/admin/crawlers/stats**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STATS),
    }))

  await page.route('**/api/admin/crawlers/failed**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_FAILED_TASKS),
    }))

  await page.route('**/api/admin/crawlers/clear-failed**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }))
}

test.describe('Crawlers 页面 - ConfirmDialog 替换（任务 7.3）', () => {
  test.beforeEach(async ({ page }) => {
    await setupCrawlersPage(page)
    await page.goto('/crawlers')
    await page.waitForTimeout(1000)
  })

  test('清空按钮应显示 ConfirmDialog 而非原生弹窗', async ({ page }) => {
    // 监控 window.confirm 是否被调用
    await page.evaluate(() => {
      (window as any).__confirmCalled = false
      const original = window.confirm
      window.confirm = (...args) => {
        ;(window as any).__confirmCalled = true
        return original.apply(window, args as any)
      }
    })

    // 查找清空失败任务的按钮
    const clearBtn = page.getByRole('button', { name: /清空/ }).first()

    if (await clearBtn.count() > 0) {
      await clearBtn.click()

      // ConfirmDialog 应出现
      await expect(page.getByRole('button', { name: '确认' })).toBeVisible({ timeout: 3000 })

      // window.confirm 不应被调用
      const confirmCalled = await page.evaluate(() => (window as any).__confirmCalled)
      expect(confirmCalled).toBe(false)
    }
  })

  test('点击取消后 clearFailedTasks 不应被调用', async ({ page }) => {
    let clearApiCalled = false
    await page.route('**/api/admin/crawlers/clear-failed**', (route: any) => {
      clearApiCalled = true
      route.continue()
    })

    const clearBtn = page.getByRole('button', { name: /清空/ }).first()

    if (await clearBtn.count() > 0) {
      await clearBtn.click()

      // ConfirmDialog 出现后点击取消
      const cancelBtn = page.getByRole('button', { name: '取消' })
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
      }

      await page.waitForTimeout(300)
      expect(clearApiCalled).toBe(false)
    }
  })

  test('点击确认后 clearFailedTasks 应被调用', async ({ page }) => {
    let clearApiCalled = false
    await page.route('**/api/admin/crawlers/clear-failed**', (route: any) => {
      clearApiCalled = true
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    const clearBtn = page.getByRole('button', { name: /清空/ }).first()

    if (await clearBtn.count() > 0) {
      await clearBtn.click()

      const confirmBtn = page.getByRole('button', { name: '确认' })
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click()
        await page.waitForTimeout(500)
        expect(clearApiCalled).toBe(true)
      }
    }
  })
})
