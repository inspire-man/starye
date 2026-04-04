import type { Favorite } from '../types'
import { computed, ref } from 'vue'
import { favoritesApi } from '../lib/api-client'

interface UseFavoritesOptions {
  entityType?: 'actor' | 'publisher' | 'movie' | 'comic'
  autoLoad?: boolean
}

export function useFavorites(options: UseFavoritesOptions = {}) {
  const { entityType, autoLoad = false } = options

  // 状态
  const favorites = ref<Favorite[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)

  // 计算属性
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
  const hasMore = computed(() => currentPage.value < totalPages.value)
  const isEmpty = computed(() => favorites.value.length === 0 && !loading.value)

  // 获取收藏列表
  async function fetchFavorites(page = 1) {
    loading.value = true
    error.value = null

    try {
      const result = await favoritesApi.getFavorites({
        page,
        limit: pageSize.value,
        entityType,
      })

      if (result.success && result.data && result.pagination) {
        favorites.value = page === 1 ? result.data : [...favorites.value, ...result.data]
        total.value = result.pagination.total
        currentPage.value = result.pagination.page
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
      console.error('[useFavorites] 加载失败:', e)
    }
    finally {
      loading.value = false
    }
  }

  // 添加收藏
  async function addFavorite(type: 'actor' | 'publisher' | 'movie' | 'comic', id: string) {
    try {
      const result = await favoritesApi.addFavorite(type, id)
      if (result.success) {
        // 如果没有指定类型或匹配当前类型，重新加载列表
        if (!entityType || entityType === type) {
          await fetchFavorites(1)
        }
        return { success: true, alreadyExists: result.data?.alreadyExists || false }
      }
      return { success: false, error: '添加失败' }
    }
    catch (e) {
      console.error('[useFavorites] 添加失败:', e)
      return { success: false, error: e instanceof Error ? e.message : '添加失败' }
    }
  }

  // 删除收藏
  async function removeFavorite(favoriteId: string) {
    try {
      const result = await favoritesApi.deleteFavorite(favoriteId)
      if (result.success) {
        // 从列表中移除
        favorites.value = favorites.value.filter(f => f.id !== favoriteId)
        total.value = Math.max(0, total.value - 1)
        return { success: true }
      }
      return { success: false, error: '删除失败' }
    }
    catch (e) {
      console.error('[useFavorites] 删除失败:', e)
      return { success: false, error: e instanceof Error ? e.message : '删除失败' }
    }
  }

  // 检查是否已收藏，同时返回 favoriteId
  async function checkIsFavorited(type: 'actor' | 'publisher' | 'movie' | 'comic', id: string): Promise<{ isFavorited: boolean, favoriteId: string | null }> {
    try {
      return await favoritesApi.checkFavorite(type, id)
    }
    catch (e) {
      console.error('[useFavorites] 检查收藏状态失败:', e)
      return { isFavorited: false, favoriteId: null }
    }
  }

  // 刷新列表
  async function refresh() {
    currentPage.value = 1
    await fetchFavorites(1)
  }

  // 加载更多
  async function loadMore() {
    if (!hasMore.value || loading.value)
      return

    await fetchFavorites(currentPage.value + 1)
  }

  // 自动加载
  if (autoLoad) {
    fetchFavorites(1)
  }

  return {
    // 状态
    favorites: computed(() => favorites.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    total: computed(() => total.value),
    currentPage: computed(() => currentPage.value),
    pageSize: computed(() => pageSize.value),
    totalPages,
    hasMore,
    isEmpty,

    // 方法
    fetchFavorites,
    addFavorite,
    removeFavorite,
    checkIsFavorited,
    refresh,
    loadMore,
  }
}
