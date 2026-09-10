import type { JavBusCrawlerConfig } from '../crawlers/javbus'
import type { MovieInfo } from '../lib/strategy'
import type { AdapterExecutionContext, AdapterExecutionResult, TaskRunnerAdapter } from './template-adapters'
import { JavBusCrawler } from '../crawlers/javbus'

export function createMovieAdapter(config: JavBusCrawlerConfig, execute?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>): TaskRunnerAdapter {
  return {
    templateKey: 'movie',
    async execute(context) {
      if (await context.checkpoint()) {
        return { contentIds: [] }
      }
      if (execute) {
        return execute(context)
      }
      const contentIds = new Set<string>()
      class ObservedJavBusCrawler extends JavBusCrawler {
        protected override onMovieSynchronized(movieInfo: MovieInfo): void {
          contentIds.add(movieInfo.code)
          context.observe(movieInfo.code)
        }
      }
      const crawler = new ObservedJavBusCrawler(config)
      await crawler.run()
      const mediaFailureReasons = crawler.getMediaFailureReasons()
      return mediaFailureReasons.length > 0
        ? { contentIds: [...contentIds], mediaFailureReasons }
        : { contentIds: [...contentIds] }
    },
  }
}
