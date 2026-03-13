/**
 * 筛选器状态管理 Composable
 * 
 * 功能：
 * - 筛选器状态管理
 * - URL 查询参数同步
 * - 应用和重置筛选
 */

import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useFilters<T extends Record<string, any>>(initialFilters: T) {
  const route = useRoute()
  const router = useRouter()

  const filters = ref<T>({
    ...initialFilters,
    ...(route.query as any),
  } as T)

  const applyFilters = () => {
    router.push({
      query: {
        ...filters.value,
        page: 1,
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
      filters.value = {
        ...initialFilters,
        ...newQuery,
      } as T
    },
  )

  return {
    filters,
    applyFilters,
    resetFilters,
  }
}
