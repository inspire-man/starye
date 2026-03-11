import type { Page } from 'puppeteer-core'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'
import got from 'got'
import { Window } from 'happy-dom'
import { parseChapterContent, parseMangaInfo, parseMangaList } from './site-92hm-parser'

/**
 * 重试包装器：处理网络超时和临时错误
 */
async function retryPageGoto(
  page: Page,
  url: string,
  options: { waitUntil: 'domcontentloaded', timeout: number },
  maxRetries = 3,
): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, options)
      return // 成功
    }
    catch (error) {
      lastError = error as Error
      const isTimeout = error instanceof Error && error.message.includes('Navigation timeout')

      if (attempt < maxRetries && isTimeout) {
        console.warn(`⚠️ 导航超时 (尝试 ${attempt}/${maxRetries}): ${url}`)
        console.warn(`   等待 ${attempt * 2} 秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000)) // 指数退避
        continue
      }

      throw error // 非超时错误或已达最大重试次数
    }
  }

  throw lastError || new Error('Unknown error during retry')
}

export class Site92Hm implements CrawlStrategy {
  name = '92hm'
  baseUrl = 'https://www.92hm.life'

  match(url: string): boolean {
    return url.includes('92hm.life') || url.includes('92hm.net')
  }

  async getMangaList(url: string, page: Page): Promise<{ mangas: string[], next?: string }> {
    await retryPageGoto(page, url, { waitUntil: 'domcontentloaded', timeout: 90000 })
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
    await retryPageGoto(page, url, { waitUntil: 'domcontentloaded', timeout: 90000 })
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
    await retryPageGoto(page, url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    const html = await page.content()
    const data = parseFromHtml(html)

    return enrichResult(data)
  }
}
