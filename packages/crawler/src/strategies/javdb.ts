import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'
import { Window } from 'happy-dom'
import { parseMovieInfo, parseMovieList } from './javdb-parser'

export class JavDBStrategy implements MovieCrawlStrategy {
  name = 'javdb'
  baseUrl = 'https://javdb457.com'

  match(url: string): boolean {
    return url.includes('javdb')
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()
    const window = new Window()
    const document = window.document
    document.write(html)
    const result = parseMovieList(document as any)
    window.close()
    return result
  }

  async getMovieInfo(url: string, page: Page): Promise<MovieInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()
    const window = new Window()
    const document = window.document
    document.write(html)
    const info = parseMovieInfo(document as any, url)
    window.close()
    return info
  }
}
