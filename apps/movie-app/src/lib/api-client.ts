/**
 * Movie App API 客户端 - Hono RPC
 *
 * 使用 hc<AppType>() 获得类型安全的 API 调用：
 * - URL 路径名 / 路径参数名 / query 参数名均在编译期校验
 * - 局部类型转换 (as unknown as LocalType) 仅在 api-client 边界使用，
 *   不向视图层透传 any
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
    sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'releaseDate'
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Movie>> {
    const res = await client.api.public.movies.$get({
      query: {
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
        actor: params?.actor,
        publisher: params?.publisher,
        genre: params?.genre,
        series: params?.series,
        search: params?.search,
        sortBy: params?.sortBy,
        sortOrder: params?.sortOrder,
      },
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error('Failed to fetch movies')
    }
    return {
      success: true,
      data: data.data as unknown as Movie[],
      pagination: data.pagination,
    }
  },

  async getMovieDetail(code: string): Promise<ApiResponse<MovieDetail>> {
    const res = await client.api.public.movies[':code'].$get({
      param: { code },
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error)
    }
    return { success: true, data: data.data as unknown as MovieDetail }
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
    const res = await client.api.actors.$get({
      query: {
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
        sort: params?.sort,
        nationality: params?.nationality,
        isActive: params?.isActive?.toString(),
        hasDetails: params?.hasDetails?.toString(),
      },
    })
    const data = await res.json()
    if ('error' in data) {
      throw new Error('Failed to fetch actors')
    }
    return {
      success: true,
      data: data.data as unknown as Actor[],
      pagination: data.meta,
    }
  },

  async getActorDetail(slug: string): Promise<ApiResponse<ActorDetail>> {
    const res = await client.api.actors[':slug'].$get({
      param: { slug },
    })
    const data = await res.json()
    if ('error' in data) {
      throw new Error(data.error)
    }
    return { success: true, data: data as unknown as ActorDetail }
  },

  async getActorRelations(actorId: string, _params?: {
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
    const res = await client.api.actors[':id'].relations.$get({
      param: { id: actorId },
    })
    const data = await res.json()
    if ('error' in data) {
      throw new Error(data.error)
    }
    return { success: true, data: data.data as unknown as {
      actorId: string
      actorName: string
      relations: Array<{
        partnerId: string
        partnerName: string
        partnerSlug: string
        partnerAvatar?: string
        collaborationCount: number
        sharedMovies: Array<{ movieId: string, movieCode: string, movieTitle: string }>
      }>
    } }
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
    const res = await client.api.publishers.$get({
      query: {
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
        sort: params?.sort,
        country: params?.country,
        hasDetails: params?.hasDetails?.toString(),
      },
    })
    const data = await res.json()
    if ('error' in data) {
      throw new Error('Failed to fetch publishers')
    }
    return {
      success: true,
      data: data.data as unknown as Publisher[],
      pagination: data.meta,
    }
  },

  async getPublisherDetail(slug: string): Promise<ApiResponse<PublisherDetail>> {
    const res = await client.api.publishers[':slug'].$get({
      param: { slug },
    })
    const data = await res.json()
    if ('error' in data) {
      throw new Error(data.error)
    }
    return { success: true, data: data as unknown as PublisherDetail }
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

// ─── Ratings API ───────────────────────────────────────────────────────────

export const ratingApi = {
  /**
   * 提交播放源评分（1-5 星），返回更新后的聚合数据
   */
  async submitPlayerRating(playerId: string, score: number): Promise<{ averageRating: number, ratingCount: number }> {
    const data = await apiFetch<{ code: number, data: { averageRating: number, ratingCount: number } }>('/ratings', {
      method: 'POST',
      body: JSON.stringify({ playerId, score }),
    })
    return data.data
  },

  /**
   * 上报播放源失效
   */
  async reportPlayer(playerId: string): Promise<{ reportCount: number, isActive: boolean }> {
    return apiFetch<{ success: boolean, reportCount: number, isActive: boolean }>(`/movies/players/${playerId}/report`, {
      method: 'POST',
    })
  },
}

// ─── Favorites API ─────────────────────────────────────────────────────────

export const favoritesApi = {
  async getFavorites(_params?: {
    page?: number
    limit?: number
    entityType?: 'actor' | 'publisher' | 'movie' | 'comic'
  }): Promise<PaginatedResponse<Favorite>> {
    const res = await client.api.favorites.$get()
    const data = await res.json()
    if ('error' in data) {
      throw new Error('Failed to fetch favorites')
    }
    return {
      success: true,
      data: data.data as unknown as Favorite[],
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
