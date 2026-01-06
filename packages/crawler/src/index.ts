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

  async run() {
    const url = process.argv[2]

    if (!url) {
      console.warn('鈻 Please provide a target URL as an argument.')
      console.log('Example: pnpm start https://www.92hm.life/manhua/123/')
      return
    }

    const strategy = this.strategies.find(s => s.match(url))
    if (!strategy) {
      console.error('鈻 No strategy found for this URL:', url)
      return
    }

    console.log(`馃敟 Starting crawl with strategy: ${strategy.name}`)
    await this.initBrowser()

    try {
      if (!this.browser)
        throw new Error('Browser not initialized')
      const page = await this.browser.newPage()

      if (url.includes('/chapter/')) {
        console.log('Detected Chapter URL. Fetching content...')
        const content = await strategy.getChapterContent(url, page)
        console.log('鉁 Chapter Content:', {
          title: content.title,
          imageCount: content.images.length,
          samples: content.images.slice(0, 3),
        })
      }
      else {
        console.log('Detected Manga URL. Fetching info...')
        const info = await strategy.getMangaInfo(url, page)

        // 补全 URL 为绝对路径
        info.chapters = info.chapters.map(c => ({
          ...c,
          url: c.url.startsWith('http') ? c.url : `${strategy.baseUrl}${c.url}`,
        }))

        console.log('鉁 Manga Info:', info)

        // Sync to API
        console.log('Syncing to API...')
        const res = await this.syncToApi('/api/admin/sync', { type: 'manga', data: info })
        console.log('鉁 Sync Result:', res)
      }
    }
    catch (e) {
      console.error('Crawl failed:', e)
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
      executablePath: process.env.CHROME_PATH, // Will use puppeteer bundled if undefined
    },
  })

  await crawler.run()
}

main().catch(console.error)
