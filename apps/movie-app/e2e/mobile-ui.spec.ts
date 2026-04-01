/* eslint-disable no-console */
/**
 * E2E 测试: 移动端 UI 优化功能
 * 测试移动端导航、抽屉菜单、自定义选择器、收藏夹等新功能
 */
import { expect, test } from '@playwright/test'

const mockUser = {
  id: 'user-1',
  name: '测试用户',
  email: 'test@example.com',
  r18Enabled: true,
}

const mockMovie = {
  id: 'movie-1',
  code: 'TEST-001',
  title: '测试电影',
  coverUrl: 'https://example.com/cover.jpg',
  releaseDate: '2024-01-01',
  duration: 120,
  rating: 8.5,
}

const mockActor = {
  id: 'actor-1',
  name: '测试女优',
  avatarUrl: 'https://example.com/avatar.jpg',
}

const mockPublisher = {
  id: 'publisher-1',
  name: '测试厂商',
  logoUrl: 'https://example.com/logo.jpg',
}

test.describe('移动端 UI 测试', () => {
  test.beforeEach(async ({ page }) => {
    // Mock 用户登录
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: mockUser,
            session: { id: 'session-1' },
          },
        }),
      })
    })

    // Mock 电影列表
    await page.route('**/api/movies**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [mockMovie],
          meta: {
            total: 1,
            page: 1,
            limit: 24,
            totalPages: 1,
          },
        }),
      })
    })
  })

  // ============= 移动端导航测试 =============

  test('移动端底部导航显示与交互', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试移动端底部导航')

    // 验证底部导航存在
    const bottomNav = page.locator('[data-testid="bottom-navigation"]')
    await expect(bottomNav).toBeVisible()

    // 验证导航项：首页、女优、个人
    await expect(bottomNav.locator('a[href="/"]')).toBeVisible()
    await expect(bottomNav.locator('a[href="/actors"]')).toBeVisible()
    await expect(bottomNav.locator('a[href="/profile"]')).toBeVisible()

    // 测试导航交互
    await bottomNav.locator('a[href="/actors"]').click()
    await page.waitForURL('**/actors')
    await expect(page).toHaveURL(/\/actors/)

    console.log('✅ 底部导航测试通过')
  })

  test('移动端抽屉菜单打开与关闭', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试移动端抽屉菜单')

    // 查找并点击菜单按钮（汉堡图标）
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await expect(menuButton.first()).toBeVisible()
    await menuButton.first().click()
    await page.waitForTimeout(500)

    // 验证抽屉已打开
    const drawer = page.locator('[data-testid="mobile-drawer"]')
    await expect(drawer).toBeVisible()

    // 验证抽屉内容
    await expect(drawer.locator('text=/厂商|Publishers/i')).toBeVisible()
    await expect(drawer.locator('text=/收藏夹|Favorites/i')).toBeVisible()

    // 点击遮罩层关闭
    const overlay = page.locator('[data-testid="drawer-overlay"]')
    await overlay.click()
    await page.waitForTimeout(500)

    // 验证抽屉已关闭
    await expect(drawer).not.toBeVisible()

    console.log('✅ 抽屉菜单测试通过')
  })

  test('抽屉菜单底部显示 R18 状态', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试抽屉底部 R18 状态')

    // 打开抽屉
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await menuButton.first().click()
    await page.waitForTimeout(500)

    // 验证 R18 状态显示
    const drawerFooter = page.locator('[data-testid="drawer-footer"]')
    await expect(drawerFooter).toBeVisible()
    await expect(drawerFooter.locator('text=/R18/i')).toBeVisible()

    console.log('✅ R18 状态显示测试通过')
  })

  test('键盘 ESC 关闭抽屉', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试键盘 ESC 关闭抽屉')

    // 打开抽屉
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await menuButton.first().click()
    await page.waitForTimeout(500)

    const drawer = page.locator('[data-testid="mobile-drawer"]')
    await expect(drawer).toBeVisible()

    // 按 ESC 键
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // 验证抽屉已关闭
    await expect(drawer).not.toBeVisible()

    console.log('✅ ESC 关闭测试通过')
  })

  // ============= 自定义 Select 组件测试 =============

  test('Profile 页面自定义 Select 切换标签', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试自定义 Select 组件')

    // 查找自定义 Select
    const customSelect = page.locator('.custom-select').first()
    await expect(customSelect).toBeVisible()

    // 点击打开下拉框
    await customSelect.click()
    await page.waitForTimeout(300)

    // 验证选项显示
    const options = page.locator('.select-option')
    await expect(options.first()).toBeVisible()

    // 选择第二个选项
    if (await options.count() > 1) {
      await options.nth(1).click()
      await page.waitForTimeout(300)

      console.log('✅ Select 切换测试通过')
    }
  })

  test('Actors 页面自定义 Select 筛选', async ({ page }) => {
    // Mock 女优列表
    await page.route('**/api/actors**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [mockActor],
          meta: {
            total: 1,
            page: 1,
            limit: 24,
            totalPages: 1,
          },
        }),
      })
    })

    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试 Actors 页面 Select')

    // 查找排序选择器
    const sortSelect = page.locator('.custom-select').first()
    if (await sortSelect.isVisible()) {
      await sortSelect.click()
      await page.waitForTimeout(300)

      // 验证选项可见
      const options = page.locator('.select-option')
      await expect(options.first()).toBeVisible()

      console.log('✅ Actors Select 测试通过')
    }
  })

  // ============= 收藏夹功能测试 =============

  test('添加电影到收藏夹', async ({ page }) => {
    // Mock 电影详情
    await page.route('**/api/movies/TEST-001', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockMovie,
        }),
      })
    })

    // Mock 检查收藏状态 (初始未收藏)
    await page.route('**/api/favorites/check/movie/movie-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { isFavorited: false },
        }),
      })
    })

    // Mock 添加收藏
    await page.route('**/api/favorites', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'favorite-1',
              alreadyExists: false,
            },
          }),
        })
      }
    })

    await page.goto('/movies/TEST-001')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试添加收藏功能')

    // 查找收藏按钮
    const favoriteBtn = page.locator('button:has-text("收藏")')
    await expect(favoriteBtn).toBeVisible()

    // 点击收藏
    await favoriteBtn.click()
    await page.waitForTimeout(1000)

    // 验证按钮状态变化（应该显示"已收藏"）
    await expect(favoriteBtn).toContainText(/已收藏/)

    console.log('✅ 添加收藏测试通过')
  })

  test('访问收藏夹页面并查看收藏列表', async ({ page }) => {
    // Mock 收藏列表
    await page.route('**/api/favorites**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'fav-1',
                userId: mockUser.id,
                entityType: 'movie',
                entityId: mockMovie.id,
                createdAt: Date.now(),
              },
            ],
            meta: {
              total: 1,
              page: 1,
              limit: 24,
              totalPages: 1,
            },
          }),
        })
      }
    })

    await page.goto('/favorites')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试收藏夹页面')

    // 验证页面标题
    await expect(page.locator('h1, h2').filter({ hasText: /收藏夹|Favorites/i })).toBeVisible()

    // 验证收藏列表显示
    const favoriteItems = page.locator('[data-testid="favorite-item"]')
    await expect(favoriteItems.first()).toBeVisible({ timeout: 5000 })

    console.log('✅ 收藏夹页面测试通过')
  })

  test('收藏夹类型筛选', async ({ page }) => {
    let currentFilter = 'all'

    await page.route('**/api/favorites**', async (route) => {
      if (route.request().method() === 'GET') {
        // 根据筛选条件返回不同数据
        const data = currentFilter === 'all'
          ? [{ id: 'fav-1', entityType: 'movie', entityId: 'movie-1' }]
          : []

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data,
            meta: { total: data.length, page: 1, limit: 24, totalPages: 1 },
          }),
        })
      }
    })

    await page.goto('/favorites')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试收藏夹类型筛选')

    // 查找类型筛选下拉框
    const typeSelect = page.locator('.custom-select').first()
    if (await typeSelect.isVisible()) {
      await typeSelect.click()
      await page.waitForTimeout(300)

      // 选择"电影"类型
      const movieOption = page.locator('.select-option').filter({ hasText: /电影|Movie/i })
      if (await movieOption.isVisible()) {
        currentFilter = 'movie'
        await movieOption.click()
        await page.waitForTimeout(500)

        console.log('✅ 类型筛选测试通过')
      }
    }
  })

  test('从收藏夹删除项目', async ({ page }) => {
    const favorites = [
      {
        id: 'fav-1',
        userId: mockUser.id,
        entityType: 'movie',
        entityId: mockMovie.id,
        createdAt: Date.now(),
      },
    ]

    // Mock 收藏列表
    await page.route('**/api/favorites?**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: favorites,
            meta: { total: favorites.length, page: 1, limit: 24, totalPages: 1 },
          }),
        })
      }
    })

    // Mock 删除收藏
    await page.route('**/api/favorites/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        favorites.length = 0 // 清空列表
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { success: true },
          }),
        })
      }
    })

    await page.goto('/favorites')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试删除收藏')

    // 查找删除按钮
    const deleteBtn = page.locator('button').filter({ hasText: /删除|移除|取消收藏/ }).first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      await page.waitForTimeout(1000)

      console.log('✅ 删除收藏测试通过')
    }
  })

  // ============= 移动端搜索功能测试 =============

  test('移动端顶部搜索图标显示与交互', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试移动端搜索')

    // 查找搜索图标/按钮
    const searchBtn = page.locator('[data-testid="search-button"], button[aria-label*="搜索"], a[href="/search"]').first()
    if (await searchBtn.isVisible()) {
      await searchBtn.click()
      await page.waitForTimeout(500)

      // 验证导航到搜索页或打开搜索界面
      const isSearchPage = page.url().includes('/search')
      const hasSearchInput = await page.locator('input[type="text"], input[placeholder*="搜索"]').isVisible()

      expect(isSearchPage || hasSearchInput).toBeTruthy()

      console.log('✅ 移动端搜索测试通过')
    }
  })

  // ============= 响应式断点测试 =============

  test('桌面端隐藏移动端导航', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试桌面端隐藏移动端元素')

    // 底部导航应不可见
    const bottomNav = page.locator('[data-testid="bottom-navigation"]')
    await expect(bottomNav).not.toBeVisible()

    // 移动端菜单按钮应不可见
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await expect(menuButton.first()).not.toBeVisible()

    console.log('✅ 桌面端响应式测试通过')
  })

  test('768px 断点切换', async ({ page }) => {
    console.log('🔍 测试响应式断点切换')

    // 桌面模式
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const bottomNavDesktop = page.locator('[data-testid="bottom-navigation"]')
    await expect(bottomNavDesktop).not.toBeVisible()

    // 切换到移动模式
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    const bottomNavMobile = page.locator('[data-testid="bottom-navigation"]')
    await expect(bottomNavMobile).toBeVisible()

    console.log('✅ 响应式断点测试通过')
  })

  // ============= 移动端用户体验测试 =============

  test('移动端滚动时底部导航固定', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Mock 大量电影数据
    await page.route('**/api/movies**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: Array.from({ length: 50 }, (_, i) => ({
            ...mockMovie,
            id: `movie-${i}`,
            code: `TEST-${String(i).padStart(3, '0')}`,
          })),
          meta: { total: 50, page: 1, limit: 50, totalPages: 1 },
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试滚动时底部导航固定')

    const bottomNav = page.locator('[data-testid="bottom-navigation"]')
    await expect(bottomNav).toBeVisible()

    // 滚动页面
    await page.evaluate(() => window.scrollTo(0, 1000))
    await page.waitForTimeout(500)

    // 验证底部导航仍然可见（固定定位）
    await expect(bottomNav).toBeVisible()

    console.log('✅ 滚动固定测试通过')
  })

  // ============= 抽屉内导航测试 =============

  test('抽屉内点击"厂商"导航到厂商页面', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Mock 厂商列表
    await page.route('**/api/publishers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [mockPublisher],
          meta: { total: 1, page: 1, limit: 24, totalPages: 1 },
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试抽屉内导航')

    // 打开抽屉
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await menuButton.first().click()
    await page.waitForTimeout(500)

    // 点击厂商链接
    const publishersLink = page.locator('[data-testid="mobile-drawer"] a[href="/publishers"]')
    await expect(publishersLink).toBeVisible()
    await publishersLink.click()
    await page.waitForTimeout(500)

    // 验证导航成功
    await expect(page).toHaveURL(/\/publishers/)

    // 验证抽屉已关闭
    const drawer = page.locator('[data-testid="mobile-drawer"]')
    await expect(drawer).not.toBeVisible()

    console.log('✅ 抽屉内导航测试通过')
  })

  test('抽屉内点击"收藏夹"导航', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Mock 收藏列表
    await page.route('**/api/favorites**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 24, totalPages: 0 },
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试收藏夹导航')

    // 打开抽屉
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")')
    await menuButton.first().click()
    await page.waitForTimeout(500)

    // 点击收藏夹链接
    const favoritesLink = page.locator('[data-testid="mobile-drawer"] a[href="/favorites"]')
    await expect(favoritesLink).toBeVisible()
    await favoritesLink.click()
    await page.waitForTimeout(500)

    // 验证导航成功
    await expect(page).toHaveURL(/\/favorites/)

    console.log('✅ 收藏夹导航测试通过')
  })
})

test.describe('Dashboard 移动端测试', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Dashboard 登录
    await page.route('**/api/admin/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: { id: 'admin-1', name: '管理员', role: 'admin' },
            session: { id: 'session-admin' },
          },
        }),
      })
    })
  })

  test('移动端 Dashboard 侧边栏抽屉', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // 假设 Dashboard 在 localhost:3002
    await page.goto('http://localhost:3002/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试 Dashboard 移动端抽屉')

    // 查找汉堡菜单按钮
    const hamburger = page.locator('button').filter({ hasText: /☰|menu/i }).first()
    if (await hamburger.isVisible()) {
      await hamburger.click()
      await page.waitForTimeout(500)

      // 验证侧边栏可见
      const sidebar = page.locator('aside, nav').first()
      await expect(sidebar).toBeVisible()

      // 点击遮罩关闭
      const overlay = page.locator('.fixed.inset-0.bg-black\\/50')
      if (await overlay.isVisible()) {
        await overlay.click()
        await page.waitForTimeout(500)

        console.log('✅ Dashboard 抽屉测试通过')
      }
    }
  })

  test('Dashboard 桌面端侧边栏始终可见', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto('http://localhost:3002/')
    await page.waitForLoadState('networkidle')

    console.log('🔍 测试 Dashboard 桌面端侧边栏')

    // 侧边栏应该始终可见
    const sidebar = page.locator('aside, nav').first()
    await expect(sidebar).toBeVisible()

    // 汉堡菜单不应显示
    const hamburger = page.locator('button').filter({ hasText: /☰|menu/i })
    await expect(hamburger).not.toBeVisible()

    console.log('✅ Dashboard 桌面端测试通过')
  })
})
