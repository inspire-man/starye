import type { Favorite } from '../types'
import { error as showError, success as showSuccess } from '@starye/ui'
import { computed, ref } from 'vue'
import { favoritesApi } from '../lib/api-client'
import { useAuthGuard } from './useAuthGuard'

/**
 * 收藏系统 composable
 * 管理漫画收藏的增删查，并提供 Toast 操作反馈
 */
export function useFavorites() {
  const favorites = ref<Favorite[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const favoriteIds = ref(new Set<string>())
  const favoriteRecordIds = ref(new Map<string, string>())

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const hasMore = computed(() => currentPage.value < totalPages.value)

  function rememberFavorite(favorite: Pick<Favorite, 'entityId' | 'id'>) {
    const ids = new Set(favoriteIds.value)
    ids.add(favorite.entityId)
    favoriteIds.value = ids

    const records = new Map(favoriteRecordIds.value)
    records.set(favorite.entityId, favorite.id)
    favoriteRecordIds.value = records
  }

  function forgetFavorite(entityId: string) {
    const ids = new Set(favoriteIds.value)
    ids.delete(entityId)
    favoriteIds.value = ids

    const records = new Map(favoriteRecordIds.value)
    records.delete(entityId)
    favoriteRecordIds.value = records
  }

  async function fetchFavorites(page = 1) {
    loading.value = true
    error.value = null
    try {
      const res = await favoritesApi.getFavorites({ page, limit: pageSize.value })
      if (res.success && res.data) {
        favorites.value = res.data
        currentPage.value = res.pagination.page
        total.value = res.pagination.total
        pageSize.value = res.pagination.limit
        favoriteIds.value = new Set(res.data.map(favorite => favorite.entityId))
        favoriteRecordIds.value = new Map(res.data.map(favorite => [favorite.entityId, favorite.id]))
      }
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : '获取收藏列表失败'
      showError('获取收藏列表失败')
    }
    finally {
      loading.value = false
    }
  }

  async function addFavorite(comicId: string, comicTitle?: string) {
    try {
      const result = await favoritesApi.addFavorite(comicId)
      if (!result.success || !result.data?.id) {
        throw new Error(result.error || '收藏失败')
      }
      rememberFavorite({ entityId: comicId, id: result.data.id })
      showSuccess(comicTitle ? `已收藏《${comicTitle}》` : '收藏成功')
    }
    catch {
      showError('收藏失败，请稍后重试')
    }
  }

  async function removeFavorite(favoriteId: string, comicId: string, comicTitle?: string) {
    try {
      const result = await favoritesApi.removeFavorite(favoriteId)
      if (!result.success) {
        throw new Error(result.error || '操作失败')
      }
      forgetFavorite(comicId)
      favorites.value = favorites.value.filter(favorite => favorite.id !== favoriteId)
      total.value = Math.max(0, total.value - 1)
      showSuccess(comicTitle ? `已取消收藏《${comicTitle}》` : '已取消收藏')
    }
    catch {
      showError('操作失败，请稍后重试')
    }
  }

  async function checkFavorite(comicId: string): Promise<boolean> {
    try {
      const result = await favoritesApi.isFavorite(comicId)
      if (result.isFavorited && result.favoriteId) {
        rememberFavorite({ entityId: comicId, id: result.favoriteId })
      }
      else {
        forgetFavorite(comicId)
      }
      return result.isFavorited
    }
    catch {
      return false
    }
  }

  async function toggleFavorite(comicId: string, comicTitle?: string) {
    const { requireLogin } = useAuthGuard()
    if (!requireLogin())
      return // 未登录 → 跳转登录页，early return
    if (favoriteIds.value.has(comicId)) {
      const favoriteId = favoriteRecordIds.value.get(comicId) || (await favoritesApi.isFavorite(comicId)).favoriteId
      if (favoriteId) {
        await removeFavorite(favoriteId, comicId, comicTitle)
      }
    }
    else {
      await addFavorite(comicId, comicTitle)
    }
  }

  function isFavorite(comicId: string): boolean {
    return favoriteIds.value.has(comicId)
  }

  return {
    favorites,
    favoriteIds,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    hasMore,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    checkFavorite,
    toggleFavorite,
    isFavorite,
  }
}
