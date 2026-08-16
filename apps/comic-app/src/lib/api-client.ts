/**
 * Comic App API 客户端 - Hono RPC
 *
 * 公开读取与非 RPC 操作统一经过原生 fetch：
 * - 保持 Gateway 下的 /api 前缀与鉴权 cookie 行为一致
 * - 局部类型转换 (as unknown as LocalType) 仅在 api-client 边界使用，
 *   不向视图层透传 any
 */

import type { FavoriteListResponse } from '@starye/api-types'
import type { ApiResponse, Chapter, ChapterDetail, Comic, Favorite, PaginatedResponse, ReadingProgress } from '../types'

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
    const query = new URLSearchParams()
    if (params?.page !== undefined)
      query.set('page', String(params.page))
    if (params?.limit !== undefined)
      query.set('limit', String(params.limit))
    if (params?.category)
      query.set('category', params.category)
    if (params?.status)
      query.set('status', params.status)
    if (params?.search)
      query.set('search', params.search)
    if (params?.sortBy)
      query.set('sortBy', params.sortBy)
    if (params?.sortOrder)
      query.set('sortOrder', params.sortOrder)

    const result = await apiFetch<{
      success: boolean
      data?: {
        data: Comic[]
        pagination: PaginatedResponse<Comic>['pagination']
      }
      error?: string
    }>(`/public/comics${query.toString() ? `?${query.toString()}` : ''}`)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch comics')
    }

    return {
      success: true,
      data: result.data.data,
      pagination: result.data.pagination,
    }
  },

  async getComicDetail(slug: string): Promise<ApiResponse<Comic & { chapters: Chapter[] }>> {
    const result = await apiFetch<{ success: boolean, data?: Comic & { chapters: Chapter[] }, error?: string }>(`/public/comics/${encodeURIComponent(slug)}`)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch comic detail')
    }
    return { success: true, data: result.data }
  },

  async getChapterDetail(slug: string, chapterId: string): Promise<ApiResponse<ChapterDetail>> {
    const result = await apiFetch<{ success: boolean, data?: ChapterDetail, error?: string }>(`/public/comics/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterId)}`)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch chapter detail')
    }
    return { success: true, data: result.data }
  },
}

// ─── Progress API ──────────────────────────────────────────────────────────

export const progressApi = {
  async saveReadingProgress(chapterId: string, page: number, completed = false): Promise<ApiResponse<void>> {
    return apiFetch('/public/progress/reading', {
      method: 'POST',
      body: JSON.stringify({ chapterId, page, completed }),
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
  async getFavorites(params?: { page?: number, limit?: number }): Promise<PaginatedResponse<Favorite>> {
    const query = new URLSearchParams({
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
      entityType: 'comic',
    })
    const result = await apiFetch<FavoriteListResponse>(`/favorites?${query.toString()}`)
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch favorites')
    }
    return {
      success: true,
      data: result.data,
      pagination: result.meta,
    }
  },

  async addFavorite(comicId: string): Promise<ApiResponse<{ id: string, alreadyExists: boolean }>> {
    const result = await apiFetch<{ success: boolean, id?: string, alreadyExists?: boolean, error?: string }>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'comic', entityId: comicId }),
    })
    return {
      success: result.success,
      data: result.id
        ? { id: result.id, alreadyExists: result.alreadyExists ?? false }
        : undefined,
      error: result.error,
    }
  },

  async removeFavorite(favoriteId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiFetch(`/favorites/${encodeURIComponent(favoriteId)}`, { method: 'DELETE' })
  },

  async isFavorite(comicId: string): Promise<{ isFavorited: boolean, favoriteId: string | null }> {
    try {
      const res = await apiFetch<ApiResponse<{ isFavorited: boolean, favoriteId: string | null }>>(`/favorites/check/comic/${encodeURIComponent(comicId)}`)
      return {
        isFavorited: res.data?.isFavorited ?? false,
        favoriteId: res.data?.favoriteId ?? null,
      }
    }
    catch {
      return { isFavorited: false, favoriteId: null }
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
