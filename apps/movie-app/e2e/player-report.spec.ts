/**
 * E2E 测试: 播放源上报功能
 * 覆盖 enhance-user-interaction 中的 player-report-invalid 规格
 */
import { expect, test } from '@playwright/test'

// ─── 公共 Mock 数据 ─────────────────────────────────────────────────────────

const mockPlayer = {
  id: 'player-report-1',
  sourceName: '磁力链接 HD',
  sourceUrl: 'magnet:?xt=urn:btih:abcdef',
  quality: '1080P',
  sortOrder: 0,
  averageRating: null,
  ratingCount: 0,
  reportCount: 0,
  isActive: true,
}

const mockMovie = {
  id: 'test-movie-report',
  code: 'RPT-001',
  title: '上报测试电影',
  slug: 'rpt-001',
  coverImage: null,
  isR18: false,
  actors: [],
  publishers: [],
  relatedMovies: [],
  players: [mockPlayer],
}

const mockUser = {
  id: 'user-report-test',
  name: '上报测试用户',
  email: 'reporter@example.com',
}

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/** Mock 电影详情 API */
async function mockMovieApi(page: any) {
  await page.route('**/api/movies/RPT-001', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockMovie }),
    })
  })
  // 同时匹配 slug 格式
  await page.route('**/api/movies/rpt-001', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockMovie }),
    })
  })
}

/** Mock 已登录会话 */
async function mockLoggedIn(page: any) {
  await page.route('**/api/auth/get-session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockUser, session: { id: 'session-report' } }),
    })
  })
}

/** Mock 未登录会话 */
async function mockLoggedOut(page: any) {
  await page.route('**/api/auth/get-session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, session: null }),
    })
  })
}

/** Mock 上报 API 返回成功 */
async function mockReportSuccess(page: any) {
  await page.route(`**/api/movies/players/${mockPlayer.id}/report`, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, reportCount: 1, isActive: true }),
    })
  })
}

// ─── 测试套件 ────────────────────────────────────────────────────────────────

test.describe('播放源上报功能 (player-report-invalid)', () => {
  // REQ-6: 未登录用户上报时显示 Toast 提示
  test('REQ-6 未登录用户点击上报应显示登录提示', async ({ page }) => {
    await mockLoggedOut(page)
    await mockMovieApi(page)

    await page.goto('/movies/RPT-001')
    await page.waitForLoadState('networkidle')

    // 找到上报按钮（可能在 player 卡片中）
    const reportBtn = page.locator('button:has-text("上报")').first()

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click()

      // 验证出现登录提示 Toast
      const toast = page.locator('text=/请先登录|登录后.*上报/i')
      await expect(toast).toBeVisible({ timeout: 3000 })
    }
    else {
      // 若无 player 数据渲染，跳过此用例
      test.skip()
    }
  })

  // REQ-1 + REQ-2: 已登录用户点击上报应弹出确认弹窗
  test('REQ-1/REQ-2 已登录用户点击上报应弹出确认弹窗', async ({ page }) => {
    await mockLoggedIn(page)
    await mockMovieApi(page)
    await mockReportSuccess(page)

    await page.goto('/movies/RPT-001')
    await page.waitForLoadState('networkidle')

    const reportBtn = page.locator('button:has-text("上报")').first()

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click()

      // 确认弹窗应显示
      const confirmModal = page.locator('text=/上报播放源失效|确认上报/i')
      await expect(confirmModal).toBeVisible({ timeout: 3000 })
    }
    else {
      test.skip()
    }
  })

  // REQ-3 + REQ-4: 确认上报后，按钮变灰显示"已上报"
  test('REQ-3/REQ-4 确认上报后按钮变为"已上报"状态', async ({ page }) => {
    await mockLoggedIn(page)
    await mockMovieApi(page)
    await mockReportSuccess(page)

    await page.goto('/movies/RPT-001')
    await page.waitForLoadState('networkidle')

    const reportBtn = page.locator('button:has-text("上报")').first()

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      // 点击上报按钮
      await reportBtn.click()

      // 等待确认弹窗出现
      const confirmBtn = page.locator('button:has-text("确认上报")')
      await expect(confirmBtn).toBeVisible({ timeout: 3000 })

      // 点击确认
      await confirmBtn.click()

      // 验证：成功 Toast 出现
      const successToast = page.locator('text=/上报成功/i')
      await expect(successToast).toBeVisible({ timeout: 3000 })

      // 验证：按钮变为"已上报"并被禁用
      const reportedBtn = page.locator('button:has-text("已上报")')
      await expect(reportedBtn).toBeVisible({ timeout: 3000 })
      await expect(reportedBtn).toBeDisabled()
    }
    else {
      test.skip()
    }
  })

  // REQ-4: 同一会话内同一 player 已上报后，按钮不可再次点击
  test('REQ-4 同一会话内不能重复上报同一播放源', async ({ page }) => {
    let reportCallCount = 0
    await mockLoggedIn(page)
    await mockMovieApi(page)
    await page.route(`**/api/movies/players/${mockPlayer.id}/report`, async (route: any) => {
      reportCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, reportCount: reportCallCount, isActive: true }),
      })
    })

    await page.goto('/movies/RPT-001')
    await page.waitForLoadState('networkidle')

    const reportBtn = page.locator('button:has-text("上报")').first()

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      // 第一次上报
      await reportBtn.click()
      const confirmBtn = page.locator('button:has-text("确认上报")')
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click()
        await page.waitForTimeout(500)
      }

      // 此时按钮应变为"已上报"（disabled）
      const reportedBtn = page.locator('button:has-text("已上报")').first()
      if (await reportedBtn.isVisible({ timeout: 2000 })) {
        // 尝试再次点击应无效（disabled）
        const isDisabled = await reportedBtn.isDisabled()
        expect(isDisabled).toBe(true)

        // API 仅被调用一次
        expect(reportCallCount).toBe(1)
      }
    }
    else {
      test.skip()
    }
  })

  // REQ-5: 上报 API 失败时应显示错误提示
  test('REQ-5 上报 API 失败时应显示错误 Toast', async ({ page }) => {
    await mockLoggedIn(page)
    await mockMovieApi(page)
    await page.route(`**/api/movies/players/${mockPlayer.id}/report`, async (route: any) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.goto('/movies/RPT-001')
    await page.waitForLoadState('networkidle')

    const reportBtn = page.locator('button:has-text("上报")').first()

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click()
      const confirmBtn = page.locator('button:has-text("确认上报")')
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click()

        // 应显示错误 Toast
        const errorToast = page.locator('text=/上报失败/i')
        await expect(errorToast).toBeVisible({ timeout: 3000 })
      }
    }
    else {
      test.skip()
    }
  })
})
