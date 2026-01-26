export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

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
  status?: 'serializing' | 'completed'
  region?: string | null
  genres?: string[] | null
  createdAt?: string
  updatedAt?: string
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
  getComics: () => fetchApi<Paginated<Comic>>('/api/comics?limit=50'),

  // Admin API (full access)
  admin: {
    getStats: () => fetchApi<{ comics: number, users: number, tasks: number }>('/api/admin/stats'),
    getComics: () => fetchApi<Paginated<Comic>>('/api/admin/comics'),
    getUsers: () => fetchApi<any[]>('/api/admin/users'), // TODO: Type User properly
    updateUserRole: (email: string, role: string) =>
      fetchApi(`/api/admin/users/${email}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    updateUserStatus: (email: string, isAdult: boolean) =>
      fetchApi(`/api/admin/users/${email}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdult }),
      }),
    updateComic: (id: string, data: Partial<Comic>) =>
      fetchApi(`/api/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  upload: {
    presign: (filename: string, contentType: string) =>
      fetchApi<{ uploadUrl: string, publicUrl: string }>('/api/upload/presign', {
        method: 'POST',
        body: JSON.stringify({ filename, contentType }),
      }),
  },
}
