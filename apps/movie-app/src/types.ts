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
  actors?: string[]
  genres?: string[]
  series?: string
  publisher?: string
  sourceUrl: string
  createdAt: Date
  updatedAt: Date
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
