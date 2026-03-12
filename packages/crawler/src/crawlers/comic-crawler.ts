/* eslint-disable no-console */
import type { Page } from 'puppeteer-core'
import type { CrawlerConfig } from '../lib/base-crawler'
import type { CrawlStrategy } from '../lib/strategy'
import type { Site92Hm } from '../strategies/site-92hm'
import pMap from 'p-map'
import { CRAWL_CONFIG } from '../config/crawl.config'
import { FailedTaskRecorder } from '../lib/anti-detection'
import { BaseCrawler } from '../lib/base-crawler'

interface MangaStatus {
  exists: boolean
  status?: 'pending' | 'partial' | 'complete'
  totalChapters?: number
  crawledChapters?: number
  lastCrawledAt?: string
  isSerializing?: boolean
  comicStatus?: 'serializing' | 'completed'
}

export class ComicCrawler extends BaseCrawler {
  private failedTasks: FailedTaskRecorder

  constructor(
    config: CrawlerConfig,
    private strategy: CrawlStrategy,
    private startUrl: string,
  ) {
    super(config)
    this.failedTasks = new FailedTaskRecorder()
  }

  async run() {
    await this.initBrowser()
    const page = await this.createPage()

    try {
      console.log(`🚀 Starting crawl for: ${this.startUrl}`)
      await this.processUrl(this.startUrl, page)
    }
    catch (error) {
      console.error('❌ Crawl failed:', error)
    }
    finally {
      // 输出成功率统计
      if ((this.strategy as Site92Hm).getSuccessRateStats) {
        const stats = (this.strategy as Site92Hm).getSuccessRateStats()
        console.log(`
📊 成功率统计:
  总请求: ${stats.total}
  成功: ${stats.successes}
  失败: ${stats.failures}
  成功率: ${(stats.successRate * 100).toFixed(1)}%`)
      }

      // 输出失败任务摘要
      this.failedTasks.printSummary()

      await this.closeBrowser()
    }
  }

  private extractSlug(url: string): string {
    // 从 URL 提取 slug (假设 URL 格式为 .../book/slug 或 .../book/1234)
    const match = url.match(/\/book\/([^/?]+)/)
    return match ? match[1] : url
  }

  private async processUrl(url: string, page: Page) {
    // 软超时记录
    const startTime = Date.now()
    const timeoutMs = CRAWL_CONFIG.limits.timeoutMinutes * 60 * 1000

    // 1. Determine if it's a list page or detail page
    let currentUrl = url
    let hasNextPage = true
    let pageCount = 1
    let totalProcessedMangas = 0

    while (hasNextPage) {
      console.log(`
📄 Processing List Page ${pageCount}: ${currentUrl}`)

      // Check if strategy implements getMangaList
      if (!this.strategy.getMangaList) {
        console.warn('⚠️ Strategy does not support list parsing. Treating as detail page.')
        await this.processManga(currentUrl, page, {})
        break
      }

      const { mangas, next } = await this.strategy.getMangaList(currentUrl, page)
      console.log(`✅ Found ${mangas.length} mangas on page ${pageCount}`)

      // 检查 maxMangasPerRun 限制
      const remainingSlots = CRAWL_CONFIG.limits.maxMangasPerRun - totalProcessedMangas
      if (remainingSlots <= 0) {
        console.log(`⏸️  已达到漫画处理上限 (${CRAWL_CONFIG.limits.maxMangasPerRun})，停止处理`)
        break
      }

      // 限制本页处理数量
      const mangasToProcess = mangas.slice(0, remainingSlots)

      // 批量状态查询
      const slugs = mangasToProcess.map(mangaUrl => this.extractSlug(mangaUrl))
      const statusMap = await this.batchQueryStatus(slugs)

      // 优先级排序
      const sortedMangas = this.sortMangasByPriority(mangasToProcess, statusMap)

      console.log(`
📊 漫画优先级排序完成:`)
      sortedMangas.slice(0, 5).forEach((mangaUrl, i) => {
        const slug = this.extractSlug(mangaUrl)
        const status = statusMap.get(slug)
        console.log(`  ${i + 1}. ${slug} - status: ${status?.status || 'new'}`)
      })

      // 漫画级并发处理
      let processedMangaCount = 0
      await pMap(sortedMangas, async (mangaUrl) => {
        // 检查软超时
        const elapsed = Date.now() - startTime
        if (elapsed > timeoutMs) {
          console.log(`⏰ 接近超时限制 (${Math.floor(elapsed / 60000)} 分钟)，优雅退出`)
          return
        }

        processedMangaCount++
        totalProcessedMangas++

        try {
          const slug = this.extractSlug(mangaUrl)
          const status = statusMap.get(slug)
          console.log(`
📘 处理漫画 ${processedMangaCount}/${sortedMangas.length}: ${mangaUrl} (状态: ${status?.status || 'new'})`)
          await this.processManga(mangaUrl, page, status || {})
        }
        catch (e) {
          console.error(`❌ Failed to process manga ${mangaUrl}:`, e)
          this.failedTasks.record(mangaUrl, e as Error, 1)
        }
      }, { concurrency: CRAWL_CONFIG.concurrency.manga })

      // 检查软超时
      const elapsed = Date.now() - startTime
      if (elapsed > timeoutMs) {
        console.log(`⏰ 接近超时限制 (${Math.floor(elapsed / 60000)} 分钟)，停止分页`)
        break
      }

      if (next && next !== currentUrl) {
        currentUrl = next
        pageCount++
      }
      else {
        hasNextPage = false
        console.log('✅ Reached end of list')
      }
    }

    console.log(`
🎉 爬取完成！共处理 ${totalProcessedMangas} 个漫画`)
  }

  private async batchQueryStatus(slugs: string[]): Promise<Map<string, MangaStatus>> {
    if (slugs.length === 0) {
      return new Map()
    }

    try {
      console.log(`🔍 批量查询 ${slugs.length} 个漫画状态...`)
      const slugsParam = slugs.join(',')
      const response = await this.syncToApi(
        `/api/admin/comics/batch-status?slugs=${slugsParam}`,
        null,
        { method: 'GET' },
      ) as Record<string, MangaStatus>

      const statusMap = new Map<string, MangaStatus>()
      for (const slug of slugs) {
        if (response[slug]) {
          statusMap.set(slug, response[slug])
        }
      }

      console.log(`  ✅ 查询完成：存在 ${[...statusMap.values()].filter(s => s.exists).length}/${slugs.length}`)
      return statusMap
    }
    catch (e) {
      console.warn('⚠️ 批量状态查询失败，将作为新漫画处理:', e)
      return new Map()
    }
  }

  private sortMangasByPriority(mangas: string[], statusMap: Map<string, MangaStatus>): string[] {
    return mangas.toSorted((a, b) => {
      const slugA = this.extractSlug(a)
      const slugB = this.extractSlug(b)
      const statusA = statusMap.get(slugA)
      const statusB = statusMap.get(slugB)

      const priorityA = this.calculatePriority(statusA)
      const priorityB = this.calculatePriority(statusB)

      if (priorityA !== priorityB) {
        return priorityB - priorityA // 高优先级在前
      }

      // 同优先级按最后爬取时间升序（最久未爬的优先）
      const timeA = statusA?.lastCrawledAt ? new Date(statusA.lastCrawledAt).getTime() : 0
      const timeB = statusB?.lastCrawledAt ? new Date(statusB.lastCrawledAt).getTime() : 0
      return timeA - timeB
    })
  }

  private calculatePriority(status?: MangaStatus): number {
    if (!status || !status.exists) {
      return 50 // 新漫画：中等优先级
    }

    // 连载中 + 已完成爬取 = 高优先级（可能有新章节）
    if (status.status === 'complete' && status.isSerializing) {
      return 100
    }

    // 部分完成：中高优先级
    if (status.status === 'partial') {
      return 70
    }

    // 未开始：中等优先级
    if (status.status === 'pending') {
      return 50
    }

    // 已完结且已完成：低优先级
    if (status.status === 'complete' && !status.isSerializing) {
      return 10
    }

    return 30 // 其他情况
  }

  private async processManga(url: string, page: Page, status: Partial<MangaStatus>) {
    console.log(`
📘 Processing Manga: ${url}`)
    const info = await this.strategy.getMangaInfo(url, page)

    // 检查是否跳过（已完结且已完成）
    if (status.exists && status.status === 'complete' && !status.isSerializing) {
      console.log(`⏭️  跳过已完结漫画: ${info.title}`)
      return
    }

    // 开始标记
    let crawledChapters = status.crawledChapters || 0
    const totalChapters = info.chapters.length

    try {
      // 1. Download Cover
      if (info.cover) {
        try {
          const coverImages = await this.imageProcessor.process(
            info.cover,
            `comics/${info.slug}`,
            'cover',
          )
          const preview = coverImages.find(i => i.variant === 'preview')
          if (preview) {
            info.cover = preview.url
          }
        }
        catch (e) {
          console.warn(`⚠️ Failed to download cover for ${info.title}:`, e)
        }
      }

      // 2. Sync Metadata
      await this.syncToApi('/api/admin/sync', {
        type: 'manga',
        data: {
          ...info,
          chapters: info.chapters.map(c => ({
            title: c.title,
            slug: c.slug,
            number: c.number,
            url: c.url,
          })),
        },
      })

      // 3. Check Existing Chapters to skip
      let existingChapters: string[] = []
      try {
        const res = await this.syncToApi(
          `/api/admin/comics/${info.slug}/existing-chapters`,
          null,
          { method: 'GET' },
        ) as string[] | null

        if (res && Array.isArray(res)) {
          existingChapters = res
        }
      }
      catch {
        console.warn('⚠️ Failed to fetch existing chapters, syncing all.')
      }

      // 4. 确定要处理的章节列表（根据状态应用限制）
      let chaptersToProcess = info.chapters.filter(ch => !existingChapters.includes(ch.slug))

      if (status.exists) {
        if (status.status === 'pending') {
          // 新漫画：限制章节数
          chaptersToProcess = chaptersToProcess.slice(0, CRAWL_CONFIG.limits.maxChaptersPerNew)
          console.log(`  📏 限制章节数: 处理 ${chaptersToProcess.length}/${info.chapters.length} 章（状态: pending）`)
        }
        else if (status.status === 'partial') {
          // 部分完成：继续处理
          chaptersToProcess = chaptersToProcess.slice(0, CRAWL_CONFIG.limits.maxChaptersPerNew)
          console.log(`  📏 限制章节数: 处理 ${chaptersToProcess.length}/${info.chapters.length} 章（状态: partial）`)
        }
        else if (status.status === 'complete' && status.isSerializing) {
          // 连载中：仅处理新章节
          chaptersToProcess = chaptersToProcess.slice(0, CRAWL_CONFIG.limits.maxChaptersPerUpdate)
          console.log(`  📏 限制章节数: 处理 ${chaptersToProcess.length}/${info.chapters.length} 章（状态: complete, 连载中）`)
        }
      }
      else {
        // 全新漫画
        chaptersToProcess = chaptersToProcess.slice(0, CRAWL_CONFIG.limits.maxChaptersPerNew)
        console.log(`  📏 限制章节数: 处理 ${chaptersToProcess.length}/${info.chapters.length} 章（新漫画）`)
      }

      console.log(`  📚 准备处理 ${chaptersToProcess.length} 个章节（跳过 ${existingChapters.length} 个已存在）`)

      // 5. Process Chapters (并发处理)
      let processedCount = 0

      await pMap(chaptersToProcess, async (chapter) => {
        processedCount++
        console.log(`📖 处理章节 ${processedCount}/${chaptersToProcess.length} - ${chapter.title}`)
        try {
          const content = await this.strategy.getChapterContent(chapter.url, page)

          // 批量并发上传图片
          const imageUrls: string[] = []
          const totalImages = content.images.length
          const batchSize = CRAWL_CONFIG.concurrency.imageBatch

          console.log(`  📦 处理 ${totalImages} 张图片，批量大小: ${batchSize}`)

          // 分批处理
          for (let batchIndex = 0; batchIndex < totalImages; batchIndex += batchSize) {
            const batch = content.images.slice(batchIndex, batchIndex + batchSize)
            const batchNum = Math.floor(batchIndex / batchSize) + 1
            const totalBatches = Math.ceil(totalImages / batchSize)

            console.log(`  🔄 批次 ${batchNum}/${totalBatches}: 处理 ${batch.length} 张图片`)

            // 并发处理批次内的图片
            const batchResults = await Promise.all(
              batch.map(async (rawUrl, batchLocalIndex) => {
                const globalIndex = batchIndex + batchLocalIndex
                try {
                  const processed = await this.imageProcessor.process(
                    rawUrl,
                    `comics/${info.slug}/${chapter.slug}`,
                    String(globalIndex + 1).padStart(3, '0'),
                  )

                  const targetVariant = processed.find(p => p.variant === 'original') || processed[0]
                  return targetVariant?.url || 'https://placehold.co/800x1200?text=Image+Load+Failed'
                }
                catch (e) {
                  console.warn(`  ⚠️ 图片 ${globalIndex + 1} 处理失败:`, e)
                  return 'https://placehold.co/800x1200?text=Image+Load+Failed'
                }
              }),
            )

            imageUrls.push(...batchResults)
            console.log(`  ✅ 批次 ${batchNum}/${totalBatches} 完成，已处理 ${imageUrls.length}/${totalImages} 张图片`)
          }

          // Sync Chapter Pages
          await this.syncToApi('/api/admin/sync', {
            type: 'chapter',
            data: {
              title: content.title,
              comicSlug: info.slug,
              chapterSlug: chapter.slug,
              images: imageUrls,
            },
          })

          crawledChapters++
          console.log(`  ✅ 章节 ${processedCount}/${chaptersToProcess.length} - ${chapter.title} 完成`)
        }
        catch (e) {
          console.error(`  ❌ 章节 ${chapter.title} 处理失败:`, e)
        }
      }, { concurrency: CRAWL_CONFIG.concurrency.chapter })

      // 6. 更新爬取状态
      const newStatus = crawledChapters >= totalChapters ? 'complete' : 'partial'
      await this.updateProgress(info.slug, newStatus, crawledChapters, totalChapters)
    }
    catch (e) {
      console.error(`❌ 漫画处理失败: ${info.title}`, e)
      // 即使失败也尝试更新状态
      await this.updateProgress(info.slug, 'partial', crawledChapters, totalChapters)
      throw e
    }
  }

  private async updateProgress(slug: string, status: 'pending' | 'partial' | 'complete', crawledChapters: number, totalChapters: number) {
    try {
      await this.syncToApi(
        `/api/admin/comics/${slug}/progress`,
        {
          status,
          crawledChapters,
          totalChapters,
        },
        { method: 'POST' },
      )
      console.log(`  📊 进度更新: ${slug} - ${status} (${crawledChapters}/${totalChapters})`)
    }
    catch (e) {
      console.warn(`  ⚠️ 进度更新失败:`, e)
    }
  }
}
