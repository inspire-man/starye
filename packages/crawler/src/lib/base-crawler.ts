import type { Browser } from 'puppeteer-core'
import type { R2Config } from './image-processor'
/* eslint-disable no-console */
import process from 'node:process'
import got from 'got'
import puppeteer from 'puppeteer-core'
import { ImageProcessor } from './image-processor'

export interface CrawlerConfig {
  r2: R2Config
  api: {
    url: string
    token: string // Crawler Secret
  }
  puppeteer?: {
    executablePath?: string
  }
}

export abstract class BaseCrawler {
  protected browser: Browser | null = null
  protected imageProcessor: ImageProcessor
  protected config: CrawlerConfig

  constructor(config: CrawlerConfig) {
    this.config = config
    this.imageProcessor = new ImageProcessor(config.r2)
  }

  async initBrowser() {
    // 优先使用配置路径或环境变量
    const executablePath = this.config.puppeteer?.executablePath || process.env.PUPPETEER_EXECUTABLE_PATH

    if (executablePath) {
      console.log('Launching browser from:', executablePath)
    }
    else {
      console.log('Launching browser (bundled/default)...')
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
    }
  }

  /**
   * Sync data to API
   */
  async syncToApi(endpoint: string, data: unknown) {
    const url = `${this.config.api.url}${endpoint}`
    try {
      const res = await got.post(url, {
        json: data,
        headers: {
          'x-service-token': this.config.api.token,
        },
      }).json()
      return res
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Sync failed to ${url}: ${msg}`)
      throw e
    }
  }

  abstract run(): Promise<void>
}
