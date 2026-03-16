import type { ApiResponse, Movie, MovieDetail, PaginatedResponse, WatchingProgress } from './types'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export const movieApi = {
  async getMovies(params?: {
    page?: number
    limit?: number
    actor?: string
    publisher?: string
    genre?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Movie>> {
    const { data } = await api.get('/public/movies', { params })
    return data
  },

  async getMovieDetail(code: string): Promise<ApiResponse<MovieDetail>> {
    const { data } = await api.get(`/public/movies/${code}`)
    return data
  },
}

export const progressApi = {
  async saveWatchingProgress(movieCode: string, progress: number, duration?: number): Promise<ApiResponse<void>> {
    const { data } = await api.post('/public/progress/watching', { movieCode, progress, duration })
    return data
  },

  async getWatchingProgress(movieCode?: string): Promise<ApiResponse<WatchingProgress | WatchingProgress[]>> {
    const { data } = await api.get('/public/progress/watching', {
      params: { movieCode },
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
      callbackURL: `${window.location.origin}/movie/`,
    })
    if (response.data.url) {
      window.location.href = response.data.url
    }
  },

  async signOut() {
    await api.post('/auth/sign-out')
    window.location.reload()
  },
}
