export interface Post {
  id: string
  title: string
  slug: string
  content?: string
  excerpt?: string
  coverImage?: string | null
  published: boolean
  author?: {
    name: string
    image?: string | null
  }
  createdAt: string
  updatedAt: string
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
