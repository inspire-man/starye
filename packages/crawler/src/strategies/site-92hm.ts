import type { Page } from 'puppeteer-core'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'
import * as cheerio from 'cheerio'
import got from 'got'
import { Window } from 'happy-dom'
import { parseMangaInfo } from './site-92hm-parser'

export class Site92Hm implements CrawlStrategy {
  name = '92hm'
  baseUrl = 'https://www.92hm.life'

  match(url: string): boolean {
    return url.includes('92hm.life') || url.includes('92hm.net')
  }

  async getMangaList(url: string, page: Page): Promise<{ mangas: string[], next?: string }> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()

    // Parse locally
    const window = new Window()
    const document = window.document
    document.write(html)

    // 检测错误页面 (如 ThinkPHP 错误页)
    if (document.title.includes('系统发生错误') || document.body.textContent?.includes('PDOException')) {
      console.warn(`⚠️ Target site returned error page for: ${url}`)
      window.close()
      return { mangas: [], next: undefined }
    }

    // Reuse logic (could also be in parser if complex)
    // 增强选择器：同时涵盖列表页常用的 .mh-item 和搜索结果页可能用到的其他类名
    // 使用更通用的策略：查找所有 href 包含 /book/ 的链接
    const mangas = Array.from(document.querySelectorAll('a'))
      .map(a => a.getAttribute('href'))
      .filter((href): href is string => !!href && (href.includes('/book/') || href.match(/\/book\/\d+/) !== null))
      // 过滤掉非详情页链接并去重
      .filter(u => !u.includes('booklist') && !u.includes('history'))
      .filter((v, i, a) => a.indexOf(v) === i)

    // 增强的下一页提取逻辑
    let next: string | undefined
    const allLinks = Array.from(document.querySelectorAll('a'))

    // 1. 优先尝试文本匹配
    const nextLinkByText = allLinks.find((a) => {
      const text = a.textContent?.trim() || ''
      return text.includes('下一页') || text.includes('Next') || text === '>' || text === '»'
    })

    if (nextLinkByText) {
      next = nextLinkByText.getAttribute('href') || undefined
    }
    // 2. 兜底尝试常见的分页选择器
    else {
      const nextEl = document.querySelector('a#nextPage, a.next, .pagination a:last-child, .page a:last-child')
      next = nextEl?.getAttribute('href') || undefined
    }

    // 确保 next 是相对路径或绝对路径，并清理
    if (next && next.startsWith('javascript')) {
      next = undefined
    }

    window.close()
    return { mangas, next }
  }

  async getMangaInfo(url: string, page: Page): Promise<MangaInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()

    const window = new Window()
    const document = window.document
    document.write(html)

    const info = parseMangaInfo(document as unknown as Document, url)

    window.close()
    return info
  }

  async getChapterContent(url: string, page: Page): Promise<ChapterContent> {
    const parseResult = (data: any) => {
      // Extract slugs from URL or data
      const parts = url.replace('https://www.92hm.life', '').split('/').filter(Boolean)

      let comicSlug = data.extractedComicSlug
      let chapterSlug = ''

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

      return { ...data, comicSlug, chapterSlug }
    }

    // 1. Fast Path: Try Cheerio first
    try {
      const response = await got(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        },
        timeout: { request: 5000 },
        retry: { limit: 0 },
      })

      if (response.statusCode === 200) {
        const $ = cheerio.load(response.body)
        const title = $('h1.title, h1, .title').first().text().trim()
        const prev = $('.fanye a:first-child[href], a.prev, .prev a').attr('href')
        const next = $('.fanye a:last-child[href], a.next, .next a').attr('href')

        const images = $('.comicpage img, .comiclist img, .comic-content img, #content img, .rd-article-wr img, .reader-main img').toArray().map(el => $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '').filter(src => src && !src.includes('/ad/') && !src.includes('logo') && !src.includes('wxqrcode.jpg')).filter((v, i, a) => a.indexOf(v) === i)

        let extractedComicSlug = ''
        const comicHref = $('a.comic-name').attr('href') || $('.breadcrumb a[href*="/book/"]').attr('href') || $('.path a[href*="/book/"]').attr('href')
        if (comicHref) {
          const match = comicHref.match(/\/book\/(\d+)/)
          if (match)
            extractedComicSlug = match[1]
        }

        if (images.length > 0) {
          console.warn(`⚡ [FastPath] Parsed ${images.length} images via Cheerio.`)
          return parseResult({ title, images, prev, next, extractedComicSlug })
        }
      }
    }
    catch {
      // Ignore error and fall back to Puppeteer
    }

    // 2. Slow Path: Puppeteer
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Execute parsing directly in browser context
    const data = await page.evaluate(() => {
      const title = document.querySelector('h1.title, h1, .title')?.textContent?.trim() || ''

      const rawImages = Array.from(document.querySelectorAll('.comicpage img, .comiclist img, .comic-content img, #content img, .rd-article-wr img, .reader-main img'))

      const mappedImages = rawImages.map(img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '')

      const images = mappedImages
        .filter(src => src && !src.includes('/ad/') && !src.includes('logo') && !src.includes('wxqrcode.jpg'))
        .filter((v, i, a) => a.indexOf(v) === i)

      const prev = document.querySelector('.fanye a:first-child[href], a.prev, .prev a')?.getAttribute('href') || undefined
      const next = document.querySelector('.fanye a:last-child[href], a.next, .next a')?.getAttribute('href') || undefined

      // Extract comic ID from page content (breadcrumbs or hidden fields)
      let extractedComicSlug = ''
      const comicLink = document.querySelector('a.comic-name, .breadcrumb a[href*="/book/"], .path a[href*="/book/"]')
      if (comicLink) {
        const href = comicLink.getAttribute('href')
        const match = href?.match(/\/book\/(\d+)/)
        if (match)
          extractedComicSlug = match[1]
      }

      return { title, images, prev, next, extractedComicSlug }
    })

    return parseResult(data)
  }
}
