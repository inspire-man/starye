import type { MovieDetail } from '../types'
import type { Aria2TaskStatus } from '../utils/aria2Client'
import { computed, ref } from 'vue'
import { calculateETA, calculateProgress } from '../utils/aria2Client'

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

  // Aria2 集成字段
  aria2Gid?: string // Aria2 任务的全局唯一标识符
  aria2Status?: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed' // Aria2 任务状态
  downloadProgress?: number // 下载进度百分比 (0-100)
  downloadSpeed?: number // 下载速度（字节/秒）
  uploadSpeed?: number // 上传速度（字节/秒）
  totalLength?: number // 文件总大小（字节）
  completedLength?: number // 已下载大小（字节）
  eta?: string // 预计剩余时间
  lastSyncAt?: number // 最后同步时间戳
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

  /**
   * 添加到 Aria2 并更新下载列表
   * @param movieId 影片 ID
   * @param aria2AddFn Aria2 添加任务的函数
   * @returns Aria2 任务 GID
   */
  async function addToAria2(
    movieId: string,
    aria2AddFn: (magnetLink: string) => Promise<string>,
  ): Promise<string> {
    const item = downloadList.value.find(i => i.movieId === movieId)
    if (!item) {
      throw new Error('影片不在下载列表中')
    }

    if (!item.magnetLink) {
      throw new Error('该影片没有磁力链接')
    }

    if (item.aria2Gid) {
      throw new Error('该任务已添加到 Aria2')
    }

    try {
      const gid = await aria2AddFn(item.magnetLink)

      // 更新列表项
      item.aria2Gid = gid
      item.status = 'downloading'
      item.aria2Status = 'active'
      item.lastSyncAt = Date.now()

      saveToStorage()
      return gid
    }
    catch (error) {
      console.error('添加到 Aria2 失败', error)
      throw error
    }
  }

  /**
   * 从 Aria2 状态更新列表项
   */
  function updateItemFromAria2Status(item: DownloadListItem, status: Aria2TaskStatus) {
    item.aria2Status = status.status
    item.downloadProgress = calculateProgress(status.totalLength, status.completedLength)
    item.downloadSpeed = Number.parseInt(status.downloadSpeed, 10)
    item.uploadSpeed = Number.parseInt(status.uploadSpeed, 10)
    item.totalLength = Number.parseInt(status.totalLength, 10)
    item.completedLength = Number.parseInt(status.completedLength, 10)

    // 计算 ETA
    if (item.totalLength && item.completedLength !== undefined && item.downloadSpeed) {
      item.eta = calculateETA(item.totalLength, item.completedLength, item.downloadSpeed)
    }

    item.lastSyncAt = Date.now()

    // 根据 Aria2 状态更新下载列表状态
    if (status.status === 'active' || status.status === 'waiting') {
      item.status = 'downloading'
    }
    else if (status.status === 'complete') {
      item.status = 'completed'
    }
  }

  /**
   * 从 Aria2 同步任务状态
   * @param getStatusFn Aria2 查询状态的函数
   */
  async function syncWithAria2(
    getStatusFn: (gid: string) => Promise<Aria2TaskStatus>,
  ): Promise<void> {
    const itemsWithGid = downloadList.value.filter(item => item.aria2Gid)

    if (itemsWithGid.length === 0) {
      return
    }

    loading.value = true

    try {
      await Promise.allSettled(
        itemsWithGid.map(async (item) => {
          if (!item.aria2Gid)
            return

          try {
            const status = await getStatusFn(item.aria2Gid)
            updateItemFromAria2Status(item, status)
          }
          catch {
            // 任务可能已被删除，标记为 removed
            item.aria2Status = 'removed'
            if (item.status === 'downloading') {
              item.status = 'planned'
            }
          }
        }),
      )

      saveToStorage()
    }
    catch (error) {
      console.error('同步 Aria2 任务失败', error)
      throw error
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 删除列表项并同时删除 Aria2 任务
   * @param movieId 影片 ID
   * @param aria2RemoveFn Aria2 删除任务的函数
   */
  async function removeWithAria2(
    movieId: string,
    aria2RemoveFn?: (gid: string) => Promise<void>,
  ): Promise<boolean> {
    const item = downloadList.value.find(i => i.movieId === movieId)

    if (!item) {
      return false
    }

    // 如果有 Aria2 任务且提供了删除函数，先删除 Aria2 任务
    if (item.aria2Gid && aria2RemoveFn) {
      try {
        await aria2RemoveFn(item.aria2Gid)
      }
      catch (error) {
        console.warn('删除 Aria2 任务失败', error)
        // 继续删除列表项
      }
    }

    return removeFromDownloadList(movieId)
  }

  /**
   * 导入 Aria2 现有任务到下载列表
   * @param aria2Tasks Aria2 任务列表
   * @param movieLookupFn 通过磁链或 InfoHash 查找影片信息的函数
   */
  async function importFromAria2(
    aria2Tasks: Aria2TaskStatus[],
    movieLookupFn?: (magnetLink: string) => Promise<{ id: string, code: string, title: string, coverImage?: string } | null>,
  ): Promise<number> {
    let importedCount = 0

    for (const task of aria2Tasks) {
      // 跳过已关联的任务
      if (downloadList.value.some(item => item.aria2Gid === task.gid)) {
        continue
      }

      // 尝试从任务中提取磁力链接
      let magnetLink = ''
      if (task.infoHash) {
        magnetLink = `magnet:?xt=urn:btih:${task.infoHash}`
      }

      if (!magnetLink) {
        continue
      }

      // 查找影片信息
      let movieInfo: { id: string, code: string, title: string, coverImage?: string } | null = null
      if (movieLookupFn) {
        try {
          movieInfo = await movieLookupFn(magnetLink)
        }
        catch (error) {
          console.warn('查找影片信息失败', error)
        }
      }

      // 创建下载列表项
      const newItem: DownloadListItem = {
        movieId: movieInfo?.id || task.gid,
        movieCode: movieInfo?.code || '',
        title: movieInfo?.title || task.bittorrent?.info?.name || `任务 ${task.gid.substring(0, 8)}`,
        coverImage: movieInfo?.coverImage,
        magnetLink,
        status: task.status === 'complete' ? 'completed' : 'downloading',
        addedAt: Date.now(),
        aria2Gid: task.gid,
        aria2Status: task.status,
      }

      updateItemFromAria2Status(newItem, task)

      // 检查容量限制
      if (downloadList.value.length >= MAX_ITEMS) {
        console.warn('下载列表已满，跳过导入')
        break
      }

      downloadList.value.unshift(newItem)
      importedCount++
    }

    if (importedCount > 0) {
      saveToStorage()
    }

    return importedCount
  }

  /**
   * 获取有 Aria2 任务的列表项
   */
  function getItemsWithAria2(): DownloadListItem[] {
    return downloadList.value.filter(item => item.aria2Gid)
  }

  /**
   * 获取需要同步的 Aria2 GID 列表
   */
  function getAria2Gids(): string[] {
    return downloadList.value
      .filter(item => item.aria2Gid)
      .map(item => item.aria2Gid!)
  }

  /**
   * 更新单个任务的 Aria2 状态
   */
  function updateAria2Status(gid: string, status: Aria2TaskStatus): boolean {
    const item = downloadList.value.find(i => i.aria2Gid === gid)

    if (!item) {
      return false
    }

    updateItemFromAria2Status(item, status)
    saveToStorage()

    return true
  }

  /**
   * 清除任务的 Aria2 关联
   */
  function clearAria2Association(movieId: string): boolean {
    const item = downloadList.value.find(i => i.movieId === movieId)

    if (!item) {
      return false
    }

    // 清除 Aria2 相关字段
    item.aria2Gid = undefined
    item.aria2Status = undefined
    item.downloadProgress = undefined
    item.downloadSpeed = undefined
    item.uploadSpeed = undefined
    item.totalLength = undefined
    item.completedLength = undefined
    item.eta = undefined
    item.lastSyncAt = undefined

    saveToStorage()
    return true
  }

  // 初始化时加载数据
  loadFromStorage()

  return {
    // 状态
    downloadList: computed(() => downloadList.value),
    loading,
    stats,

    // 基础方法
    isInDownloadList,
    addToDownloadList,
    removeFromDownloadList,
    removeMultiple,
    updateDownloadStatus,
    getDownloadList,
    clearAll,

    // Aria2 集成方法
    addToAria2,
    syncWithAria2,
    removeWithAria2,
    importFromAria2,
    getItemsWithAria2,
    getAria2Gids,
    updateAria2Status,
    clearAria2Association,
  }
}
