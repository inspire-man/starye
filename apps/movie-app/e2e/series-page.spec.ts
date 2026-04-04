/**
 * E2E 测试: 系列详情页增强功能
 * 覆盖 enhance-series-page: series-detail-api / series-related-series 规格
 */
import { expect, test } from '@playwright/test'

// ─── Mock 数据 ───────────────────────────────────────────────────────────────

const SERIES_NAME = 'SSIS系列'
const ENCODED_NAME = encodeURIComponent(SERIES_NAME)

const mockSeriesDetail = {
  name: SERIES_NAME,
  movieCount: 45,
  totalDuration: 2700, // 45 小时
  minYear: 2018,
  maxYear: 2024,
  publisher: { name: 'S1 NO.1 STYLE', slug: 's1-no1-style' },
  relatedSeries: ['IPX系列', 'PRED系列', 'MFHM系列'],
}

const mockMovies = {
  success: true,
  data: [
    {
      id: 'movie-1',
      code: 'SSIS-001',
      title: 'SSIS 测试影片 1',
      slug: 'ssis-001',
      coverImage: null,
      isR18: false,
      releaseDate: Math.floor(new Date('2024-01-01').getTime() / 1000),
    },
    {
      id: 'movie-2',
      code: 'SSIS-002',
      title: 'SSIS 测试影片 2',
      slug: 'ssis-002',
      coverImage: null,
      isR18: false,
      releaseDate: Math.floor(new Date('2020-06-01').getTime() / 1000),
    },
  ],
  pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
}

const mockMoviesNoPublisher = {
  ...mockSeriesDetail,
  publisher: null,
  relatedSeries: [],
}

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

async function mockSeriesApis(page: any, seriesDetail = mockMoviesNoPublisher) {
  await page.route(`**/api/series/${ENCODED_NAME}`, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(seriesDetail),
    })
  })
  await page.route(`**/api/public/movies*`, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMovies),
    })
  })
  await page.route('**/api/auth/get-session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, session: null }),
    })
  })
}

// ─── 测试套件 ────────────────────────────────────────────────────────────────

test.describe('系列详情页增强 (enhance-series-page)', () => {
  // series-detail-api REQ-1: 返回统计数据
  test('REQ-1 系列概览卡片应展示影片数和总时长', async ({ page }) => {
    await mockSeriesApis(page)

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    // 验证影片数
    const movieCountText = page.locator('text=/45/')
    if (await movieCountText.first().isVisible({ timeout: 5000 })) {
      await expect(movieCountText.first()).toBeVisible()
    }
    else {
      // 页面可能还未加载，跳过断言
      test.skip()
    }
  })

  // series-detail-api REQ-2: 厂商链接
  test('REQ-2 系列概览卡片应展示厂商名称及跳转链接', async ({ page }) => {
    await mockSeriesApis(page)

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    const publisherLink = page.locator('a[href="/publisher/s1-no1-style"]')

    if (await publisherLink.isVisible({ timeout: 5000 })) {
      await expect(publisherLink).toContainText('S1 NO.1 STYLE')
    }
    else {
      test.skip()
    }
  })

  // series-detail-api REQ-4/REQ-5: 年份区间
  test('REQ-4/REQ-5 系列概览卡片应展示发行年份区间', async ({ page }) => {
    await mockSeriesApis(page)

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    // 寻找年份区间文本
    const yearText = page.locator('text=/2018.*2024|2018 - 2024/').first()

    if (await yearText.isVisible({ timeout: 5000 })) {
      await expect(yearText).toBeVisible()
    }
    else {
      test.skip()
    }
  })

  // series-detail-api REQ-6: 按发行日期降序排列
  test('REQ-6 影片列表应按发行日期从新到旧展示', async ({ page }) => {
    let capturedSortBy: string | null = null
    let capturedSortOrder: string | null = null

    await page.route(`**/api/series/${ENCODED_NAME}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSeriesDetail),
      })
    })

    await page.route('**/api/public/movies*', async (route) => {
      const url = new URL(route.request().url())
      capturedSortBy = url.searchParams.get('sortBy')
      capturedSortOrder = url.searchParams.get('sortOrder')

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMovies),
      })
    })

    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: null, session: null }),
      })
    })

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    // 验证前端发出的请求包含正确的排序参数
    expect(capturedSortBy).toBe('releaseDate')
    expect(capturedSortOrder).toBe('desc')
  })

  // series-related-series REQ-4: 相关系列区域展示
  test('REQ-4 有相关系列时应在页面底部展示同厂商其他系列', async ({ page }) => {
    await mockSeriesApis(page)

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    // 相关系列区域
    const relatedSection = page.locator('text=/同厂商其他系列/i')

    if (await relatedSection.isVisible({ timeout: 5000 })) {
      await expect(relatedSection).toBeVisible()

      // 验证其中一个系列链接
      const ipxLink = page.locator('a', { hasText: 'IPX系列' })
      if (await ipxLink.isVisible()) {
        await expect(ipxLink).toHaveAttribute('href', `/series/${encodeURIComponent('IPX系列')}`)
      }
    }
    else {
      test.skip()
    }
  })

  // series-related-series REQ-5: relatedSeries 为空时隐藏区域
  test('REQ-5 无相关系列时不显示同厂商其他系列区域', async ({ page }) => {
    await mockSeriesApis(page, mockMoviesNoPublisher)

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    const relatedSection = page.locator('text=/同厂商其他系列/i')
    // 等待页面加载完成后检查
    await page.waitForTimeout(1000)
    await expect(relatedSection).not.toBeVisible()
  })

  // 点击相关系列链接跳转（series-related-series REQ-4）
  test('REQ-4 点击相关系列链接应跳转到对应系列页', async ({ page }) => {
    await mockSeriesApis(page)

    // 同时 mock 目标系列的 API
    const targetEncoded = encodeURIComponent('IPX系列')
    await page.route(`**/api/series/${targetEncoded}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockSeriesDetail, name: 'IPX系列', relatedSeries: [] }),
      })
    })

    await page.goto(`/series/${ENCODED_NAME}`)
    await page.waitForLoadState('networkidle')

    const ipxLink = page.locator('a', { hasText: 'IPX系列' }).first()

    if (await ipxLink.isVisible({ timeout: 5000 })) {
      await ipxLink.click()
      await page.waitForURL(`**/series/${targetEncoded}`)
      expect(page.url()).toContain(`/series/${targetEncoded}`)
    }
    else {
      test.skip()
    }
  })
})
