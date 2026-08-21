export interface Comic {
  id: string
  title: string
  slug: string
  author?: string
  coverImage?: string
  description?: string
  status: 'serializing' | 'completed'
  isR18: boolean
  genres?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Chapter {
  id: string
  comicId: string
  title: string
  chapterNumber: number
  sortOrder: number
  createdAt: Date
}

export interface ChapterDetail extends Chapter {
  images: string[]
  pageAvailability?: {
    availablePageCount: number
    expectedPageCount: number
    findings: unknown[]
    observedAt: string | number
    policyVersion: string
    projectionVersion: number
    samples: unknown[]
    sourceRevision: number
    status: 'available' | 'unavailable' | 'degraded' | 'unknown'
    storedPageCount: number
    unknownPageCount: number
    unavailablePageCount: number
  } | null
}

export interface ReadingProgress {
  id: string
  contentType: 'comic'
  contentId: string
  chapterId: string
  comicSlug?: string
  comicTitle?: string
  chapterTitle?: string
  position: number
  page: number
  duration: null
  completed: boolean
  updatedAt: string
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

export type FavoriteEntityType = 'actor' | 'publisher' | 'movie' | 'comic'

export interface FavoriteEntity {
  name: string
  cover: string | null
  slug: string
}

export interface Favorite {
  id: string
  userId: string
  entityType: FavoriteEntityType
  entityId: string
  createdAt: number
  entity?: FavoriteEntity | null
}

export interface User {
  id: string
  email: string
  name: string
  image?: string
  isR18Verified: boolean
}
