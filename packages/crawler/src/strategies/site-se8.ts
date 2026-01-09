import type { Page } from 'puppeteer-core'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'

export class SiteSe8 implements CrawlStrategy {
  name = 'se8'
  baseUrl = 'https://se8.us'

  match(url: string): boolean {
    return url.includes('se8.us')
  }

  async getMangaInfo(url: string, page: Page): Promise<MangaInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const info = await page.evaluate(() => {
      // 标题去掉 "- 韩漫库..." 后缀
      const fullTitle = document.querySelector('h1')?.textContent?.trim() || 'Unknown Title'
      const title = fullTitle.split('-')[0].trim()

      const cover = document.querySelector('.de-info__cover img, .lazy')?.getAttribute('src') || ''
      const author = document.querySelector('.author, .de-info__author')?.textContent?.trim()
      const desc = document.querySelector('.de-info__description, .intro')?.textContent?.trim()

      const statusText = document.querySelector('.de-info__status, .status')?.textContent?.trim()
      const status = statusText?.includes('连载') ? 'serializing' : 'completed'

      // Selector based on inspection: ul.chapter__list-box li a
      const chapterEls = Array.from(document.querySelectorAll('.chapter__list-box li a'))

      const chapters = chapterEls.map((el, index) => ({
        title: el.textContent?.trim() || `Chapter ${index + 1}`,
        slug: el.getAttribute('href')?.split('/').filter(Boolean).pop() || '',
        url: el.getAttribute('href') || '',
        number: index + 1, // Se8 appears to be asc order
      })).filter(c => c.url)

      return { title, cover, author, description: desc, status, chapters }
    })

    return {
      ...info,
      status: info.status as 'serializing' | 'completed',
      slug: url.split('/').filter(Boolean).pop() || '',
    }
  }

  async getChapterContent(url: string, page: Page): Promise<ChapterContent> {
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || ''

      // Se8 reading page image selector (heuristic)
      const images = Array.from(document.querySelectorAll('.rd-article-wr img, .comic-list img, .lazy'))
        .map(img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src'))
        .filter((src): src is string => !!src && !src.includes('ad'))

      const prev = document.querySelector('a.prev')?.getAttribute('href') || undefined
      const next = document.querySelector('a.next')?.getAttribute('href') || undefined

      return { title, images, prev, next }
    })

    // Extract slugs from URL: /comic/slug/chapter-slug
    const parts = url.replace('https://se8.us', '').split('/').filter(Boolean)
    // Assuming structure /comic/SLUG/CHAPTER_SLUG or similar
    // Often se8 is /manhua/SLUG/CHAPTER_ID.html
    const comicSlug = parts[1] || '' // index 0 is 'manhua' probably
    const chapterSlug = parts[2]?.replace('.html', '') || ''

    return { ...data, comicSlug, chapterSlug }
  }
}
