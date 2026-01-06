import type { Page } from 'puppeteer-core'
import type { ChapterContent, CrawlStrategy, MangaInfo } from '../lib/strategy'

export class Site92Hm implements CrawlStrategy {
  name = '92hm'
  baseUrl = 'https://www.92hm.life'

  match(url: string): boolean {
    return url.includes('92hm.life') || url.includes('92hm.net')
  }

  async getMangaInfo(url: string, page: Page): Promise<MangaInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // 猜测的选择器，需要根据实际 DOM 调整
    // 假设标题在 h1，封面在 .cover img，章节在 .chapter-list a
    const info = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || 'Unknown Title'
      const cover = document.querySelector('.cover img, .book-cover img')?.getAttribute('src') || ''
      const author = document.querySelector('.author, .info p:nth-child(2)')?.textContent?.trim()
      const desc = document.querySelector('.intro, #intro')?.textContent?.trim()

      // Fixed selector based on inspection: ul#detail-list-select li a
      const chapterEls = Array.from(document.querySelectorAll('#detail-list-select li a, .detail-list-select li a'))

      const chapters = chapterEls.map((el, index) => ({
        title: el.textContent?.trim() || `Chapter ${index + 1}`,
        slug: el.getAttribute('href')?.split('/').pop() || '',
        url: el.getAttribute('href') || '',
        number: chapterEls.length - index, // Assuming list is desc
      })).filter(c => c.url)

      return { title, cover, author, description: desc, chapters }
    })

    return {
      ...info,
      slug: url.split('/').pop() || '',
    }
  }

  async getChapterContent(url: string, page: Page): Promise<ChapterContent> {
    await page.goto(url, { waitUntil: 'networkidle2' }) // Wait for images to load

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || ''

      // 查找所有可能的图片容器
      const images = Array.from(document.querySelectorAll('.comic-content img, #content img, .rd-article-wr img'))
        .map(img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '')
        .filter(src => src && !src.includes('ad')) // Filter ads

      return { title, images }
    })

    return data
  }
}
