/* eslint-disable no-console */
import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'

export class JavBusStrategy implements MovieCrawlStrategy {
  name = 'javbus'
  baseUrl = 'https://www.javbus.com'

  // 镜像站点列表，用于自动切换
  private mirrorSites = [
    'https://www.javbus.com',
    'https://busdmm.bond',
    'https://dmmbus.cyou',
    'https://cdnbus.cyou',
    'https://javsee.cyou',
  ]

  private currentMirrorIndex = 0
  private requestCount = 0
  private lastRequestTime = 0

  match(url: string): boolean {
    return url.includes('javbus.com')
      || url.includes('dmmbus.cyou')
      || url.includes('dmmbus.bond')
      || url.includes('busdmm.bond')
      || url.includes('cdnbus.cyou')
      || url.includes('javsee.cyou')
  }

  /**
   * 智能延迟：根据请求频率自动调整
   */
  private async _smartDelay() {
    this.requestCount++
    const now = Date.now()

    // 计算距离上次请求的时间
    const timeSinceLastRequest = now - this.lastRequestTime

    // 基础延迟：3-6秒
    let baseDelay = Math.random() * 3000 + 3000

    // 如果请求过于频繁（小于2秒），增加延迟
    if (timeSinceLastRequest < 2000) {
      baseDelay += 5000
      console.log('[JavBus] ⚠️  请求过于频繁，增加延迟...')
    }

    // 每10个请求后，增加一次长延迟
    if (this.requestCount % 10 === 0) {
      baseDelay += Math.random() * 5000 + 5000
      console.log('[JavBus] 💤 已完成 10 个请求，休息一下...')
    }

    console.log(`[JavBus] ⏳ 等待 ${(baseDelay / 1000).toFixed(1)}s...`)
    await new Promise(resolve => setTimeout(resolve, baseDelay))

    this.lastRequestTime = Date.now()
  }

  /**
   * 切换到下一个镜像站点
   */
  private _switchMirror() {
    this.currentMirrorIndex = (this.currentMirrorIndex + 1) % this.mirrorSites.length
    this.baseUrl = this.mirrorSites[this.currentMirrorIndex]
    console.log(`[JavBus] 🔄 切换到镜像站点: ${this.baseUrl}`)
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await this._smartDelay() // 添加智能延迟
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
    await this._smartDelay() // 添加智能延迟
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
        const bigImage = document.querySelector('.bigImage img') as HTMLImageElement
        const coverImage = bigImage ? bigImage.src : ''

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
    // Use a very recent and standard Chrome User-Agent
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    await page.setUserAgent(UA)

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    })

    // 添加随机延迟，模拟真实用户行为
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))
    })

    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const rootDomain = domain.split('.').slice(-2).join('.')

    const domains = [domain, `.${domain}`, rootDomain, `.${rootDomain}`]
    const uniqueDomains = [...new Set(domains)]

    const cookies = []
    for (const d of uniqueDomains) {
      cookies.push(
        { name: 'existmag', value: 'all', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 },
        { name: 'age_verified', value: '1', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 },
        { name: 'dv', value: '1', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 }, // Potential driver-verify bypass
      )
    }

    await page.setCookie(...cookies)

    console.log(`[JavBus] Navigating to ${url}...`)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    }
    catch (e: any) {
      console.warn(`[JavBus] Navigation timeout/error: ${e.message}. checking page state...`)
    }

    // 添加随机鼠标移动，模拟真实用户
    await page.mouse.move(Math.random() * 1000, Math.random() * 800)
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
    })

    await this._waitForCloudflareChallenge(page)
    await this._handleAgeVerification(page)
  }

  private async _waitForCloudflareChallenge(page: Page) {
    try {
      const pageState = await page.evaluate(() => {
        const title = document.title
        const bodyText = document.body.textContent || ''
        return {
          title,
          hasCloudflare: title.includes('Just a moment') || title.includes('DDoS protection') || title.includes('Security Check'),
          hasDriverVerify: title.includes('driver-verify') || bodyText.includes('Driver Knowledge Test'),
          bodyLength: bodyText.length,
        }
      })

      // 检测 driver-verify（最严重的封禁）
      if (pageState.hasDriverVerify) {
        console.error('[JavBus] ❌ CRITICAL: "Driver Knowledge Test" detected!')
        console.error('[JavBus] 你的 IP/浏览器指纹已被标记为机器人')
        console.error('[JavBus] 建议措施：')
        console.error('[JavBus]   1. 更换 IP 地址（使用代理或 VPN）')
        console.error('[JavBus]   2. 使用镜像站点（如 busdmm.bond）')
        console.error('[JavBus]   3. 等待 24 小时后重试')
        console.error('[JavBus]   4. 降低爬取频率（每次间隔 10 秒以上）')
        throw new Error('Driver verification challenge detected - IP is blocked')
      }

      // 检测 Cloudflare 挑战
      if (pageState.hasCloudflare) {
        console.log('[JavBus] ⏳ Cloudflare challenge detected, waiting up to 60s...')
        const startTime = Date.now()

        await page.waitForFunction(
          () => {
            const title = document.title
            return !title.includes('Just a moment') && !title.includes('DDoS protection') && !title.includes('Security Check')
          },
          { timeout: 60000 },
        )

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`[JavBus] ✅ Cloudflare challenge passed in ${elapsed}s`)

        // 挑战通过后再等待一小段时间
        await page.evaluate(() => {
          return new Promise(resolve => setTimeout(resolve, 1000))
        })
      }

      // 检测空白页面或异常
      if (pageState.bodyLength < 100) {
        console.warn(`[JavBus] ⚠️  Page content is suspiciously short (${pageState.bodyLength} chars)`)
        console.warn(`[JavBus] Title: "${pageState.title}"`)
      }
    }
    catch (e: any) {
      if (e.message.includes('Driver verification')) {
        throw e // 重新抛出 driver-verify 错误
      }
      console.warn('[JavBus] Error checking/waiting for Cloudflare:', e.message)
    }
  }

  private async _handleAgeVerification(page: Page) {
    try {
      const pageInfo = await page.evaluate(() => {
        const title = document.title
        const url = location.href
        return { title, url }
      })

      if (pageInfo.url.includes('driver-verify')) {
        console.error('[JavBus] ❌ CRITICAL: "Driver Knowledge Test" detected. Your IP/Browser is flagged as a bot.')
        console.log('[JavBus] Tip: Try using a mirror site (e.g., busdmm.bond) or a high-quality residential proxy.')
        return
      }

      const needsVerification = await page.evaluate(() => {
        const indicators = ['Age Verification', '年龄认证', 'age verification', '18+', 'adult content']
        const title = document.title
        const bodyText = document.body.textContent || ''
        return indicators.some(i => title.includes(i) || (bodyText.length < 1000 && bodyText.toLowerCase().includes(i.toLowerCase())))
      })

      if (!needsVerification)
        return

      console.log(`[JavBus] Age verification detected. Attempting bypass...`)

      const clicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, div, span'))
        const keywords = ['成年', 'ENTER', 'YES', '进入', '進入']
        for (const link of links) {
          const txt = link.textContent?.trim() || ''
          if (keywords.some(k => txt.includes(k)) && txt.length < 20) {
            (link as HTMLElement).click()
            return true
          }
        }
        return false
      })

      if (clicked) {
        console.log('[JavBus] Clicked verification button. Waiting for nav...')
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
      }
    }
    catch (e) {
      console.warn('[JavBus] Age verification logic error:', e)
    }
  }
}
