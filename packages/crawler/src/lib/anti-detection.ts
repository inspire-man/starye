/* eslint-disable no-console */
import type { Page, Protocol } from 'puppeteer-core'

/**
 * 错误类型分类
 */
export type ErrorType
  = | 'ERR_ABORTED'
    | 'TIMEOUT'
    | 'CONNECTION_REFUSED'
    | 'HTTP_ERROR'
    | 'UNKNOWN'

/**
 * 错误处理决策
 */
export type ErrorAction
  = | 'RETRY' // 重试
    | 'SKIP' // 跳过当前资源
    | 'ABORT_ALL' // 中止所有任务

/**
 * 爬取上下文
 */
export interface CrawlContext {
  url: string
  retries: number
  currentDelay: number
  currentTimeout: number
  headerIndex: number
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

/**
 * 反检测配置
 */
export interface AntiDetectionConfig {
  // 延迟配置
  baseDelay: number // 基础延迟（ms）
  randomDelay: number // 随机延迟范围（ms）
  errorBackoffMultiplier: number // 错误退避倍数
  maxDelay: number // 最大延迟上限（ms）

  // 重试配置
  maxRetries: number // 最大重试次数
  retryDelayMultiplier: number // 重试延迟倍数
  longBackoffDuration: number // 长时间退避时长（ms）

  // 监控配置
  successRateWindow: number // 成功率窗口大小
  lowSuccessRateThreshold: number // 低成功率阈值
  autoSlowdownMultiplier: number // 自动降速倍数

  // 会话配置
  enableSessionManagement: boolean // 是否启用会话管理
  enableHeaderRotation: boolean // 是否启用请求头轮换
}

/**
 * 请求头模板
 */
export interface HeaderTemplate {
  name: string
  userAgent: string
  headers: Record<string, string>
}

/**
 * 失败任务记录
 */
export interface FailedTask {
  url: string
  errorType: ErrorType
  errorMessage: string
  attempts: number
  timestamp: Date
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  /**
   * 分类错误
   */
  static classifyError(error: Error): ErrorType {
    const message = error.message || ''

    if (message.includes('ERR_ABORTED') || message.includes('net::ERR_ABORTED')) {
      return 'ERR_ABORTED'
    }

    if (error.name === 'TimeoutError' || message.includes('timeout') || message.includes('Timeout')) {
      return 'TIMEOUT'
    }

    if (message.includes('ERR_CONNECTION_REFUSED') || message.includes('Connection refused')) {
      return 'CONNECTION_REFUSED'
    }

    if (message.includes('404') || message.includes('500') || message.includes('HTTP')) {
      return 'HTTP_ERROR'
    }

    return 'UNKNOWN'
  }

  /**
   * 处理爬取错误
   */
  static async handleCrawlError(
    error: Error,
    context: CrawlContext,
    config: AntiDetectionConfig,
  ): Promise<{ action: ErrorAction, updatedContext: CrawlContext }> {
    const errorType = this.classifyError(error)
    let action: ErrorAction = 'RETRY'
    const updatedContext = { ...context }

    switch (errorType) {
      case 'ERR_ABORTED':
        // 最严重：可能被反爬虫检测
        console.warn(`[ErrorHandler] ⚠️  ERR_ABORTED detected for ${context.url} (attempt ${context.retries + 1})`)
        updatedContext.currentDelay = Math.min(
          context.currentDelay * config.errorBackoffMultiplier,
          config.maxDelay,
        )
        updatedContext.headerIndex = (context.headerIndex + 1) % 2 // 轮换请求头
        updatedContext.retries++

        if (updatedContext.retries >= config.maxRetries) {
          console.error(`[ErrorHandler] ❌ ERR_ABORTED: Max retries (${config.maxRetries}) reached for ${context.url}`)
          action = 'SKIP'
        }
        else {
          console.log(`[ErrorHandler] 🔄 Will retry with increased delay (${updatedContext.currentDelay}ms) and rotated headers`)
          await this._sleep(updatedContext.currentDelay)
        }
        break

      case 'TIMEOUT':
        console.warn(`[ErrorHandler] ⏱️  Timeout for ${context.url} (attempt ${context.retries + 1})`)
        updatedContext.currentTimeout = Math.floor(context.currentTimeout * 1.5)
        updatedContext.retries++

        if (updatedContext.retries >= 2) {
          console.error(`[ErrorHandler] ❌ Timeout: Max retries (2) reached for ${context.url}`)
          action = 'SKIP'
        }
        else {
          console.log(`[ErrorHandler] 🔄 Will retry with increased timeout (${updatedContext.currentTimeout}ms)`)
          await this._sleep(context.currentDelay)
        }
        break

      case 'CONNECTION_REFUSED':
        console.error(`[ErrorHandler] 🚫 Connection refused for ${context.url} - possible IP ban`)
        updatedContext.retries++

        if (updatedContext.retries >= 1) {
          console.error(`[ErrorHandler] ❌ IP might be banned. Aborting all tasks.`)
          action = 'ABORT_ALL'
        }
        else {
          console.log(`[ErrorHandler] ⏳ Long backoff (${config.longBackoffDuration}ms) before retry`)
          await this._sleep(config.longBackoffDuration)
        }
        break

      case 'HTTP_ERROR':
        console.warn(`[ErrorHandler] 🌐 HTTP error for ${context.url}: ${error.message}`)
        console.log('[ErrorHandler] ⏭️  Skipping (HTTP errors are not retried)')
        action = 'SKIP'
        break

      case 'UNKNOWN':
        console.warn(`[ErrorHandler] ❓ Unknown error for ${context.url}: ${error.message}`)
        updatedContext.retries++

        if (updatedContext.retries >= 2) {
          console.error(`[ErrorHandler] ❌ Unknown error: Max retries (2) reached for ${context.url}`)
          action = 'SKIP'
        }
        else {
          await this._sleep(context.currentDelay)
        }
        break
    }

    return { action, updatedContext }
  }

  private static async _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 成功率监控器
 */
export class SuccessRateMonitor {
  private window: boolean[] = []
  private windowSize: number

  constructor(windowSize = 20) {
    this.windowSize = windowSize
  }

  /**
   * 记录请求结果
   */
  record(success: boolean): void {
    this.window.push(success)
    if (this.window.length > this.windowSize) {
      this.window.shift()
    }
  }

  /**
   * 获取成功率
   */
  getSuccessRate(): number {
    if (this.window.length === 0)
      return 1.0
    const successes = this.window.filter(x => x).length
    return successes / this.window.length
  }

  /**
   * 判断是否需要降速
   */
  shouldSlowDown(threshold = 0.7): boolean {
    const rate = this.getSuccessRate()
    return rate < threshold && this.window.length >= 10 // 至少 10 个样本
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      total: this.window.length,
      successes: this.window.filter(x => x).length,
      failures: this.window.filter(x => !x).length,
      successRate: this.getSuccessRate(),
    }
  }
}

/**
 * 延迟策略
 */
export class DelayStrategy {
  private config: AntiDetectionConfig
  private currentMultiplier = 1.0

  constructor(config: AntiDetectionConfig) {
    this.config = config
  }

  /**
   * 计算延迟时间
   */
  calculateDelay(hasError = false): number {
    let delay = this.config.baseDelay * this.currentMultiplier

    // 添加随机化
    delay += Math.random() * this.config.randomDelay

    // 如果有错误，应用退避倍数
    if (hasError) {
      delay *= this.config.errorBackoffMultiplier
    }

    // 应用最大延迟限制
    delay = Math.min(delay, this.config.maxDelay)

    return Math.floor(delay)
  }

  /**
   * 增加延迟倍数（自动降速）
   */
  increaseMultiplier(multiplier: number): void {
    this.currentMultiplier *= multiplier
    console.warn(`[DelayStrategy] ⚠️  Increasing delay multiplier to ${this.currentMultiplier.toFixed(2)}`)
  }

  /**
   * 重置延迟倍数
   */
  resetMultiplier(): void {
    if (this.currentMultiplier > 1.0) {
      console.log('[DelayStrategy] ✅ Resetting delay multiplier to 1.0')
      this.currentMultiplier = 1.0
    }
  }

  /**
   * 逐步恢复延迟倍数
   */
  gradualRecover(step = 0.1): void {
    if (this.currentMultiplier > 1.0) {
      this.currentMultiplier = Math.max(1.0, this.currentMultiplier - step)
      if (this.currentMultiplier > 1.0) {
        console.log(`[DelayStrategy] 📉 Gradually recovering delay multiplier to ${this.currentMultiplier.toFixed(2)}`)
      }
    }
  }
}

/**
 * 请求头轮换器
 */
export class HeaderRotator {
  private templates: HeaderTemplate[]
  private currentIndex = 0

  constructor() {
    this.templates = this._createTemplates()
  }

  /**
   * 获取当前请求头
   */
  getCurrentHeaders(index?: number): HeaderTemplate {
    const idx = index !== undefined ? index % this.templates.length : this.currentIndex
    return this.templates[idx]
  }

  /**
   * 切换到下一套请求头
   */
  rotate(): HeaderTemplate {
    this.currentIndex = (this.currentIndex + 1) % this.templates.length
    console.log(`[HeaderRotator] 🔄 Rotated to header template: ${this.templates[this.currentIndex].name}`)
    return this.templates[this.currentIndex]
  }

  /**
   * 创建请求头模板
   */
  private _createTemplates(): HeaderTemplate[] {
    return [
      {
        name: 'Chrome-Windows',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        headers: {
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      },
      {
        name: 'Chrome-MacOS',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        headers: {
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      },
    ]
  }
}

/**
 * 爬虫会话管理器
 */
export class CrawlerSession {
  private baseUrl: string
  private cookies: Protocol.Network.Cookie[] = []
  private initialized = false
  private headerRotator: HeaderRotator
  private sessionStartTime = Date.now()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.headerRotator = new HeaderRotator()
  }

  /**
   * 初始化会话：访问首页并保存 Cookie
   */
  async initialize(page: Page): Promise<void> {
    if (this.initialized) {
      console.log('[CrawlerSession] ℹ️  Session already initialized')
      return
    }

    console.log('[CrawlerSession] 🔧 Initializing crawler session...')

    try {
      // 应用初始请求头
      await this.applyHeaders(page, 0)

      // 访问首页建立会话
      await page.goto(this.baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })

      // 停留一会儿，模拟真实浏览
      await this._sleep(2000 + Math.random() * 2000)

      // 保存 Cookies
      this.cookies = await page.cookies()
      this.initialized = true
      this.sessionStartTime = Date.now()

      console.log(`[CrawlerSession] ✅ Session initialized with ${this.cookies.length} cookies`)
    }
    catch (error) {
      console.error('[CrawlerSession] ❌ Failed to initialize session:', error)
      throw error
    }
  }

  /**
   * 应用 Cookie 到页面
   */
  async applyCookies(page: Page): Promise<void> {
    if (!this.initialized || this.cookies.length === 0) {
      console.warn('[CrawlerSession] ⚠️  No cookies to apply (session not initialized)')
      return
    }

    try {
      await page.setCookie(...this.cookies)
      // console.log(`[CrawlerSession] 🍪 Applied ${this.cookies.length} cookies`)
    }
    catch (error) {
      console.error('[CrawlerSession] ❌ Failed to apply cookies:', error)
    }
  }

  /**
   * 应用请求头到页面
   */
  async applyHeaders(page: Page, headerIndex: number): Promise<void> {
    const template = this.headerRotator.getCurrentHeaders(headerIndex)

    try {
      await page.setUserAgent(template.userAgent)
      await page.setExtraHTTPHeaders(template.headers)
      // console.log(`[CrawlerSession] 📋 Applied headers: ${template.name}`)
    }
    catch (error) {
      console.error('[CrawlerSession] ❌ Failed to apply headers:', error)
    }
  }

  /**
   * 刷新会话（重新初始化）
   */
  async refreshSession(page: Page): Promise<void> {
    console.log('[CrawlerSession] 🔄 Refreshing session...')
    this.initialized = false
    this.cookies = []
    await this.initialize(page)
  }

  /**
   * 检查会话是否需要刷新
   */
  shouldRefresh(): boolean {
    // 会话超过 30 分钟，可能过期
    const sessionAge = Date.now() - this.sessionStartTime
    return sessionAge > 30 * 60 * 1000
  }

  /**
   * 轮换请求头
   */
  rotateHeaders(): HeaderTemplate {
    return this.headerRotator.rotate()
  }

  private async _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 失败任务记录器
 */
export class FailedTaskRecorder {
  private tasks: FailedTask[] = []

  /**
   * 记录失败任务
   */
  record(url: string, error: Error, attempts: number): void {
    const errorType = ErrorClassifier.classifyError(error)
    this.tasks.push({
      url,
      errorType,
      errorMessage: error.message,
      attempts,
      timestamp: new Date(),
    })
  }

  /**
   * 获取失败任务列表
   */
  getFailedTasks(): FailedTask[] {
    return this.tasks
  }

  /**
   * 按错误类型分组
   */
  getByErrorType(): Map<ErrorType, FailedTask[]> {
    const grouped = new Map<ErrorType, FailedTask[]>()

    for (const task of this.tasks) {
      const list = grouped.get(task.errorType) || []
      list.push(task)
      grouped.set(task.errorType, list)
    }

    return grouped
  }

  /**
   * 输出失败摘要
   */
  printSummary(): void {
    if (this.tasks.length === 0) {
      console.log('\n✅ No failed tasks!')
      return
    }

    console.log(`\n❌ Failed Tasks Summary (${this.tasks.length} total):`)

    const grouped = this.getByErrorType()
    for (const [errorType, tasks] of grouped.entries()) {
      console.log(`\n  ${errorType} (${tasks.length}):`)
      tasks.slice(0, 5).forEach((task) => {
        console.log(`    - ${task.url}`)
      })
      if (tasks.length > 5) {
        console.log(`    ... and ${tasks.length - 5} more`)
      }
    }
  }
}

/**
 * IP 封禁检测器
 */
export class IpBanDetector {
  private consecutiveRefused = 0
  private readonly threshold = 5

  /**
   * 记录连接被拒绝
   */
  recordRefused(): void {
    this.consecutiveRefused++
  }

  /**
   * 记录连接成功
   */
  recordSuccess(): void {
    this.consecutiveRefused = 0
  }

  /**
   * 检测是否可能被封禁
   */
  isPossiblyBanned(): boolean {
    return this.consecutiveRefused >= this.threshold
  }

  /**
   * 获取连续失败次数
   */
  getConsecutiveRefused(): number {
    return this.consecutiveRefused
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this.consecutiveRefused = 0
  }
}
