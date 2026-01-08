import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 Puppeteer 的 Page 对象
const mockPage = {
  goto: vi.fn(),
  evaluate: vi.fn((fn) => {
    // 在 happy-dom 环境下直接执行传入的函数
    return fn()
  }),
}

describe('site92Hm Strategy', () => {
  let strategy: any

  beforeEach(async () => {
    // 动态导入策略，确保 document 已经由 happy-dom 准备好（如果需要）
    // 但在 vitest happy-dom 环境中，document 全局可用
    const { Site92Hm } = await import('../src/strategies/site-92hm')
    strategy = new Site92Hm()

    // 加载 Fixture
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/92hm-sample.html'), 'utf-8')
    document.write(html)
  })

  afterEach(() => {
    document.close()
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('should match 92hm urls', () => {
    expect(strategy.match('https://www.92hm.life/book/123')).toBe(true)
    expect(strategy.match('https://other-site.com')).toBe(false)
  })

  it('should parse manga info correctly', async () => {
    // 运行策略的 getMangaInfo，传入 mock page
    // 注意：我们在 mockPage.evaluate 中直接执行了函数，
    // 而此时全局 document 已经是我们加载的 fixture HTML
    const info = await strategy.getMangaInfo('https://www.92hm.life/book/123', mockPage)

    expect(info.title).toBe('My Test Manga Title')
    expect(info.author).toContain('Test Author')
    expect(info.cover).toBe('https://example.com/cover.jpg')
    expect(info.description).toContain('This is a test description')
    expect(info.status).toBe('ongoing') // "连载中" -> ongoing

    expect(info.chapters).toHaveLength(2)
    expect(info.chapters[0].title).toBe('Chapter 2')
    expect(info.chapters[0].slug).toBe('2')
    expect(info.chapters[0].number).toBe(2) // 倒序计算
  })
})
