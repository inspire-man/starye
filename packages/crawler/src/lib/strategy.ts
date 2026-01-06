export interface MangaInfo {
  title: string
  slug: string
  cover?: string
  author?: string
  description?: string
  chapters: {
    title: string
    slug: string
    url: string
    number: number
  }[]
}

export interface ChapterContent {
  title: string
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
   * Parse manga details page to get metadata and chapter list
   */
  getMangaInfo: (url: string, page: any) => Promise<MangaInfo> // Using any for Page to avoid complex type imports here

  /**
   * Parse chapter reading page to get image URLs
   */
  getChapterContent: (url: string, page: any) => Promise<ChapterContent>
}
