import type { User } from 'better-auth'

// 使用相对路径，通过 Gateway 转发到 API
export const API_BASE = '/api'

const TOKEN_KEY = 'starye_admin_token'
export const getAdminToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setAdminToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const token = getAdminToken()

  const res = await fetch(url, {
    credentials: 'include', // Important for Better Auth Cookies
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Send token if present (for backward compatibility or script access)
      ...(token ? { 'x-service-token': token } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}

export interface Comic {
  id?: string
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
  isR18?: boolean
  metadataLocked?: boolean
  status?: 'serializing' | 'completed'
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
  publishers?: (string | { id: string, name: string })[] | null
  genres?: string[] | null
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

export const api = {
  API_BASE,
  // Public API (filtered)
  getComics: () => fetchApi<Paginated<Comic>>('/comics?limit=50'),

  // Admin API (full access)
  admin: {
    getStats: () => fetchApi<{ comics: number, users: number, tasks: number }>('/admin/stats'),

    getComics: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return fetchApi<Paginated<Comic>>(`/admin/comics${query ? `?${query}` : ''}`)
    },

    getUsers: () => fetchApi<any[]>('/admin/users'),

    updateUserRole: (email: string, role: string) =>
      fetchApi(`/admin/users/${email}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    updateUserStatus: (email: string, isAdult: boolean) =>
      fetchApi(`/admin/users/${email}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdult }),
      }),

    updateComic: (id: string, data: Partial<Comic>) =>
      fetchApi(`/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    getChapters: (comicId: string) => fetchApi<Chapter[]>(`/admin/comics/${comicId}/chapters`),
    getChapter: (id: string) => fetchApi<Chapter>(`/admin/chapters/${id}`),
    deleteChapter: (id: string) => fetchApi(`/admin/chapters/${id}`, { method: 'DELETE' }),

    bulkOperationComics: (ids: string[], operation: string, payload?: any) =>
      fetchApi('/admin/comics/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    bulkDeleteChapters: (comicId: string, chapterIds: string[]) =>
      fetchApi(`/admin/comics/${comicId}/chapters/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ chapterIds }),
      }),

    getMovies: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return fetchApi<Paginated<Movie>>(`/admin/movies${query ? `?${query}` : ''}`)
    },

    getMovie: (id: string) => fetchApi<Movie>(`/admin/movies/${id}`),

    updateMovie: (id: string, data: Partial<Movie>) =>
      fetchApi(`/admin/movies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteMovie: (id: string) =>
      fetchApi(`/admin/movies/${id}`, { method: 'DELETE' }),

    bulkOperationMovies: (ids: string[], operation: string, payload?: any) =>
      fetchApi('/admin/movies/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    getPlayers: (movieId: string) =>
      fetchApi<{ movieId: string, players: Player[], total: number }>(`/admin/movies/${movieId}/players`),

    addPlayer: (movieId: string, data: { sourceName: string, sourceUrl: string, quality?: string }) =>
      fetchApi(`/admin/movies/${movieId}/players`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updatePlayer: (playerId: string, data: Partial<Player>) =>
      fetchApi(`/admin/movies/players/${playerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePlayer: (playerId: string) =>
      fetchApi(`/admin/movies/players/${playerId}`, { method: 'DELETE' }),

    batchImportPlayers: (movieId: string, players: Array<{ sourceName: string, sourceUrl: string, quality?: string }>) =>
      fetchApi(`/admin/movies/${movieId}/players/batch-import`, {
        method: 'POST',
        body: JSON.stringify({ players }),
      }),

    getActors: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return fetchApi<Paginated<Actor>>(`/admin/actors${query ? `?${query}` : ''}`)
    },

    getActor: (id: string) => fetchApi<Actor & { relatedMovies: Movie[] }>(`/admin/actors/${id}`),

    getActorDetail: (id: string) => fetchApi<{ actor: Actor, movies: Movie[] }>(`/admin/actors/${id}`),

    updateActor: (id: string, data: Partial<Actor>) =>
      fetchApi(`/admin/actors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergeActors: (sourceId: string, targetId: string) =>
      fetchApi('/admin/actors/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createActor: (data: { name: string }) =>
      fetchApi<{ id: string, name: string }>('/admin/actors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    batchRecrawlActors: (ids: string[]) =>
      fetchApi<{ success: boolean, total: number, marked: number, message: string }>('/admin/actors/batch-recrawl', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    updateMovieActors: (movieId: string, actors: { id: string, name: string, sortOrder: number }[]) =>
      fetchApi(`/admin/movies/${movieId}/actors`, {
        method: 'PUT',
        body: JSON.stringify({ actors }),
      }),

    getPublishers: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return fetchApi<Paginated<Publisher>>(`/admin/publishers${query ? `?${query}` : ''}`)
    },

    getPublisher: (id: string) => fetchApi<Publisher & { relatedMovies: Movie[] }>(`/admin/publishers/${id}`),

    getPublisherDetail: (id: string) => fetchApi<{ publisher: Publisher, movies: Movie[] }>(`/admin/publishers/${id}`),

    updatePublisher: (id: string, data: Partial<Publisher>) =>
      fetchApi(`/admin/publishers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergePublishers: (sourceId: string, targetId: string) =>
      fetchApi('/admin/publishers/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createPublisher: (data: { name: string }) =>
      fetchApi<{ id: string, name: string }>('/admin/publishers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateMoviePublishers: (movieId: string, publishers: { id: string, name: string, sortOrder: number }[]) =>
      fetchApi(`/admin/movies/${movieId}/publishers`, {
        method: 'PUT',
        body: JSON.stringify({ publishers }),
      }),

    getCrawlerStats: () =>
      fetchApi<any>('/admin/crawlers/stats'),

    getFailedTasks: () =>
      fetchApi<any>('/admin/crawlers/failed-tasks'),

    recoverCrawler: (type: 'comic' | 'movie') =>
      fetchApi('/admin/crawlers/recover', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    clearFailedTasks: (type: 'comic' | 'movie') =>
      fetchApi('/admin/crawlers/clear-failed', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    getAuditLogs: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return fetchApi<Paginated<AuditLog>>(`/admin/audit-logs${query ? `?${query}` : ''}`)
    },

    exportAuditLogs: async (format: 'json' | 'csv', params?: Record<string, any>): Promise<Blob> => {
      const query = new URLSearchParams({ ...params, format }).toString()
      const response = await fetch(`${API_BASE}/admin/audit-logs/export?${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Failed to export audit logs: ${response.statusText}`)
      }
      return await response.blob()
    },

    // R18 白名单管理
    getR18Whitelist: () =>
      fetchApi<{ success: boolean, data: User[] }>('/admin/r18-whitelist'),

    addToR18Whitelist: (userId?: string, email?: string) =>
      fetchApi('/admin/r18-whitelist', {
        method: 'POST',
        body: JSON.stringify({ userId, email }),
      }),

    removeFromR18Whitelist: (userId: string) =>
      fetchApi(`/admin/r18-whitelist/${userId}`, {
        method: 'DELETE',
      }),
  },

  upload: {
    presign: (filename: string, contentType: string) =>
      fetchApi<{ uploadUrl: string, publicUrl: string }>('/upload/presign', {
        method: 'POST',
        body: JSON.stringify({ filename, contentType }),
      }),

    /**
     * 直接上传图片到服务器
     * @param file - 要上传的图片文件
     * @returns 上传结果，包含图片 URL 和元数据
     */
    uploadImage: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)

      const token = getAdminToken()
      const url = `${API_BASE}/upload`

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { 'x-service-token': token } : {}),
        },
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.error || `Upload failed with status ${res.status}`)
      }

      return res.json()
    },
  },
}
