/* eslint-disable no-console */
/**
 * 厂商详情爬虫
 * 爬取厂商详情页（Logo、官网、简介等信息）
 */

import type { ApiConfig, BrowserConfig } from '../types/config'
import pMap from 'p-map'
import { FailedTaskRecorder } from '../lib/anti-detection'
import { JavBusStrategy } from '../strategies/javbus'
import { ApiClient } from '../utils/api-client'
import { BrowserManager } from '../utils/browser'

export interface PublisherCrawlerConfig {
  browserConfig: BrowserConfig
  apiConfig: ApiConfig
  maxPublishers?: number
  concurrency?: number
  delay?: number
  recoveryMode?: boolean
}

interface PendingPublisher {
  id: string
  name: string
  sourceUrl: string
  movieCount: number
  crawlFailureCount: number
  lastCrawlAttempt: Date | null
}

export class PublisherCrawler {
  private browserManager: BrowserManager
  private apiClient: ApiClient
  private strategy: JavBusStrategy
  private failedTasks: FailedTaskRecorder
  private failedTasksFile = './.publisher-failed-tasks.json'

  // 统计信息
  private stats = {
    totalPublishers: 0,
    processedPublishers: 0,
    skippedPublishers: 0,
    failedPublishers: 0,
    dataCompleteness: {
      hasLogo: 0,
      hasWebsite: 0,
      hasDescription: 0,
      hasFoundedYear: 0,
      hasCountry: 0,
    },
    averageCompleteness: 0,
  }

  // 配置
  private maxPublishers: number
  private concurrency: number
  private delay: number
  private recoveryMode: boolean

  // 软超时控制
  private startTime: number = 0
  private readonly SOFT_TIMEOUT = 19800000 // 5.5 小时（毫秒）

  constructor(config: PublisherCrawlerConfig) {
    this.browserManager = new BrowserManager(
      config.browserConfig.puppeteer,
      config.browserConfig.proxy,
    )
    this.apiClient = new ApiClient(config.apiConfig)
    this.strategy = new JavBusStrategy()
    this.failedTasks = new FailedTaskRecorder()

    this.maxPublishers = config.maxPublishers || 150
    this.concurrency = config.concurrency || 2
    this.delay = config.delay || 8000
    this.recoveryMode = config.recoveryMode || false
  }

  /**
   * 运行爬虫
   */
  async run(): Promise<void> {
    this.startTime = Date.now()

    try {
      console.log('\n🏢 启动厂商详情爬虫')
      console.log(`⚙️  配置: maxPublishers=${this.maxPublishers}, concurrency=${this.concurrency}, delay=${this.delay}ms\n`)

      // 初始化浏览器
      await this.browserManager.launch()

      // 恢复模式
      if (this.recoveryMode) {
        await this.runRecoveryMode()
      }
      else {
        await this.runNormalMode()
      }

      // 输出统计
      this.printStats()
    }
    catch (error) {
      console.error('❌ 爬虫运行失败:', error)
      throw error
    }
    finally {
      // 保存失败任务
      await this.failedTasks.saveToFile(this.failedTasksFile)

      // 关闭浏览器
      await this.browserManager.close()
    }
  }

  /**
   * 正常模式运行
   */
  private async runNormalMode(): Promise<void> {
    // 获取待爬取厂商列表
    console.log(`📡 获取待爬取厂商列表（最多 ${this.maxPublishers} 个）...`)
    const pendingPublishers = await this.apiClient.fetchPendingPublishers(this.maxPublishers)

    if (pendingPublishers.length === 0) {
      console.log('ℹ️  没有待爬取的厂商')
      return
    }

    // 检查是否有足够的数据
    if (pendingPublishers.length < 5) {
      console.warn(`⚠️  待爬取厂商数量较少（${pendingPublishers.length}），可能需要先运行电影爬虫`)
    }

    this.stats.totalPublishers = pendingPublishers.length
    console.log(`✅ 获取到 ${pendingPublishers.length} 个待爬取厂商\n`)

    // 优先级排序
    const sortedPublishers = this.sortByPriority(pendingPublishers)

    // 并发爬取
    await pMap(
      sortedPublishers,
      async (publisher, index) => {
        // 检查软超时
        if (this.shouldStop()) {
          console.log(`\n⏱️  接近超时限制，优雅退出（已处理 ${index}/${sortedPublishers.length}）`)
          return
        }

        await this.processPublisher(publisher)
      },
      { concurrency: this.concurrency },
    )
  }

  /**
   * 恢复模式运行
   */
  private async runRecoveryMode(): Promise<void> {
    console.log('🔄 恢复模式：重试失败任务\n')

    // 加载失败任务
    await this.failedTasks.loadFromFile(this.failedTasksFile)
    const recoverableTasks = this.failedTasks.getRecoverableTasks()

    if (recoverableTasks.length === 0) {
      console.log('ℹ️  没有可恢复的失败任务')
      return
    }

    console.log(`📝 找到 ${recoverableTasks.length} 个可恢复的失败任务`)
    this.failedTasks.clear()

    this.stats.totalPublishers = recoverableTasks.length

    // TODO: 将失败任务转换为 PendingPublisher 格式并处理
    console.log('⚠️  恢复模式开发中...')
  }

  /**
   * 优先级排序
   */
  private sortByPriority(publishers: PendingPublisher[]): PendingPublisher[] {
    return publishers.toSorted((a, b) => {
      const scoreA = this.calculatePriority(a)
      const scoreB = this.calculatePriority(b)
      return scoreB - scoreA
    })
  }

  /**
   * 计算优先级分数
   *
   * 公式: movieCount * 10 - crawlFailureCount * 20 + newPublisherBonus
   * 示例:
   * - 厂商 A (movieCount=100, crawlFailureCount=0, new=false): 分数 = 1000
   * - 厂商 B (movieCount=20, crawlFailureCount=0, new=true): 分数 = 215
   * - 厂商 C (movieCount=50, crawlFailureCount=1, new=false): 分数 = 480
   */
  private calculatePriority(publisher: PendingPublisher): number {
    let score = publisher.movieCount * 10
    score -= publisher.crawlFailureCount * 20

    // 新厂商加成（从未尝试过的优先处理）
    if (!publisher.lastCrawlAttempt) {
      score += 15
    }

    return score
  }

  /**
   * 处理单个厂商
   */
  private async processPublisher(publisher: PendingPublisher): Promise<void> {
    const page = await this.browserManager.createPage()

    try {
      console.log(`\n[${this.stats.processedPublishers + this.stats.failedPublishers + 1}/${this.stats.totalPublishers}] 爬取厂商: ${publisher.name}`)
      console.log(`   URL: ${publisher.sourceUrl}`)
      console.log(`   作品数: ${publisher.movieCount}, 失败次数: ${publisher.crawlFailureCount}`)

      // 调用 Strategy 爬取详情
      const details = await this.strategy.crawlPublisherDetails(publisher.sourceUrl, page)

      if (!details) {
        throw new Error('解析失败：未能提取厂商详情')
      }

      // 数据完整度检查
      const completeness = this.calculateCompleteness(details)
      console.log(`   数据完整度: ${(completeness * 100).toFixed(0)}%`)

      // 降低阈值：只要有 logo 就认为是有效数据
      if (completeness < 0.5) {
        throw new Error(`数据过少 (${(completeness * 100).toFixed(0)}%)`)
      }

      // 同步到 API
      const result = await this.apiClient.syncPublisherDetails(publisher.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      // 更新统计
      this.stats.processedPublishers++
      this.updateDataCompletenessStats(details)

      console.log(`   ✅ 成功`)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ❌ 失败: ${errorMessage}`)

      // 记录失败任务
      const errorObj = error instanceof Error ? error : new Error(errorMessage)
      this.failedTasks.record(publisher.sourceUrl, errorObj, publisher.crawlFailureCount + 1)
      this.stats.failedPublishers++
    }
    finally {
      await page.close()
    }
  }

  /**
   * 计算数据完整度
   *
   * 字段权重:
   * - logo: 30%
   * - website: 20%
   * - description: 20%
   * - foundedYear: 15%
   * - country: 15%
   */
  private calculateCompleteness(details: any): number {
    // 调整权重：聚焦在实际可获取的数据（主要是 logo）
    // JavBus 厂商页面通常只提供 logo，其他字段很少有数据
    const fields = [
      { key: 'logo', weight: 0.70 }, // 提高到 70%（最重要）
      { key: 'website', weight: 0.10 },
      { key: 'description', weight: 0.10 },
      { key: 'foundedYear', weight: 0.05 },
      { key: 'country', weight: 0.05 },
    ]

    let score = 0
    for (const field of fields) {
      const value = details[field.key]
      if (value !== null && value !== undefined && value !== '') {
        score += field.weight
      }
    }

    return score
  }

  /**
   * 更新数据完整度统计
   */
  private updateDataCompletenessStats(details: any): void {
    if (details.logo)
      this.stats.dataCompleteness.hasLogo++
    if (details.website)
      this.stats.dataCompleteness.hasWebsite++
    if (details.description)
      this.stats.dataCompleteness.hasDescription++
    if (details.foundedYear)
      this.stats.dataCompleteness.hasFoundedYear++
    if (details.country)
      this.stats.dataCompleteness.hasCountry++
  }

  /**
   * 检查是否应该停止
   */
  private shouldStop(): boolean {
    const elapsed = Date.now() - this.startTime
    return elapsed > this.SOFT_TIMEOUT
  }

  /**
   * 输出统计报告
   */
  private printStats(): void {
    const elapsed = Date.now() - this.startTime
    const elapsedMinutes = Math.floor(elapsed / 60000)

    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 厂商爬取统计报告')
    console.log('='.repeat(60))

    console.log(`\n总数: ${this.stats.totalPublishers}`)
    console.log(`成功: ${this.stats.processedPublishers} ✅`)
    console.log(`失败: ${this.stats.failedPublishers} ❌`)
    console.log(`跳过: ${this.stats.skippedPublishers}`)

    const successRate = this.stats.totalPublishers > 0
      ? ((this.stats.processedPublishers / this.stats.totalPublishers) * 100).toFixed(1)
      : '0.0'
    console.log(`成功率: ${successRate}%`)

    // 数据完整度统计
    if (this.stats.processedPublishers > 0) {
      const processed = this.stats.processedPublishers
      console.log(`\n数据完整度:`)
      console.log(`  - Logo: ${((this.stats.dataCompleteness.hasLogo / processed) * 100).toFixed(0)}%`)
      console.log(`  - 官网: ${((this.stats.dataCompleteness.hasWebsite / processed) * 100).toFixed(0)}%`)
      console.log(`  - 简介: ${((this.stats.dataCompleteness.hasDescription / processed) * 100).toFixed(0)}%`)
      console.log(`  - 成立年份: ${((this.stats.dataCompleteness.hasFoundedYear / processed) * 100).toFixed(0)}%`)
      console.log(`  - 国家: ${((this.stats.dataCompleteness.hasCountry / processed) * 100).toFixed(0)}%`)

      // 计算平均完整度
      const totalWeight = (
        this.stats.dataCompleteness.hasLogo * 0.30
        + this.stats.dataCompleteness.hasWebsite * 0.20
        + this.stats.dataCompleteness.hasDescription * 0.20
        + this.stats.dataCompleteness.hasFoundedYear * 0.15
        + this.stats.dataCompleteness.hasCountry * 0.15
      )
      this.stats.averageCompleteness = totalWeight / processed

      console.log(`  - 平均完整度: ${(this.stats.averageCompleteness * 100).toFixed(0)}%`)
    }

    console.log(`\n耗时: ${elapsedMinutes} 分钟`)

    // 失败任务提示
    if (this.stats.failedPublishers > 0) {
      console.log(`\n⚠️  失败任务已保存到: ${this.failedTasksFile}`)
      console.log(`   使用 --recovery 模式可重试`)
    }

    console.log(`${'='.repeat(60)}\n`)
  }
}
