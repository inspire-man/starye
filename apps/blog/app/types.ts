export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

export interface Post {
  id: string
  title: string
  slug: string
  content?: string
  excerpt?: string | null
  coverImage?: string | null
  published: boolean
  contentFormat?: string | null
  tags?: string[] | null
  series?: string | null
  seriesOrder?: number | null
  toc?: TocItem[]
  author?: {
    name: string
    image?: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface AdjacentPost {
  title: string
  slug: string
}

export interface AdjacentPosts {
  prev: AdjacentPost | null
  next: AdjacentPost | null
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
