/**
 * Movie App API 客户端 - 原生 fetch
 *
 * 使用原生 fetch 进行 API 调用，避免引入 Hono RPC 的源码类型链
 */

import type {
  Actor,
  ActorDetail,
  ApiResponse,
  Favorite,
  Movie,
  MovieDetail,
  PaginatedResponse,
  Publisher,
  PublisherDetail,
  WatchingProgress,
} from '../types'

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

// ─── Movie API ─────────────────────────────────────────────────────────────

export const movieApi = {
  async getMovies(params?: {
    page?: number
    limit?: number
    actor?: string
    publisher?: string
    genre?: string
    series?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Movie>> {
    const data = await apiFetch<any>(`/public/movies${buildQuery(params)}`)
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getMovieDetail(code: string): Promise<ApiResponse<MovieDetail>> {
    const data = await apiFetch<any>(`/public/movies/${encodeURIComponent(code)}`)
    return { success: true, data: data.data }
  },
}

// ─── Actor API ─────────────────────────────────────────────────────────────

export const actorApi = {
  async getActors(params?: {
    page?: number
    limit?: number
    sort?: 'name' | 'movieCount' | 'createdAt'
    nationality?: string
    isActive?: boolean
    hasDetails?: boolean
  }): Promise<PaginatedResponse<Actor>> {
    const data = await apiFetch<any>(`/actors${buildQuery(params)}`)
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getActorDetail(slug: string): Promise<ApiResponse<ActorDetail>> {
    const data = await apiFetch<any>(`/actors/${encodeURIComponent(slug)}`)
    return { success: true, data }
  },

  async getActorRelations(actorId: string, params?: {
    minCollaborations?: number
    limit?: number
  }): Promise<ApiResponse<{
    actorId: string
    actorName: string
    relations: Array<{
      partnerId: string
      partnerName: string
      partnerSlug: string
      partnerAvatar?: string
      collaborationCount: number
      sharedMovies: Array<{
        movieId: string
        movieCode: string
        movieTitle: string
      }>
    }>
  }>> {
    const data = await apiFetch<any>(`/actors/${encodeURIComponent(actorId)}/relations${buildQuery(params)}`)
    return { success: true, data: data.data }
  },
}

// ─── Publisher API ─────────────────────────────────────────────────────────

export const publisherApi = {
  async getPublishers(params?: {
    page?: number
    limit?: number
    sort?: 'name' | 'movieCount' | 'createdAt'
    country?: string
    hasDetails?: boolean
  }): Promise<PaginatedResponse<Publisher>> {
    const data = await apiFetch<any>(`/publishers${buildQuery(params)}`)
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getPublisherDetail(slug: string): Promise<ApiResponse<PublisherDetail>> {
    const data = await apiFetch<any>(`/publishers/${encodeURIComponent(slug)}`)
    return { success: true, data }
  },
}

// ─── Progress API ──────────────────────────────────────────────────────────

export const progressApi = {
  async saveWatchingProgress(movieCode: string, progress: number, duration?: number): Promise<ApiResponse<void>> {
    return apiFetch('/public/progress/watching', {
      method: 'POST',
      body: JSON.stringify({ movieCode, progress, duration }),
    })
  },

  async getWatchingProgress(movieCode?: string): Promise<ApiResponse<WatchingProgress | WatchingProgress[]>> {
    const query = movieCode ? `?movieCode=${encodeURIComponent(movieCode)}` : ''
    return apiFetch(`/public/progress/watching${query}`)
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
        callbackURL: `${window.location.origin}/movie/`,
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

// ─── Favorites API ─────────────────────────────────────────────────────────

export const favoritesApi = {
  async getFavorites(params?: {
    page?: number
    limit?: number
    entityType?: 'actor' | 'publisher' | 'movie' | 'comic'
  }): Promise<PaginatedResponse<Favorite>> {
    const data = await apiFetch<any>(`/favorites${buildQuery(params)}`)
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async addFavorite(entityType: 'actor' | 'publisher' | 'movie' | 'comic', entityId: string): Promise<ApiResponse<{ id: string, alreadyExists: boolean }>> {
    return apiFetch('/favorites', {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId }),
    })
  },

  async deleteFavorite(favoriteId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' })
  },

  async checkFavorite(entityType: 'actor' | 'publisher' | 'movie' | 'comic', entityId: string): Promise<{ isFavorited: boolean, favoriteId: string | null }> {
    try {
      const data = await apiFetch<any>(`/favorites/check/${entityType}/${entityId}`)
      return {
        isFavorited: data.data?.isFavorited || false,
        favoriteId: data.data?.favoriteId || null,
      }
    }
    catch {
      return { isFavorited: false, favoriteId: null }
    }
  },
}
