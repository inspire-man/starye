import { error as showError, success as showSuccess } from '@starye/ui'
import { ref } from 'vue'
import { favoritesApi } from '../lib/api-client'
import type { Comic } from '../types'

export interface FavoriteItem {
  comicId: string
  comic?: Comic
}

/**
 * 收藏系统 composable
 * 管理漫画收藏的增删查，并提供 Toast 操作反馈
 */
export function useFavorites() {
  const favorites = ref<FavoriteItem[]>([])
  const loading = ref(false)
  const favoriteIds = ref(new Set<string>())

  async function fetchFavorites() {
    loading.value = true
    try {
      const res = await favoritesApi.getFavorites()
      if (res.success && res.data) {
        favorites.value = res.data
        favoriteIds.value = new Set(res.data.map(f => f.comicId))
      }
    }
    catch {
      showError('获取收藏列表失败')
    }
    finally {
      loading.value = false
    }
  }

  async function addFavorite(comicId: string, comicTitle?: string) {
    try {
      await favoritesApi.addFavorite(comicId)
      favoriteIds.value.add(comicId)
      showSuccess(comicTitle ? `已收藏《${comicTitle}》` : '收藏成功')
    }
    catch {
      showError('收藏失败，请稍后重试')
    }
  }

  async function removeFavorite(comicId: string, comicTitle?: string) {
    try {
      await favoritesApi.removeFavorite(comicId)
      favoriteIds.value.delete(comicId)
      favorites.value = favorites.value.filter(f => f.comicId !== comicId)
      showSuccess(comicTitle ? `已取消收藏《${comicTitle}》` : '已取消收藏')
    }
    catch {
      showError('操作失败，请稍后重试')
    }
  }

  async function toggleFavorite(comicId: string, comicTitle?: string) {
    if (favoriteIds.value.has(comicId)) {
      await removeFavorite(comicId, comicTitle)
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
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  }
}
