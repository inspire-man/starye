/* eslint-disable node/prefer-global/process */
/**
 * 爬虫配置系统
 * 支持环境检测、环境变量覆盖、参数验证
 */

export interface CrawlConfig {
  // 并发控制
  concurrency: {
    manga: number // 漫画级并发
    chapter: number // 章节级并发
    imageBatch: number // 图片批量大小
  }
  // 限流控制
  limits: {
    maxMangasPerRun: number // 每次最多处理漫画数
    maxChaptersPerNew: number // 新漫画章节限制
    maxChaptersPerUpdate: number // 更新时章节限制
    timeoutMinutes: number // 软超时时间（分钟）
  }
  // 增量策略
  incremental: {
    enabled: boolean // 是否启用增量爬取
    skipCompleted: boolean // 跳过已完成的漫画
    prioritizeUpdates: boolean // 优先更新连载中的漫画
  }
  // 重试策略
  retry: {
    maxAttempts: number // 最大重试次数
    backoffMs: number // 退避时间（毫秒）
  }
  // 环境信息
  isCI: boolean // 是否运行在 CI 环境
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
  isCI: false,
}

/**
 * 环境检测
 */
function detectEnvironment(): boolean {
  return process.env.CI === 'true'
}

/**
 * 从环境变量读取覆盖配置
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

  return overrides
}

/**
 * 配置验证
 */
function validateConfig(config: CrawlConfig): void {
  const { concurrency, limits, isCI } = config

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
}

/**
 * 加载并冻结配置
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

  // 冻结配置，防止运行时修改
  return Object.freeze(config)
}

/**
 * 全局配置实例
 */
export const CRAWL_CONFIG = loadCrawlConfig()
