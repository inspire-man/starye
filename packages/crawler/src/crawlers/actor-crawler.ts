/* eslint-disable no-console */
/**
 * 女优详情爬虫
 * 爬取女优详情页（头像、简介、生日等信息）
 */

import type { R2Config } from '../lib/image-processor'
import type { ApiConfig, BrowserConfig } from '../types/config'
import pMap from 'p-map'
import { FailedTaskRecorder } from '../lib/anti-detection'
import { ImageProcessor } from '../lib/image-processor'
import { NameMapper } from '../lib/name-mapper'
import { JavBusStrategy } from '../strategies/javbus'
import { SeesaaWikiStrategy } from '../strategies/seesaawiki/seesaawiki-strategy'
import { ApiClient } from '../utils/api-client'
import { BrowserManager } from '../utils/browser'

export interface ActorCrawlerConfig {
  browserConfig: BrowserConfig
  apiConfig: ApiConfig
  r2Config: R2Config
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
  hasDetailsCrawled?: boolean
  needsAvatarUpdate?: boolean
}

export class ActorCrawler {
  private browserManager: BrowserManager
  private apiClient: ApiClient
  private javbusStrategy: JavBusStrategy // 保留作为头像备用
  private seesaaWikiStrategy: SeesaaWikiStrategy // 主数据源
  private nameMapper: NameMapper
  private imageProcessor: ImageProcessor
  private failedTasks: FailedTaskRecorder
  private failedTasksFile = './.actor-failed-tasks.json'

  // 统计信息
  private stats = {
    processedActors: 0,
    skippedActors: 0,
    failedActors: 0,
    nameMappingFailed: 0,
    dataCompleteness: {
      hasAvatar: 0,
      hasAliases: 0,
      hasTwitter: 0,
      hasInstagram: 0,
      hasBlog: 0,
      hasDebutDate: 0,
      hasRetireDate: 0,
      hasBio: 0,
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
    this.javbusStrategy = new JavBusStrategy()
    this.seesaaWikiStrategy = new SeesaaWikiStrategy()
    this.imageProcessor = new ImageProcessor(config.r2Config)
    this.failedTasks = new FailedTaskRecorder()

    // 初始化名字映射器
    this.nameMapper = new NameMapper(this.seesaaWikiStrategy)

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

      // 保存名字映射表
      await this.nameMapper.saveMappings()

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

    // 不再预设 totalActors，改为获取到的数量（用于日志参考）
    const fetchedCount = pendingActors.length
    console.log(`✅ 获取到 ${fetchedCount} 个待爬取女优\n`)

    // 优先级排序
    const sortedActors = this.sortByPriority(pendingActors)

    // 并发爬取
    await pMap(
      sortedActors,
      async (actor, index) => {
        // 检查软超时
        if (this.shouldStop()) {
          console.log(`\n⏱️  接近超时限制，优雅退出（已处理 ${this.stats.processedActors}/${fetchedCount}）`)
          return
        }

        await this.processActor(actor, index + 1, fetchedCount)
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
  private async processActor(actor: PendingActor, currentIndex: number, totalFetched: number): Promise<void> {
    const page = await this.browserManager.createPage()

    try {
      console.log(`\n[${currentIndex}/${totalFetched}] 爬取女优: ${actor.name}`)
      console.log(`   JavBus URL: ${actor.sourceUrl}`)
      console.log(`   作品数: ${actor.movieCount}, 失败次数: ${actor.crawlFailureCount}`)

      // 如果是头像补全模式（已爬取但需要更新头像）
      if (actor.needsAvatarUpdate && actor.hasDetailsCrawled) {
        console.log(`   🔄 仅补全头像（已爬取）`)
        await this.processAvatarUpdate(actor, page)
        return
      }

      // 阶段 1: 名字匹配（获取 Wiki URL）
      console.log(`   🔍 匹配 SeesaaWiki 名字...`)
      const nameMapping = await this.nameMapper.matchActorName(actor.name, page)

      if (!nameMapping) {
        // 名字匹配失败，记录并跳过
        console.log(`   ⚠️  名字匹配失败，使用 JavBus 备用`)
        this.stats.nameMappingFailed++
        this.failedTasks.record(
          actor.sourceUrl,
          new Error('Name mapping failed'),
          actor.crawlFailureCount + 1,
        )

        // 备用：使用 JavBus 爬取头像
        await this.processFallbackJavBus(actor, page)
        return
      }

      console.log(`   ✅ 匹配成功: ${actor.name} -> ${nameMapping.wikiName}`)
      console.log(`   Wiki URL: ${nameMapping.wikiUrl}`)

      // 阶段 2: 爬取 SeesaaWiki 详情
      console.log(`   📡 爬取 SeesaaWiki 详情...`)
      const wikiResult = await this.seesaaWikiStrategy.fetchActorDetails(nameMapping.wikiUrl, page)

      if (!wikiResult.data) {
        const errorMsg = wikiResult.errors.length > 0
          ? wikiResult.errors.map(e => `${e.field}: ${e.reason}`).join(', ')
          : '未知错误'
        throw new Error(`SeesaaWiki 解析失败: ${errorMsg}`)
      }

      const wikiDetails = wikiResult.data

      // 打印警告（如有）
      if (wikiResult.warnings.length > 0) {
        console.warn(`   ⚠️  解析警告: ${wikiResult.warnings.join('; ')}`)
      }

      // 准备同步数据
      const details: {
        source: 'seesaawiki'
        sourceId: string
        sourceUrl: string
        avatar?: string
        bio?: string
        twitter?: string
        instagram?: string
        blog?: string
        wikiUrl: string
      } = {
        source: 'seesaawiki' as const,
        sourceId: nameMapping.wikiName,
        sourceUrl: nameMapping.wikiUrl,
        bio: wikiDetails.reading || undefined,
        twitter: wikiDetails.twitter || undefined,
        instagram: wikiDetails.instagram || undefined,
        blog: wikiDetails.blog || undefined,
        wikiUrl: nameMapping.wikiUrl,
      }

      // 数据完整度检查
      const completeness = this.calculateCompleteness(details, wikiDetails)
      console.log(`   数据完整度: ${(completeness * 100).toFixed(0)}%`)

      // 如果没有头像，尝试从 JavBus 补全
      if (!details.avatar) {
        console.log(`   🔄 Wiki 无头像，尝试从 JavBus 补全...`)
        try {
          const javbusDetails = await this.javbusStrategy.crawlActorDetails(actor.sourceUrl, page)
          if (javbusDetails?.avatar) {
            details.avatar = javbusDetails.avatar
            console.log(`   ✅ JavBus 头像补全成功`)
          }
        }
        catch (e) {
          console.warn(`   ⚠️  JavBus 头像补全失败:`, e instanceof Error ? e.message : String(e))
        }
      }

      // 上传头像到 R2（如果有）
      if (details.avatar) {
        try {
          console.log(`   📤 上传头像到 R2...`)
          const avatarImages = await this.imageProcessor.process(
            details.avatar,
            `actors/${actor.id}`,
            'avatar',
          )
          const preview = avatarImages.find(i => i.variant === 'preview')
          if (preview) {
            details.avatar = preview.url
            console.log(`   ✅ 头像已上传: ${preview.url}`)
          }
        }
        catch (e) {
          console.warn(`   ⚠️  头像上传失败（继续执行）:`, e instanceof Error ? e.message : String(e))
        }
      }

      // 同步到 API
      const result = await this.apiClient.syncActorDetails(actor.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      // 更新统计
      this.stats.processedActors++
      this.updateDataCompletenessStats(details, wikiDetails)

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
   * 备用方案：使用 JavBus（当名字匹配失败时）
   */
  private async processFallbackJavBus(actor: PendingActor, page: any): Promise<void> {
    try {
      console.log(`   🔄 回退到 JavBus 数据源...`)
      const details = await this.javbusStrategy.crawlActorDetails(actor.sourceUrl, page)

      if (!details || !details.avatar) {
        throw new Error('JavBus 也未能获取有效数据')
      }

      // 上传头像到 R2
      console.log(`   📤 上传头像到 R2...`)
      const avatarImages = await this.imageProcessor.process(
        details.avatar,
        `actors/${actor.id}`,
        'avatar',
      )
      const preview = avatarImages.find(i => i.variant === 'preview')

      if (!preview) {
        throw new Error('头像处理失败')
      }

      details.avatar = preview.url

      // 同步到 API（仅头像，标记 source 为 javbus）
      const result = await this.apiClient.syncActorDetails(actor.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      this.stats.processedActors++
      this.updateDataCompletenessStats(details, null)
      console.log(`   ✅ JavBus 备用成功`)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ❌ JavBus 备用也失败: ${errorMessage}`)
      throw error
    }
  }

  /**
   * 仅更新头像（头像补全模式）
   */
  private async processAvatarUpdate(actor: PendingActor, page: any): Promise<void> {
    try {
      // 只爬取页面获取头像
      const details = await this.javbusStrategy.crawlActorDetails(actor.sourceUrl, page)

      if (!details || !details.avatar) {
        throw new Error('未能获取头像')
      }

      // 上传头像到 R2
      console.log(`   📤 上传头像到 R2...`)
      const avatarImages = await this.imageProcessor.process(
        details.avatar,
        `actors/${actor.id}`,
        'avatar',
      )
      const preview = avatarImages.find(i => i.variant === 'preview')

      if (!preview) {
        throw new Error('头像处理失败')
      }

      // 仅更新头像字段
      const result = await this.apiClient.syncActorDetails(actor.id, {
        source: details.source,
        sourceId: details.sourceId,
        sourceUrl: details.sourceUrl,
        avatar: preview.url,
      })

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      this.stats.processedActors++
      console.log(`   ✅ 头像已更新: ${preview.url}`)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ❌ 头像更新失败: ${errorMessage}`)

      const errorObj = error instanceof Error ? error : new Error(errorMessage)
      this.failedTasks.record(actor.sourceUrl, errorObj, actor.crawlFailureCount + 1)
      this.stats.failedActors++
    }
  }

  /**
   * 计算数据完整度
   *
   * SeesaaWiki 权重:
   * - avatar: 30%
   * - aliases: 15%
   * - socialLinks: 15% (twitter/instagram/blog 各 5%)
   * - debutDate: 10%
   * - bio: 10%
   * - 其他: 20% (退役日期、作品列表等)
   */
  private calculateCompleteness(details: any, wikiDetails: any): number {
    let score = 0

    // 头像 (30%)
    if (details.avatar)
      score += 0.30

    // 别名 (15%)
    if (wikiDetails?.aliases && wikiDetails.aliases.length > 0)
      score += 0.15

    // 社交链接 (15%)
    if (details.twitter)
      score += 0.05
    if (details.instagram)
      score += 0.05
    if (details.blog)
      score += 0.05

    // 出道日期 (10%)
    if (wikiDetails?.debutDate)
      score += 0.10

    // 简介/读音 (10%)
    if (details.bio)
      score += 0.10

    // 其他 (20%)
    if (wikiDetails?.retireDate)
      score += 0.10
    if (wikiDetails?.works && wikiDetails.works.length > 0)
      score += 0.10

    return score
  }

  /**
   * 更新数据完整度统计
   */
  private updateDataCompletenessStats(details: any, wikiDetails: any): void {
    if (details.avatar)
      this.stats.dataCompleteness.hasAvatar++
    if (details.bio)
      this.stats.dataCompleteness.hasBio++
    if (wikiDetails?.aliases && wikiDetails.aliases.length > 0)
      this.stats.dataCompleteness.hasAliases++
    if (details.twitter)
      this.stats.dataCompleteness.hasTwitter++
    if (details.instagram)
      this.stats.dataCompleteness.hasInstagram++
    if (details.blog)
      this.stats.dataCompleteness.hasBlog++
    if (wikiDetails?.debutDate)
      this.stats.dataCompleteness.hasDebutDate++
    if (wikiDetails?.retireDate)
      this.stats.dataCompleteness.hasRetireDate++
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

    const totalProcessed = this.stats.processedActors + this.stats.failedActors + this.stats.skippedActors

    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 女优爬取统计报告 (SeesaaWiki 数据源)')
    console.log('='.repeat(60))

    console.log(`\n总数: ${totalProcessed}`)
    console.log(`成功: ${this.stats.processedActors} ✅`)
    console.log(`失败: ${this.stats.failedActors} ❌`)
    console.log(`跳过: ${this.stats.skippedActors}`)
    console.log(`名字匹配失败: ${this.stats.nameMappingFailed}`)

    const successRate = totalProcessed > 0
      ? ((this.stats.processedActors / totalProcessed) * 100).toFixed(1)
      : '0.0'
    console.log(`成功率: ${successRate}%`)

    // 数据完整度统计（基于 SeesaaWiki 新字段）
    if (this.stats.processedActors > 0) {
      const processed = this.stats.processedActors
      console.log(`\n数据完整度 (SeesaaWiki):`)
      console.log(`  - 头像: ${((this.stats.dataCompleteness.hasAvatar / processed) * 100).toFixed(0)}%`)
      console.log(`  - 别名: ${((this.stats.dataCompleteness.hasAliases / processed) * 100).toFixed(0)}%`)
      console.log(`  - Twitter: ${((this.stats.dataCompleteness.hasTwitter / processed) * 100).toFixed(0)}%`)
      console.log(`  - Instagram: ${((this.stats.dataCompleteness.hasInstagram / processed) * 100).toFixed(0)}%`)
      console.log(`  - 博客: ${((this.stats.dataCompleteness.hasBlog / processed) * 100).toFixed(0)}%`)
      console.log(`  - 出道日期: ${((this.stats.dataCompleteness.hasDebutDate / processed) * 100).toFixed(0)}%`)
      console.log(`  - 退役日期: ${((this.stats.dataCompleteness.hasRetireDate / processed) * 100).toFixed(0)}%`)
      console.log(`  - 简介: ${((this.stats.dataCompleteness.hasBio / processed) * 100).toFixed(0)}%`)

      // 计算平均完整度（使用新权重）
      const totalWeight = (
        this.stats.dataCompleteness.hasAvatar * 0.30
        + this.stats.dataCompleteness.hasAliases * 0.15
        + this.stats.dataCompleteness.hasTwitter * 0.05
        + this.stats.dataCompleteness.hasInstagram * 0.05
        + this.stats.dataCompleteness.hasBlog * 0.05
        + this.stats.dataCompleteness.hasDebutDate * 0.10
        + this.stats.dataCompleteness.hasBio * 0.10
        + this.stats.dataCompleteness.hasRetireDate * 0.10
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

    // 名字映射统计
    const mapperStats = this.nameMapper.getStats()
    console.log(`\n📊 名字映射统计:`)
    console.log(`  - 女优映射: ${mapperStats.actorMappings} 条`)
    console.log(`  - 未匹配: ${mapperStats.unmappedActors} 条`)

    console.log(`${'='.repeat(60)}\n`)
  }
}
