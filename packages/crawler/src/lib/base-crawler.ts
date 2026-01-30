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
  proxy?: {
    server: string // 例如: 'http://proxy.example.com:8080' 或 'socks5://127.0.0.1:9050'
    username?: string
    password?: string
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

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
      '--disable-blink-features=AutomationControlled',
      // 增强反检测参数
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ]

    // 如果配置了代理，添加代理参数
    if (this.config.proxy?.server) {
      launchArgs.push(`--proxy-server=${this.config.proxy.server}`)
      console.log('Using proxy:', this.config.proxy.server)
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
    })
  }

  async createPage() {
    if (!this.browser)
      throw new Error('Browser not initialized')
    const page = await this.browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // 如果配置了代理认证，设置认证信息
    if (this.config.proxy?.username && this.config.proxy?.password) {
      await page.authenticate({
        username: this.config.proxy.username,
        password: this.config.proxy.password,
      })
    }

    // 增强反检测：覆盖 webdriver 等属性
    await page.evaluateOnNewDocument(() => {
      // 覆盖 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      // 覆盖 Chrome 对象
      // @ts-expect-error - Type 'Window' has no properties named 'chrome'
      window.chrome = {
        runtime: {},
      }

      // 覆盖 permissions
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = parameters => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters)
      )

      // 覆盖 plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      // 覆盖 languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      })
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
        })
      }
      else {
        // 如果是连接错误（如 API 未启动），仅警告不中断，方便单机测试爬虫逻辑
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('ECONNREFUSED')) {
          console.warn(`[API] ⚠️  API is offline (${url}). Skipping data sync.`)
          return null
        }
        console.error(`[API] ❌ Sync failed to ${url}: ${msg}`)
      }
      // 不再抛出异常，保证爬虫继续运行
      return null
    }
  }

  abstract run(): Promise<void>
}
