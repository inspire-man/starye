/**
 * 优化的爬虫基类 - 重构版
 * 使用工具类和模块化设计
 */

import type { Page } from 'puppeteer-core'
import type { ProcessedImage } from '../lib/image-processor'
import type { MovieInfo } from '../lib/strategy'
import type { OptimizedCrawlerConfig } from '../types/config'
import { ImageProcessor } from '../lib/image-processor'
import { QueueManager } from '../lib/queue-manager'
import { DEFAULT_CONCURRENCY, DEFAULT_DELAY, DEFAULT_LIMITS, DEFAULT_OPTIONS } from '../types/config'
import { ApiClient } from '../utils/api-client'
import { BrowserManager } from '../utils/browser'
import { ProgressMonitor } from '../utils/progress'

export abstract class OptimizedCrawler {
  protected browserManager: BrowserManager
  protected queueManager: QueueManager
  protected imageProcessor: ImageProcessor
  protected apiClient: ApiClient
  protected progressMonitor: ProgressMonitor
  protected config: Required<OptimizedCrawlerConfig>

  constructor(config: OptimizedCrawlerConfig) {
    // 合并配置
    this.config = {
      ...config,
      concurrency: { ...DEFAULT_CONCURRENCY, ...config.concurrency },
      delay: { ...DEFAULT_DELAY, ...config.delay },
      limits: { ...DEFAULT_LIMITS, ...config.limits },
      options: { ...DEFAULT_OPTIONS, ...config.options },
    } as Required<OptimizedCrawlerConfig>

    // 初始化工具类
    this.browserManager = new BrowserManager(config.puppeteer, config.proxy)
    this.imageProcessor = new ImageProcessor(config.r2)
    this.apiClient = new ApiClient(config.api)
    this.progressMonitor = new ProgressMonitor(
      this.config.limits.maxMovies,
      this.config.options.showProgress,
    )

    // 初始化队列管理器
    this.queueManager = new QueueManager({
      listPageConcurrency: this.config.concurrency.listPage,
      detailPageConcurrency: this.config.concurrency.detailPage,
      imageConcurrency: this.config.concurrency.image,
      apiConcurrency: this.config.concurrency.api,
      listPageDelay: this.config.delay.listPage,
      detailPageDelay: this.config.delay.detailPage,
      imageDelay: this.config.delay.image,
      apiDelay: this.config.delay.api,
      maxRetries: 3,
      retryDelay: 2000,
    })
  }

  /**
   * 初始化爬虫
   */
  async init(): Promise<void> {
    await this.browserManager.launch()
    this.progressMonitor.init()

    if (this.config.options.showStats) {
      this.progressMonitor.startStatsMonitor(
        this.config.options.statsInterval!,
        () => {
          this.progressMonitor.printStats()
          this.queueManager.printStats()
        },
      )
    }
  }

  /**
   * 创建页面
   */
  async createPage(): Promise<Page> {
    return this.browserManager.createPage()
  }

  /**
   * 处理单个影片
   */
  protected async processMovie(url: string, page: Page): Promise<MovieInfo | null> {
    try {
      this.progressMonitor.incrementMoviesProcessed()

      // 获取影片信息（子类实现）
      const movieInfo = await this.getMovieInfo(url, page)

      if (!movieInfo) {
        this.progressMonitor.incrementMoviesFailed()
        return null
      }

      // 下载图片
      if (movieInfo.coverImage) {
        await this.processImage(movieInfo)
      }

      // 同步到 API
      await this.syncToApi(movieInfo)

      this.progressMonitor.incrementMoviesSuccess()
      this.progressMonitor.update(`成功: ${movieInfo.title}`)

      return movieInfo
    }
    catch (error) {
      this.progressMonitor.incrementMoviesFailed()
      console.error(`❌ 处理影片失败 [${url}]:`, error)
      return null
    }
  }

  /**
   * 处理图片
   */
  private async processImage(movieInfo: MovieInfo): Promise<void> {
    await this.queueManager.addImageTask(async () => {
      try {
        const keyPrefix = `movies/${movieInfo.code}`
        const filename = 'cover'
        const results = await this.imageProcessor.process(
          movieInfo.coverImage!,
          keyPrefix,
          filename,
        )

        const previewImage = results.find((r: ProcessedImage) => r.variant === 'preview')
        if (previewImage) {
          movieInfo.coverImage = previewImage.url
        }

        this.progressMonitor.incrementImagesDownloaded()
      }
      catch (error) {
        console.warn(`⚠️  图片下载失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }).catch(() => {
      // 图片任务失败已在内部处理
    })
  }

  /**
   * 同步到 API
   */
  private async syncToApi(movieInfo: MovieInfo): Promise<void> {
    await this.queueManager.addApiTask(async () => {
      try {
        const result = await this.apiClient.syncMovie(movieInfo)
        if (result) {
          this.progressMonitor.incrementApiSynced()
        }
      }
      catch (error) {
        console.warn(`⚠️  API 同步失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }).catch(() => {
      // API 任务失败已在内部处理
    })
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.progressMonitor.stop()
    await this.browserManager.close()
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.progressMonitor.getStats()
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
