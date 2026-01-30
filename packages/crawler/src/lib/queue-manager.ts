/* eslint-disable no-console */
/**
 * 队列管理器 - 多阶段流水线架构
 * 参考 jav-scrapy 的四阶段队列设计，优化并发处理
 */

import PQueue from 'p-queue'

export interface QueueTask<T = any> {
  data: T
  priority?: number
}

export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
}

export interface QueueManagerConfig {
  // 并发级别配置
  listPageConcurrency: number // 列表页并发（建议 1-2）
  detailPageConcurrency: number // 详情页并发（建议 2-3）
  imageConcurrency: number // 图片下载并发（建议 3-5）
  apiConcurrency: number // API 同步并发（建议 2-4）

  // 延迟配置
  listPageDelay: number // 列表页延迟（毫秒）
  detailPageDelay: number // 详情页延迟（毫秒）
  imageDelay: number // 图片下载延迟（毫秒）
  apiDelay: number // API 同步延迟（毫秒）

  // 重试配置
  maxRetries: number
  retryDelay: number
}

export const DEFAULT_QUEUE_CONFIG: QueueManagerConfig = {
  listPageConcurrency: 1, // 列表页串行，避免触发反爬
  detailPageConcurrency: 2, // 详情页低并发
  imageConcurrency: 3, // 图片可以稍高并发
  apiConcurrency: 2, // API 同步中等并发

  listPageDelay: 5000, // 列表页间隔 5 秒
  detailPageDelay: 3000, // 详情页间隔 3 秒
  imageDelay: 1000, // 图片间隔 1 秒
  apiDelay: 500, // API 间隔 0.5 秒

  maxRetries: 3,
  retryDelay: 2000,
}

/**
 * 队列管理器类
 */
export class QueueManager {
  private config: QueueManagerConfig

  // 四个阶段的队列
  private listPageQueue: PQueue
  private detailPageQueue: PQueue
  private imageQueue: PQueue
  private apiQueue: PQueue

  // 统计信息
  private stats = {
    listPage: { pending: 0, running: 0, completed: 0, failed: 0 },
    detailPage: { pending: 0, running: 0, completed: 0, failed: 0 },
    image: { pending: 0, running: 0, completed: 0, failed: 0 },
    api: { pending: 0, running: 0, completed: 0, failed: 0 },
  }

  // 延迟管理
  private lastRequestTime = {
    listPage: 0,
    detailPage: 0,
    image: 0,
    api: 0,
  }

  constructor(config: Partial<QueueManagerConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config }

    // 初始化队列
    this.listPageQueue = new PQueue({
      concurrency: this.config.listPageConcurrency,
      autoStart: true,
    })

    this.detailPageQueue = new PQueue({
      concurrency: this.config.detailPageConcurrency,
      autoStart: true,
    })

    this.imageQueue = new PQueue({
      concurrency: this.config.imageConcurrency,
      autoStart: true,
    })

    this.apiQueue = new PQueue({
      concurrency: this.config.apiConcurrency,
      autoStart: true,
    })

    // 设置队列事件监听
    this.setupQueueListeners()
  }

  private setupQueueListeners() {
    // 列表页队列
    this.listPageQueue.on('active', () => {
      this.stats.listPage.running++
      this.stats.listPage.pending--
    })

    this.listPageQueue.on('completed', () => {
      this.stats.listPage.running--
      this.stats.listPage.completed++
    })

    this.listPageQueue.on('error', () => {
      this.stats.listPage.running--
      this.stats.listPage.failed++
    })

    // 详情页队列
    this.detailPageQueue.on('active', () => {
      this.stats.detailPage.running++
      this.stats.detailPage.pending--
    })

    this.detailPageQueue.on('completed', () => {
      this.stats.detailPage.running--
      this.stats.detailPage.completed++
    })

    this.detailPageQueue.on('error', () => {
      this.stats.detailPage.running--
      this.stats.detailPage.failed++
    })

    // 图片队列
    this.imageQueue.on('active', () => {
      this.stats.image.running++
      this.stats.image.pending--
    })

    this.imageQueue.on('completed', () => {
      this.stats.image.running--
      this.stats.image.completed++
    })

    this.imageQueue.on('error', () => {
      this.stats.image.running--
      this.stats.image.failed++
    })

    // API 队列
    this.apiQueue.on('active', () => {
      this.stats.api.running++
      this.stats.api.pending--
    })

    this.apiQueue.on('completed', () => {
      this.stats.api.running--
      this.stats.api.completed++
    })

    this.apiQueue.on('error', () => {
      this.stats.api.running--
      this.stats.api.failed++
    })
  }

  /**
   * 智能延迟：根据上次请求时间自动计算延迟
   */
  private async smartDelay(type: 'listPage' | 'detailPage' | 'image' | 'api') {
    const now = Date.now()
    const lastTime = this.lastRequestTime[type]
    const configDelay = this.config[`${type}Delay` as keyof QueueManagerConfig] as number

    if (lastTime > 0) {
      const elapsed = now - lastTime
      const remainingDelay = configDelay - elapsed

      if (remainingDelay > 0) {
        // 添加随机抖动（±20%）
        const jitter = remainingDelay * 0.2 * (Math.random() - 0.5)
        const actualDelay = Math.max(0, remainingDelay + jitter)

        if (actualDelay > 100) { // 只有超过 100ms 才延迟
          await new Promise(resolve => setTimeout(resolve, actualDelay))
        }
      }
    }

    this.lastRequestTime[type] = Date.now()
  }

  /**
   * 添加列表页任务
   */
  async addListPageTask<T>(
    task: () => Promise<T>,
    options: { priority?: number, retries?: number } = {},
  ): Promise<T> {
    this.stats.listPage.pending++

    const result = await this.listPageQueue.add(async () => {
      await this.smartDelay('listPage')

      let lastError: Error | null = null
      const maxRetries = options.retries ?? this.config.maxRetries

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await task()
        }
        catch (error) {
          lastError = error as Error

          if (attempt < maxRetries) {
            const delay = this.config.retryDelay * 1.5 ** attempt
            console.log(`[列表页] 重试 ${attempt + 1}/${maxRetries}，等待 ${Math.round(delay / 1000)}s...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      throw lastError
    }, { priority: options.priority })

    return result!
  }

  /**
   * 添加详情页任务
   */
  async addDetailPageTask<T>(
    task: () => Promise<T>,
    options: { priority?: number, retries?: number } = {},
  ): Promise<T> {
    this.stats.detailPage.pending++

    const result = await this.detailPageQueue.add(async () => {
      await this.smartDelay('detailPage')

      let lastError: Error | null = null
      const maxRetries = options.retries ?? this.config.maxRetries

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await task()
        }
        catch (error) {
          lastError = error as Error

          if (attempt < maxRetries) {
            const delay = this.config.retryDelay * 1.5 ** attempt
            console.log(`[详情页] 重试 ${attempt + 1}/${maxRetries}，等待 ${Math.round(delay / 1000)}s...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      throw lastError
    }, { priority: options.priority })

    return result!
  }

  /**
   * 添加图片下载任务
   */
  async addImageTask<T>(
    task: () => Promise<T>,
    options: { priority?: number, retries?: number } = {},
  ): Promise<T> {
    this.stats.image.pending++

    const result = await this.imageQueue.add(async () => {
      await this.smartDelay('image')

      let lastError: Error | null = null
      const maxRetries = options.retries ?? this.config.maxRetries

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await task()
        }
        catch (error) {
          lastError = error as Error

          if (attempt < maxRetries) {
            const delay = this.config.retryDelay * 1.5 ** attempt
            console.log(`[图片] 重试 ${attempt + 1}/${maxRetries}，等待 ${Math.round(delay / 1000)}s...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      throw lastError
    }, { priority: options.priority })

    return result!
  }

  /**
   * 添加 API 同步任务
   */
  async addApiTask<T>(
    task: () => Promise<T>,
    options: { priority?: number, retries?: number } = {},
  ): Promise<T> {
    this.stats.api.pending++

    const result = await this.apiQueue.add(async () => {
      await this.smartDelay('api')

      let lastError: Error | null = null
      const maxRetries = options.retries ?? this.config.maxRetries

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await task()
        }
        catch (error) {
          lastError = error as Error

          if (attempt < maxRetries) {
            const delay = this.config.retryDelay * 1.5 ** attempt
            console.log(`[API] 重试 ${attempt + 1}/${maxRetries}，等待 ${Math.round(delay / 1000)}s...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      throw lastError
    }, { priority: options.priority })

    return result!
  }

  /**
   * 获取队列统计信息
   */
  getStats() {
    return {
      listPage: { ...this.stats.listPage },
      detailPage: { ...this.stats.detailPage },
      image: { ...this.stats.image },
      api: { ...this.stats.api },
      total: {
        pending: this.stats.listPage.pending + this.stats.detailPage.pending + this.stats.image.pending + this.stats.api.pending,
        running: this.stats.listPage.running + this.stats.detailPage.running + this.stats.image.running + this.stats.api.running,
        completed: this.stats.listPage.completed + this.stats.detailPage.completed + this.stats.image.completed + this.stats.api.completed,
        failed: this.stats.listPage.failed + this.stats.detailPage.failed + this.stats.image.failed + this.stats.api.failed,
      },
    }
  }

  /**
   * 打印队列状态
   */
  printStats() {
    const stats = this.getStats()
    console.log('\n📊 队列状态:')
    console.log(`  列表页: 等待 ${stats.listPage.pending} | 运行 ${stats.listPage.running} | 完成 ${stats.listPage.completed} | 失败 ${stats.listPage.failed}`)
    console.log(`  详情页: 等待 ${stats.detailPage.pending} | 运行 ${stats.detailPage.running} | 完成 ${stats.detailPage.completed} | 失败 ${stats.detailPage.failed}`)
    console.log(`  图片:   等待 ${stats.image.pending} | 运行 ${stats.image.running} | 完成 ${stats.image.completed} | 失败 ${stats.image.failed}`)
    console.log(`  API:    等待 ${stats.api.pending} | 运行 ${stats.api.running} | 完成 ${stats.api.completed} | 失败 ${stats.api.failed}`)
    console.log(`  总计:   等待 ${stats.total.pending} | 运行 ${stats.total.running} | 完成 ${stats.total.completed} | 失败 ${stats.total.failed}`)
  }

  /**
   * 等待所有队列完成
   */
  async waitForAll() {
    await Promise.all([
      this.listPageQueue.onIdle(),
      this.detailPageQueue.onIdle(),
      this.imageQueue.onIdle(),
      this.apiQueue.onIdle(),
    ])
  }

  /**
   * 清空所有队列
   */
  clear() {
    this.listPageQueue.clear()
    this.detailPageQueue.clear()
    this.imageQueue.clear()
    this.apiQueue.clear()
  }

  /**
   * 暂停所有队列
   */
  pause() {
    this.listPageQueue.pause()
    this.detailPageQueue.pause()
    this.imageQueue.pause()
    this.apiQueue.pause()
  }

  /**
   * 恢复所有队列
   */
  resume() {
    this.listPageQueue.start()
    this.detailPageQueue.start()
    this.imageQueue.start()
    this.apiQueue.start()
  }
}
