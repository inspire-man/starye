/**
 * 爬虫包主入口
 */

// 常量
export * from './constants'

// 核心类
export { OptimizedCrawler } from './core/optimized-crawler'
// 爬虫实现
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
