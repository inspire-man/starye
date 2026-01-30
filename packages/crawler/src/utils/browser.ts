/* eslint-disable no-console */
/**
 * 浏览器工具类
 */

import type { Browser, Page } from 'puppeteer-core'
import type { ProxyConfig, PuppeteerConfig } from '../types/config'
import process from 'node:process'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BROWSER_ARGS } from '../constants'

puppeteer.use(StealthPlugin())

export class BrowserManager {
  private browser: Browser | null = null
  private config: PuppeteerConfig
  private proxy?: ProxyConfig

  constructor(config: PuppeteerConfig = {}, proxy?: ProxyConfig) {
    this.config = config
    this.proxy = proxy
  }

  async launch(): Promise<Browser> {
    const executablePath = this.config.executablePath || process.env.PUPPETEER_EXECUTABLE_PATH

    if (executablePath) {
      console.log('🚀 使用本地 Chrome:', executablePath)
    }
    else {
      console.log('🚀 使用内置 Chromium')
    }

    const launchArgs = [...BROWSER_ARGS]

    if (this.proxy?.server) {
      launchArgs.push(`--proxy-server=${this.proxy.server}` as any)
      console.log('🔒 使用代理:', this.proxy.server)
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.config.headless ?? true,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
    })

    console.log('✅ 浏览器初始化完成')
    return this.browser
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call launch() first.')
    }

    const page = await this.browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // 代理认证
    if (this.proxy?.username && this.proxy?.password) {
      await page.authenticate({
        username: this.proxy.username,
        password: this.proxy.password,
      })
    }

    // 反检测脚本
    await this.injectAntiDetection(page)

    return page
  }

  private async injectAntiDetection(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      // 覆盖 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      // 添加 Chrome 对象
      // @ts-expect-error - chrome object
      window.chrome = { runtime: {} }

      // 覆盖 plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      // 覆盖 languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      })
    })
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('🔒 浏览器已关闭')
    }
  }

  getBrowser(): Browser | null {
    return this.browser
  }
}
