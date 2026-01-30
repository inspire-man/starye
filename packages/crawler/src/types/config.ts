/**
 * 爬虫配置类型定义
 */

import type { R2Config } from '../lib/image-processor'

export interface ProxyConfig {
  server: string
  username?: string
  password?: string
}

export interface PuppeteerConfig {
  executablePath?: string
  headless?: boolean
  timeout?: number
}

export interface ApiConfig {
  url: string
  token: string
  timeout?: number
  retries?: number
}

export interface ConcurrencyConfig {
  listPage: number
  detailPage: number
  image: number
  api: number
}

export interface DelayConfig {
  listPage: number
  detailPage: number
  image: number
  api: number
}

export interface CrawlerLimits {
  maxMovies: number
  maxPages: number
}

export interface CrawlerOptions {
  showProgress: boolean
  showStats: boolean
  statsInterval: number
}

export interface BaseCrawlerConfig {
  r2: R2Config
  api: ApiConfig
  puppeteer?: PuppeteerConfig
  proxy?: ProxyConfig
}

export interface OptimizedCrawlerConfig extends BaseCrawlerConfig {
  concurrency?: Partial<ConcurrencyConfig>
  delay?: Partial<DelayConfig>
  limits?: Partial<CrawlerLimits>
  options?: Partial<CrawlerOptions>
}

// 默认配置
export const DEFAULT_CONCURRENCY: ConcurrencyConfig = {
  listPage: 1,
  detailPage: 2,
  image: 3,
  api: 2,
}

export const DEFAULT_DELAY: DelayConfig = {
  listPage: 5000,
  detailPage: 3000,
  image: 1000,
  api: 500,
}

export const DEFAULT_LIMITS: CrawlerLimits = {
  maxMovies: 0, // 0 = 无限制
  maxPages: 0, // 0 = 无限制
}

export const DEFAULT_OPTIONS: CrawlerOptions = {
  showProgress: true,
  showStats: true,
  statsInterval: 10000, // 10秒
}

// GitHub Actions 推荐配置
export const GITHUB_ACTIONS_CONFIG: Partial<OptimizedCrawlerConfig> = {
  concurrency: {
    listPage: 1,
    detailPage: 2,
    image: 2,
    api: 2,
  },
  delay: {
    listPage: 10000,
    detailPage: 6000,
    image: 3000,
    api: 1000,
  },
  limits: {
    maxMovies: 50,
    maxPages: 5,
  },
}
