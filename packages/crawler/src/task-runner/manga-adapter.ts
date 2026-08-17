import type { CrawlerConfig } from '../lib/base-crawler'
import type { AdapterExecutionContext, AdapterExecutionResult, TaskRunnerAdapter } from './template-adapters'
import { ComicCrawler } from '../crawlers/comic-crawler'
import { MANGA_SOURCE_URL, Site92Hm } from '../strategies/site-92hm'

export function createMangaAdapter(config: CrawlerConfig, execute?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>): TaskRunnerAdapter {
  return {
    templateKey: 'manga',
    async execute(context) {
      if (await context.checkpoint()) {
        return { contentIds: [] }
      }
      if (execute) {
        return execute(context)
      }
      const contentIds = new Set<string>()
      class ObservedComicCrawler extends ComicCrawler {
        protected override onMangaSynchronized(slug: string): void {
          contentIds.add(slug)
          context.observe(slug)
        }
      }
      await new ObservedComicCrawler(config, new Site92Hm(), MANGA_SOURCE_URL).run()
      return { contentIds: [...contentIds] }
    },
  }
}
