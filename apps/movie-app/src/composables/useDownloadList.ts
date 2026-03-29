import { computed, ref } from 'vue'
import type { MovieDetail } from '../types'

// 下载状态类型
export type DownloadStatus = 'planned' | 'downloading' | 'completed'

// 下载列表项接口
export interface DownloadListItem {
  movieId: string
  movieCode: string
  title: string
  coverImage?: string
  magnetLink?: string // 用户选择的磁链
  status: DownloadStatus
  addedAt: number // timestamp
}

// localStorage key
const STORAGE_KEY = 'starye:download-list'
const MAX_ITEMS = 100 // 最大容量限制

/**
 * 下载列表管理 Composable
 */
export function useDownloadList() {
  const downloadList = ref<DownloadListItem[]>([])
  const loading = ref(false)

  // 从 localStorage 加载数据
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        downloadList.value = JSON.parse(stored)
      }
    }
    catch (error) {
      console.error('加载下载列表失败', error)
      downloadList.value = []
    }
  }

  // 保存到 localStorage
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(downloadList.value))
    }
    catch (error) {
      console.error('保存下载列表失败', error)
      // 如果是容量超限错误，提示用户
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('存储空间已满，请清理部分数据')
      }
      throw error
    }
  }

  // 检查影片是否在列表中
  function isInDownloadList(movieId: string): boolean {
    return downloadList.value.some(item => item.movieId === movieId)
  }

  // 添加影片到下载列表
  function addToDownloadList(movie: MovieDetail, magnetLink?: string): boolean {
    // 检查是否已存在
    if (isInDownloadList(movie.id)) {
      throw new Error('该影片已在下载列表中')
    }

    // 检查容量限制
    if (downloadList.value.length >= MAX_ITEMS) {
      throw new Error(`下载列表已满（最多${MAX_ITEMS}个），请先清理部分数据`)
    }

    const newItem: DownloadListItem = {
      movieId: movie.id,
      movieCode: movie.code,
      title: movie.title,
      coverImage: movie.coverImage,
      magnetLink,
      status: 'planned',
      addedAt: Date.now(),
    }

    downloadList.value.unshift(newItem) // 新添加的在前面
    saveToStorage()

    return true
  }

  // 从列表移除影片
  function removeFromDownloadList(movieId: string): boolean {
    const index = downloadList.value.findIndex(item => item.movieId === movieId)

    if (index === -1) {
      return false
    }

    downloadList.value.splice(index, 1)
    saveToStorage()

    return true
  }

  // 批量移除影片
  function removeMultiple(movieIds: string[]): number {
    const before = downloadList.value.length
    downloadList.value = downloadList.value.filter(item => !movieIds.includes(item.movieId))
    const removed = before - downloadList.value.length

    if (removed > 0) {
      saveToStorage()
    }

    return removed
  }

  // 更新下载状态
  function updateDownloadStatus(movieId: string, status: DownloadStatus): boolean {
    const item = downloadList.value.find(item => item.movieId === movieId)

    if (!item) {
      return false
    }

    item.status = status
    saveToStorage()

    return true
  }

  // 获取列表（按添加时间排序，最新的在前）
  function getDownloadList(statusFilter?: DownloadStatus): DownloadListItem[] {
    let list = [...downloadList.value]

    if (statusFilter) {
      list = list.filter(item => item.status === statusFilter)
    }

    // 按添加时间降序排序
    return list.sort((a, b) => b.addedAt - a.addedAt)
  }

  // 获取统计信息
  const stats = computed(() => {
    return {
      total: downloadList.value.length,
      planned: downloadList.value.filter(item => item.status === 'planned').length,
      downloading: downloadList.value.filter(item => item.status === 'downloading').length,
      completed: downloadList.value.filter(item => item.status === 'completed').length,
    }
  })

  // 清空所有数据
  function clearAll(): boolean {
    downloadList.value = []
    saveToStorage()
    return true
  }

  // 初始化时加载数据
  loadFromStorage()

  return {
    downloadList: computed(() => downloadList.value),
    loading,
    stats,
    isInDownloadList,
    addToDownloadList,
    removeFromDownloadList,
    removeMultiple,
    updateDownloadStatus,
    getDownloadList,
    clearAll,
  }
}
