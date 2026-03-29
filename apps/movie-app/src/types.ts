export interface Movie {
  id: string
  code: string
  title: string
  slug: string
  coverImage?: string
  description?: string
  releaseDate?: number
  duration?: number
  rating?: number
  isR18: boolean
  actors?: ActorSummary[]
  publishers?: PublisherSummary[]
  genres?: string[]
  series?: string
  sourceUrl: string
  createdAt: Date
  updatedAt: Date
}

export interface ActorSummary {
  id: string
  name: string
  slug: string
  avatar?: string
}

export interface Actor extends ActorSummary {
  bio?: string
  birthDate?: number
  height?: number
  measurements?: string
  cupSize?: string
  bloodType?: string
  nationality?: string
  debutDate?: number
  isActive?: boolean
  retireDate?: number
  movieCount: number
  hasDetailsCrawled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ActorDetail extends Actor {
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage?: string
    releaseDate?: number
    duration?: number
  }>
}

export interface PublisherSummary {
  id: string
  name: string
  slug: string
  logo?: string
}

export interface Publisher extends PublisherSummary {
  website?: string
  description?: string
  foundedYear?: number
  country?: string
  movieCount: number
  hasDetailsCrawled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PublisherDetail extends Publisher {
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage?: string
    releaseDate?: number
    duration?: number
  }>
}

export interface Player {
  id: string
  movieId: string
  sourceName: string
  sourceUrl: string
  quality?: string
  sortOrder: number
}

export interface MovieDetail extends Movie {
  players: Player[]
  relatedMovies: Movie[]
}

export interface WatchingProgress {
  id: string
  userId: string
  movieCode: string
  progress: number
  duration?: number
  updatedAt: Date
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface User {
  id: string
  email: string
  name: string
  image?: string
  isR18Verified: boolean
}

// 下载状态类型
export type DownloadStatus = 'planned' | 'downloading' | 'completed'

// 下载列表项接口
export interface DownloadListItem {
  movieId: string
  movieCode: string
  title: string
  coverImage?: string
  magnetLink?: string
  status: DownloadStatus
  addedAt: number
}
