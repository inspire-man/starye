/* eslint-disable no-console */
/**
 * 优化的 JavBus 爬虫 - 使用队列管理器
 * 支持高效并发处理和 GitHub Actions 运行
 */

import type { Page } from 'puppeteer-core'
import type { OptimizedCrawlerConfig } from '../lib/optimized-crawler'
import type { MovieInfo } from '../lib/strategy'
import { OptimizedCrawler } from '../lib/optimized-crawler'

export interface JavBusCrawlerConfig extends OptimizedCrawlerConfig {
  startUrl?: string // 起始 URL
  useRandomMirror?: boolean // 是否随机使用镜像站点
}

export class JavBusCrawler extends OptimizedCrawler {
  private currentPage = 1
  private mirrorSites = [
    'https://www.javbus.com',
    'https://busdmm.bond',
    'https://dmmbus.cyou',
    'https://cdnbus.cyou',
    'https://javsee.cyou',
  ]

  private currentMirror: string

  constructor(config: JavBusCrawlerConfig) {
    super(config)

    // 选择镜像站点
    if (config.useRandomMirror) {
      this.currentMirror = this.mirrorSites[Math.floor(Math.random() * this.mirrorSites.length)]
      console.log(`🔄 使用随机镜像: ${this.currentMirror}`)
    }
    else {
      this.currentMirror = config.startUrl || this.mirrorSites[0]
    }
  }

  /**
   * 准备页面（设置 Cookie、User-Agent 等）
   */
  private async preparePage(page: Page, url: string) {
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    await page.setUserAgent(UA)

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    })

    // 设置 Cookie
    const urlObj = new URL(url)
    const domain = urlObj.hostname

    await page.setCookie(
      { name: 'existmag', value: 'all', domain, path: '/' },
      { name: 'age_verified', value: '1', domain, path: '/' },
      { name: 'dv', value: '1', domain, path: '/' },
    )

    // 导航到页面
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    }
    catch (e: any) {
      console.warn(`⚠️  导航超时: ${e.message}`)
    }

    // 检测 Cloudflare
    await this.waitForCloudflare(page)
  }

  /**
   * 等待 Cloudflare 挑战完成
   */
  private async waitForCloudflare(page: Page) {
    try {
      const pageState = await page.evaluate(() => {
        const title = document.title
        const bodyText = document.body.textContent || ''
        return {
          title,
          hasCloudflare: title.includes('Just a moment') || title.includes('DDoS protection'),
          hasDriverVerify: title.includes('driver-verify') || bodyText.includes('Driver Knowledge Test'),
        }
      })

      if (pageState.hasDriverVerify) {
        throw new Error('❌ 检测到 Driver Verify - IP 已被封禁！请更换 IP 或使用代理')
      }

      if (pageState.hasCloudflare) {
        console.log('⏳ 等待 Cloudflare 挑战...')
        await page.waitForFunction(
          () => {
            const title = document.title
            return !title.includes('Just a moment') && !title.includes('DDoS protection')
          },
          { timeout: 60000 },
        )
        console.log('✅ Cloudflare 挑战通过')
      }
    }
    catch (e: any) {
      if (e.message.includes('Driver Verify')) {
        throw e
      }
      console.warn('⚠️  Cloudflare 检测失败:', e.message)
    }
  }

  /**
   * 获取列表页的影片链接
   */
  private async getMovieLinks(page: Page): Promise<string[]> {
    try {
      await page.waitForSelector('.movie-box', { timeout: 15000 })
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
      await page.waitForSelector('h3', { timeout: 15000 })
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
    console.log(`📊 配置: 最大影片=${this.config.maxMovies}, 最大页数=${this.config.maxPages}`)
    console.log(`⚙️  并发: 列表=${this.config.listPageConcurrency}, 详情=${this.config.detailPageConcurrency}, 图片=${this.config.imageConcurrency}`)

    this.stats.startTime = Date.now()

    // 初始化
    await this.initBrowser()
    this.initProgressBar()
    this.startStatsMonitor()

    try {
      // 主循环：爬取列表页
      while (true) {
        // 检查是否达到限制
        if (this.config.maxPages && this.currentPage > this.config.maxPages) {
          console.log(`✅ 达到最大页数限制: ${this.config.maxPages}`)
          break
        }

        if (this.config.maxMovies && this.stats.moviesSuccess >= this.config.maxMovies) {
          console.log(`✅ 达到最大影片数限制: ${this.config.maxMovies}`)
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
            this.stats.moviesFound += movieLinks.length

            if (movieLinks.length === 0) {
              console.warn('⚠️  未找到影片，可能已到最后一页')
              return
            }

            // 添加详情页任务
            for (const movieUrl of movieLinks) {
              // 检查是否达到限制
              if (this.config.maxMovies && this.stats.moviesSuccess >= this.config.maxMovies) {
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

        // 检查是否应该停止
        if (this.config.maxMovies && this.stats.moviesSuccess >= this.config.maxMovies) {
          break
        }
      }

      // 等待所有任务完成
      console.log('\n⏳ 等待所有任务完成...')
      await this.queueManager.waitForAll()

      console.log('\n✅ 爬取完成！')
      this.printStats()
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
