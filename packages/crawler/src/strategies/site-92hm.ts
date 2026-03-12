import type { Page } from 'puppeteer-core'
import type { CrawlContext } from '../lib/anti-detection'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'
import got from 'got'
import { Window } from 'happy-dom'
import { DEFAULT_MANGA_ANTI_DETECTION } from '../config/crawl.config'
import { CrawlerSession, DelayStrategy, ErrorClassifier, SuccessRateMonitor } from '../lib/anti-detection'
import { parseChapterContent, parseMangaInfo, parseMangaList } from './site-92hm-parser'

export class Site92Hm implements CrawlStrategy {
  name = '92hm'
  baseUrl = 'https://www.92hm.life'

  private session: CrawlerSession
  private monitor: SuccessRateMonitor
  private delayStrategy: DelayStrategy
  private initialized = false

  constructor() {
    this.session = new CrawlerSession(this.baseUrl)
    this.monitor = new SuccessRateMonitor(DEFAULT_MANGA_ANTI_DETECTION.successRateWindow)
    this.delayStrategy = new DelayStrategy(DEFAULT_MANGA_ANTI_DETECTION)
  }

  match(url: string): boolean {
    return url.includes('92hm.life') || url.includes('92hm.net')
  }

  /**
   * 智能页面导航：集成反检测和错误恢复
   */
  private async _smartGoto(page: Page, url: string): Promise<void> {
    // 首次调用时初始化会话
    if (!this.initialized) {
      await this.session.initialize(page)
      this.initialized = true
    }

    // 检查会话是否需要刷新
    if (this.session.shouldRefresh()) {
      await this.session.refreshSession(page)
    }

    // 应用 Cookie
    await this.session.applyCookies(page)

    // 创建爬取上下文
    const context: CrawlContext = {
      url,
      retries: 0,
      currentDelay: 0,
      currentTimeout: 90000,
      headerIndex: 0,
      maxRetries: DEFAULT_MANGA_ANTI_DETECTION.maxRetries,
      baseDelay: DEFAULT_MANGA_ANTI_DETECTION.baseDelay,
      maxDelay: DEFAULT_MANGA_ANTI_DETECTION.maxDelay,
    }

    // 智能延迟
    const delay = this.delayStrategy.calculateDelay()
    if (delay > 0) {
      // console.log(`[Site92Hm] ⏳ Waiting ${(delay / 1000).toFixed(1)}s before ${url}`)
      await this._sleep(delay)
    }

    // 检查是否需要降速
    if (this.monitor.shouldSlowDown(DEFAULT_MANGA_ANTI_DETECTION.lowSuccessRateThreshold)) {
      this.delayStrategy.increaseMultiplier(DEFAULT_MANGA_ANTI_DETECTION.autoSlowdownMultiplier)
    }

    // 带错误恢复的导航
    let currentContext = context
    while (true) {
      try {
        // 应用请求头（可能轮换）
        await this.session.applyHeaders(page, currentContext.headerIndex)

        // 导航
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: currentContext.currentTimeout,
        })

        // 成功
        this.monitor.record(true)
        return
      }
      catch (error) {
        this.monitor.record(false)

        const { action, updatedContext } = await ErrorClassifier.handleCrawlError(
          error as Error,
          currentContext,
          DEFAULT_MANGA_ANTI_DETECTION,
        )

        if (action === 'RETRY') {
          currentContext = updatedContext
          continue
        }
        else if (action === 'SKIP') {
          throw error // 抛出错误，让上层处理
        }
        else if (action === 'ABORT_ALL') {
          throw new Error(`IP possibly banned. Aborting all tasks. Original error: ${(error as Error).message}`)
        }
      }
    }
  }

  private async _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取成功率统计
   */
  getSuccessRateStats() {
    return this.monitor.getStats()
  }

  async getMangaList(url: string, page: Page): Promise<{ mangas: string[], next?: string }> {
    await this._smartGoto(page, url)
    const html = await page.content()

    const window = new Window()
    const document = window.document
    document.write(html)

    const result = parseMangaList(document as unknown as Document)

    // ✅ 将相对路径转换为绝对 URL
    const mangas = result.mangas.map((mangaUrl) => {
      if (mangaUrl.startsWith('http')) {
        return mangaUrl // 已经是完整 URL
      }
      // 相对路径，拼接 baseUrl
      return `${this.baseUrl}${mangaUrl.startsWith('/') ? '' : '/'}${mangaUrl}`
    })

    // ✅ 处理 next 页面 URL
    let next = result.next
    if (next && !next.startsWith('http')) {
      next = `${this.baseUrl}${next.startsWith('/') ? '' : '/'}${next}`
    }

    if (mangas.length === 0 && !next) {
      console.warn(`⚠️ No mangas found for: ${url}`)
    }

    window.close()
    return { mangas, next }
  }

  async getMangaInfo(url: string, page: Page): Promise<MangaInfo> {
    await this._smartGoto(page, url)
    const html = await page.content()

    const window = new Window()
    const document = window.document
    document.write(html)

    const info = parseMangaInfo(document as unknown as Document, url)

    // ✅ 标准化 chapters 中的相对 URL
    if (info.chapters) {
      info.chapters = info.chapters.map((chapter) => {
        let chapterUrl = chapter.url
        if (chapterUrl && !chapterUrl.startsWith('http')) {
          chapterUrl = `${this.baseUrl}${chapterUrl.startsWith('/') ? '' : '/'}${chapterUrl}`
        }
        return {
          ...chapter,
          url: chapterUrl,
        }
      })
    }

    window.close()
    return info
  }

  async getChapterContent(url: string, page: Page): Promise<ChapterContent> {
    const enrichResult = (data: ReturnType<typeof parseChapterContent>) => {
      // Extract slugs from URL or data
      // TODO: Handle baseUrl dynamically if possible, though strict replace is fine for now
      const pathOnly = url.replace(/^https?:\/\/[^/]+/, '')
      const parts = pathOnly.split('/').filter(Boolean)

      let comicSlug = data.extractedComicSlug
      let chapterSlug = ''

      // URL Structure: /chapter/{id} OR /read/{comicId}/{chapterId}
      if (parts[0] === 'chapter') {
        chapterSlug = parts[1]
      }
      else if (parts[0] === 'read') {
        if (!comicSlug)
          comicSlug = parts[1]
        chapterSlug = parts[2]
      }

      if (!comicSlug) {
        console.warn(`⚠️ Could not determine comicSlug for ${url}. Sync might fail.`)
      }

      // ✅ 将相对路径的 prev/next 转换为绝对 URL
      const normalizeUrl = (relativeUrl?: string) => {
        if (!relativeUrl)
          return undefined
        if (relativeUrl.startsWith('http'))
          return relativeUrl
        return `${this.baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`
      }

      return {
        title: data.title,
        images: data.images,
        prev: normalizeUrl(data.prev),
        next: normalizeUrl(data.next),
        comicSlug: comicSlug || '',
        chapterSlug,
      }
    }

    const parseFromHtml = (html: string) => {
      const window = new Window()
      const document = window.document
      document.write(html)
      const data = parseChapterContent(document as unknown as Document)
      window.close()
      return data
    }

    // 1. Fast Path: Try got first (avoid browser overhead)
    try {
      const response = await got(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        },
        timeout: { request: 5000 },
        retry: { limit: 0 },
      })

      if (response.statusCode === 200) {
        const data = parseFromHtml(response.body)
        if (data.images.length > 0) {
          console.warn(`⚡ [FastPath] Parsed ${data.images.length} images via HappyDOM.`)
          return enrichResult(data)
        }
      }
    }
    catch {
      // Ignore error and fall back to Puppeteer
    }

    // 2. Slow Path: Puppeteer
    await this._smartGoto(page, url)
    const html = await page.content()
    const data = parseFromHtml(html)

    return enrichResult(data)
  }
}
