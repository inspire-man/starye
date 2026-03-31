/* eslint-disable node/prefer-global/process */
/* eslint-disable no-console */
/**
 * 厂商详情爬虫
 * 爬取厂商详情页（Logo、官网、简介等信息）
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

export interface PublisherCrawlerConfig {
  browserConfig: BrowserConfig
  apiConfig: ApiConfig
  r2Config: R2Config
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
  hasDetailsCrawled?: boolean
  needsLogoUpdate?: boolean
}

export class PublisherCrawler {
  private browserManager: BrowserManager
  private apiClient: ApiClient
  private javbusStrategy: JavBusStrategy // 保留作为 Logo 备用
  private seesaaWikiStrategy: SeesaaWikiStrategy // 主数据源
  private nameMapper: NameMapper
  private imageProcessor: ImageProcessor
  private failedTasks: FailedTaskRecorder
  private failedTasksFile = './.publisher-failed-tasks.json'

  // 统计信息
  private stats = {
    processedPublishers: 0,
    skippedPublishers: 0,
    failedPublishers: 0,
    nameMappingFailed: 0,
    dataCompleteness: {
      hasLogo: 0,
      hasWebsite: 0,
      hasTwitter: 0,
      hasInstagram: 0,
      hasDescription: 0,
      hasParentPublisher: 0,
      hasBrandSeries: 0,
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
    this.javbusStrategy = new JavBusStrategy()
    this.seesaaWikiStrategy = new SeesaaWikiStrategy()
    this.imageProcessor = new ImageProcessor(config.r2Config)
    this.failedTasks = new FailedTaskRecorder()

    // 初始化名字映射器（支持 R2 上传）
    this.nameMapper = new NameMapper(this.seesaaWikiStrategy, {
      uploadToR2: process.env.UPLOAD_MAPPINGS_TO_R2 === 'true',
      r2Config: config.r2Config,
    })

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

    // 不再预设 totalPublishers，改为获取到的数量（用于日志参考）
    const fetchedCount = pendingPublishers.length
    console.log(`✅ 获取到 ${fetchedCount} 个待爬取厂商\n`)

    // 优先级排序
    const sortedPublishers = this.sortByPriority(pendingPublishers)

    // 并发爬取
    await pMap(
      sortedPublishers,
      async (publisher, index) => {
        // 检查软超时
        if (this.shouldStop()) {
          console.log(`\n⏱️  接近超时限制，优雅退出（已处理 ${this.stats.processedPublishers}/${fetchedCount}）`)
          return
        }

        await this.processPublisher(publisher, index + 1, fetchedCount)
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
  private async processPublisher(publisher: PendingPublisher, currentIndex: number, totalFetched: number): Promise<void> {
    const page = await this.browserManager.createPage()

    try {
      console.log(`\n[${currentIndex}/${totalFetched}] 爬取厂商: ${publisher.name}`)
      console.log(`   JavBus URL: ${publisher.sourceUrl}`)
      console.log(`   作品数: ${publisher.movieCount}, 失败次数: ${publisher.crawlFailureCount}`)

      // 如果是 logo 补全模式（已爬取但需要更新 logo）
      if (publisher.needsLogoUpdate && publisher.hasDetailsCrawled) {
        console.log(`   🔄 仅补全 logo（已爬取）`)
        await this.processLogoUpdate(publisher, page)
        return
      }

      // 阶段 1: 名字匹配（获取 Wiki URL）
      console.log(`   🔍 匹配 SeesaaWiki 名字...`)
      const nameMapping = await this.nameMapper.matchPublisherName(publisher.name, page)

      if (!nameMapping) {
        // 名字匹配失败，记录并跳过
        console.log(`   ⚠️  名字匹配失败，使用 JavBus 备用`)
        this.stats.nameMappingFailed++
        this.failedTasks.record(
          publisher.sourceUrl,
          new Error('Name mapping failed'),
          publisher.crawlFailureCount + 1,
        )

        // 备用：使用 JavBus 爬取 Logo
        await this.processFallbackJavBus(publisher, page)
        return
      }

      console.log(`   ✅ 匹配成功: ${publisher.name} -> ${nameMapping.wikiName}`)
      console.log(`   Wiki URL: ${nameMapping.wikiUrl}`)

      // 阶段 2: 爬取 SeesaaWiki 详情
      console.log(`   📡 爬取 SeesaaWiki 详情...`)
      const wikiResult = await this.seesaaWikiStrategy.fetchPublisherDetails(nameMapping.wikiUrl, page)

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
      const details = {
        source: 'seesaawiki' as const,
        sourceId: nameMapping.wikiName,
        sourceUrl: publisher.sourceUrl, // 保持原始 JavBus URL
        logo: wikiDetails.logo || undefined,
        website: wikiDetails.website || undefined,
        twitter: wikiDetails.twitter || undefined,
        instagram: wikiDetails.instagram || undefined,
        wikiUrl: nameMapping.wikiUrl,
        parentPublisher: wikiDetails.parentPublisher || undefined,
        brandSeries: wikiDetails.brandSeries || undefined,
      }

      // 数据完整度检查
      const completeness = this.calculateCompleteness(details, wikiDetails)
      console.log(`   数据完整度: ${(completeness * 100).toFixed(0)}%`)

      // 如果没有 Logo，尝试从 JavBus 补全
      if (!details.logo) {
        console.log(`   🔄 Wiki 无 Logo，尝试从 JavBus 补全...`)
        try {
          const javbusDetails = await this.javbusStrategy.crawlPublisherDetails(publisher.sourceUrl, page)
          if (javbusDetails?.logo) {
            details.logo = javbusDetails.logo
            console.log(`   ✅ JavBus Logo 补全成功`)
          }
        }
        catch (e) {
          console.warn(`   ⚠️  JavBus Logo 补全失败:`, e instanceof Error ? e.message : String(e))
        }
      }

      // 上传 logo 到 R2（如果有）
      if (details.logo) {
        try {
          console.log(`   📤 上传 logo 到 R2...`)
          const logoImages = await this.imageProcessor.process(
            details.logo,
            `publishers/${publisher.id}`,
            'logo',
          )
          const preview = logoImages.find(i => i.variant === 'preview')
          if (preview) {
            details.logo = preview.url
            console.log(`   ✅ Logo 已上传: ${preview.url}`)
          }
        }
        catch (e) {
          console.warn(`   ⚠️  Logo 上传失败（继续执行）:`, e instanceof Error ? e.message : String(e))
        }
      }

      // 同步到 API
      const result = await this.apiClient.syncPublisherDetails(publisher.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      // 更新统计
      this.stats.processedPublishers++
      this.updateDataCompletenessStats(details, wikiDetails)

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
   * 备用方案：使用 JavBus（当名字匹配失败时）
   */
  private async processFallbackJavBus(publisher: PendingPublisher, page: any): Promise<void> {
    try {
      console.log(`   🔄 回退到 JavBus 数据源...`)
      const details = await this.javbusStrategy.crawlPublisherDetails(publisher.sourceUrl, page)

      if (!details || !details.logo) {
        throw new Error('JavBus 也未能获取有效数据')
      }

      // 上传 logo 到 R2
      console.log(`   📤 上传 logo 到 R2...`)
      const logoImages = await this.imageProcessor.process(
        details.logo,
        `publishers/${publisher.id}`,
        'logo',
      )
      const preview = logoImages.find(i => i.variant === 'preview')

      if (!preview) {
        throw new Error('Logo 处理失败')
      }

      details.logo = preview.url

      // 同步到 API（仅 logo，标记 source 为 javbus）
      const result = await this.apiClient.syncPublisherDetails(publisher.id, details)

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      this.stats.processedPublishers++
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
   * 仅更新 logo（logo 补全模式）
   */
  private async processLogoUpdate(publisher: PendingPublisher, page: any): Promise<void> {
    try {
      // 只爬取页面获取 logo
      const details = await this.javbusStrategy.crawlPublisherDetails(publisher.sourceUrl, page)

      if (!details || !details.logo) {
        throw new Error('未能获取 logo')
      }

      // 上传 logo 到 R2
      console.log(`   📤 上传 logo 到 R2...`)
      const logoImages = await this.imageProcessor.process(
        details.logo,
        `publishers/${publisher.id}`,
        'logo',
      )
      const preview = logoImages.find(i => i.variant === 'preview')

      if (!preview) {
        throw new Error('Logo 处理失败')
      }

      // 仅更新 logo 字段
      const result = await this.apiClient.syncPublisherDetails(publisher.id, {
        source: details.source,
        sourceId: details.sourceId,
        sourceUrl: details.sourceUrl,
        logo: preview.url,
      })

      if (!result || !result.success) {
        throw new Error('API 同步失败')
      }

      this.stats.processedPublishers++
      console.log(`   ✅ Logo 已更新: ${preview.url}`)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ❌ Logo 更新失败: ${errorMessage}`)

      const errorObj = error instanceof Error ? error : new Error(errorMessage)
      this.failedTasks.record(publisher.sourceUrl, errorObj, publisher.crawlFailureCount + 1)
      this.stats.failedPublishers++
    }
  }

  /**
   * 计算数据完整度
   *
   * SeesaaWiki 权重:
   * - logo: 30%
   * - website: 20%
   * - twitter: 10%
   * - instagram: 10%
   * - description: 15%
   * - 系列关系: 15% (parentPublisher/brandSeries)
   */
  private calculateCompleteness(details: any, wikiDetails: any): number {
    let score = 0

    // Logo (30%)
    if (details.logo)
      score += 0.30

    // 官网 (20%)
    if (details.website)
      score += 0.20

    // 社交媒体 (20%)
    if (details.twitter)
      score += 0.10
    if (details.instagram)
      score += 0.10

    // 简介 (15%)
    if (wikiDetails?.description)
      score += 0.15

    // 系列关系 (15%)
    if (details.parentPublisher)
      score += 0.075
    if (details.brandSeries)
      score += 0.075

    return score
  }

  /**
   * 更新数据完整度统计
   */
  private updateDataCompletenessStats(details: any, wikiDetails: any): void {
    if (details.logo)
      this.stats.dataCompleteness.hasLogo++
    if (details.website)
      this.stats.dataCompleteness.hasWebsite++
    if (details.twitter)
      this.stats.dataCompleteness.hasTwitter++
    if (details.instagram)
      this.stats.dataCompleteness.hasInstagram++
    if (wikiDetails?.description)
      this.stats.dataCompleteness.hasDescription++
    if (details.parentPublisher)
      this.stats.dataCompleteness.hasParentPublisher++
    if (details.brandSeries)
      this.stats.dataCompleteness.hasBrandSeries++
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

    const totalProcessed = this.stats.processedPublishers + this.stats.failedPublishers + this.stats.skippedPublishers

    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 厂商爬取统计报告 (SeesaaWiki 数据源)')
    console.log('='.repeat(60))

    console.log(`\n总数: ${totalProcessed}`)
    console.log(`成功: ${this.stats.processedPublishers} ✅`)
    console.log(`失败: ${this.stats.failedPublishers} ❌`)
    console.log(`跳过: ${this.stats.skippedPublishers}`)
    console.log(`名字匹配失败: ${this.stats.nameMappingFailed}`)

    const successRate = totalProcessed > 0
      ? ((this.stats.processedPublishers / totalProcessed) * 100).toFixed(1)
      : '0.0'
    console.log(`成功率: ${successRate}%`)

    // 数据完整度统计（基于 SeesaaWiki 新字段）
    if (this.stats.processedPublishers > 0) {
      const processed = this.stats.processedPublishers
      console.log(`\n数据完整度 (SeesaaWiki):`)
      console.log(`  - Logo: ${((this.stats.dataCompleteness.hasLogo / processed) * 100).toFixed(0)}%`)
      console.log(`  - 官网: ${((this.stats.dataCompleteness.hasWebsite / processed) * 100).toFixed(0)}%`)
      console.log(`  - Twitter: ${((this.stats.dataCompleteness.hasTwitter / processed) * 100).toFixed(0)}%`)
      console.log(`  - Instagram: ${((this.stats.dataCompleteness.hasInstagram / processed) * 100).toFixed(0)}%`)
      console.log(`  - 简介: ${((this.stats.dataCompleteness.hasDescription / processed) * 100).toFixed(0)}%`)
      console.log(`  - 母公司: ${((this.stats.dataCompleteness.hasParentPublisher / processed) * 100).toFixed(0)}%`)
      console.log(`  - 子品牌: ${((this.stats.dataCompleteness.hasBrandSeries / processed) * 100).toFixed(0)}%`)

      // 计算平均完整度（使用新权重）
      const totalWeight = (
        this.stats.dataCompleteness.hasLogo * 0.30
        + this.stats.dataCompleteness.hasWebsite * 0.20
        + this.stats.dataCompleteness.hasTwitter * 0.10
        + this.stats.dataCompleteness.hasInstagram * 0.10
        + this.stats.dataCompleteness.hasDescription * 0.15
        + this.stats.dataCompleteness.hasParentPublisher * 0.075
        + this.stats.dataCompleteness.hasBrandSeries * 0.075
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

    // 名字映射统计
    const mapperStats = this.nameMapper.getStats()
    console.log(`\n📊 名字映射统计:`)
    console.log(`  - 厂商映射: ${mapperStats.publisherMappings} 条`)
    console.log(`  - 未匹配: ${mapperStats.unmappedPublishers} 条`)

    console.log(`${'='.repeat(60)}\n`)
  }
}
