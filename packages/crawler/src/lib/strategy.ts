import type { Page } from 'puppeteer-core'

// --- Manga (Comic) Specific Interfaces ---

export interface MangaInfo {
  title: string
  slug: string
  cover?: string
  author?: string
  description?: string
  status?: 'serializing' | 'completed'
  isR18?: boolean
  sourceUrl?: string
  region?: string
  genres?: string[]
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

// --- Movie Specific Interfaces ---

export interface MovieInfo {
  title: string
  slug: string
  code: string
  description?: string
  coverImage?: string
  releaseDate?: number // timestamp
  duration?: number // minutes
  sourceUrl: string
  actors?: string[]
  genres?: string[]
  series?: string
  publisher?: string
  isR18: boolean
  players: {
    sourceName: string
    sourceUrl: string
    quality?: string
    sortOrder: number
  }[]
}

export interface MovieCrawlStrategy {
  name: string
  baseUrl: string
  match: (url: string) => boolean
  getMovieList: (url: string, page: Page) => Promise<{ movies: string[], next?: string }>
  getMovieInfo: (url: string, page: Page) => Promise<MovieInfo>
}
