import type { Page } from 'puppeteer-core'

export interface MangaInfo {
  title: string
  slug: string
  cover?: string
  author?: string
  description?: string
  status?: string
  isR18?: boolean
  chapters: {
    title: string
    slug: string
    url: string
    number: number
  }[]
}

export interface ChapterContent {
  title: string
  comicSlug: string
  chapterSlug: string
  prev?: string
  next?: string
  images: string[]
}

export interface CrawlStrategy {
  name: string
  baseUrl: string
  /**
   * Check if this strategy handles the given URL
   */
  match: (url: string) => boolean

  /**
   * Parse a list page (pagination) to get manga links and next page
   */
  getMangaList?: (url: string, page: Page) => Promise<{ mangas: string[], next?: string }>

  /**
   * Parse manga details page to get metadata and chapter list
   */
  getMangaInfo: (url: string, page: Page) => Promise<MangaInfo>

  /**
   * Parse chapter reading page to get image URLs
   */
  getChapterContent: (url: string, page: Page) => Promise<ChapterContent>
}
