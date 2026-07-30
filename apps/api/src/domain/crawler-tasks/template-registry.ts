import type {
  CrawlerTaskSnapshot,
  CrawlerTaskTemplate,
  CrawlerTaskTemplateKey,
} from './types'

export const crawlerTaskTemplates = {
  manga: {
    entrypoint: 'manga-crawler',
    permissionResource: 'comic',
    templateKey: 'manga',
    templateVersion: 1,
  },
  movie: {
    entrypoint: 'movie-crawler',
    permissionResource: 'movie',
    templateKey: 'movie',
    templateVersion: 1,
  },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export function getCrawlerTaskTemplate(templateKey: CrawlerTaskTemplateKey): CrawlerTaskTemplate {
  return crawlerTaskTemplates[templateKey]
}

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}
