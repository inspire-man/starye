/**
 * 分页逻辑 Composable
 */

import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function usePagination(defaultLimit = 20) {
  const route = useRoute()
  const router = useRouter()

  const currentPage = computed(() => {
    const page = Number(route.query.page)
    return page > 0 ? page : 1
  })

  const limit = computed(() => {
    const l = Number(route.query.limit)
    return l > 0 ? l : defaultLimit
  })

  const totalPages = ref(1)
  const total = ref(0)

  const goToPage = (page: number) => {
    router.push({
      query: {
        ...route.query,
        page: String(page),
      },
    })
  }

  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      goToPage(currentPage.value + 1)
    }
  }

  const prevPage = () => {
    if (currentPage.value > 1) {
      goToPage(currentPage.value - 1)
    }
  }

  const setMeta = (meta: { total: number, totalPages: number }) => {
    total.value = meta.total
    totalPages.value = meta.totalPages
  }

  return {
    currentPage,
    limit,
    totalPages,
    total,
    goToPage,
    nextPage,
    prevPage,
    setMeta,
  }
}
