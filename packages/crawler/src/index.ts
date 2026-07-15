/** Crawler public library entry. Remote execution is owned by target-crawl-mutation. */

import process from 'node:process'

export * from './constants'
export { OptimizedCrawler } from './core/optimized-crawler'
export { ComicCrawler } from './crawlers/comic-crawler'
export { JavBusCrawler } from './crawlers/javbus'
export { ImageProcessor } from './lib/image-processor'
export { QueueManager } from './lib/queue-manager'
export type { MovieCrawlStrategy, MovieInfo } from './lib/strategy'
export * from './types/config'
export { ApiClient } from './utils/api-client'
export { BrowserManager } from './utils/browser'
export { ProgressMonitor } from './utils/progress'

export function getComicCrawlerOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    recoveryMode: env.RECOVERY_MODE === 'true',
    uploadCoversToR2: env.UPLOAD_COMIC_COVERS_TO_R2 === 'true',
  }
}
