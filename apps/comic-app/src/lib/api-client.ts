/**
 * Comic App API 客户端 - 原生 fetch
 *
 * 使用原生 fetch 进行 API 调用，避免引入 Hono RPC 的源码类型链
 */

import type { ApiResponse, Chapter, ChapterDetail, Comic, PaginatedResponse, ReadingProgress } from '../types'

/** 通用 JSON fetch，统一处理凭据和错误 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
    throw new Error(err.message || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** 将参数对象构建为 query string */
function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params)
    return ''
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '')
      q.set(k, String(v))
  })
  const str = q.toString()
  return str ? `?${str}` : ''
}

// ─── Comic API ─────────────────────────────────────────────────────────────

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
    return apiFetch(`/public/comics${buildQuery(params)}`)
  },

  async getComicDetail(slug: string): Promise<ApiResponse<Comic & { chapters: Chapter[] }>> {
    return apiFetch(`/public/comics/${encodeURIComponent(slug)}`)
  },

  async getChapterDetail(slug: string, chapterId: string): Promise<ApiResponse<ChapterDetail>> {
    return apiFetch(`/public/comics/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterId)}`)
  },
}

// ─── Progress API ──────────────────────────────────────────────────────────

export const progressApi = {
  async saveReadingProgress(chapterId: string, page: number): Promise<ApiResponse<void>> {
    return apiFetch('/public/progress/reading', {
      method: 'POST',
      body: JSON.stringify({ chapterId, page }),
    })
  },

  async getReadingProgress(chapterId?: string, comicSlug?: string): Promise<ApiResponse<ReadingProgress | ReadingProgress[]>> {
    const params = new URLSearchParams()
    if (chapterId)
      params.set('chapterId', chapterId)
    if (comicSlug)
      params.set('comicSlug', comicSlug)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiFetch(`/public/progress/reading${query}`)
  },
}

// ─── Favorites API ─────────────────────────────────────────────────────────

export const favoritesApi = {
  async getFavorites(): Promise<ApiResponse<{ comicId: string, comic?: Comic }[]>> {
    return apiFetch('/favorites')
  },

  async addFavorite(comicId: string): Promise<ApiResponse<void>> {
    return apiFetch('/favorites', {
      method: 'POST',
      body: JSON.stringify({ comicId }),
    })
  },

  async removeFavorite(comicId: string): Promise<ApiResponse<void>> {
    return apiFetch(`/favorites/${comicId}`, { method: 'DELETE' })
  },

  async isFavorite(comicId: string): Promise<boolean> {
    try {
      const res = await apiFetch<ApiResponse<{ isFavorite: boolean }>>(`/favorites/${comicId}/check`)
      return res.data?.isFavorite ?? false
    }
    catch {
      return false
    }
  },
}

// ─── Auth API (Better Auth - 使用原生 fetch) ───────────────────────────────

export const authApi = {
  async getSession(): Promise<{ user: any } | null> {
    try {
      return await apiFetch('/auth/get-session')
    }
    catch {
      return null
    }
  },

  async signIn() {
    const response = await apiFetch<{ url?: string }>('/auth/sign-in/social', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'github',
        callbackURL: `${window.location.origin}/comic/`,
      }),
    })
    if (response.url) {
      window.location.href = response.url
    }
  },

  async signOut() {
    await apiFetch('/auth/sign-out', { method: 'POST' })
    window.location.reload()
  },
}
