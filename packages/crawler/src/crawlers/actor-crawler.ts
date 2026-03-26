/* eslint-disable no-console */
/**
 * 女优详情爬虫
 * 爬取女优详情页（头像、简介、生日等信息）
 */

import type { ApiConfig, BrowserConfig } from '../types/config'
import pMap from 'p-map'
import { FailedTaskRecorder } from '../lib/anti-detection'
import { JavBusStrategy } from '../strategies/javbus'
import { ApiClient } from '../utils/api-client'
import { BrowserManager } from '../utils/browser'

export interface ActorCrawlerConfig {
  browserConfig: BrowserConfig
  apiConfig: ApiConfig
  maxActors?: number
  concurrency?: number
  delay?: number
  recoveryMode?: boolean
}

interface PendingActor {
  id: string
  name: string
  sourceUrl: string
  movieCount: number
  crawlFailureCount: number
  lastCrawlAttempt: Date | null
}

export class ActorCrawler {
  private browserManager: BrowserManager
  private apiClient: ApiClient
  private strategy: JavBusStrategy
  private failedTasks: FailedTaskRecorder
  private failedTasksFile = './.actor-failed-tasks.json'

  // 统计信息
  private stats = {
    totalActors: 0,
    processedActors: 0,
    skippedActors: 0,
    failedActors: 0,
    dataCompleteness: {
      hasAvatar: 0,
      hasBio: 0,
      hasBirthDate: 0,
      hasHeight: 0,
      hasMeasurements: 0,
      hasNationality: 0,
    },
    averageCompleteness: 0,
  }

  // 配置
  private maxActors: number
  private concurrency: number
  private delay: number
  private recoveryMode: boolean

  // 软超时控制
  private startTime: number = 0
  private readonly SOFT_TIMEOUT = 19800000 // 5.5 小时（毫秒）

  constructor(config: ActorCrawlerConfig) {
    this.browserManager = new BrowserManager(
      config.browserConfig.puppeteer,
      config.browserConfig.proxy,
    )
    this.apiClient = new ApiClient(config.apiConfig)
    this.strategy = new JavBusStrategy()
    this.failedTasks = new FailedTaskRecorder()

    this.maxActors = config.maxActors || 150
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
      console.log('\n🎬 启动女优详情爬虫')
      console.log(`⚙️  配置: maxActors=${this.maxActors}, concurrency=${this.concurrency}, delay=${this.delay}ms\n`)

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
    // 获取待爬取女优列表
    console.log(`📡 获取待爬取女优列表（最多 ${this.maxActors} 个）...`)
    const pendingActors = await this.apiClient.fetchPendingActors(this.maxActors)

    if (pendingActors.length === 0) {
      console.log('ℹ️  没有待爬取的女优')
      return
    }

    // 检查是否有足够的数据
    if (pendingActors.length < 10) {
      console.warn(`⚠️  待爬取女优数量较少（${pendingActors.length}），可能需要先运行电影爬虫`)
    }

    this.stats.totalActors = pendingActors.length
    console.log(`✅ 获取到 ${pendingActors.length} 个待爬取女优\n`)

    // 优先级排序
    const sortedActors = this.sortByPriority(pendingActors)

    // 并发爬取
    await pMap(
      sortedActors,
      async (actor, index) => {
        // 检查软超时
        if (this.shouldStop()) {
          console.log(`\n⏱️  接近超时限制，优雅退出（已处理 ${index}/${sortedActors.length}）`)
          return
        }

        await this.processActor(actor)
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

    this.stats.totalActors = recoverableTasks.length

    // TODO: 将失败任务转换为 PendingActor 格式并处理
    console.log('⚠️  恢复模式开发中...')
  }

  /**
   * 优先级排序
   */
  private sortByPriority(actors: PendingActor[]): PendingActor[] {
    return actors.toSorted((a, b) => {
      const scoreA = this.calculatePriority(a)
      const scoreB = this.calculatePriority(b)
      return scoreB - scoreA
    })
  }

  /**
   * 计算优先级分数
   *
   * 公式: movieCount * 10 - crawlFailureCount * 20 + newActorBonus
   * 示例:
   * - 女优 A (movieCount=50, crawlFailureCount=0, new=false): 分数 = 500
   * - 女优 B (movieCount=10, crawlFailureCount=0, new=true): 分数 = 115
   * - 女优 C (movieCount=30, crawlFailureCount=2, new=false): 分数 = 260
   */
  private calculatePriority(actor: PendingActor): number {
    let score = actor.movieCount * 10
    score -= actor.crawlFailureCount * 20

    // 新女优加成（从未尝试过的优先处理）
    if (!actor.lastCrawlAttempt) {
      score += 15
    }

    return score
  }

  /**
   * 处理单个女优
   */
  private async processActor(actor: PendingActor): Promise<void> {
    const page = await this.browserManager.createPage()

    try {
      console.log(`\n[${this.stats.processedActors + this.stats.failedActors + 1}/${this.stats.totalActors}] 爬取女优: ${actor.name}`)
      console.log(`   URL: ${actor.sourceUrl}`)
      console.log(`   作品数: ${actor.movieCount}, 失败次数: ${actor.crawlFailureCount}`)

      // 调用 Strategy 爬取详情
      const details = await this.strategy.crawlActorDetails(actor.sourceUrl, page)

      if (!details) {
        throw new Error('解析失败：未能提取女优详情')
      }

      // 数据完整度检查
      const completeness = this.calculateCompleteness(details)
      console.log(`   数据完整度: ${(completeness * 100).toFixed(0)}%`)

      // 降低阈值：只要有头像就认为是有效数据
      if (completeness < 0.5) {
        throw new Error(`数据过少 (${(completeness * 100).toFixed(0)}%)`)
      }

      // 同步到 API
      const result = await this.apiClient.syncActorDetails(actor.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      // 更新统计
      this.stats.processedActors++
      this.updateDataCompletenessStats(details)

      console.log(`   ✅ 成功`)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ❌ 失败: ${errorMessage}`)

      // 记录失败任务
      const errorObj = error instanceof Error ? error : new Error(errorMessage)
      this.failedTasks.record(actor.sourceUrl, errorObj, actor.crawlFailureCount + 1)
      this.stats.failedActors++
    }
    finally {
      await page.close()
    }
  }

  /**
   * 计算数据完整度
   *
   * 字段权重:
   * - avatar: 25%
   * - bio: 20%
   * - birthDate: 15%
   * - height: 15%
   * - measurements: 10%
   * - nationality: 15%
   */
  private calculateCompleteness(details: any): number {
    // 调整权重：聚焦在实际可获取的数据（主要是头像）
    // JavBus 女优页面通常只提供头像，其他字段很少有数据
    const fields = [
      { key: 'avatar', weight: 0.70 }, // 提高到 70%（最重要）
      { key: 'bio', weight: 0.10 },
      { key: 'birthDate', weight: 0.05 },
      { key: 'height', weight: 0.05 },
      { key: 'measurements', weight: 0.05 },
      { key: 'nationality', weight: 0.05 },
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
    if (details.avatar)
      this.stats.dataCompleteness.hasAvatar++
    if (details.bio)
      this.stats.dataCompleteness.hasBio++
    if (details.birthDate)
      this.stats.dataCompleteness.hasBirthDate++
    if (details.height)
      this.stats.dataCompleteness.hasHeight++
    if (details.measurements)
      this.stats.dataCompleteness.hasMeasurements++
    if (details.nationality)
      this.stats.dataCompleteness.hasNationality++
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
    console.log('📊 女优爬取统计报告')
    console.log('='.repeat(60))

    console.log(`\n总数: ${this.stats.totalActors}`)
    console.log(`成功: ${this.stats.processedActors} ✅`)
    console.log(`失败: ${this.stats.failedActors} ❌`)
    console.log(`跳过: ${this.stats.skippedActors}`)

    const successRate = this.stats.totalActors > 0
      ? ((this.stats.processedActors / this.stats.totalActors) * 100).toFixed(1)
      : '0.0'
    console.log(`成功率: ${successRate}%`)

    // 数据完整度统计
    if (this.stats.processedActors > 0) {
      const processed = this.stats.processedActors
      console.log(`\n数据完整度:`)
      console.log(`  - 头像: ${((this.stats.dataCompleteness.hasAvatar / processed) * 100).toFixed(0)}%`)
      console.log(`  - 简介: ${((this.stats.dataCompleteness.hasBio / processed) * 100).toFixed(0)}%`)
      console.log(`  - 生日: ${((this.stats.dataCompleteness.hasBirthDate / processed) * 100).toFixed(0)}%`)
      console.log(`  - 身高: ${((this.stats.dataCompleteness.hasHeight / processed) * 100).toFixed(0)}%`)
      console.log(`  - 三围: ${((this.stats.dataCompleteness.hasMeasurements / processed) * 100).toFixed(0)}%`)
      console.log(`  - 国籍: ${((this.stats.dataCompleteness.hasNationality / processed) * 100).toFixed(0)}%`)

      // 计算平均完整度
      const totalWeight = (
        this.stats.dataCompleteness.hasAvatar * 0.25
        + this.stats.dataCompleteness.hasBio * 0.20
        + this.stats.dataCompleteness.hasBirthDate * 0.15
        + this.stats.dataCompleteness.hasHeight * 0.15
        + this.stats.dataCompleteness.hasMeasurements * 0.10
        + this.stats.dataCompleteness.hasNationality * 0.15
      )
      this.stats.averageCompleteness = totalWeight / processed

      console.log(`  - 平均完整度: ${(this.stats.averageCompleteness * 100).toFixed(0)}%`)
    }

    console.log(`\n耗时: ${elapsedMinutes} 分钟`)

    // 失败任务提示
    if (this.stats.failedActors > 0) {
      console.log(`\n⚠️  失败任务已保存到: ${this.failedTasksFile}`)
      console.log(`   使用 --recovery 模式可重试`)
    }

    console.log(`${'='.repeat(60)}\n`)
  }
}
