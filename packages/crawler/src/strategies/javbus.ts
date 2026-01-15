import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'

export class JavBusStrategy implements MovieCrawlStrategy {
  name = 'javbus'
  baseUrl = 'https://www.javbus.com'

  match(url: string): boolean {
    return url.includes('javbus.com')
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await this._handleAgeVerification(page)
    try {
      await page.waitForSelector('.movie-box', { timeout: 15000 })
    }
    catch {
      // Ignore timeout
    }

    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.movie-box'))
      const movies = items
        .map(a => (a as HTMLAnchorElement).href)
        .filter((href): href is string => !!href)

      const nextEl = document.querySelector('a#next')
      const next = (nextEl as HTMLAnchorElement)?.href || undefined

      return {
        movies: [...new Set(movies)],
        next,
      }
    })
  }

  async getMovieInfo(url: string, page: Page): Promise<MovieInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await this._handleAgeVerification(page)

    // Wait for the title to ensure we are on the detail page
    try {
      await page.waitForSelector('h3', { timeout: 15000 })
    }
    catch {
      console.warn('[JavBus] Timeout waiting for content. May be blocked or slow.')
    }

    return page.evaluate((pageUrl) => {
      try {
        const titleEl = document.querySelector('h3')
        if (!titleEl) {
          throw new Error('Title element not found')
        }
        const title = titleEl.textContent ? titleEl.textContent.trim() : ''
        const bigImage = document.querySelector('.bigImage img')
        const coverImage = bigImage ? bigImage.getAttribute('src') : ''

        function getInfo(label: string) {
          const els = document.querySelectorAll('.info p')
          for (const el of Array.from(els)) {
            if (el.textContent && el.textContent.includes(label)) {
              return el.textContent.replace(label, '').trim()
            }
          }
          return ''
        }

        const code = getInfo('識別碼:') || title.split(' ')[0]
        const dateText = getInfo('發行日期:')
        const releaseDate = dateText ? new Date(dateText).getTime() / 1000 : 0
        const durationText = getInfo('長度:')
        const duration = Number.parseInt(durationText) || 0
        const publisher = getInfo('發行商:')
        const series = getInfo('系列:')
        // const director = getInfo('導演:')
        const studio = getInfo('製作商:')

        const genres: string[] = []
        const genreEls = document.querySelectorAll('.genre label a')
        for (const el of Array.from(genreEls)) {
          if (el.textContent)
            genres.push(el.textContent.trim())
        }

        const actors: string[] = []
        const actorEls = document.querySelectorAll('.star-name a')
        for (const el of Array.from(actorEls)) {
          if (el.textContent)
            actors.push(el.textContent.trim())
        }

        return {
          title,
          slug: pageUrl.split('/').pop() || '',
          code,
          description: '',
          coverImage: coverImage || '',
          releaseDate,
          duration,
          sourceUrl: pageUrl,
          actors,
          genres,
          series,
          publisher: publisher || studio,
          isR18: true,
          players: [],
        }
      }
      catch (e: any) {
        return {
          title: `ERROR: ${e.message}`,
          slug: pageUrl.split('/').pop() || '',
          code: 'ERROR',
          sourceUrl: pageUrl,
          description: e.message,
          isR18: false,
          actors: [],
          genres: [],
          players: [],
        }
      }
    }, url)
  }

  private async _handleAgeVerification(page: Page) {
    try {
      const verifyBtn = await page.$('#ageVerify input[type="submit"]')
      if (verifyBtn) {
        // console.log('[JavBus] Found age verification, handling...')
        await page.click('#ageVerify input[type="checkbox"]')
        await new Promise(r => setTimeout(r, 100))
        await verifyBtn.click()
        // Wait for an element that only exists on the detail page
        await page.waitForSelector('.bigImage', { timeout: 15000 })
        // console.log('[JavBus] Age verification passed.')
      }
    }
    catch {
      // console.warn('[JavBus] Age verification failed:', e.message)
    }
  }
}
