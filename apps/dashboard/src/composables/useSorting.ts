/**
 * 排序状态管理 Composable
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useSorting(defaultSortBy = 'updatedAt', defaultSortOrder: 'asc' | 'desc' = 'desc') {
  const route = useRoute()
  const router = useRouter()

  const sortBy = computed(() => {
    return (route.query.sortBy as string) || defaultSortBy
  })

  const sortOrder = computed(() => {
    return (route.query.sortOrder as 'asc' | 'desc') || defaultSortOrder
  })

  const updateSort = (newSortBy: string, newSortOrder?: 'asc' | 'desc') => {
    const order = newSortOrder || (newSortBy === sortBy.value && sortOrder.value === 'desc' ? 'asc' : 'desc')

    router.push({
      query: {
        ...route.query,
        sortBy: newSortBy,
        sortOrder: order,
        page: 1,
      },
    })
  }

  return {
    sortBy,
    sortOrder,
    updateSort,
  }
}
