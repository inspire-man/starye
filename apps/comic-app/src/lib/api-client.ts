/**
 * Comic App API 客户端 - Hono RPC
 *
 * 使用 hc<AppType>() 获得类型安全的 API 调用：
 * - URL 路径名 / 路径参数名 / query 参数名均在编译期校验
 * - 局部类型转换 (as unknown as LocalType) 仅在 api-client 边界使用，
 *   不向视图层透传 any
 */

import type { AppType } from '@starye/api-types'
import type { ApiResponse, Chapter, ChapterDetail, Comic, PaginatedResponse, ReadingProgress } from '../types'
import { hc } from 'hono/client'

/** Hono RPC 客户端 */
const client = hc<AppType>('/')

/** 非 RPC 路由（mutation、auth、progress）使用原生 fetch */
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

// ─── Comic API ─────────────────────────────────────────────────────────────

export const comicApi = {
  async getComics(params?: {
    page?: number
    limit?: number
    category?: string
    status?: 'serializing' | 'completed'
    search?: string
    sortBy?: 'title' | 'createdAt' | 'updatedAt'
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Comic>> {
    const res = await client.api.public.comics.$get({
      query: {
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
        category: params?.category,
        status: params?.status,
        search: params?.search,
        sortBy: params?.sortBy,
        sortOrder: params?.sortOrder,
      },
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error('Failed to fetch comics')
    }
    const inner = data.data
    return {
      success: true,
      data: inner.data as unknown as Comic[],
      pagination: inner.pagination,
    }
  },

  async getComicDetail(slug: string): Promise<ApiResponse<Comic & { chapters: Chapter[] }>> {
    const res = await client.api.public.comics[':slug'].$get({
      param: { slug },
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error)
    }
    return { success: true, data: data.data as unknown as Comic & { chapters: Chapter[] } }
  },

  async getChapterDetail(slug: string, chapterId: string): Promise<ApiResponse<ChapterDetail>> {
    const res = await client.api.public.comics[':slug'].chapters[':chapterId'].$get({
      param: { slug, chapterId },
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error)
    }
    return { success: true, data: data.data as unknown as ChapterDetail }
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
