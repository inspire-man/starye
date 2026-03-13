/* eslint-disable node/prefer-global/process */
/**
 * 爬虫配置系统
 *
 * 提供完整的爬虫配置管理，包括：
 * - 并发控制：多级并发策略（漫画、章节、图片）
 * - 限流控制：防止过载和超时
 * - 增量策略：智能跳过和优先级排序
 * - 反检测机制：降低被识别为机器人的风险
 * - 环境适配：自动检测 CI/本地环境
 *
 * @module crawl.config
 * @since 2026-03-13
 */

import type { AntiDetectionConfig } from '../lib/anti-detection'

/**
 * 爬虫配置接口
 *
 * @interface CrawlConfig
 */
export interface CrawlConfig {
  /**
   * 并发控制配置
   *
   * 多级并发架构，总并发度 = manga × chapter × imageBatch
   *
   * @example
   * // 默认配置
   * concurrency: {
   *   manga: 2,        // 同时处理2个漫画
   *   chapter: 2,      // 每个漫画同时处理2章
   *   imageBatch: 10   // 每章同时上传10张图片
   * }
   * // 总并发度 = 2 × 2 × 10 = 40
   */
  concurrency: {
    /** 漫画级并发数（建议：1-5） */
    manga: number
    /** 章节级并发数（建议：1-3） */
    chapter: number
    /** 图片批量大小（建议：5-20） */
    imageBatch: number
  }

  /**
   * 限流控制配置
   *
   * 防止单次运行处理过多内容导致超时或资源耗尽
   */
  limits: {
    /** 每次运行最多处理漫画数 */
    maxMangasPerRun: number
    /** 新漫画最多处理章节数 */
    maxChaptersPerNew: number
    /** 更新漫画最多处理章节数 */
    maxChaptersPerUpdate: number
    /** 软超时时间（分钟），接近此时间时优雅退出 */
    timeoutMinutes: number
  }

  /**
   * 增量爬取策略配置
   *
   * 智能跳过已完成内容，优先处理需要更新的漫画
   */
  incremental: {
    /** 是否启用增量爬取 */
    enabled: boolean
    /** 跳过已完成且非连载的漫画 */
    skipCompleted: boolean
    /** 优先更新连载中的漫画 */
    prioritizeUpdates: boolean
  }

  /**
   * 重试策略配置
   *
   * 基础重试配置（简单场景）
   * 复杂错误处理由 antiDetection 配置管理
   */
  retry: {
    /** 最大重试次数 */
    maxAttempts: number
    /** 退避时间（毫秒） */
    backoffMs: number
  }

  /**
   * 反检测配置
   *
   * 降低被识别为机器人的风险，包括：
   * - 智能延迟策略
   * - 请求头伪装
   * - Cookie 管理
   * - 错误分类与处理
   * - 成功率监控
   *
   * @see {@link AntiDetectionConfig}
   */
  antiDetection: AntiDetectionConfig

  /**
   * 环境信息
   *
   * 自动检测是否运行在 CI 环境（GitHub Actions）
   */
  isCI: boolean
}

/**
 * 默认反检测配置 - 漫画爬虫
 *
 * 保守配置，优先稳定性：
 * - 基础延迟 8 秒，确保不被识别为机器人
 * - 最多重试 3 次，应对网络波动
 * - 启用会话管理和请求头轮换
 *
 * 适用于目标网站：92hm.life
 *
 * @constant
 * @type {AntiDetectionConfig}
 */
export const DEFAULT_MANGA_ANTI_DETECTION: AntiDetectionConfig = {
  baseDelay: 8000, // 8 秒基础延迟
  randomDelay: 4000, // 0-4 秒随机延迟
  errorBackoffMultiplier: 2.0, // 错误时延迟翻倍
  maxDelay: 30000, // 最大 30 秒

  maxRetries: 3,
  retryDelayMultiplier: 2.0,
  longBackoffDuration: 60000, // 1 分钟

  successRateWindow: 20,
  lowSuccessRateThreshold: 0.7,
  autoSlowdownMultiplier: 1.5,

  enableSessionManagement: true,
  enableHeaderRotation: true,
}

/**
 * 默认反检测配置 - 影片爬虫
 *
 * 稳定配置，已验证可靠：
 * - 基础延迟 6 秒，当前运行稳定
 * - 最多重试 2 次，降低延迟
 * - 暂不启用会话管理（目标站点无需）
 *
 * 适用于目标网站：JavBus 及镜像站
 *
 * @constant
 * @type {AntiDetectionConfig}
 */
export const DEFAULT_MOVIE_ANTI_DETECTION: AntiDetectionConfig = {
  baseDelay: 6000, // 6 秒基础延迟（当前稳定值）
  randomDelay: 4000,
  errorBackoffMultiplier: 1.5,
  maxDelay: 20000,

  maxRetries: 2,
  retryDelayMultiplier: 1.5,
  longBackoffDuration: 60000,

  successRateWindow: 20,
  lowSuccessRateThreshold: 0.7,
  autoSlowdownMultiplier: 1.3,

  enableSessionManagement: false, // Movie 爬虫暂不启用
  enableHeaderRotation: false,
}

/**
 * 默认配置（保守策略，适配 GitHub Actions）
 */
const DEFAULT_CONFIG: CrawlConfig = {
  concurrency: {
    manga: 2, // 保守：2 个漫画并发
    chapter: 2, // 保守：每个漫画 2 章并发
    imageBatch: 10, // 保守：每批 10 张图片
  },
  limits: {
    maxMangasPerRun: 15, // 每次最多 15 个漫画
    maxChaptersPerNew: 5, // 新漫画限制 5 章
    maxChaptersPerUpdate: 20, // 更新时限制 20 章
    timeoutMinutes: 300, // 5 小时软超时（留 1 小时缓冲）
  },
  incremental: {
    enabled: true,
    skipCompleted: true,
    prioritizeUpdates: true,
  },
  retry: {
    maxAttempts: 3,
    backoffMs: 1000, // 1 秒
  },
  antiDetection: DEFAULT_MANGA_ANTI_DETECTION, // 默认使用漫画配置
  isCI: false,
}

/**
 * 检测运行环境
 *
 * @returns {boolean} true 表示运行在 CI 环境（GitHub Actions），false 表示本地环境
 */
function detectEnvironment(): boolean {
  return process.env.CI === 'true'
}

/**
 * 从环境变量读取配置覆盖
 *
 * 支持的环境变量：
 * - `CRAWLER_MANGA_CONCURRENCY`: 漫画并发数
 * - `CRAWLER_CHAPTER_CONCURRENCY`: 章节并发数
 * - `CRAWLER_IMAGE_BATCH`: 图片批量大小
 * - `CRAWLER_MAX_MANGAS`: 最大漫画数
 * - `CRAWLER_MAX_CHAPTERS_NEW`: 新漫画章节限制
 * - `CRAWLER_MAX_CHAPTERS_UPDATE`: 更新章节限制
 * - `CRAWLER_TIMEOUT_MINUTES`: 超时时间
 * - `CRAWLER_BASE_DELAY`: 基础延迟
 * - `CRAWLER_MAX_RETRIES`: 最大重试次数
 * - `CRAWLER_ENABLE_SESSION`: 是否启用会话管理
 *
 * @returns {Partial<CrawlConfig>} 从环境变量读取的配置覆盖
 */
function getEnvOverrides(): Partial<CrawlConfig> {
  const overrides: Partial<CrawlConfig> = {}

  // 并发控制
  if (process.env.CRAWLER_MANGA_CONCURRENCY) {
    overrides.concurrency = {
      ...DEFAULT_CONFIG.concurrency,
      manga: Number.parseInt(process.env.CRAWLER_MANGA_CONCURRENCY, 10),
    }
  }
  if (process.env.CRAWLER_CHAPTER_CONCURRENCY) {
    overrides.concurrency = {
      ...overrides.concurrency || DEFAULT_CONFIG.concurrency,
      chapter: Number.parseInt(process.env.CRAWLER_CHAPTER_CONCURRENCY, 10),
    }
  }
  if (process.env.CRAWLER_IMAGE_BATCH) {
    overrides.concurrency = {
      ...overrides.concurrency || DEFAULT_CONFIG.concurrency,
      imageBatch: Number.parseInt(process.env.CRAWLER_IMAGE_BATCH, 10),
    }
  }

  // 限流控制
  if (process.env.CRAWLER_MAX_MANGAS) {
    overrides.limits = {
      ...DEFAULT_CONFIG.limits,
      maxMangasPerRun: Number.parseInt(process.env.CRAWLER_MAX_MANGAS, 10),
    }
  }
  if (process.env.CRAWLER_MAX_CHAPTERS_NEW) {
    overrides.limits = {
      ...overrides.limits || DEFAULT_CONFIG.limits,
      maxChaptersPerNew: Number.parseInt(process.env.CRAWLER_MAX_CHAPTERS_NEW, 10),
    }
  }
  if (process.env.CRAWLER_MAX_CHAPTERS_UPDATE) {
    overrides.limits = {
      ...overrides.limits || DEFAULT_CONFIG.limits,
      maxChaptersPerUpdate: Number.parseInt(process.env.CRAWLER_MAX_CHAPTERS_UPDATE, 10),
    }
  }
  if (process.env.CRAWLER_TIMEOUT_MINUTES) {
    overrides.limits = {
      ...overrides.limits || DEFAULT_CONFIG.limits,
      timeoutMinutes: Number.parseInt(process.env.CRAWLER_TIMEOUT_MINUTES, 10),
    }
  }

  // 反检测配置
  if (process.env.CRAWLER_BASE_DELAY) {
    overrides.antiDetection = {
      ...DEFAULT_CONFIG.antiDetection,
      baseDelay: Number.parseInt(process.env.CRAWLER_BASE_DELAY, 10),
    }
  }
  if (process.env.CRAWLER_MAX_RETRIES) {
    overrides.antiDetection = {
      ...overrides.antiDetection || DEFAULT_CONFIG.antiDetection,
      maxRetries: Number.parseInt(process.env.CRAWLER_MAX_RETRIES, 10),
    }
  }
  if (process.env.CRAWLER_ENABLE_SESSION) {
    overrides.antiDetection = {
      ...overrides.antiDetection || DEFAULT_CONFIG.antiDetection,
      enableSessionManagement: process.env.CRAWLER_ENABLE_SESSION === 'true',
    }
  }

  return overrides
}

/**
 * 验证反检测配置的合法性
 *
 * 检查项：
 * - 延迟范围：baseDelay >= 1000ms, maxDelay >= baseDelay
 * - 重试参数：maxRetries 在 0-10 范围内
 * - 监控参数：successRateWindow 在 5-100 范围内
 *
 * @param {AntiDetectionConfig} config - 待验证的反检测配置
 * @throws {Error} 配置不合法时抛出错误
 */
function validateAntiDetectionConfig(config: AntiDetectionConfig): void {
  // 验证延迟范围
  if (config.baseDelay < 1000) {
    throw new Error('baseDelay 必须 >= 1000ms（至少 1 秒）')
  }
  if (config.maxDelay < config.baseDelay) {
    throw new Error('maxDelay 必须 >= baseDelay')
  }
  if (config.errorBackoffMultiplier < 1.0) {
    throw new Error('errorBackoffMultiplier 必须 >= 1.0')
  }

  // 验证重试参数
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    throw new Error('maxRetries 必须在 0-10 范围内')
  }
  if (config.retryDelayMultiplier < 1.0) {
    throw new Error('retryDelayMultiplier 必须 >= 1.0')
  }
  if (config.longBackoffDuration < 10000) {
    throw new Error('longBackoffDuration 必须 >= 10000ms')
  }

  // 验证监控参数
  if (config.successRateWindow < 5 || config.successRateWindow > 100) {
    console.warn('⚠️  successRateWindow 建议在 5-100 范围内')
  }
  if (config.lowSuccessRateThreshold <= 0 || config.lowSuccessRateThreshold >= 1) {
    throw new Error('lowSuccessRateThreshold 必须在 0-1 之间')
  }
}

/**
 * 验证完整爬虫配置的合法性
 *
 * 检查项：
 * - 并发数必须为正整数
 * - 限流参数必须为正整数
 * - CI 环境超时不超过 350 分钟
 * - 新漫画章节限制 <= 更新章节限制
 * - 反检测配置合法性
 *
 * @param {CrawlConfig} config - 待验证的爬虫配置
 * @throws {Error} 配置不合法时抛出错误
 */
function validateConfig(config: CrawlConfig): void {
  const { concurrency, limits, isCI, antiDetection } = config

  // 验证并发数
  if (concurrency.manga <= 0 || concurrency.chapter <= 0 || concurrency.imageBatch <= 0) {
    throw new Error('并发数必须为正整数')
  }

  // 验证限流参数
  if (limits.maxMangasPerRun <= 0 || limits.maxChaptersPerNew <= 0 || limits.maxChaptersPerUpdate <= 0) {
    throw new Error('限流参数必须为正整数')
  }

  // CI 环境超时检查
  if (isCI && limits.timeoutMinutes > 350) {
    console.warn('⚠️  超时设置超过 GitHub Actions 限制（360 分钟），可能导致任务中断')
  }

  // 合理性检查
  if (limits.maxChaptersPerNew > limits.maxChaptersPerUpdate) {
    console.warn('⚠️  新漫画章节限制大于更新限制，可能不合理')
  }

  // 验证反检测配置
  validateAntiDetectionConfig(antiDetection)
}

/**
 * 加载爬虫配置
 *
 * 加载流程：
 * 1. 检测运行环境（CI/本地）
 * 2. 读取环境变量覆盖
 * 3. 合并默认配置和覆盖配置
 * 4. 验证配置合法性
 * 5. 输出配置日志
 * 6. 冻结配置防止运行时修改
 *
 * @returns {Readonly<CrawlConfig>} 只读的爬虫配置对象
 * @throws {Error} 配置验证失败时抛出错误
 *
 * @example
 * ```typescript
 * import { CRAWL_CONFIG } from './config/crawl.config'
 *
 * console.log(CRAWL_CONFIG.concurrency.manga) // 2
 * console.log(CRAWL_CONFIG.isCI) // true/false
 * ```
 */
export function loadCrawlConfig(): Readonly<CrawlConfig> {
  const isCI = detectEnvironment()
  const envOverrides = getEnvOverrides()

  const config: CrawlConfig = {
    ...DEFAULT_CONFIG,
    ...envOverrides,
    isCI,
  }

  // 验证配置
  validateConfig(config)

  // 输出配置日志
  console.log('🔧 爬虫配置加载完成:')
  console.log(`  运行环境: ${isCI ? 'CI (GitHub Actions)' : '本地'}`)
  console.log(`  并发配置: manga=${config.concurrency.manga}, chapter=${config.concurrency.chapter}, imageBatch=${config.concurrency.imageBatch}`)
  console.log(`  限流配置: maxMangasPerRun=${config.limits.maxMangasPerRun}, maxChaptersPerNew=${config.limits.maxChaptersPerNew}, maxChaptersPerUpdate=${config.limits.maxChaptersPerUpdate}`)
  console.log(`  增量策略: ${config.incremental.enabled ? '启用' : '禁用'}`)
  console.log(`  软超时: ${config.limits.timeoutMinutes} 分钟`)
  console.log(`  反检测: baseDelay=${config.antiDetection.baseDelay}ms, maxRetries=${config.antiDetection.maxRetries}, session=${config.antiDetection.enableSessionManagement ? '启用' : '禁用'}`)

  // 冻结配置，防止运行时修改
  return Object.freeze(config)
}

/**
 * 全局爬虫配置实例
 *
 * 只读配置对象，在模块加载时初始化
 *
 * @constant
 * @type {Readonly<CrawlConfig>}
 *
 * @example
 * ```typescript
 * import { CRAWL_CONFIG } from '@starye/crawler'
 *
 * // 读取配置
 * const mangaConcurrency = CRAWL_CONFIG.concurrency.manga
 * const baseDelay = CRAWL_CONFIG.antiDetection.baseDelay
 *
 * // 配置是只读的，以下操作会报错
 * // CRAWL_CONFIG.concurrency.manga = 10 // Error!
 * ```
 */
export const CRAWL_CONFIG = loadCrawlConfig()
