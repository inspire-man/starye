import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'

export class JavDBStrategy implements MovieCrawlStrategy {
  name = 'javdb'
  baseUrl = 'https://javdb457.com'

  match(url: string): boolean {
    return url.includes('javdb')
  }

  private async _preparePage(page: Page) {
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    })
  }

  private async _handleChallenge(page: Page) {
    try {
      const title = await page.title()
      if (title.includes('Just a moment')) {
        // eslint-disable-next-line no-console
        console.log(`[${this.name}] Cloudflare challenge detected. Waiting...`)

        await page.waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 60000 })

        // eslint-disable-next-line no-console
        console.log(`[${this.name}] Cloudflare challenge resolved.`)
      }
    }
    catch {
      console.warn(`[${this.name}] Timed out waiting for Cloudflare challenge.`)
    }
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await this._preparePage(page)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await this._handleChallenge(page)

    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.movie-list .item a.box'))
      // eslint-disable-next-line no-console
      console.log(`Found ${items.length} movie items in DOM`)

      if (items.length === 0) {
        // eslint-disable-next-line no-console
        console.log('Body classes:', document.body.className)
        // eslint-disable-next-line no-console
        console.log('Main content HTML:', document.querySelector('.main-content')?.innerHTML.substring(0, 500))
      }

      const movies = items
        .map(a => (a as HTMLAnchorElement).href)
        .filter((href): href is string => !!href)

      const nextEl = document.querySelector('a.pagination-next')
      const next = (nextEl as HTMLAnchorElement)?.href || undefined

      return {
        movies: [...new Set(movies)],
        next,
      }
    }, this.baseUrl)
  }

  async getMovieInfo(url: string, page: Page): Promise<MovieInfo> {
    await this._preparePage(page)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await this._handleChallenge(page)

    return page.evaluate((pageUrl) => {
      function findValueByLabel(doc: Document | Element, label: string): string | undefined {
        const blocks = Array.from(doc.querySelectorAll('.panel-block'))
        for (const block of blocks) {
          const strong = block.querySelector('strong')
          if (strong && strong.textContent?.includes(label)) {
            return block.querySelector('.value')?.textContent?.trim()
          }
        }
        return undefined
      }

      const title = document.querySelector('h2.title .current-title')?.textContent?.trim() || ''
      const code = document.querySelector('h2.title strong:first-child')?.textContent?.trim() || ''
      const coverImage = (document.querySelector('.column-video-cover img') as HTMLImageElement)?.src || undefined

      const dateText = findValueByLabel(document, '日期') || ''
      const releaseDate = dateText ? new Date(dateText).getTime() / 1000 : undefined

      const durationText = findValueByLabel(document, '時長') || ''
      const duration = Number.parseInt(durationText.replace(/\D/g, '')) || undefined

      const publisher = findValueByLabel(document, '片商')
      const series = findValueByLabel(document, '系列')

      const genreEls = Array.from(document.querySelectorAll('.panel-block strong'))
        .find(el => el.textContent?.includes('類別'))
        ?.parentElement
        ?.querySelectorAll('.value a')
      const genres = genreEls ? Array.from(genreEls).map(a => a.textContent?.trim()).filter(Boolean) as string[] : []

      const actorEls = Array.from(document.querySelectorAll('.panel-block strong'))
        .find(el => el.textContent?.includes('演員'))
        ?.parentElement
        ?.querySelectorAll('.value a')
      const actors = actorEls ? Array.from(actorEls).map(a => a.textContent?.trim()).filter(Boolean) as string[] : []

      const magnetItems = Array.from(document.querySelectorAll('#magnets-content .item'))
      const players = magnetItems.map((item, index) => {
        const name = item.querySelector('.name')?.textContent?.trim() || '磁力链接'
        const magnetUrl = (item.querySelector('a[href^="magnet:"]') as HTMLAnchorElement)?.href || ''
        const size = item.querySelector('.meta')?.textContent?.trim() || ''

        return {
          sourceName: `磁力 - ${name}`,
          sourceUrl: magnetUrl,
          quality: size,
          sortOrder: index,
        }
      }).filter(p => p.sourceUrl)

      return {
        title,
        slug: pageUrl.split('/').pop() || '',
        code,
        description: '',
        coverImage,
        releaseDate,
        duration,
        sourceUrl: pageUrl,
        actors,
        genres,
        series,
        publisher,
        isR18: true,
        players,
      }
    }, url)
  }
}
