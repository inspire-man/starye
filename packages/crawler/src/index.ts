/* eslint-disable no-console */
import type { CrawlStrategy, MovieCrawlStrategy } from './lib/strategy'
import process from 'node:process'
import { BaseCrawler } from './lib/base-crawler'
// import { JavDBStrategy } from './strategies/javdb'
import { JavBusStrategy } from './strategies/javbus'
import { Site92Hm } from './strategies/site-92hm'
import { SiteSe8 } from './strategies/site-se8'
import 'dotenv/config'

type Strategy = CrawlStrategy | MovieCrawlStrategy

class Runner extends BaseCrawler {
  private strategies: Strategy[] = [
    new Site92Hm(),
    new SiteSe8(),
    // new JavDBStrategy(),
    new JavBusStrategy(),
  ]

  private queue: string[] = []
  private visited = new Set<string>()
  private MAX_PAGES = 100000
  private processedCount = 0
  private activeWorkers = 0
  private CONCURRENCY = Number(process.env.CONCURRENCY) || 2

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

        // 默认扫描漫画入口
        const tags = ['青春', '性感', '长腿', '多人', '御姐', '巨乳', '新婚', '媳妇', '暧昧', '清纯', '调教', '少妇', '风骚', '同居', '淫乱', '好友', '女神', '诱惑', '偷情', '出轨', '正妹', '家教']
        const areas = [1, 2, 3]
        const ends = [0, 1]

        for (const tag of tags) {
          for (const area of areas) {
            for (const end of ends) {
              const url = `https://www.92hm.life/booklist?tag=${encodeURIComponent(tag)}&area=${area}&end=${end}`
              this.queue.push(url)
            }
          }
        }

        // 增加电影抓取入口
        this.queue.push('https://javdb457.com/')

        console.log(`✅ Generated ${this.queue.length} seed URLs.`)
      }
      else {
        this.queue.push(startUrl)
      }

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

      if (!url) {
        if (this.activeWorkers === 0 && this.queue.length === 0) {
          break
        }
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

    const page = await this.createPage()
    page.on('console', msg => console.log('PAGE LOG:', msg.text()))

    try {
      // 区分漫画策略和电影策略
      if ('getChapterContent' in strategy) {
        await this.processManga(url, page, strategy as CrawlStrategy)
      }
      else if ('getMovieInfo' in strategy) {
        await this.processMovie(url, page, strategy as MovieCrawlStrategy)
      }
    }
    finally {
      await page.close()
    }
  }

  private async processMovie(url: string, page: any, strategy: MovieCrawlStrategy) {
    let isDetail = url.includes('/v/') // JavDB

    if (strategy.name === 'javbus') {
      const path = new URL(url).pathname
      // JavBus detail URLs are like /SSIS-001. A simple regex can check for this pattern.
      // It should not match list pages like /genre/sub, /page/2, etc.
      isDetail = /^\/[A-Z]+-\d+$/i.test(path)
    }

    if (isDetail) {
      console.log('🎬 Detected Movie Detail Page. Syncing info...')
      const info = await strategy.getMovieInfo(url, page)

      if (info.title && info.slug) {
        console.log(`  Syncing Movie: ${info.title} (${info.code})...`)
        await this.syncToApi('/api/movies/sync', { type: 'movie', data: info })
      }
    }
    else {
      console.log('📋 Detected Movie List Page. Discovering...')
      const { movies, next } = await strategy.getMovieList(url, page)

      movies.forEach((u) => {
        if (!this.visited.has(u))
          this.queue.push(u)
      })
      console.log(`  + Discovered ${movies.length} movies`)

      if (next) {
        const nextUrl = next.startsWith('http') ? next : `${strategy.baseUrl}${next}`
        if (!this.visited.has(nextUrl)) {
          this.queue.push(nextUrl)
          console.log(`  + Next Page found: ${nextUrl}`)
        }
      }
    }
  }

  private async processManga(url: string, page: any, strategy: CrawlStrategy) {
    const isBookList = url.includes('booklist') || url.includes('/list/')
    const isChapter = url.includes('/chapter/') || url.includes('/read/')
    const isManga = url.includes('/book/') || url.includes('/manhua/')

    if (isBookList && strategy.getMangaList) {
      const { mangas, next } = await strategy.getMangaList(url, page)
      mangas.map(u => u.startsWith('http') ? u : `${strategy.baseUrl}${u}`).forEach((u) => {
        if (!this.visited.has(u))
          this.queue.push(u)
      })
      if (next) {
        const nextUrl = next.startsWith('http') ? next : `${strategy.baseUrl}${next}`
        if (!this.visited.has(nextUrl))
          this.queue.push(nextUrl)
      }
    }
    else if (isChapter) {
      const content = await strategy.getChapterContent(url, page)
      if (content.images.length > 0) {
        // Optimization: Check if chapter exists and is complete
        try {
          const check = await this.syncToApi('/api/admin/check-chapter', undefined, {
            method: 'GET',
            searchParams: {
              comicSlug: content.comicSlug,
              chapterSlug: content.chapterSlug,
              sourceCount: String(content.images.length),
            },
          }) as any

          if (check.exists && !check.hasFailures && check.count >= content.images.length) {
            console.log(`⏩ [Skip] Chapter ${content.comicSlug}/${content.chapterSlug} already exists (${check.count}/${content.images.length} images).`)
            return
          }
        }
        catch (e) {
          console.warn('⚠️ Failed to check chapter status, proceeding with crawl.', e)
        }

        const processedUrls: string[] = []
        for (let i = 0; i < content.images.length; i++) {
          try {
            const processed = await this.imageProcessor.process(content.images[i], `comics/${content.comicSlug}/${content.chapterSlug}`, String(i + 1).padStart(3, '0')) as any
            const selected = processed.find((p: any) => p.variant === 'preview') || processed.find((p: any) => p.variant === 'original')
            processedUrls.push(selected?.url || '')
          }
          catch (e) { console.error(e) }
        }
        await this.syncToApi('/api/admin/sync', {
          type: 'chapter',
          data: { ...content, images: processedUrls.filter(Boolean) },
        })
      }
    }
    else if (isManga) {
      const info = await strategy.getMangaInfo(url, page)
      await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })

      // Optimization: Fetch existing chapters to skip what's already done
      let existingChapters: Set<string> = new Set()
      try {
        const existingList = await this.syncToApi(`/api/admin/comics/${info.slug}/existing-chapters`, undefined, { method: 'GET' }) as string[]
        existingChapters = new Set(existingList)
      }
      catch {
        console.warn(`⚠️ Failed to fetch existing chapters for ${info.slug}, proceeding with full crawl.`)
      }

      let skippedCount = 0
      info.chapters.forEach((c) => {
        const cUrl = c.url.startsWith('http') ? c.url : `${strategy.baseUrl}${c.url}`

        // Use the slug from MangaInfo (parsed from strategies)
        if (c.slug && existingChapters.has(c.slug)) {
          skippedCount++
          // Mark as visited to prevent reprocessing if encountered elsewhere
          this.visited.add(cUrl)
          return
        }

        if (!this.visited.has(cUrl))
          this.queue.push(cUrl)
      })

      if (skippedCount > 0) {
        console.log(`⏩ [Smart Skip] Skipped ${skippedCount}/${info.chapters.length} existing chapters for ${info.title}`)
      }
    }
  }
}

async function main() {
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
