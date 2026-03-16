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
}

export interface ReadingProgress {
  id: string
  userId: string
  chapterId: string
  page: number
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
