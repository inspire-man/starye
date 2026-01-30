/* eslint-disable no-console */
import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'

export class JavBusStrategy implements MovieCrawlStrategy {
  name = 'javbus'
  baseUrl = 'https://www.javbus.com'

  match(url: string): boolean {
    return url.includes('javbus.com') || url.includes('dmmbus.cyou') || url.includes('dmmbus.bond')
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await this._preparePage(page, url)

    try {
      await page.waitForSelector('.movie-box', { timeout: 15000 })
    }
    catch {
      // Ignore timeout, might be empty or blocked
      console.warn('[JavBus] Timeout waiting for .movie-box. Checking if blocked...')
    }

    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.movie-box'))
      const movies = items
        .map(a => (a as HTMLAnchorElement).href)
        .filter((href): href is string => !!href)

      if (movies.length === 0) {
        console.log('No movies found. Title:', document.title)
      }

      const nextEl = document.querySelector('a#next')
      const next = (nextEl as HTMLAnchorElement)?.href || undefined

      return {
        movies: [...new Set(movies)],
        next,
      }
    })
  }

  async getMovieInfo(url: string, page: Page): Promise<MovieInfo> {
    await this._preparePage(page, url)

    // Wait for the title to ensure we are on the detail page
    try {
      await page.waitForSelector('h3', { timeout: 15000 })
    }
    catch {
      console.warn('[JavBus] Timeout waiting for content (h3). May be blocked or slow.')
    }

    return page.evaluate((pageUrl) => {
      try {
        const titleEl = document.querySelector('h3')
        if (!titleEl) {
          throw new Error(`Title element not found. Page title: ${document.title}`)
        }
        const title = titleEl.textContent ? titleEl.textContent.trim() : ''
        const bigImage = document.querySelector('.bigImage img')
        const coverImage = bigImage ? bigImage.getAttribute('src') : ''

        const infoMap: Record<string, string> = {}
        const els = document.querySelectorAll('.info p')
        for (const el of Array.from(els)) {
          const text = el.textContent || ''
          // Split by first colon
          const splitIndex = text.indexOf(':')
          if (splitIndex > -1) {
            const key = text.substring(0, splitIndex + 1).trim()
            const value = text.substring(splitIndex + 1).trim()
            infoMap[key] = value
          }
        }

        const code = infoMap['識別碼:'] || title.split(' ')[0]
        const dateText = infoMap['發行日期:']
        const releaseDate = dateText ? new Date(dateText).getTime() / 1000 : 0
        const durationText = infoMap['長度:']
        const duration = Number.parseInt(durationText) || 0
        const publisher = infoMap['發行商:']
        const series = infoMap['系列:']
        // const director = infoMap['導演:']
        const studio = infoMap['製作商:']

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

  private async _preparePage(page: Page, url: string) {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    })

    const domain = new URL(this.baseUrl).hostname.replace('www.', '.')
    const cookies = [
      { name: 'existmag', value: 'all' },
      { name: 'age_verified', value: 'true' },
      { name: 'adult_verified', value: 'true' },
      { name: 'age_verification', value: '1' },
      { name: 'is_adult', value: 'true' },
      { name: 'javbus_age', value: '1' },
      { name: 'age_verification_passed', value: 'true' },
      { name: 'verified_adult', value: 'true' },
    ].map(c => ({ ...c, domain, path: '/', expires: Date.now() / 1000 + 31536000 }))

    await page.setCookie(...cookies)

    console.log(`[JavBus] Navigating to ${url}...`)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    }
    catch (e: any) {
      console.warn(`[JavBus] Navigation timeout/error: ${e.message}. checking page state...`)
    }

    await this._waitForCloudflareChallenge(page)
    await this._handleAgeVerification(page)
  }

  private async _waitForCloudflareChallenge(page: Page) {
    try {
      const hasChallenge = await page.evaluate(() => {
        const challenges = [
          'cf-browser-verification',
          'cf-im-under-attack',
          'cf-challenge-running',
          'cloudflare-turnstile',
          'jschl_vc',
        ]
        return challenges.some(c => document.body.innerHTML.includes(c))
          || document.title.includes('Just a moment')
          || document.title.includes('DDoS protection')
      })

      if (hasChallenge) {
        console.log('[JavBus] Cloudflare challenge detected, waiting...')
        await page.waitForFunction(
          () => {
            const hasC = document.body.innerHTML.includes('cf-browser-verification')
              || document.body.innerHTML.includes('cf-im-under-attack')
              || document.title.includes('Just a moment')
            return !hasC
          },
          { timeout: 60000 },
        )
        console.log('[JavBus] Cloudflare challenge passed (hopefully).')
      }
    }
    catch (e) {
      console.warn('[JavBus] Error checking/waiting for Cloudflare:', e)
    }
  }

  private async _handleAgeVerification(page: Page) {
    try {
      // Check if the modal is visible
      const needsVerification = await page.evaluate(() => {
        const indicators = [
          'Age Verification',
          '年龄认证',
          'age verification',
          '18+',
          'adult content',
        ]
        return indicators.some(i => document.title.includes(i) || document.body?.textContent.toLowerCase().includes(i.toLowerCase()))
      })

      if (!needsVerification)
        return

      console.log('[JavBus] Age verification page detected.')

      // Try clicking common buttons
      const clicked = await page.evaluate(() => {
        const selectors = [
          'input[type="submit"]',
          'button[type="submit"]',
          '.btn-primary',
          '#enter',
          '#age-verify',
        ]
        // Try checkboxes first
        const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
        if (checkbox && !checkbox.checked)
          checkbox.click()

        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement
          if (el) {
            el.click()
            return true
          }
        }
        // Try finding by text
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
        for (const btn of buttons) {
          const txt = btn.textContent?.toLowerCase() || ''
          if (txt.includes('enter') || txt.includes('yes') || txt.includes('18') || txt.includes('进入')) {
            (btn as HTMLElement).click()
            return true
          }
        }
        return false
      })

      if (clicked) {
        console.log('[JavBus] Clicked verification button. Waiting for nav...')
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      }
      else {
        console.warn('[JavBus] Could not find verification button.')
      }

      // Check again
      const stillStuck = await page.evaluate(() => document.title.includes('Age Verification'))
      if (stillStuck) {
        console.log('[JavBus] Still stuck. Forcing cookies and reloading...')
        await page.evaluate(() => {
          const cookies = [
            'age_verified=true',
            'adult_verified=true',
            'age_verification=1',
            'is_adult=true',
            'javbus_age=1',
            'existmag=all',
          ]
          cookies.forEach(c => document.cookie = `${c}; path=/; max-age=31536000`)
        })
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
      }
    }
    catch (e) {
      console.warn('[JavBus] Age verification logic error:', e)
    }
  }
}
