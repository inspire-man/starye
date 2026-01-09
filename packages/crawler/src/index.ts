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
  private MAX_PAGES = 100000
  private processedCount = 0
  private activeWorkers = 0
  private CONCURRENCY = Number(process.env.CONCURRENCY) || 20

  async run() {
    const startUrl = process.argv[2]

    if (!startUrl) {
      console.warn('⚠️  Please provide a target URL or "full" as an argument.')
      console.log('Example: pnpm start https://www.92hm.life/booklist?end=0')
      console.log('Example: pnpm start full')
      return
    }

    await this.initBrowser()

    try {
      if (startUrl === 'full') {
        console.log('🚀 Starting Full Scan Mode...')
        this.MAX_PAGES = 50000 // 增加爬取上限

        const tags = [
          '青春',
          '性感',
          '长腿',
          '多人',
          '御姐',
          '巨乳',
          '新婚',
          '媳妇',
          '暧昧',
          '清纯',
          '调教',
          '少妇',
          '风骚',
          '同居',
          '淫乱',
          '好友',
          '女神',
          '诱惑',
          '偷情',
          '出轨',
          '正妹',
          '家教',
        ]
        const areas = [1, 2, 3] // 1:韩国, 2:日本, 3:台湾
        const ends = [0, 1] // 0:连载, 1:完结

        for (const tag of tags) {
          for (const area of areas) {
            for (const end of ends) {
              const url = `https://www.92hm.life/booklist?tag=${encodeURIComponent(tag)}&area=${area}&end=${end}`
              this.queue.push(url)
            }
          }
        }
        console.log(`✅ Generated ${this.queue.length} seed URLs.`)
      }
      else {
        this.queue.push(startUrl)
      }

      // 启动 Worker Pool
      const workers = Array.from({ length: this.CONCURRENCY }).fill(null).map((_, i) => this.worker(i + 1))
      await Promise.all(workers)

      console.log('🎉 All tasks completed!')
    }
    finally {
      await this.closeBrowser()
    }
  }

  private async worker(id: number) {
    console.log(`👷 Worker ${id} started`)

    while (this.processedCount < this.MAX_PAGES) {
      const url = this.queue.shift()

      // 队列为空，且没有其他 Worker 在工作（说明真的没任务了），则退出
      if (!url) {
        if (this.activeWorkers === 0 && this.queue.length === 0) {
          break
        }
        // 如果队列暂时为空但其他 Worker 还在跑，可能产生新连接，稍微等待
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      if (this.visited.has(url))
        continue
      this.visited.add(url)

      this.activeWorkers++
      this.processedCount++
      console.log(`[Worker ${id}] [${this.processedCount}/${this.MAX_PAGES}] Processing: ${url} (Queue: ${this.queue.length})`)

      try {
        await this.processUrl(url)
      }
      catch (e) {
        console.error(`[Worker ${id}] ❌ Error processing ${url}:`, e)
      }
      finally {
        this.activeWorkers--
        // 随机延迟防止封禁
        const delay = Math.floor(Math.random() * 500) + 500
        await new Promise(r => setTimeout(r, delay))
      }
    }
    console.log(`👷 Worker ${id} finished`)
  }

  private async processUrl(url: string) {
    const strategy = this.strategies.find(s => s.match(url))
    if (!strategy) {
      console.warn(`⚠️  No strategy for ${url}, skipping.`)
      return
    }

    const page = await this.browser!.newPage()
    page.on('console', msg => console.log('PAGE LOG:', msg.text()))
    try {
      const isBookList = url.includes('booklist') || url.includes('/list/')
      const isChapter = url.includes('/chapter/') || url.includes('/read/')
      const isManga = url.includes('/book/') || url.includes('/manhua/')

      if (isBookList && strategy.getMangaList) {
        console.log('📋 Detected List Page. Discovering...')
        const { mangas, next } = await strategy.getMangaList(url, page)

        const fullMangaUrls = mangas.map(u => u.startsWith('http') ? u : `${strategy.baseUrl}${u}`)
        fullMangaUrls.forEach((u) => {
          if (!this.visited.has(u))
            this.queue.push(u)
        })
        console.log(`  + Discovered ${mangas.length} mangas`)

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

        // Check if chapter already exists and is complete
        if (content.comicSlug && content.chapterSlug) {
          try {
            const status: any = await this.syncToApi('/api/admin/check-chapter', null, {
              method: 'GET',
              searchParams: { comicSlug: content.comicSlug, chapterSlug: content.chapterSlug },
            })

            if (status && status.exists && status.count > 0 && !status.hasFailures) {
              // Allow small variance in page count
              if (Math.abs(status.count - content.images.length) <= 5) {
                console.log(`  ⏭️  Skipping existing chapter: ${content.title} (${status.count} images)`)
                return
              }
              console.log(`  ⚠️  Chapter update detected (DB: ${status.count}, Site: ${content.images.length}). Re-crawling...`)
            }
          }
          catch {
            console.warn('  ⚠️  Failed to check chapter status, proceeding with crawl.')
          }
        }

        if (content.images.length === 0) {
          console.warn(`⚠️  No images found for ${url}. Dumping HTML...`)
          const fs = await import('node:fs/promises')
          const path = await import('node:path')
          const dumpPath = path.resolve('chapter_content.html')
          await fs.writeFile(dumpPath, await page.content())
          console.log(`Saved HTML to ${dumpPath}`)
        }

        if (content.images.length > 0) {
          console.log(`  Processing ${content.images.length} images...`)

          // 优化配置
          const CONCURRENCY = 10
          const MAX_RETRIES = 3
          const FAILED_IMAGE_PLACEHOLDER = 'https://placehold.co/600x800?text=Image+Load+Failed'

          const total = content.images.length
          let completed = 0

          // 并发控制处理函数
          const processImage = async (imgUrl: string, globalIdx: number) => {
            const filename = String(globalIdx + 1).padStart(3, '0')
            const prefix = `comics/${content.comicSlug}/${content.chapterSlug}`

            let lastError
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                // 强超时控制：每张图最多给 20 秒
                const processPromise = this.imageProcessor.process(imgUrl, prefix, filename)
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Process timeout')), 20000),
                )

                const processed = await Promise.race([processPromise, timeoutPromise]) as any

                const selected = processed.find((p: any) => p.variant === 'preview') || processed.find((p: any) => p.variant === 'original')
                return selected?.url || FAILED_IMAGE_PLACEHOLDER
              }
              catch (e) {
                lastError = e
                // 打印重试日志，但不换行破坏进度条（如果可能），或者简单换行
                process.stdout.write(`\n    ⚠️  Retry ${attempt}/${MAX_RETRIES} for image ${globalIdx + 1}: ${e instanceof Error ? e.message : String(e)}\n`)
                if (attempt < MAX_RETRIES) {
                  // 简单退避: 1s, 2s, ...
                  await new Promise(r => setTimeout(r, attempt * 1000))
                }
              }
            }
            console.error(`  ❌ Failed to process image ${globalIdx + 1}/${total} after ${MAX_RETRIES} attempts: ${imgUrl}`, lastError)
            return FAILED_IMAGE_PLACEHOLDER
          }
          // 使用分块并发 (Chunked Concurrency) - 简单且有效
          // 为了避免 Promise.all 一次性加载太多导致内存爆涨，我们还是分块，但块大一点
          const processedUrls: string[] = Array.from({ length: total }, () => '')

          for (let i = 0; i < total; i += CONCURRENCY) {
            const chunk = content.images.slice(i, i + CONCURRENCY)
            const chunkPromises = chunk.map((imgUrl, idx) => {
              const globalIdx = i + idx
              return processImage(imgUrl, globalIdx).then((url) => {
                processedUrls[globalIdx] = url
                completed++
                // 简单的进度打印
                if (completed % 5 === 0 || completed === total) {
                  process.stdout.write(`\r  ⏳ Progress: ${completed}/${total} (${Math.round(completed / total * 100)}%)`)
                }
              })
            })

            await Promise.all(chunkPromises)
          }

          console.log('\n  ✅ Image processing complete.')

          if (processedUrls.length > 0) {
            await this.syncToApi('/api/admin/sync', {
              type: 'chapter',
              data: {
                comicSlug: content.comicSlug,
                chapterSlug: content.chapterSlug,
                title: content.title,
                images: processedUrls,
              },
            })
          }
        }
      }
      else if (isManga) {
        console.log('📚 Detected Manga Page. Syncing info...')
        const info = await strategy.getMangaInfo(url, page)

        info.chapters = info.chapters
          .map(c => ({
            ...c,
            url: c.url.startsWith('http') ? c.url : `${strategy.baseUrl}${c.url}`,
          }))
          .filter(c => c.title && c.slug && c.url)

        if (info.title && info.slug) {
          console.log(`  Syncing ${info.title} (${info.chapters.length} chapters)...`)
          await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })

          // Enqueue chapters for processing
          let addedCount = 0
          for (const chapter of info.chapters) {
            const chapterUrl = chapter.url.startsWith('http') ? chapter.url : `${strategy.baseUrl}${chapter.url}`
            // Optional: Check constraint (e.g. only latest 5 if full scan to save time?)
            // For now, enqueue all. The check-chapter logic in isChapter will skip existing ones.
            if (!this.visited.has(chapterUrl)) {
              this.queue.push(chapterUrl)
              addedCount++
            }
          }
          console.log(`  + Enqueued ${addedCount} chapters for ${info.title}`)
        }
      }
    }
    finally {
      await page.close()
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
