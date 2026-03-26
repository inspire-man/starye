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
import { FailedTaskRecorder } from '../lib/anti-detection'

export interface JavBusCrawlerConfig extends OptimizedCrawlerConfig {
  startUrl?: string
  useRandomMirror?: boolean
  recoveryMode?: boolean
}

export class JavBusCrawler extends OptimizedCrawler {
  private currentPage = 1
  private currentMirror: string
  private failedTasks: FailedTaskRecorder
  private failedTasksFile = './.javbus-failed-tasks.json'

  // 收集女优和厂商信息（用于批量同步）
  private collectedActorDetails: Map<string, { name: string, sourceUrl: string }> = new Map()
  private collectedPublisherUrls: Map<string, { name: string, sourceUrl: string }> = new Map()

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

    this.failedTasks = new FailedTaskRecorder()
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
      const items = [...document.querySelectorAll('.movie-box')]
      return items
        .map(a => (a as HTMLAnchorElement).href)
        .filter((href): href is string => !!href)
    })
  }

  /**
   * 重写 processMovie 以收集 actor/publisher 信息
   */
  protected override async processMovie(url: string, page: Page): Promise<MovieInfo | null> {
    const movieInfo = await super.processMovie(url, page)

    if (movieInfo) {
      // 收集女优信息
      if (movieInfo.actorDetails && Array.isArray(movieInfo.actorDetails)) {
        for (const actor of movieInfo.actorDetails) {
          if (actor.name && actor.url) {
            // 使用 name 作为 key 去重
            this.collectedActorDetails.set(actor.name, {
              name: actor.name,
              sourceUrl: actor.url,
            })
          }
        }
      }

      // 收集厂商信息
      if (movieInfo.publisherUrl && movieInfo.publisher) {
        this.collectedPublisherUrls.set(movieInfo.publisher, {
          name: movieInfo.publisher,
          sourceUrl: movieInfo.publisherUrl,
        })
      }
    }

    return movieInfo
  }

  /**
   * 获取影片信息（重写以添加错误记录）
   */
  protected async getMovieInfo(url: string, page: Page): Promise<MovieInfo | null> {
    try {
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
          for (const el of [...els]) {
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
          for (const el of [...genreEls]) {
            if (el.textContent)
              genres.push(el.textContent.trim())
          }

          const actors: string[] = []
          const actorEls = document.querySelectorAll('.star-name a')
          for (const el of [...actorEls]) {
            if (el.textContent)
              actors.push(el.textContent.trim())
          }

          // 解析女优详情页 URL（任务 3.1）
          const actorDetails: Array<{ name: string, url: string }> = []
          for (const el of [...actorEls]) {
            const name = el.textContent ? el.textContent.trim() : ''
            const url = (el as HTMLAnchorElement).href || ''
            if (name && url) {
              actorDetails.push({ name, url })
            }
          }

          // 解析厂商详情页 URL（任务 3.6）
          let publisherUrl = ''
          const publisherEl = Array.from(document.querySelectorAll('.info p'))
            .find(el => el.textContent?.includes('發行商:'))
          if (publisherEl) {
            const publisherLink = publisherEl.querySelector('a') as HTMLAnchorElement
            if (publisherLink) {
              publisherUrl = publisherLink.href || ''
            }
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
            actorDetails, // 新增：女优详情页 URL 列表
            genres,
            series,
            publisher: publisher || studio,
            publisherUrl, // 新增：厂商详情页 URL
            isR18: true,
            players: [],
          }
        }
        catch {
          return null
        }
      }, url)
    }
    catch (error) {
      // 记录失败任务
      this.failedTasks.record(url, error as Error, 1)
      throw error
    }
  }

  /**
   * 运行爬虫
   */
  async run(): Promise<void> {
    // 恢复模式：加载失败任务并重试
    if ((this.config as JavBusCrawlerConfig).recoveryMode) {
      await this.runRecoveryMode()
      return
    }

    console.log('🚀 启动 JavBus 优化爬虫')
    console.log(`📊 配置: 最大影片=${this.config.limits.maxMovies}, 最大页数=${this.config.limits.maxPages}`)
    console.log(`⚙️  并发: 列表=${this.config.concurrency.listPage}, 详情=${this.config.concurrency.detailPage}, 图片=${this.config.concurrency.image}`)
    console.log(`🔄 增量模式: 已启用（自动跳过已存在影片）`)

    await this.init()

    // 启用增量模式进度跟踪
    this.progressMonitor.enableIncrementalMode()

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

            // === 增量爬取逻辑 ===
            // 批量查询影片状态，避免重复爬取已存在内容
            // 使用批量查询 API 一次性获取所有影片的存在状态，相比逐个查询大幅提升性能
            const movieCodes = movieLinks.map(url => url.split('/').pop() || '')
            const statusMap = await this.apiClient.batchQueryMovieStatus(movieCodes)
            const existingCount = Object.values(statusMap).filter(s => s.exists).length

            // 更新增量统计，用于最终报告中显示增量命中率
            this.progressMonitor.incrementMoviesSkippedExisting(existingCount)

            if (existingCount > 0) {
              console.log(`  ℹ️  跳过 ${existingCount}/${movieLinks.length} 个已存在的影片`)
            }

            // 添加详情页任务（跳过已存在的）
            // 仅处理 statusMap 中标记为不存在的影片，实现增量爬取
            for (const movieUrl of movieLinks) {
              const currentStats = this.getStats()
              if (this.config.limits.maxMovies && currentStats.moviesSuccess >= this.config.limits.maxMovies) {
                break
              }

              const code = movieUrl.split('/').pop() || ''
              const status = statusMap[code]

              // 增量过滤：跳过数据库中已存在的影片
              if (status?.exists) {
                console.log(`  ⏭️  跳过已存在影片: ${code}`)
                continue
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

      // 同步女优和厂商信息
      await this.syncActorsAndPublishers()

      // 增量模式说明
      const stats = this.getStats()
      const newMoviesCount = stats.moviesFound - stats.moviesSkippedExisting
      const maxMovies = this.config.limits.maxMovies || 0
      if (newMoviesCount > 0 && maxMovies > 0 && stats.moviesSuccess < maxMovies) {
        console.log(`\n💡 说明: 虽然配置的最大影片数为 ${maxMovies}，但由于增量模式，`)
        console.log(`   实际只发现了 ${newMoviesCount} 部新影片需要处理。`)
        console.log(`   已成功处理 ${stats.moviesSuccess}/${newMoviesCount} 部 (${((stats.moviesSuccess / newMoviesCount) * 100).toFixed(1)}%)`)
      }
    }
    catch (error) {
      console.error('\n❌ 爬虫运行失败:', error)
      throw error
    }
    finally {
      // 输出失败任务摘要
      this.failedTasks.printSummary()

      // 保存失败任务
      if (this.failedTasks.getFailedTasks().length > 0) {
        await this.failedTasks.saveToFile(this.failedTasksFile)
      }

      await this.cleanup()
    }
  }

  /**
   * 恢复模式：重试失败的任务
   */
  private async runRecoveryMode(): Promise<void> {
    console.log('🔄 启动恢复模式')
    await this.init()

    try {
      await this.failedTasks.loadFromFile(this.failedTasksFile)
      const recoverableTasks = this.failedTasks.getRecoverableTasks()

      if (recoverableTasks.length === 0) {
        console.log('ℹ️  没有可恢复的失败任务')
        return
      }

      console.log(`📋 开始恢复 ${recoverableTasks.length} 个失败任务`)
      this.failedTasks.clear()

      // 逐个重试失败的影片
      let successCount = 0
      let failCount = 0

      for (const task of recoverableTasks) {
        try {
          const page = await this.createPage()
          try {
            console.log(`🔄 重试: ${task.url}`)
            await this.processMovie(task.url, page)
            successCount++
          }
          finally {
            await page.close()
          }
        }
        catch (error) {
          console.error(`❌ 恢复失败: ${task.url}`, error)
          this.failedTasks.record(task.url, error as Error, 1)
          failCount++
        }
      }

      console.log(`
📊 恢复完成:
  成功: ${successCount}/${recoverableTasks.length}
  失败: ${failCount}/${recoverableTasks.length}`)
    }
    catch (error) {
      console.error('❌ 恢复模式运行失败:', error)
      throw error
    }
    finally {
      // 输出失败任务摘要
      this.failedTasks.printSummary()

      // 保存失败任务
      if (this.failedTasks.getFailedTasks().length > 0) {
        await this.failedTasks.saveToFile(this.failedTasksFile)
      }

      await this.cleanup()
    }
  }

  /**
   * 同步女优和厂商信息
   */
  private async syncActorsAndPublishers(): Promise<void> {
    try {
      const actorCount = this.collectedActorDetails.size
      const publisherCount = this.collectedPublisherUrls.size

      if (actorCount === 0 && publisherCount === 0) {
        console.log('\nℹ️  未收集到女优或厂商信息，跳过同步')
        return
      }

      console.log('\n📤 同步女优和厂商信息...')
      console.log(`  收集到 ${actorCount} 个女优，${publisherCount} 个厂商`)

      // 同步女优
      if (actorCount > 0) {
        const actors = Array.from(this.collectedActorDetails.values())
        console.log(`  📡 同步 ${actors.length} 个女优...`)

        const actorResult = await this.apiClient.batchSyncActors(actors)

        if (actorResult) {
          console.log(`  ✅ 女优同步完成: 新建 ${actorResult.created || 0}, 更新 ${actorResult.updated || 0}`)
        }
        else {
          console.warn('  ⚠️  女优同步失败（非阻塞错误）')
        }
      }

      // 同步厂商
      if (publisherCount > 0) {
        const publishers = Array.from(this.collectedPublisherUrls.values())
        console.log(`  📡 同步 ${publishers.length} 个厂商...`)

        const publisherResult = await this.apiClient.batchSyncPublishers(publishers)

        if (publisherResult) {
          console.log(`  ✅ 厂商同步完成: 新建 ${publisherResult.created || 0}, 更新 ${publisherResult.updated || 0}`)
        }
        else {
          console.warn('  ⚠️  厂商同步失败（非阻塞错误）')
        }
      }
    }
    catch (error) {
      // 同步失败不应影响爬虫主流程
      console.error('❌ 女优/厂商同步失败:', error)
      console.log('ℹ️  此错误不影响影片数据')
    }
  }
}
