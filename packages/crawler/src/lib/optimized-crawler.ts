/* eslint-disable no-console */
/**
 * 优化的爬虫基类 - 集成队列管理器
 * 支持多阶段流水线处理和并发控制
 */

import type { Browser, Page } from 'puppeteer-core'
import type { CrawlerConfig } from './base-crawler'
import type { MovieInfo } from './strategy'
import process from 'node:process'
import cliProgress from 'cli-progress'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ImageProcessor } from './image-processor'
import { QueueManager } from './queue-manager'

puppeteer.use(StealthPlugin())

export interface OptimizedCrawlerConfig extends CrawlerConfig {
  // 并发配置
  listPageConcurrency?: number
  detailPageConcurrency?: number
  imageConcurrency?: number
  apiConcurrency?: number

  // 延迟配置
  listPageDelay?: number
  detailPageDelay?: number
  imageDelay?: number
  apiDelay?: number

  // 限制配置
  maxMovies?: number // 最大爬取数量
  maxPages?: number // 最大页数

  // 显示配置
  showProgress?: boolean // 是否显示进度条
  showStats?: boolean // 是否显示统计信息
  statsInterval?: number // 统计信息显示间隔（毫秒）
}

export abstract class OptimizedCrawler {
  protected browser: Browser | null = null
  protected config: OptimizedCrawlerConfig
  protected queueManager: QueueManager
  protected imageProcessor: ImageProcessor

  // 进度跟踪
  protected progressBar: cliProgress.SingleBar | null = null
  protected multibar: cliProgress.MultiBar | null = null
  protected statsInterval: NodeJS.Timeout | null = null

  // 统计信息
  protected stats = {
    moviesFound: 0,
    moviesProcessed: 0,
    moviesSuccess: 0,
    moviesFailed: 0,
    imagesDownloaded: 0,
    apiSynced: 0,
    startTime: 0,
  }

  constructor(config: OptimizedCrawlerConfig) {
    this.config = {
      showProgress: true,
      showStats: true,
      statsInterval: 10000, // 10秒
      maxMovies: 0, // 0 表示无限制
      maxPages: 0, // 0 表示无限制
      listPageConcurrency: 1,
      detailPageConcurrency: 2,
      imageConcurrency: 3,
      apiConcurrency: 2,
      listPageDelay: 5000,
      detailPageDelay: 3000,
      imageDelay: 1000,
      apiDelay: 500,
      ...config,
    }

    this.imageProcessor = new ImageProcessor(config.r2)

    // 初始化队列管理器
    this.queueManager = new QueueManager({
      listPageConcurrency: this.config.listPageConcurrency!,
      detailPageConcurrency: this.config.detailPageConcurrency!,
      imageConcurrency: this.config.imageConcurrency!,
      apiConcurrency: this.config.apiConcurrency!,
      listPageDelay: this.config.listPageDelay!,
      detailPageDelay: this.config.detailPageDelay!,
      imageDelay: this.config.imageDelay!,
      apiDelay: this.config.apiDelay!,
      maxRetries: 3,
      retryDelay: 2000,
    })
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    const executablePath = this.config.puppeteer?.executablePath || process.env.PUPPETEER_EXECUTABLE_PATH

    if (executablePath) {
      console.log('🚀 使用本地 Chrome:', executablePath)
    }
    else {
      console.log('🚀 使用内置 Chromium')
    }

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ]

    if (this.config.proxy?.server) {
      launchArgs.push(`--proxy-server=${this.config.proxy.server}`)
      console.log('🔒 使用代理:', this.config.proxy.server)
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
    })

    console.log('✅ 浏览器初始化完成')
  }

  /**
   * 创建页面
   */
  async createPage(): Promise<Page> {
    if (!this.browser)
      throw new Error('Browser not initialized')

    const page = await this.browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // 代理认证
    if (this.config.proxy?.username && this.config.proxy?.password) {
      await page.authenticate({
        username: this.config.proxy.username,
        password: this.config.proxy.password,
      })
    }

    // 反检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      // @ts-expect-error - chrome object
      window.chrome = { runtime: {} }

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      })
    })

    return page
  }

  /**
   * 初始化进度条
   */
  protected initProgressBar() {
    if (!this.config.showProgress || this.config.maxMovies === 0)
      return

    this.multibar = new cliProgress.MultiBar({
      format: '进度 |{bar}| {percentage}% | {value}/{total} | 剩余: {eta}s | {status}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic)

    this.progressBar = this.multibar.create(this.config.maxMovies!, 0, { status: '准备中...' })
  }

  /**
   * 更新进度条
   */
  protected updateProgress(status: string) {
    if (this.progressBar) {
      this.progressBar.update(this.stats.moviesSuccess, { status })
    }
  }

  /**
   * 启动统计信息定时输出
   */
  protected startStatsMonitor() {
    if (!this.config.showStats)
      return

    this.statsInterval = setInterval(() => {
      this.printStats()
      this.queueManager.printStats()
    }, this.config.statsInterval!)
  }

  /**
   * 停止统计信息定时输出
   */
  protected stopStatsMonitor() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
  }

  /**
   * 打印统计信息
   */
  protected printStats() {
    const elapsed = Math.round((Date.now() - this.stats.startTime) / 1000)
    const rate = elapsed > 0 ? (this.stats.moviesSuccess / elapsed * 60).toFixed(2) : '0.00'

    console.log('\n📈 爬虫统计:')
    console.log(`  运行时间: ${elapsed}s`)
    console.log(`  发现影片: ${this.stats.moviesFound}`)
    console.log(`  处理中: ${this.stats.moviesProcessed}`)
    console.log(`  成功: ${this.stats.moviesSuccess}`)
    console.log(`  失败: ${this.stats.moviesFailed}`)
    console.log(`  图片下载: ${this.stats.imagesDownloaded}`)
    console.log(`  API 同步: ${this.stats.apiSynced}`)
    console.log(`  处理速度: ${rate} 部/分钟`)
  }

  /**
   * 处理单个影片
   */
  protected async processMovie(url: string, page: Page): Promise<MovieInfo | null> {
    try {
      this.stats.moviesProcessed++

      // 获取影片信息（子类实现）
      const movieInfo = await this.getMovieInfo(url, page)

      if (!movieInfo) {
        this.stats.moviesFailed++
        return null
      }

      // 下载图片
      if (movieInfo.coverImage) {
        await this.queueManager.addImageTask(async () => {
          // 使用 ImageProcessor 的 process 方法
          const keyPrefix = `movies/${movieInfo.code}`
          const filename = 'cover'
          const results = await this.imageProcessor.process(movieInfo.coverImage!, keyPrefix, filename)
          // 使用 preview 版本的 URL
          const previewImage = results.find(r => r.variant === 'preview')
          if (previewImage) {
            movieInfo.coverImage = previewImage.url
          }
          this.stats.imagesDownloaded++
        })
      }

      // 同步到 API
      await this.queueManager.addApiTask(async () => {
        await this.syncToApi('/api/movies', movieInfo)
        this.stats.apiSynced++
      })

      this.stats.moviesSuccess++
      this.updateProgress(`成功: ${movieInfo.title}`)

      return movieInfo
    }
    catch (error) {
      this.stats.moviesFailed++
      console.error(`❌ 处理影片失败 [${url}]:`, error)
      return null
    }
  }

  /**
   * 同步数据到 API
   */
  protected async syncToApi(endpoint: string, data: unknown) {
    const url = `${this.config.api.url}${endpoint}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': this.config.api.token,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`API 返回错误: ${response.status}`)
      }

      return await response.json()
    }
    catch (error) {
      // API 离线时不中断爬虫
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        console.warn('⚠️  API 离线，跳过同步')
        return null
      }
      throw error
    }
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    this.stopStatsMonitor()

    if (this.progressBar) {
      this.progressBar.stop()
    }

    if (this.multibar) {
      this.multibar.stop()
    }

    await this.closeBrowser()
  }

  /**
   * 抽象方法：获取影片信息（子类实现）
   */
  protected abstract getMovieInfo(url: string, page: Page): Promise<MovieInfo | null>

  /**
   * 抽象方法：运行爬虫（子类实现）
   */
  abstract run(): Promise<void>
}
