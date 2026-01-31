/**
 * 爬虫包主入口 & CLI Runner
 */

/* eslint-disable no-console */
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { ComicCrawler } from './crawlers/comic-crawler'
import { Site92Hm } from './strategies/site-92hm'
import 'dotenv/config'

// 常量
export * from './constants'

// 核心类
export { OptimizedCrawler } from './core/optimized-crawler'
// 爬虫实现
export { ComicCrawler } from './crawlers/comic-crawler'
export { JavBusCrawler } from './crawlers/javbus'
export { ImageProcessor } from './lib/image-processor'

export { QueueManager } from './lib/queue-manager'

// 策略接口（向后兼容）
export type { MovieCrawlStrategy, MovieInfo } from './lib/strategy'
// 类型定义
export * from './types/config'
export { ApiClient } from './utils/api-client'

// 工具类
export { BrowserManager } from './utils/browser'
export { ProgressMonitor } from './utils/progress'

// CLI Runner Logic
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const url = args[0]

  if (!url) {
    console.error('Usage: tsx src/index.ts <url>')
    process.exit(1)
  }

  console.log(`Run # 动态查找 Chrome 路径...`)

  // Initialize Configuration
  const config = {
    r2: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET_NAME || 'starye-media',
      publicUrl: process.env.R2_PUBLIC_URL || 'https://media.starye.org',
    },
    api: {
      url: process.env.API_URL || 'http://localhost:8787',
      token: process.env.CRAWLER_SECRET || '',
    },
    // Optional: Puppeteer executable path is handled by BaseCrawler
  }

  const run = async () => {
    // Strategy Selector
    if (url.includes('92hm')) {
      const strategy = new Site92Hm()
      const crawler = new ComicCrawler(config, strategy)
      await crawler.run(url)
    }
    else {
      console.error('❌ Unsupported URL strategy')
      process.exit(1)
    }
  }

  run().catch((err) => {
    console.error('Fatal Error:', err)
    process.exit(1)
  })
}
