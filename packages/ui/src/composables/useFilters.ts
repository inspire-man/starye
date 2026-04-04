import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useFilters<T extends Record<string, any>>(initialFilters: T) {
  const route = useRoute()
  const router = useRouter()

  const extractFilters = (query: Record<string, any>): T => {
    const result: Record<string, any> = { ...initialFilters }
    Object.keys(initialFilters).forEach((key) => {
      if (query[key] !== undefined) {
        result[key] = query[key]
      }
    })
    return result as T
  }

  const filters = ref<T>(extractFilters(route.query))

  const applyFilters = () => {
    const cleanFilters: Record<string, any> = {}
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        cleanFilters[key] = value
      }
    })

    router.push({
      query: {
        ...route.query,
        ...cleanFilters,
        page: '1',
      },
    })
  }

  const resetFilters = () => {
    filters.value = { ...initialFilters } as T
    applyFilters()
  }

  watch(
    () => route.query,
    (newQuery) => {
      filters.value = extractFilters(newQuery)
    },
  )

  return {
    filters,
    applyFilters,
    resetFilters,
  }
}
