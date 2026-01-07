export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
}

export const api = {
  API_BASE,
  getComics: () => fetchApi<Comic[]>('/api/comics'),
}
