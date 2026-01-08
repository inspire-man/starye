import type { Page } from 'puppeteer-core'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'
import { Window } from 'happy-dom'
import { parseChapterContent, parseMangaInfo } from './site-92hm-parser'

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

    // Reuse logic (could also be in parser if complex)
    const mangas = Array.from(document.querySelectorAll('.mh-item a, .item-lg a'))
      .map(a => a.getAttribute('href'))
      .filter((href): href is string => !!href && href.includes('/book/'))
      .filter((v, i, a) => a.indexOf(v) === i)

    const nextEl = document.querySelector('a#nextPage')
    const next = nextEl?.getAttribute('href') || undefined

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
    await page.goto(url, { waitUntil: 'networkidle2' })
    const html = await page.content()

    const window = new Window()
    const document = window.document
    document.write(html)

    const data = parseChapterContent(document as unknown as Document)

    window.close()

    // Extract slugs from URL: /read/123/456
    const parts = url.replace('https://www.92hm.life', '').split('/').filter(Boolean)
    const comicSlug = parts[1] || ''
    const chapterSlug = parts[2] || ''

    return { ...data, comicSlug, chapterSlug }
  }
}
