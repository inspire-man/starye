import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface ListQueryMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListQueryInput {
  page: number
  limit: number
}

/** Shared URL pagination and stale-request guard for public list views. */
export function useListQuery(defaultLimit = 20) {
  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const error = ref('')
  const total = ref(0)
  const totalPages = ref(0)
  let requestVersion = 0

  const page = computed(() => {
    const value = Number(route.query.page)
    return value > 0 ? value : 1
  })

  const limit = computed(() => {
    const value = Number(route.query.limit)
    return value > 0 ? value : defaultLimit
  })

  function updateQuery(next: Record<string, string | undefined>): Promise<void> {
    const query = { ...route.query }
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '')
        delete query[key]
      else query[key] = value
    }
    return router.replace({ query }).then(() => undefined)
  }

  function goToPage(nextPage: number): Promise<void> {
    return updateQuery({ page: nextPage > 1 ? String(nextPage) : undefined })
  }

  function updatePageSize(nextLimit: number): Promise<void> {
    return updateQuery({ limit: String(nextLimit), page: undefined })
  }

  function resetMeta() {
    total.value = 0
    totalPages.value = 0
  }

  function setMeta(meta: ListQueryMeta) {
    total.value = meta.total
    totalPages.value = meta.totalPages
  }

  async function execute<T>(loader: (input: ListQueryInput) => Promise<{ data: T, pagination: ListQueryMeta }>, fallbackMessage = '加载失败'): Promise<T | null> {
    const version = ++requestVersion
    loading.value = true
    error.value = ''
    try {
      const response = await loader({ page: page.value, limit: limit.value })
      if (version !== requestVersion)
        return null
      setMeta(response.pagination)
      return response.data
    }
    catch (cause) {
      if (version !== requestVersion)
        return null
      error.value = cause instanceof Error ? cause.message : fallbackMessage
      return null
    }
    finally {
      if (version === requestVersion)
        loading.value = false
    }
  }

  function cancel() {
    requestVersion += 1
    loading.value = false
  }

  return {
    page,
    limit,
    total,
    totalPages,
    loading,
    error,
    goToPage,
    updatePageSize,
    resetMeta,
    setMeta,
    execute,
    cancel,
  }
}
