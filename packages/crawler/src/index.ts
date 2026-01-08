/* eslint-disable no-console */
import type { CrawlStrategy } from './lib/strategy'
import process from 'node:process'
import { BaseCrawler } from './lib/base-crawler'
import { Site92Hm } from './strategies/site-92hm'
import { SiteSe8 } from './strategies/site-se8'
import 'dotenv/config'

class Runner extends BaseCrawler {
  private strategies: CrawlStrategy[] = [
    new Site92Hm(),
    new SiteSe8(),
  ]

  private queue: string[] = []
  private visited = new Set<string>()
  private MAX_PAGES = 100 // 安全限制，防止无限爬取

  async run() {
    const startUrl = process.argv[2]

    if (!startUrl) {
      console.warn('⚠️  Please provide a target URL as an argument.')
      console.log('Example: pnpm start https://www.92hm.life/booklist?end=0')
      return
    }

    this.queue.push(startUrl)
    await this.initBrowser()

    try {
      let processedCount = 0

      while (this.queue.length > 0 && processedCount < this.MAX_PAGES) {
        const url = this.queue.shift()!

        if (this.visited.has(url))
          continue
        this.visited.add(url)
        processedCount++

        console.log(`[${processedCount}/${this.MAX_PAGES}] Processing: ${url} (Queue: ${this.queue.length})`)

        const strategy = this.strategies.find(s => s.match(url))
        if (!strategy) {
          console.warn(`⚠️  No strategy for ${url}, skipping.`)
          continue
        }

        const page = await this.browser!.newPage()
        try {
          // 1. 判断页面类型 (启发式)
          const isBookList = url.includes('booklist') || url.includes('/list/')
          const isChapter = url.includes('/chapter/') || url.includes('/read/')
          const isManga = url.includes('/book/') || url.includes('/manhua/')

          if (isBookList && strategy.getMangaList) {
            console.log('📋 Detected List Page. Discovering...')
            const { mangas, next } = await strategy.getMangaList(url, page)

            // 添加漫画到队列
            const fullMangaUrls = mangas.map(u => u.startsWith('http') ? u : `${strategy.baseUrl}${u}`)
            fullMangaUrls.forEach((u) => {
              if (!this.visited.has(u))
                this.queue.push(u)
            })
            console.log(`  + Discovered ${mangas.length} mangas`)

            // 添加下一页
            if (next) {
              const nextUrl = next.startsWith('http') ? next : `${strategy.baseUrl}${next}`
              if (!this.visited.has(nextUrl)) {
                this.queue.push(nextUrl)
                console.log(`  + Next Page found: ${nextUrl}`)
              }
            }
          }
          else if (isChapter) {
            console.log('📖 Detected Chapter Page. Fetching content...')
            const content = await strategy.getChapterContent(url, page)
            console.log('✅ Chapter Content:', {
              title: content.title,
              imageCount: content.images.length,
              comicSlug: content.comicSlug,
              chapterSlug: content.chapterSlug,
            })

            // 处理图片
            if (content.images.length > 0) {
              console.log(`  Processing ${content.images.length} images...`)
              const processedUrls: string[] = []

              // 分批处理以防止内存溢出 (OOM)
              const BATCH_SIZE = 3
              for (let i = 0; i < content.images.length; i += BATCH_SIZE) {
                const batch = content.images.slice(i, i + BATCH_SIZE)
                console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(content.images.length / BATCH_SIZE)}`)

                const results = await Promise.all(batch.map(async (imgUrl, idx) => {
                  try {
                    // 索引是相对于 batch 的，计算全局索引
                    const globalIdx = i + idx
                    const filename = String(globalIdx + 1).padStart(3, '0')
                    const prefix = `comics/${content.comicSlug}/${content.chapterSlug}`

                    const processed = await this.imageProcessor.process(imgUrl, prefix, filename)
                    // 优先使用预览图，回退到原图
                    const selected = processed.find(p => p.variant === 'preview') || processed.find(p => p.variant === 'original')
                    return selected?.url
                  }
                  catch (e) {
                    console.error(`  ❌ Failed to process image ${imgUrl}:`, e)
                    return null
                  }
                }))

                processedUrls.push(...results.filter((u): u is string => !!u))
              }

              if (processedUrls.length > 0) {
                console.log(`  Syncing ${processedUrls.length} pages to API...`)
                await this.syncToApi('/api/admin/sync', {
                  type: 'chapter',
                  data: {
                    comicSlug: content.comicSlug,
                    chapterSlug: content.chapterSlug,
                    title: content.title,
                    images: processedUrls,
                    // width/height 需要更复杂的逻辑获取，暂默认为 0
                  },
                })
              }
              else {
                console.warn('⚠️  No images were successfully processed.')
              }
            }
          }
          else if (isManga) {
            console.log('📚 Detected Manga Page. Syncing info...')
            const info = await strategy.getMangaInfo(url, page)

            // 标准化和校验
            info.chapters = info.chapters
              .map(c => ({
                ...c,
                url: c.url.startsWith('http') ? c.url : `${strategy.baseUrl}${c.url}`,
              }))
              .filter(c => c.title && c.slug && c.url) // 移除无效章节

            // 同步前校验数据
            if (!info.title || !info.slug) {
              console.error('❌ Invalid manga info: missing title or slug')
              throw new Error('Invalid manga data')
            }

            if (info.chapters.length === 0) {
              console.warn('⚠️  Warning: No chapters found for this manga')
            }

            console.log(`  Syncing ${info.title} (${info.chapters.length} chapters)...`)
            console.log(`  Config: API=${this.config.api.url}, Token=${this.config.api.token.substring(0, 15)}...`)

            // 同步到 API
            await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })
          }
          else {
            console.log('❓ Unknown URL type, assuming Manga Info...')
            // 兜底逻辑
            const info = await strategy.getMangaInfo(url, page)
            await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })
          }
        }
        catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`❌ Failed to process ${url}: ${msg}`)
        }
        finally {
          await page.close()
        }
      }
    }
    finally {
      await this.closeBrowser()
    }
  }
}

async function main() {
  // 校验环境变量
  const requiredEnv = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'CRAWLER_SECRET']
  const missing = requiredEnv.filter(k => !process.env[k])

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`)
    // return // 允许本地测试策略时不带环境变量
  }

  const crawler = new Runner({
    r2: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'mock',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock',
      bucketName: process.env.R2_BUCKET_NAME || 'starye-media',
      publicUrl: process.env.R2_PUBLIC_URL || 'http://localhost:3000',
    },
    api: {
      url: process.env.API_URL || 'http://localhost:8787',
      token: process.env.CRAWLER_SECRET || 'mock',
    },
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
    },
  })

  await crawler.run()
}

main().catch(console.error)
