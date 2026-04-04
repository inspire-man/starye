/**
 * Comic App API 客户端 - 基于 Hono RPC
 *
 * 使用 hc<AppType>() 替代 axios，获得原生 fetch 的类型安全调用
 */

import type { AppType } from '@starye/api-types'
import type { ApiResponse, Chapter, ChapterDetail, Comic, PaginatedResponse, ReadingProgress } from '../types'
import { hc } from 'hono/client'

/** Hono RPC 客户端 */
const client = hc<AppType>('/')

/** 通用 JSON fetch，处理非 RPC 路由（auth、progress 等） */
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
  return res.json()
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '')
          query[k] = String(v)
      })
    }
    const res = await client.api.public.comics.$get({ query } as any)
    return res.json() as any
  },

  async getComicDetail(slug: string): Promise<ApiResponse<Comic & { chapters: Chapter[] }>> {
    const res = await client.api.public.comics[':slug'].$get({ param: { slug } } as any)
    return res.json() as any
  },

  async getChapterDetail(slug: string, chapterId: string): Promise<ApiResponse<ChapterDetail>> {
    const res = await client.api.public.comics[':slug'].chapters[':chapterId'].$get({
      param: { slug, chapterId },
    } as any)
    return res.json() as any
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
