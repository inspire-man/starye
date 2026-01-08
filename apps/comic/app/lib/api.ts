import type { UseFetchOptions } from 'nuxt/app'

export interface ApiMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  meta?: ApiMeta
}

/**
 * Wrapper around useFetch for standardized API calls
 */
export function useApi<T = unknown>(
  url: string | (() => string),
  options: UseFetchOptions<ApiResponse<T>> = {},
) {
  const config = useRuntimeConfig()

  const defaults: UseFetchOptions<ApiResponse<T>> = {
    baseURL: config.public.apiUrl as string,
    credentials: 'include',
    headers: useRequestHeaders(['cookie']) as Record<string, string>,
  }

  return useFetch(url, {
    ...defaults,
    ...options,
    headers: {
      ...defaults.headers,
      ...options.headers,
    },
  })
}
