/* eslint-disable no-console */
/**
 * JavBus 爬虫 - 重构版
 * 使用优化的基类和工具
 */

import type { Page } from 'puppeteer-core'
import type { MovieInfo } from '../lib/strategy'
import type { OptimizedCrawlerConfig } from '../types/config'
import {
  CLOUDFLARE_INDICATORS,
  DEFAULT_COOKIES,
  DEFAULT_HEADERS,
  DRIVER_VERIFY_INDICATORS,
  JAVBUS_MIRRORS,
  TIMEOUTS,
  USER_AGENT,
} from '../constants'
import { OptimizedCrawler } from '../core/optimized-crawler'

export interface JavBusCrawlerConfig extends OptimizedCrawlerConfig {
  startUrl?: string
  useRandomMirror?: boolean
}

export class JavBusCrawler extends OptimizedCrawler {
  private currentPage = 1
  private currentMirror: string

  constructor(config: JavBusCrawlerConfig) {
    super(config)

    // 选择镜像站点
    if (config.useRandomMirror) {
      this.currentMirror = JAVBUS_MIRRORS[Math.floor(Math.random() * JAVBUS_MIRRORS.length)]
      console.log(`🔄 使用随机镜像: ${this.currentMirror}`)
    }
    else {
      this.currentMirror = config.startUrl || JAVBUS_MIRRORS[0]
    }
  }

  /**
   * 准备页面
   */
  private async preparePage(page: Page, url: string): Promise<void> {
    await page.setUserAgent(USER_AGENT)
    await page.setExtraHTTPHeaders(DEFAULT_HEADERS)

    // 设置 Cookie
    const urlObj = new URL(url)
    const domain = urlObj.hostname

    await page.setCookie(
      ...DEFAULT_COOKIES.map(cookie => ({
        ...cookie,
        domain,
        path: '/',
      })),
    )

    // 导航到页面
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation })
    }
    catch (e: any) {
      console.warn(`⚠️  导航超时: ${e.message}`)
    }

    // 检测反爬虫机制
    await this.detectAntiBot(page)
  }

  /**
   * 检测反爬虫机制
   */
  private async detectAntiBot(page: Page): Promise<void> {
    const pageState = await page.evaluate((cloudflareIndicators, driverVerifyIndicators) => {
      const title = document.title
      const bodyText = document.body.textContent || ''

      return {
        title,
        hasCloudflare: cloudflareIndicators.some(indicator => title.includes(indicator)),
        hasDriverVerify: driverVerifyIndicators.some(indicator =>
          title.includes(indicator) || bodyText.includes(indicator),
        ),
        bodyLength: bodyText.length,
      }
    }, CLOUDFLARE_INDICATORS, DRIVER_VERIFY_INDICATORS)

    // 检测 Driver Verify（最严重）
    if (pageState.hasDriverVerify) {
      throw new Error(
        '❌ 检测到 Driver Verify - IP 已被封禁！\n'
        + '建议措施：\n'
        + '  1. 更换 IP 地址（使用代理或 VPN）\n'
        + '  2. 使用镜像站点\n'
        + '  3. 等待 24 小时后重试\n'
        + '  4. 降低爬取频率',
      )
    }

    // 检测 Cloudflare
    if (pageState.hasCloudflare) {
      console.log('⏳ 等待 Cloudflare 挑战...')
      const startTime = Date.now()

      await page.waitForFunction(
        (indicators) => {
          const title = document.title
          return !indicators.some(indicator => title.includes(indicator))
        },
        { timeout: TIMEOUTS.cloudflare },
        CLOUDFLARE_INDICATORS,
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ Cloudflare 挑战通过 (${elapsed}s)`)
    }

    // 检测空白页面
    if (pageState.bodyLength < 100) {
      console.warn(`⚠️  页面内容异常短 (${pageState.bodyLength} 字符)`)
      console.warn(`⚠️  标题: "${pageState.title}"`)
    }
  }

  /**
   * 获取列表页的影片链接
   */
  private async getMovieLinks(page: Page): Promise<string[]> {
    try {
      await page.waitForSelector('.movie-box', { timeout: TIMEOUTS.selector })
    }
    catch {
      console.warn('⚠️  未找到 .movie-box 元素')
    }

    return page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.movie-box'))
      return items
        .map(a => (a as HTMLAnchorElement).href)
        .filter((href): href is string => !!href)
    })
  }

  /**
   * 获取影片信息
   */
  protected async getMovieInfo(url: string, page: Page): Promise<MovieInfo | null> {
    await this.preparePage(page, url)

    try {
      await page.waitForSelector('h3', { timeout: TIMEOUTS.selector })
    }
    catch {
      console.warn('⚠️  未找到标题元素')
      return null
    }

    return page.evaluate((pageUrl) => {
      try {
        const titleEl = document.querySelector('h3')
        if (!titleEl)
          throw new Error('未找到标题')

        const title = titleEl.textContent?.trim() || ''
        const bigImage = document.querySelector('.bigImage img') as HTMLImageElement
        const coverImage = bigImage?.src || ''

        const infoMap: Record<string, string> = {}
        const els = document.querySelectorAll('.info p')
        for (const el of Array.from(els)) {
          const text = el.textContent || ''
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
      catch {
        return null
      }
    }, url)
  }

  /**
   * 运行爬虫
   */
  async run(): Promise<void> {
    console.log('🚀 启动 JavBus 优化爬虫')
    console.log(`📊 配置: 最大影片=${this.config.limits.maxMovies}, 最大页数=${this.config.limits.maxPages}`)
    console.log(`⚙️  并发: 列表=${this.config.concurrency.listPage}, 详情=${this.config.concurrency.detailPage}, 图片=${this.config.concurrency.image}`)

    await this.init()

    try {
      // 主循环：爬取列表页
      while (true) {
        // 检查是否达到限制
        if (this.config.limits.maxPages && this.currentPage > this.config.limits.maxPages) {
          console.log(`✅ 达到最大页数限制: ${this.config.limits.maxPages}`)
          break
        }

        const stats = this.getStats()
        if (this.config.limits.maxMovies && stats.moviesSuccess >= this.config.limits.maxMovies) {
          console.log(`✅ 达到最大影片数限制: ${this.config.limits.maxMovies}`)
          break
        }

        const listUrl = this.currentPage === 1
          ? this.currentMirror
          : `${this.currentMirror}/page/${this.currentPage}`

        console.log(`\n📄 爬取第 ${this.currentPage} 页: ${listUrl}`)

        // 添加列表页任务
        await this.queueManager.addListPageTask(async () => {
          const page = await this.createPage()

          try {
            await this.preparePage(page, listUrl)
            const movieLinks = await this.getMovieLinks(page)

            console.log(`✅ 第 ${this.currentPage} 页找到 ${movieLinks.length} 部影片`)
            this.progressMonitor.incrementMoviesFound(movieLinks.length)

            if (movieLinks.length === 0) {
              console.warn('⚠️  未找到影片，可能已到最后一页')
              return
            }

            // 添加详情页任务
            for (const movieUrl of movieLinks) {
              const currentStats = this.getStats()
              if (this.config.limits.maxMovies && currentStats.moviesSuccess >= this.config.limits.maxMovies) {
                break
              }

              this.queueManager.addDetailPageTask(async () => {
                const detailPage = await this.createPage()
                try {
                  await this.processMovie(movieUrl, detailPage)
                }
                finally {
                  await detailPage.close()
                }
              })
            }
          }
          finally {
            await page.close()
          }
        })

        this.currentPage++

        const currentStats = this.getStats()
        if (this.config.limits.maxMovies && currentStats.moviesSuccess >= this.config.limits.maxMovies) {
          break
        }
      }

      // 等待所有任务完成
      console.log('\n⏳ 等待所有任务完成...')
      await this.queueManager.waitForAll()

      console.log('\n✅ 爬取完成！')
      this.progressMonitor.printStats()
      this.queueManager.printStats()
    }
    catch (error) {
      console.error('\n❌ 爬虫运行失败:', error)
      throw error
    }
    finally {
      await this.cleanup()
    }
  }
}
