import type { User } from 'better-auth'
import { credentialFetch } from './hono-rpc-client'

// API_BASE 用于 upload 等特殊场景
export const API_BASE = '/api'

/** 通用 JSON fetch — 使用 credentialFetch 确保携带 Cookie 凭证 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await credentialFetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}

/** fetchApi 向后兼容别名（与 apiFetch 等效） */
export const fetchApi = apiFetch

// ─── 公用类型 ────────────────────────────────────────────────────────────────

export interface Comic {
  id: string
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
  isR18?: boolean
  metadataLocked?: boolean
  status?: 'serializing' | 'completed'
  crawlStatus?: 'pending' | 'partial' | 'complete'
  chapterCount?: number | null
  region?: string | null
  genres?: string[] | null
  createdAt?: string
  updatedAt?: string
}

export interface Chapter {
  id: string
  title: string
  slug: string
  sortOrder: number
  sourcePageCount?: number | null
  pages?: { id: string, imageUrl: string, pageNumber: number }[]
}

export interface Movie {
  id: string
  title: string
  slug: string
  code: string
  description?: string | null
  coverImage?: string | null
  releaseDate?: string | null
  duration?: number | null
  actors?: (string | { id: string, name: string })[] | null
  actorNames?: string[] | null
  publishers?: (string | { id: string, name: string })[] | null
  publisherNames?: string[] | null
  genres?: string[] | null
  series?: string | null
  publisher?: string | null
  isR18: boolean
  metadataLocked?: boolean
  sortOrder?: number
  crawlStatus?: 'pending' | 'partial' | 'complete'
  lastCrawledAt?: string | null
  totalPlayers?: number
  crawledPlayers?: number
  createdAt?: string
  updatedAt?: string
  movieActors?: Array<{ sortOrder: number, actor?: { id: string, name: string } }>
  moviePublishers?: Array<{ sortOrder: number, publisher?: { id: string, name: string } }>
}

export interface Player {
  id: string
  movieId: string
  sourceName: string
  sourceUrl: string
  quality?: string | null
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Actor {
  id: string
  name: string
  slug: string
  avatar?: string | null
  bio?: string | null
  movieCount: number
  hasDetailsCrawled: boolean
  sourceUrl?: string | null
  nationality?: string | null
  birthDate?: number | null
  height?: number | null
  measurements?: string | null
  cupSize?: string | null
  bloodType?: string | null
  debutDate?: number | null
  isActive?: boolean | null
  crawlFailureCount?: number
  aliases?: string[] | null
  twitter?: string | null
  instagram?: string | null
  blog?: string | null
  wikiUrl?: string | null
  createdAt?: number | null
  updatedAt?: number | null
}

export interface Publisher {
  id: string
  name: string
  slug: string
  logo?: string | null
  website?: string | null
  movieCount: number
  hasDetailsCrawled: boolean
  sourceUrl?: string | null
  country?: string | null
  foundedYear?: number | null
  description?: string | null
  crawlFailureCount?: number
  twitter?: string | null
  instagram?: string | null
  wikiUrl?: string | null
  parentPublisher?: string | null
  brandSeries?: string[] | null
  createdAt?: number | null
  updatedAt?: number | null
}

export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId?: string | null
  resourceIdentifier?: string | null
  affectedCount: number
  changes?: any
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface UploadResponse {
  id: string
  url: string
  key: string
  size: number
  mimeType: string
}

export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── API 对象 ─────────────────────────────────────────────────────────────────

export const api = {
  API_BASE,
  // Public API (filtered)
  getComics: () => apiFetch<Paginated<Comic>>('/comics?limit=50'),

  // Admin API (full access)
  admin: {
    getStats: () => apiFetch<{
      comics: number
      movies: number
      actors: number
      publishers: number
      users: number
      crawling: { movies: number, comics: number }
      pending: { actors: number, publishers: number }
    }>('/admin/stats'),

    getComics: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Comic>>(`/admin/comics${query ? `?${query}` : ''}`)
    },

    getUsers: () => apiFetch<any[]>('/admin/users'),

    updateUserRole: (email: string, role: string) =>
      apiFetch(`/admin/users/${email}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    updateUserStatus: (email: string, isAdult: boolean) =>
      apiFetch(`/admin/users/${email}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdult }),
      }),

    updateComic: (id: string, data: Partial<Comic>) =>
      apiFetch(`/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    getChapters: (comicId: string) => apiFetch<Chapter[]>(`/admin/comics/${comicId}/chapters`),
    getChapter: (id: string) => apiFetch<Chapter>(`/admin/chapters/${id}`),
    deleteChapter: (id: string) => apiFetch(`/admin/chapters/${id}`, { method: 'DELETE' }),

    bulkOperationComics: (ids: string[], operation: string, payload?: any) =>
      apiFetch('/admin/comics/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    bulkDeleteChapters: (comicId: string, chapterIds: string[]) =>
      apiFetch(`/admin/comics/${comicId}/chapters/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ chapterIds }),
      }),

    getMovies: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Movie>>(`/admin/movies${query ? `?${query}` : ''}`)
    },

    getMovie: (id: string) => apiFetch<Movie>(`/admin/movies/${id}`),

    updateMovie: (id: string, data: Partial<Movie>) =>
      apiFetch(`/admin/movies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteMovie: (id: string) =>
      apiFetch(`/admin/movies/${id}`, { method: 'DELETE' }),

    bulkOperationMovies: (ids: string[], operation: string, payload?: any) =>
      apiFetch('/admin/movies/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    getPlayers: (movieId: string) =>
      apiFetch<{ movieId: string, players: Player[], total: number }>(`/admin/movies/${movieId}/players`),

    addPlayer: (movieId: string, data: { sourceName: string, sourceUrl: string, quality?: string }) =>
      apiFetch(`/admin/movies/${movieId}/players`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updatePlayer: (playerId: string, data: Partial<Player>) =>
      apiFetch(`/admin/movies/players/${playerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePlayer: (playerId: string) =>
      apiFetch(`/admin/movies/players/${playerId}`, { method: 'DELETE' }),

    batchImportPlayers: (movieId: string, players: Array<{ sourceName: string, sourceUrl: string, quality?: string }>) =>
      apiFetch(`/admin/movies/${movieId}/players/batch-import`, {
        method: 'POST',
        body: JSON.stringify({ players }),
      }),

    getActors: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Actor>>(`/admin/actors${query ? `?${query}` : ''}`)
    },

    getActor: (id: string) => apiFetch<Actor & { relatedMovies: Movie[] }>(`/admin/actors/${id}`),

    getActorDetail: (id: string) => apiFetch<{ actor: Actor, movies: Movie[] }>(`/admin/actors/${id}`),

    updateActor: (id: string, data: Partial<Actor>) =>
      apiFetch(`/admin/actors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergeActors: (sourceId: string, targetId: string) =>
      apiFetch('/admin/actors/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createActor: (data: { name: string }) =>
      apiFetch<{ id: string, name: string }>('/admin/actors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    batchRecrawlActors: (ids: string[]) =>
      apiFetch<{ success: boolean, total: number, marked: number, message: string }>('/admin/actors/batch-recrawl', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    updateMovieActors: (movieId: string, actors: { id: string, name: string, sortOrder: number }[]) =>
      apiFetch(`/admin/movies/${movieId}/actors`, {
        method: 'PUT',
        body: JSON.stringify({ actors }),
      }),

    getPublishers: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Publisher>>(`/admin/publishers${query ? `?${query}` : ''}`)
    },

    getPublisher: (id: string) => apiFetch<Publisher & { relatedMovies: Movie[] }>(`/admin/publishers/${id}`),

    getPublisherDetail: (id: string) => apiFetch<{ publisher: Publisher, movies: Movie[] }>(`/admin/publishers/${id}`),

    updatePublisher: (id: string, data: Partial<Publisher>) =>
      apiFetch(`/admin/publishers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergePublishers: (sourceId: string, targetId: string) =>
      apiFetch('/admin/publishers/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createPublisher: (data: { name: string }) =>
      apiFetch<{ id: string, name: string }>('/admin/publishers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateMoviePublishers: (movieId: string, publishers: { id: string, name: string, sortOrder: number }[]) =>
      apiFetch(`/admin/movies/${movieId}/publishers`, {
        method: 'PUT',
        body: JSON.stringify({ publishers }),
      }),

    getCrawlerStats: () =>
      apiFetch<any>('/admin/crawlers/stats'),

    getFailedTasks: () =>
      apiFetch<any>('/admin/crawlers/failed-tasks'),

    recoverCrawler: (type: 'comic' | 'movie') =>
      apiFetch('/admin/crawlers/recover', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    clearFailedTasks: (type: 'comic' | 'movie') =>
      apiFetch('/admin/crawlers/clear-failed', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    getAuditLogs: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<AuditLog>>(`/admin/audit-logs${query ? `?${query}` : ''}`)
    },

    exportAuditLogs: async (format: 'json' | 'csv', params?: Record<string, any>): Promise<Blob> => {
      const query = new URLSearchParams({ ...params, format }).toString()
      const response = await credentialFetch(`${API_BASE}/admin/audit-logs/export?${query}`)
      if (!response.ok) {
        throw new Error(`Failed to export audit logs: ${response.statusText}`)
      }
      return response.blob()
    },

    // R18 白名单管理
    getR18Whitelist: () =>
      apiFetch<{ success: boolean, data: User[] }>('/admin/r18-whitelist'),

    addToR18Whitelist: (userId?: string, email?: string) =>
      apiFetch('/admin/r18-whitelist', {
        method: 'POST',
        body: JSON.stringify({ userId, email }),
      }),

    removeFromR18Whitelist: (userId: string) =>
      apiFetch(`/admin/r18-whitelist/${userId}`, {
        method: 'DELETE',
      }),

    // 名称映射管理
    getNameMappings: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/admin/name-mappings${query ? `?${query}` : ''}`)
    },

    createNameMapping: (data: any) =>
      apiFetch('/admin/name-mappings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateNameMapping: (id: string, data: any) =>
      apiFetch(`/admin/name-mappings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteNameMapping: (id: string) =>
      apiFetch(`/admin/name-mappings/${id}`, { method: 'DELETE' }),

    bulkDeleteNameMappings: (ids: string[]) =>
      apiFetch('/admin/name-mappings/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    getMappingQualityReport: () =>
      apiFetch<any>('/admin/name-mappings/quality-report'),

    // 收藏管理
    getFavorites: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/favorites${query ? `?${query}` : ''}`)
    },

    checkFavorite: (entityType: string, entityId: string) =>
      apiFetch<any>(`/favorites/check/${entityType}/${entityId}`),

    addFavorite: (entityType: string, entityId: string) =>
      apiFetch('/favorites', {
        method: 'POST',
        body: JSON.stringify({ entityType, entityId }),
      }),

    deleteFavorite: (favoriteId: string) =>
      apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' }),

    // 评分管理
    getRatings: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/ratings${query ? `?${query}` : ''}`)
    },

    // 同步管理
    triggerSync: (type: string, params?: any) =>
      apiFetch('/admin/sync', {
        method: 'POST',
        body: JSON.stringify({ type, ...params }),
      }),

    // 系统设置
    getSettings: () =>
      apiFetch<{ success: boolean, data: Array<{ key: string, value: string, updatedAt: number | null }> }>('/admin/settings'),

    updateSettings: (settings: Array<{ key: string, value: string }>) =>
      apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }),

    // 用户管理附加
    saveComic: (id: string, data: Partial<Comic>) =>
      apiFetch(`/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteComic: (id: string) =>
      apiFetch(`/admin/comics/${id}`, { method: 'DELETE' }),

    bulkDeleteMovies: (ids: string[]) =>
      apiFetch('/admin/movies/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    bulkDeleteActors: (ids: string[]) =>
      apiFetch('/admin/actors/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    bulkDeletePublishers: (ids: string[]) =>
      apiFetch('/admin/publishers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },

  upload: {
    presign: (filename: string, contentType: string) =>
      apiFetch<{ uploadUrl: string, publicUrl: string }>('/upload/presign', {
        method: 'POST',
        body: JSON.stringify({ filename, contentType }),
      }),

    uploadImage: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)

      const res = await credentialFetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' })) as { error?: string, message?: string }
        throw new Error(error.error || error.message || `Upload failed with status ${res.status}`)
      }

      return res.json()
    },
  },
}
