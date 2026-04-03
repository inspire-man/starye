/**
 * Blog 前端 Playwright E2E 测试 — blog-enhance 变更
 * 使用 page.route() mock API 响应，无需启动真实 API 服务
 */

import { expect, test } from '@playwright/test'

// ─── Mock 数据 ─────────────────────────────────────────────────────────────

const MOCK_POSTS_LIST = {
  data: [
    {
      id: 'post-1',
      title: 'TypeScript Full-Stack Part 1',
      slug: 'ts-fullstack-part-1',
      excerpt: 'Starting the journey with TypeScript and Cloudflare',
      coverImage: null,
      published: true,
      tags: ['typescript', 'cloudflare'],
      series: 'ts-fullstack-ai-chronicle',
      seriesOrder: 1,
      contentFormat: 'html',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      author: { name: 'Starye', image: null },
    },
    {
      id: 'post-2',
      title: 'TypeScript Full-Stack Part 2',
      slug: 'ts-fullstack-part-2',
      excerpt: 'Diving into Drizzle ORM and D1',
      coverImage: null,
      published: true,
      tags: ['typescript', 'drizzle'],
      series: 'ts-fullstack-ai-chronicle',
      seriesOrder: 2,
      contentFormat: 'html',
      createdAt: '2024-01-08T00:00:00.000Z',
      updatedAt: '2024-01-08T00:00:00.000Z',
      author: { name: 'Starye', image: null },
    },
  ],
  meta: { total: 2, page: 1, limit: 9, totalPages: 1 },
}

const MOCK_HTML_POST = {
  data: {
    id: 'post-1',
    title: 'TypeScript Full-Stack Part 1',
    slug: 'ts-fullstack-part-1',
    content: '<h2 id="introduction">Introduction</h2><p>Hello world</p><h3 id="setup">Setup</h3><p>Config here</p>',
    excerpt: 'Starting the journey',
    coverImage: null,
    published: true,
    tags: ['typescript', 'cloudflare'],
    series: 'ts-fullstack-ai-chronicle',
    seriesOrder: 1,
    contentFormat: 'html',
    createdAt: '2024-01-01T00:00:00.000Z',
    toc: [
      { id: 'introduction', text: 'Introduction', level: 2 },
      { id: 'setup', text: 'Setup', level: 3 },
    ],
    author: { id: 'u1', name: 'Starye', image: null },
  },
}

const MOCK_ADJACENT = {
  data: {
    prev: null,
    next: { title: 'TypeScript Full-Stack Part 2', slug: 'ts-fullstack-part-2' },
  },
}

// ─── API Mock 工具 ─────────────────────────────────────────────────────────

async function mockApiRoutes(page: import('@playwright/test').Page) {
  // 首页文章列表（含 series 聚合用的 limit=100 请求）
  await page.route('**/api/posts**', async (route) => {
    const url = new URL(route.request().url())
    const series = url.searchParams.get('series')

    if (series) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_POSTS_LIST.data.filter(p => p.series === series),
          meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
        }),
      })
    }
    else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_POSTS_LIST),
      })
    }
  })

  // 单篇文章详情
  await page.route('**/api/posts/ts-fullstack-part-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HTML_POST),
    })
  })

  // 相邻文章
  await page.route('**/api/posts/ts-fullstack-part-1/adjacent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADJACENT),
    })
  })
}

// ─── 首页：系列筛选 chip ────────────────────────────────────────────────────

test.describe('首页 — 系列筛选 chip', () => {
  test('首页应渲染系列筛选区域', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/')

    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 系列筛选区域应可见（"系列：" 标签）
    const seriesLabel = page.getByText('系列：')
    await expect(seriesLabel).toBeVisible({ timeout: 10000 })
  })

  test('点击系列 chip 应将 ?series= 添加到 URL', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 等待 series chip 出现并点击
    const seriesChip = page.locator('button').filter({ hasText: /Ts Fullstack Ai Chronicle/i }).first()
    await expect(seriesChip).toBeVisible({ timeout: 10000 })
    await seriesChip.click()

    // URL 应包含 ?series=ts-fullstack-ai-chronicle
    await expect(page).toHaveURL(/series=ts-fullstack-ai-chronicle/)
  })

  test('首页应展示文章卡片', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 应该展示文章标题
    await expect(page.getByText('TypeScript Full-Stack Part 1')).toBeVisible({ timeout: 10000 })
  })
})

// ─── 系列页 /series/:name ──────────────────────────────────────────────────

test.describe('系列页 /series/ts-fullstack-ai-chronicle', () => {
  test('系列页应展示该系列所有文章', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/series/ts-fullstack-ai-chronicle')
    await page.waitForLoadState('networkidle')

    // 页面标题应包含系列名
    await expect(page.locator('h1')).toContainText('Ts Fullstack Ai Chronicle', { timeout: 10000 })

    // 应显示文章列表
    await expect(page.getByText('TypeScript Full-Stack Part 1')).toBeVisible()
    await expect(page.getByText('TypeScript Full-Stack Part 2')).toBeVisible()
  })

  test('系列页文章应显示序号', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/series/ts-fullstack-ai-chronicle')
    await page.waitForLoadState('networkidle')

    // 序号数字应可见（div with seriesOrder value）
    await expect(page.locator('div').filter({ hasText: /^1$/ }).first()).toBeVisible({ timeout: 10000 })
  })

  test('系列页应显示文章总数', async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/series/ts-fullstack-ai-chronicle')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/共[^\n\r2\u2028\u2029]*2.*篇/)).toBeVisible({ timeout: 10000 })
  })
})

// ─── 标签页 /tags/:tag ─────────────────────────────────────────────────────

test.describe('标签页 /tags/typescript', () => {
  test.beforeEach(async ({ page }) => {
    // Mock 标签过滤接口
    await page.route('**/api/posts**', async (route) => {
      const url = new URL(route.request().url())
      const tag = url.searchParams.get('tag')
      if (tag === 'typescript') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: MOCK_POSTS_LIST.data.filter(p => p.tags.includes('typescript')),
            meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
          }),
        })
      }
      else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_POSTS_LIST),
        })
      }
    })
  })

  test('标签页应展示 # 标签名称', async ({ page }) => {
    await page.goto('/tags/typescript')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText('typescript', { timeout: 10000 })
    await expect(page.locator('span, h1, div').filter({ hasText: /^#$/ }).first()).toBeVisible({ timeout: 5000 })
  })

  test('标签页应展示含该 tag 的文章', async ({ page }) => {
    await page.goto('/tags/typescript')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('TypeScript Full-Stack Part 1')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('TypeScript Full-Stack Part 2')).toBeVisible()
  })
})

// ─── 文章详情页 — TOC + 上下篇导航 ────────────────────────────────────────

test.describe('文章详情页 /ts-fullstack-part-1', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('应展示文章标题', async ({ page }) => {
    await page.goto('/ts-fullstack-part-1')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText('TypeScript Full-Stack Part 1', { timeout: 10000 })
  })

  test('应展示阅读时间和字数', async ({ page }) => {
    await page.goto('/ts-fullstack-part-1')
    await page.waitForLoadState('networkidle')

    // 应显示阅读时间（分钟）
    await expect(page.getByText(/min read|分钟/)).toBeVisible({ timeout: 10000 })
  })

  test('宽屏下应显示 TOC 侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/ts-fullstack-part-1')
    await page.waitForLoadState('networkidle')

    // TOC 目录区域
    await expect(page.getByText('目录')).toBeVisible({ timeout: 10000 })

    // TOC 条目
    await expect(page.getByRole('link', { name: 'Introduction' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Setup' })).toBeVisible()
  })

  test('应展示下一篇导航', async ({ page }) => {
    await page.goto('/ts-fullstack-part-1')
    await page.waitForLoadState('networkidle')

    // 下一篇导航
    await expect(page.getByText('下一篇')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('TypeScript Full-Stack Part 2')).toBeVisible()
  })

  test('应展示文章标签', async ({ page }) => {
    await page.goto('/ts-fullstack-part-1')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('#typescript')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('#cloudflare')).toBeVisible()
  })
})
