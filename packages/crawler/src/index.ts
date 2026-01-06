/* eslint-disable no-console */
import type { CrawlStrategy } from './lib/strategy'
import process from 'node:process'
import { BaseCrawler } from './lib/base-crawler'
import { Site92Hm } from './strategies/site-92hm'
import { SiteSe8 } from './strategies/site-se8'
import 'dotenv/config' // Must be first

class Runner extends BaseCrawler {
  private strategies: CrawlStrategy[] = [
    new Site92Hm(),
    new SiteSe8(),
  ]

  private queue: string[] = []
  private visited = new Set<string>()
  private MAX_PAGES = 100 // Safety limit for now

  async run() {
    const startUrl = process.argv[2]

    if (!startUrl) {
      console.warn('鈻 Please provide a target URL as an argument.')
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
          console.warn(`鈻 No strategy for ${url}, skipping.`)
          continue
        }

        const page = await this.browser!.newPage()
        try {
          // 1. Determine Type (Heuristic)
          const isBookList = url.includes('booklist') || url.includes('/list/')
          const isChapter = url.includes('/chapter/') || url.includes('/read/') // Basic heuristic, strategy can refine
          const isManga = url.includes('/book/') || url.includes('/manhua/')

          if (isBookList && strategy.getMangaList) {
            console.log('鈻 Detected List Page. Discovering...')
            const { mangas, next } = await strategy.getMangaList(url, page)

            // Add mangas to queue
            const fullMangaUrls = mangas.map(u => u.startsWith('http') ? u : `${strategy.baseUrl}${u}`)
            fullMangaUrls.forEach((u) => {
              if (!this.visited.has(u))
                this.queue.push(u)
            })
            console.log(`  + Discovered ${mangas.length} mangas`)

            // Add next page
            if (next) {
              const nextUrl = next.startsWith('http') ? next : `${strategy.baseUrl}${next}`
              if (!this.visited.has(nextUrl)) {
                this.queue.push(nextUrl)
                console.log(`  + Next Page found: ${nextUrl}`)
              }
            }
          }
          else if (isChapter) {
            console.log('鈻 Detected Chapter Page. Fetching content...')
            const content = await strategy.getChapterContent(url, page)
            console.log('鉁 Chapter Content:', {
              title: content.title,
              imageCount: content.images.length,
            })
            // TODO: Process images
          }
          else if (isManga) {
            console.log('鈻 Detected Manga Page. Syncing info...')
            const info = await strategy.getMangaInfo(url, page)

            // Normalize
            info.chapters = info.chapters.map(c => ({
              ...c,
              url: c.url.startsWith('http') ? c.url : `${strategy.baseUrl}${c.url}`,
            }))

            console.log(`  Syncing ${info.title} (${info.chapters.length} chapters)...`)
            // Sync to API
            await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })
          }
          else {
            console.log('鈻 Unknown URL type, assuming Manga Info...')
            // Fallback
            const info = await strategy.getMangaInfo(url, page)
            await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })
          }
        }
        catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`鉁 Failed to process ${url}: ${msg}`)
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
  // Validate Env
  const requiredEnv = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'CRAWLER_SECRET']
  const missing = requiredEnv.filter(k => !process.env[k])

  if (missing.length > 0) {
    console.warn(`鈻 Missing environment variables: ${missing.join(', ')}`)
    // return // Allow running without env for local strategy testing
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
