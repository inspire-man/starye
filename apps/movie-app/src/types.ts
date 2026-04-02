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
  source?: string
  quality?: string
  sortOrder: number
  magnetLink?: string
  // 评分相关字段
  averageRating?: number // 平均用户评分 (1-5)
  ratingCount?: number // 评分人数
  userScore?: number // 当前用户的评分 (1-5)
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

// Aria2 相关类型
export interface Aria2Config {
  rpcUrl: string
  secret?: string
  useProxy: boolean
}

export interface Aria2Task {
  gid: string
  status: Aria2Status
  totalLength: string
  completedLength: string
  uploadLength: string
  downloadSpeed: string
  uploadSpeed: string
  files?: Aria2File[]
  infoHash?: string
}

export type Aria2Status = 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed'

export interface Aria2File {
  index: string
  path: string
  length: string
  completedLength: string
  selected: string
}

// 评分相关类型
export interface Rating {
  id: string
  playerId: string
  userId: string
  score: number // 1-5
  createdAt: Date
  updatedAt: Date
}

export interface RatingStats {
  averageRating: number
  ratingCount: number
  distribution: RatingDistribution
}

export interface RatingDistribution {
  star1: number
  star2: number
  star3: number
  star4: number
  star5: number
}

export interface AutoScoreWeights {
  quality: number
  fileSize: number
  source: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface FavoriteEntity {
  name: string
  cover: string | null
  slug: string
}

export interface Favorite {
  id: string
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
  createdAt: number
  entity?: FavoriteEntity | null
}
