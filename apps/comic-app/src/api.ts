import type { ApiResponse, Chapter, ChapterDetail, Comic, PaginatedResponse, ReadingProgress } from './types'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export const comicApi = {
  async getComics(params?: {
    page?: number
    limit?: number
    category?: string
    status?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Comic>> {
    const { data } = await api.get('/public/comics', { params })
    return data
  },

  async getComicDetail(slug: string): Promise<ApiResponse<Comic & { chapters: Chapter[] }>> {
    const { data } = await api.get(`/public/comics/${slug}`)
    return data
  },

  async getChapterDetail(slug: string, chapterId: string): Promise<ApiResponse<ChapterDetail>> {
    const { data } = await api.get(`/public/comics/${slug}/chapters/${chapterId}`)
    return data
  },
}

export const progressApi = {
  async saveReadingProgress(chapterId: string, page: number): Promise<ApiResponse<void>> {
    const { data } = await api.post('/public/progress/reading', { chapterId, page })
    return data
  },

  async getReadingProgress(chapterId?: string, comicSlug?: string): Promise<ApiResponse<ReadingProgress | ReadingProgress[]>> {
    const { data } = await api.get('/public/progress/reading', {
      params: { chapterId, comicSlug },
    })
    return data
  },
}

export const authApi = {
  async getSession(): Promise<{ user: any } | null> {
    try {
      const { data } = await api.get('/auth/get-session')
      // Better Auth 返回 { user: {...}, session: {...} } 或 null
      return data
    }
    catch {
      return null
    }
  },

  async signIn() {
    // Better Auth 的 GitHub OAuth 使用 POST 到 /sign-in/social
    const response = await api.post('/auth/sign-in/social', {
      provider: 'github',
      callbackURL: `${window.location.origin}/comic/`,
    })
    if (response.data.url) {
      window.location.href = response.data.url
    }
  },

  async signOut() {
    await api.post('/auth/sign-out', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    window.location.reload()
  },
}
