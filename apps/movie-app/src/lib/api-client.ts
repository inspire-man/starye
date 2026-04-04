/**
 * Movie App API 客户端 - 基于 Hono RPC
 *
 * 使用 hc<AppType>() 替代 axios，获得原生 fetch 的类型安全调用
 */

import type { AppType } from '@starye/api-types'
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
import { hc } from 'hono/client'

/** Hono RPC 客户端 */
const client = hc<AppType>('/')

/** 通用 JSON fetch，处理非 RPC 路由（auth、favorites 等） */
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '')
          query[k] = String(v)
      })
    }
    const res = await client.api.public.movies.$get({ query } as any)
    const data = await res.json() as any
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getMovieDetail(code: string): Promise<ApiResponse<MovieDetail>> {
    const res = await client.api.public.movies[':identifier'].$get({ param: { identifier: code } } as any)
    const data = await res.json() as any
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '')
          query[k] = String(v)
      })
    }
    const res = await client.api.actors.$get({ query } as any)
    const data = await res.json() as any
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getActorDetail(slug: string): Promise<ApiResponse<ActorDetail>> {
    const res = await client.api.actors[':slug'].$get({ param: { slug } } as any)
    const data = await res.json() as any
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined)
          query[k] = String(v)
      })
    }
    const res = await client.api.actors[':slug'].relations.$get({ param: { slug: actorId }, query } as any)
    const data = await res.json() as any
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '')
          query[k] = String(v)
      })
    }
    const res = await client.api.publishers.$get({ query } as any)
    const data = await res.json() as any
    return {
      success: true,
      data: data.data,
      pagination: data.meta,
    }
  },

  async getPublisherDetail(slug: string): Promise<ApiResponse<PublisherDetail>> {
    const res = await client.api.publishers[':slug'].$get({ param: { slug } } as any)
    const data = await res.json() as any
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
    const query: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined)
          query[k] = String(v)
      })
    }
    const res = await client.api.favorites.$get({ query } as any)
    const data = await res.json() as any
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
