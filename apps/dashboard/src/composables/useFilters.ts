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

  // 从 URL query 中提取筛选参数（排除分页参数）
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
    // 清理空值，避免 URL 污染
    const cleanFilters: Record<string, any> = {}
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        cleanFilters[key] = value
      }
    })

    router.push({
      query: {
        ...route.query, // 保留 page 和 limit
        ...cleanFilters,
        page: '1', // 筛选条件变化时重置到第一页
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
