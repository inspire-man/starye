/* eslint-disable no-console */
import process from 'node:process'
import { BaseCrawler } from './lib/base-crawler'
import 'dotenv/config'

class DemoCrawler extends BaseCrawler {
  async run() {
    console.log('馃敟 Starting Demo Crawl...')
    await this.initBrowser()
    console.log('鉁 Browser launched successfully!')

    if (this.browser) {
      const page = await this.browser.newPage()
      await page.goto('https://example.com')
      console.log('鉁 Visited example.com, Title:', await page.title())
    }

    await this.closeBrowser()
    console.log('鉁 Browser closed.')
  }
}

async function main() {
  // Validate Env
  const requiredEnv = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'CRAWLER_SECRET']
  const missing = requiredEnv.filter(k => !process.env[k])

  if (missing.length > 0) {
    console.warn(`鈻 Missing environment variables: ${missing.join(', ')}`)
    console.warn('Skipping crawler execution. Please configure .env for packages/crawler.')
    return
  }

  const crawler = new DemoCrawler({
    r2: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucketName: process.env.R2_BUCKET_NAME || 'starye-media',
      publicUrl: process.env.R2_PUBLIC_URL || 'http://localhost:3000',
    },
    api: {
      url: process.env.API_URL || 'http://localhost:8787',
      token: process.env.CRAWLER_SECRET!,
    },
    puppeteer: {
      executablePath: process.env.CHROME_PATH,
    },
  })

  await crawler.run()
}

main().catch(console.error)
