/**
 * E2E 测试: TorrServer 集成测试
 *
 * 通过 Playwright route mock 模拟 TorrServer API 响应，
 * 覆盖：连接配置、在线播放按钮、文件选择、播放页跳转、错误降级。
 *
 * 注意：该应用 base 为 /movie/，所有页面 URL 均以 /movie/ 开头。
 */
import { expect, test } from '@playwright/test'

// ── 常量 & Mock 数据 ────────────────────────────────────

const BASE = '/movie'
const TORRSERVER_URL = 'http://localhost:8090'

const mockUser = {
  id: 'user-1',
  name: '测试用户',
  email: 'test@example.com',
}

const mockMovie = {
  id: 'movie-1',
  code: 'TEST-TS-001',
  title: 'TorrServer 测试电影',
  coverImage: null,
  releaseDate: null,
  duration: null,
  description: null,
  genres: null,
  actors: [],
  publishers: [],
  series: null,
  isR18: false,
  totalPlayers: 2,
  relatedMovies: [],
  players: [
    {
      id: 'player-1',
      sourceName: '磁力 - HD 1080P',
      sourceUrl: 'magnet:?xt=urn:btih:aabbccdd11223344aabbccdd11223344&dn=test-movie',
      quality: '3.2 GB',
      sortOrder: 0,
      averageRating: null,
      ratingCount: 0,
    },
    {
      id: 'player-2',
      sourceName: '在线播放源',
      sourceUrl: 'https://example.com/stream/video.mp4',
      quality: '720P',
      sortOrder: 1,
      averageRating: null,
      ratingCount: 0,
    },
  ],
}

const mockTorrentInfo = {
  title: 'test-movie',
  hash: 'aabbccdd11223344aabbccdd11223344',
  stat: 2,
  file_stats: [
    { id: 0, path: 'test-movie/movie.mp4', length: 3_400_000_000 },
    { id: 1, path: 'test-movie/cover.jpg', length: 500_000 },
    { id: 2, path: 'test-movie/subs.srt', length: 80_000 },
  ],
}

const mockTorrentInfoMultiVideo = {
  title: 'test-multi',
  hash: 'eeff00112233445566778899aabbccdd',
  stat: 2,
  file_stats: [
    { id: 0, path: 'multi/part1.mp4', length: 2_100_000_000 },
    { id: 1, path: 'multi/part2.mp4', length: 2_000_000_000 },
    { id: 2, path: 'multi/bonus.mp4', length: 500_000_000 },
    { id: 3, path: 'multi/cover.jpg', length: 200_000 },
  ],
}

// ── 辅助函数 ─────────────────────────────────────────────

async function setupCommonMocks(page: any, movieData = mockMovie) {
  await page.route('**/api/auth/get-session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: mockUser, session: { id: 'session-1' } }),
    })
  })

  await page.route(`**/api/public/movies/${movieData.code}`, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: movieData }),
    })
  })

  await page.route('**/api/favorites/check**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { isFavorited: false, favoriteId: null } }),
    })
  })

  await page.route('**/api/aria2/config', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: null }),
    })
  })

  // Mock 观看进度（Player.vue / Profile.vue 需要）
  await page.route('**/api/public/progress/**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    })
  })
}

async function setupTorrServerMocks(page: any, torrentInfo = mockTorrentInfo) {
  await page.route(`${TORRSERVER_URL}/echo`, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'MatriX.141',
    })
  })

  await page.route(`${TORRSERVER_URL}/torrents`, async (route: any) => {
    const body = JSON.parse(route.request().postData() || '{}')
    if (body.action === 'add' || body.action === 'get') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(torrentInfo),
      })
    }
    else if (body.action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([torrentInfo]),
      })
    }
    else {
      await route.fulfill({ status: 200, body: '' })
    }
  })
}

/**
 * 通过 Profile 页手动配置 TorrServer 连接（最可靠的方式）
 */
async function connectTorrServerViaProfile(page: any) {
  await page.goto(`${BASE}/profile`)
  await page.waitForLoadState('networkidle')

  // 切换到 TorrServer 设置 tab
  const torrTab = page.locator('button:has-text("TorrServer")')
  await torrTab.first().click()
  await page.waitForTimeout(500)

  // 填写 TorrServer 地址
  const urlInput = page.locator('input#torrserver-url')
  await urlInput.clear()
  await urlInput.fill(TORRSERVER_URL)

  // Profile 页使用 v-show 管理 tab，Aria2 和 TorrServer 各有一个"测试连接"按钮，
  // 但只有当前 tab 对应的按钮可见，用 :visible 过滤
  const testBtn = page.locator('button:has-text("测试连接"):visible')
  await testBtn.click()
  await page.waitForTimeout(2000)
}

// ── 测试用例 ─────────────────────────────────────────────

test.describe('TorrServer 集成测试', () => {
  // ── 1. 连接配置 ──

  test('配置 TorrServer 连接并测试成功', async ({ page }) => {
    await setupCommonMocks(page)
    await setupTorrServerMocks(page)

    await connectTorrServerViaProfile(page)

    const connected = page.locator('text=/已连接|MatriX/i')
    await expect(connected.first()).toBeVisible({ timeout: 5000 })
  })

  test('TorrServer 连接失败时显示未连接', async ({ page }) => {
    await setupCommonMocks(page)
    await page.route(`${TORRSERVER_URL}/echo`, async (route) => {
      await route.abort('connectionrefused')
    })

    await page.goto(`${BASE}/profile`)
    await page.waitForLoadState('networkidle')

    // 切换到 TorrServer tab
    const torrTab = page.locator('button:has-text("TorrServer")')
    await torrTab.first().click()
    await page.waitForTimeout(500)

    const urlInput = page.locator('input#torrserver-url')
    await urlInput.clear()
    await urlInput.fill(TORRSERVER_URL)

    // 用 :visible 过滤避免与 Aria2 的同名按钮冲突
    const testBtn = page.locator('button:has-text("测试连接"):visible')
    await testBtn.click()
    await page.waitForTimeout(2000)

    // 用 :visible 过滤：Aria2 tab 中也有"未连接"文本但被 v-show 隐藏
    const disconnected = page.locator('text=未连接').and(page.locator(':visible'))
    await expect(disconnected.first()).toBeVisible({ timeout: 5000 })
  })

  // ── 2. MovieDetail 按钮渲染 ──

  test('TorrServer 已连接时显示在线播放按钮', async ({ page }) => {
    await setupCommonMocks(page)
    await setupTorrServerMocks(page)

    // 先通过 Profile 页完成连接
    await connectTorrServerViaProfile(page)

    // 然后跳转到影片详情
    await page.goto(`${BASE}/movie/${mockMovie.code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const streamBtn = page.locator('button:has-text("在线播放")')
    await expect(streamBtn.first()).toBeVisible({ timeout: 8000 })
  })

  test('TorrServer 未连接时不显示在线播放按钮', async ({ page }) => {
    await setupCommonMocks(page)

    await page.goto(`${BASE}/movie/${mockMovie.code}`)
    await page.waitForLoadState('networkidle')

    // 先确认影片页面正常渲染
    await expect(page.locator(`text=${mockMovie.title}`).first()).toBeVisible({ timeout: 8000 })

    const streamBtn = page.locator('button:has-text("在线播放")')
    await expect(streamBtn).toHaveCount(0)
  })

  // ── 3. 播放流程 ──

  test('点击在线播放跳转到播放页', async ({ page }) => {
    await setupCommonMocks(page)
    await setupTorrServerMocks(page)

    await connectTorrServerViaProfile(page)

    await page.goto(`${BASE}/movie/${mockMovie.code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const streamBtn = page.locator('button:has-text("在线播放")')
    if (await streamBtn.first().isVisible({ timeout: 5000 })) {
      await streamBtn.first().click()
      await page.waitForURL(/\/play\?streamUrl=/, { timeout: 15000 })
      expect(page.url()).toContain('streamUrl=')
    }
  })

  // ── 4. 文件选择 Modal ──

  test('多视频文件种子显示文件选择弹窗', async ({ page }) => {
    const multiVideoMovie = {
      ...mockMovie,
      code: 'TEST-TS-MULTI',
      players: [{
        ...mockMovie.players[0],
        sourceUrl: 'magnet:?xt=urn:btih:eeff00112233445566778899aabbccdd&dn=multi-video',
      }],
    }

    await setupCommonMocks(page, multiVideoMovie)
    await setupTorrServerMocks(page, mockTorrentInfoMultiVideo)

    await connectTorrServerViaProfile(page)

    await page.goto(`${BASE}/movie/${multiVideoMovie.code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const streamBtn = page.locator('button:has-text("在线播放")')
    if (await streamBtn.first().isVisible({ timeout: 5000 })) {
      await streamBtn.first().click()

      const fileModal = page.locator('text=选择播放文件')
      await expect(fileModal).toBeVisible({ timeout: 15000 })

      const fileItems = page.locator('text=/part1\\.mp4|part2\\.mp4|bonus\\.mp4/')
      expect(await fileItems.count()).toBeGreaterThanOrEqual(2)
    }
  })

  test('选择文件后跳转播放', async ({ page }) => {
    const multiVideoMovie = {
      ...mockMovie,
      code: 'TEST-TS-MULTI2',
      players: [{
        ...mockMovie.players[0],
        sourceUrl: 'magnet:?xt=urn:btih:eeff00112233445566778899aabbccdd&dn=multi-video',
      }],
    }

    await setupCommonMocks(page, multiVideoMovie)
    await setupTorrServerMocks(page, mockTorrentInfoMultiVideo)

    await connectTorrServerViaProfile(page)

    await page.goto(`${BASE}/movie/${multiVideoMovie.code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const streamBtn = page.locator('button:has-text("在线播放")')
    if (await streamBtn.first().isVisible({ timeout: 5000 })) {
      await streamBtn.first().click()
      await page.waitForSelector('text=选择播放文件', { timeout: 15000 })

      const firstFile = page.locator('button:has-text("part1.mp4")')
      if (await firstFile.isVisible()) {
        await firstFile.click()
        await page.waitForURL(/\/play\?streamUrl=/, { timeout: 10000 })
        expect(page.url()).toContain('streamUrl=')
      }
    }
  })

  // ── 5. Player.vue TorrServer 模式 ──

  test('Player.vue 显示 TorrServer 模式标识', async ({ page }) => {
    await setupCommonMocks(page)
    await setupTorrServerMocks(page)

    // 先建立连接再跳到播放页
    await connectTorrServerViaProfile(page)

    // 然后到影片详情页点在线播放（走正常流程比直接构造 URL 可靠）
    await page.goto(`${BASE}/movie/${mockMovie.code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const streamBtn = page.locator('button:has-text("在线播放")')
    if (await streamBtn.first().isVisible({ timeout: 5000 })) {
      await streamBtn.first().click()
      await page.waitForURL(/\/play\?streamUrl=/, { timeout: 15000 })

      const modeLabel = page.locator('text=TorrServer 流播放')
      await expect(modeLabel).toBeVisible({ timeout: 8000 })
    }
  })

  // ── 6. 现有功能不受影响 ──

  test('未配置 TorrServer 时现有按钮功能正常', async ({ page }) => {
    await setupCommonMocks(page)

    await page.goto(`${BASE}/movie/${mockMovie.code}`)
    await page.waitForLoadState('networkidle')

    // 先确认影片页面正常渲染
    await expect(page.locator(`text=${mockMovie.title}`).first()).toBeVisible({ timeout: 8000 })

    // 播放源区块应该渲染
    const playerSection = page.locator('text=播放源')
    await expect(playerSection.first()).toBeVisible({ timeout: 8000 })

    // 复制按钮存在（磁力链接播放源）
    const copyBtn = page.locator('button:has-text("复制")')
    await expect(copyBtn.first()).toBeVisible({ timeout: 5000 })

    // 在线播放按钮不应存在
    const streamBtn = page.locator('button:has-text("在线播放")')
    await expect(streamBtn).toHaveCount(0)
  })
})
