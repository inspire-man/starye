import type { Browser } from 'puppeteer-core'
import type { R2Config } from './image-processor'
/* eslint-disable no-console */
import process from 'node:process'
import got, { HTTPError } from 'got'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ImageProcessor } from './image-processor'

// 使用 Stealth Plugin 增强隐匿性
puppeteer.use(StealthPlugin())

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
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    })
  }

  async createPage() {
    if (!this.browser)
      throw new Error('Browser not initialized')
    const page = await this.browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // Manual Stealth Injections
    await page.evaluateOnNewDocument(() => {
      // 1. Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      // 2. Pass the Webdriver Test.
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
      // 3. Pass the Chrome Test.
      // @ts-expect-error Mocking window.chrome for stealth
      window.chrome = {
        // @ts-expect-error Mocking runtime for stealth
        runtime: {},
        loadTimes() {},
        csi() {},
        app: {},
      }
    })

    return page
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
    }
  }

  /**
   * Sync data to API
   */
  async syncToApi(endpoint: string, data: unknown, options?: { method?: 'GET' | 'POST', searchParams?: Record<string, string> }) {
    const url = `${this.config.api.url}${endpoint}`
    const method = options?.method || 'POST'

    try {
      // console.log(`[API] 📤 ${method} ${url}...`) // Reduce noise
      const res = await got(url, {
        method,
        json: method === 'POST' ? data : undefined,
        searchParams: options?.searchParams,
        headers: {
          'x-service-token': this.config.api.token,
        },
        timeout: {
          request: 30000, // 30 seconds timeout
        },
        retry: {
          limit: 5,
          methods: ['POST', 'GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'],
        },
      }).json()
      // console.log(`[API] ✅ Success`)
      return res
    }
    catch (e: unknown) {
      // 详细的错误日志
      if (e instanceof HTTPError) {
        const response = e.response
        console.error(`[API] ❌ Sync failed to ${url}:`, {
          status: response?.statusCode,
          statusMessage: response?.statusMessage,
          body: response?.body,
          headers: response?.headers,
        })
      }
      else {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[API] ❌ Sync failed to ${url}: ${msg}`)
        if (e instanceof Error && e.stack) {
          console.error('Stack trace:', e.stack)
        }
      }
      throw e
    }
  }

  abstract run(): Promise<void>
}
