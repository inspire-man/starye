/**
 * Aria2 连接和任务管理 Composable
 */

import type { Aria2TaskStatus, Aria2Version } from '../utils/aria2Client'
import { computed, ref } from 'vue'
import { createAria2Client } from '../utils/aria2Client'
import { useToast } from './useToast'

// Aria2 配置
export interface Aria2Config {
  rpcUrl: string
  secret?: string
  useProxy: boolean
}

// 存储键
const STORAGE_KEY = 'aria2-config'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// 全局状态（单例模式）
const config = ref<Aria2Config | null>(null)
const isConnected = ref(false)
const version = ref<Aria2Version | null>(null)
const tasks = ref<Aria2TaskStatus[]>([])
const isLoading = ref(false)

export function useAria2() {
  const toast = useToast()

  // 创建客户端实例
  const client = computed(() => {
    if (!config.value)
      return null

    if (config.value.useProxy) {
      // 使用后端代理模式
      return null // 代理模式下不创建直连客户端
    }

    return createAria2Client({
      rpcUrl: config.value.rpcUrl,
      secret: config.value.secret,
    })
  })

  /**
   * 加载配置（从 localStorage 或后端）
   */
  async function loadConfig() {
    try {
      // 1. 从 localStorage 加载
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        config.value = JSON.parse(stored)
      }

      // 2. 如果已登录，从后端同步
      const response = await fetch(`${API_BASE_URL}/aria2/config`, {
        credentials: 'include',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.code === 0 && result.data) {
          config.value = {
            rpcUrl: result.data.rpcUrl,
            secret: undefined, // 后端不返回明文密钥
            useProxy: result.data.useProxy,
          }
          // 更新 localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
        }
      }
    }
    catch (error) {
      console.warn('加载 Aria2 配置失败', error)
    }
  }

  /**
   * 保存配置（到 localStorage 和后端）
   */
  async function saveConfig(newConfig: Aria2Config) {
    try {
      config.value = newConfig

      // 1. 保存到 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))

      // 2. 如果已登录，同步到后端
      const response = await fetch(`${API_BASE_URL}/aria2/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newConfig),
      })

      if (response.ok) {
        toast.success('配置已保存')
      }
    }
    catch (error) {
      console.error('保存配置失败', error)
      toast.error('保存配置失败')
      throw error
    }
  }

  /**
   * 测试连接并检测版本
   */
  async function testConnection(): Promise<boolean> {
    if (!config.value) {
      toast.error('请先配置 Aria2 连接')
      return false
    }

    isLoading.value = true

    try {
      if (config.value.useProxy) {
        // 代理模式：通过后端测试
        const response = await fetch(`${API_BASE_URL}/aria2/proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            method: 'aria2.getVersion',
            params: [],
          }),
        })

        if (!response.ok) {
          throw new Error('连接失败')
        }

        const result = await response.json()
        if (result.code === 0 && result.data.result) {
          version.value = result.data.result
          isConnected.value = true
          toast.success(`已连接到 Aria2 ${version.value?.version ?? 'unknown'}`)
          return true
        }
      }
      else {
        // 直连模式
        if (!client.value) {
          throw new Error('客户端未初始化')
        }

        version.value = await client.value.getVersion()
        isConnected.value = true
        toast.success(`已连接到 Aria2 ${version.value.version}`)
        return true
      }
    }
    catch (error) {
      isConnected.value = false
      if (error instanceof Error) {
        toast.error(`连接失败: ${error.message}`)
      }
      return false
    }
    finally {
      isLoading.value = false
    }

    return false
  }

  /**
   * 发送 RPC 请求（支持代理和直连）
   */
  async function rpcRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!config.value) {
      throw new Error('未配置 Aria2 连接')
    }

    if (config.value.useProxy) {
      // 代理模式
      const response = await fetch(`${API_BASE_URL}/aria2/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ method, params }),
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const result = await response.json()
      if (result.code !== 0) {
        throw new Error(result.message || '请求失败')
      }

      return result.data.result
    }
    else {
      // 直连模式
      if (!client.value) {
        throw new Error('客户端未初始化')
      }

      const methods: Record<string, any> = {
        'aria2.addUri': client.value.addUri.bind(client.value),
        'aria2.tellStatus': client.value.tellStatus.bind(client.value),
        'aria2.tellActive': client.value.tellActive.bind(client.value),
        'aria2.tellWaiting': client.value.tellWaiting.bind(client.value),
        'aria2.tellStopped': client.value.tellStopped.bind(client.value),
        'aria2.pause': client.value.pause.bind(client.value),
        'aria2.unpause': client.value.unpause.bind(client.value),
        'aria2.remove': client.value.remove.bind(client.value),
        'aria2.forceRemove': client.value.forceRemove.bind(client.value),
        'aria2.pauseAll': client.value.pauseAll.bind(client.value),
        'aria2.unpauseAll': client.value.unpauseAll.bind(client.value),
        'aria2.changePosition': client.value.changePosition.bind(client.value),
        'aria2.getGlobalStat': client.value.getGlobalStat.bind(client.value),
      }

      const methodFn = methods[method]
      if (!methodFn) {
        throw new Error(`不支持的方法: ${method}`)
      }

      return await methodFn(...params)
    }
  }

  /**
   * 添加单个磁力链接任务
   */
  async function addMagnetTask(magnetLink: string, options?: Record<string, any>): Promise<string> {
    try {
      const gid = await rpcRequest<string>('aria2.addUri', [[magnetLink], options])
      toast.success('已添加到 Aria2')
      return gid
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`添加失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 批量添加磁力链接任务
   */
  async function addMagnetTasks(magnetLinks: string[]): Promise<string[]> {
    const gids: string[] = []
    let successCount = 0

    for (const link of magnetLinks) {
      try {
        const gid = await rpcRequest<string>('aria2.addUri', [[link]])
        gids.push(gid)
        successCount++
      }
      catch (error) {
        console.error('批量添加失败', error)
      }
    }

    if (successCount > 0) {
      toast.success(`已添加 ${successCount}/${magnetLinks.length} 个任务`)
    }
    else {
      toast.error('批量添加失败')
    }

    return gids
  }

  /**
   * 查询任务状态
   */
  async function getTaskStatus(gid: string): Promise<Aria2TaskStatus> {
    return await rpcRequest<Aria2TaskStatus>('aria2.tellStatus', [gid])
  }

  /**
   * 批量查询任务状态
   */
  async function getTasksStatus(gids: string[]): Promise<Aria2TaskStatus[]> {
    const statuses = await Promise.allSettled(
      gids.map(gid => getTaskStatus(gid)),
    )

    return statuses
      .filter((result): result is PromiseFulfilledResult<Aria2TaskStatus> => result.status === 'fulfilled')
      .map(result => result.value)
  }

  /**
   * 获取所有活跃任务
   */
  async function getActiveTasks(): Promise<Aria2TaskStatus[]> {
    try {
      return await rpcRequest<Aria2TaskStatus[]>('aria2.tellActive')
    }
    catch (error) {
      console.error('获取活跃任务失败', error)
      return []
    }
  }

  /**
   * 获取等待中的任务
   */
  async function getWaitingTasks(offset = 0, num = 100): Promise<Aria2TaskStatus[]> {
    try {
      return await rpcRequest<Aria2TaskStatus[]>('aria2.tellWaiting', [offset, num])
    }
    catch (error) {
      console.error('获取等待任务失败', error)
      return []
    }
  }

  /**
   * 获取已停止的任务
   */
  async function getStoppedTasks(offset = 0, num = 100): Promise<Aria2TaskStatus[]> {
    try {
      return await rpcRequest<Aria2TaskStatus[]>('aria2.tellStopped', [offset, num])
    }
    catch (error) {
      console.error('获取已停止任务失败', error)
      return []
    }
  }

  /**
   * 暂停任务
   */
  async function pauseTask(gid: string): Promise<void> {
    try {
      await rpcRequest('aria2.pause', [gid])
      toast.success('任务已暂停')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`暂停失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 恢复任务
   */
  async function unpauseTask(gid: string): Promise<void> {
    try {
      await rpcRequest('aria2.unpause', [gid])
      toast.success('任务已恢复')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`恢复失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 删除任务
   */
  async function removeTask(gid: string, force = false): Promise<void> {
    try {
      await rpcRequest(force ? 'aria2.forceRemove' : 'aria2.remove', [gid])
      toast.success('任务已删除')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`删除失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 调整任务优先级
   */
  async function changeTaskPosition(gid: string, pos: number): Promise<void> {
    try {
      await rpcRequest('aria2.changePosition', [gid, pos, 'POS_SET'])
      toast.success('优先级已调整')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`调整失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 暂停所有任务
   */
  async function pauseAllTasks(): Promise<void> {
    try {
      await rpcRequest('aria2.pauseAll')
      toast.success('所有任务已暂停')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`暂停失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 恢复所有任务
   */
  async function unpauseAllTasks(): Promise<void> {
    try {
      await rpcRequest('aria2.unpauseAll')
      toast.success('所有任务已恢复')
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(`恢复失败: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 获取全局统计
   */
  async function getGlobalStats() {
    try {
      return await rpcRequest('aria2.getGlobalStat')
    }
    catch (error) {
      console.error('获取统计失败', error)
      return null
    }
  }

  /**
   * 刷新所有任务列表
   */
  async function refreshTasks() {
    if (!isConnected.value) {
      return
    }

    isLoading.value = true

    try {
      const [active, waiting, stopped] = await Promise.all([
        getActiveTasks(),
        getWaitingTasks(0, 50),
        getStoppedTasks(0, 50),
      ])

      tasks.value = [...active, ...waiting, ...stopped]
    }
    catch (error) {
      console.error('刷新任务失败', error)
    }
    finally {
      isLoading.value = false
    }
  }

  // 初始化时加载配置
  if (!config.value) {
    loadConfig()
  }

  return {
    // 状态
    config,
    isConnected,
    version,
    tasks,
    isLoading,

    // 方法
    loadConfig,
    saveConfig,
    testConnection,
    addMagnetTask,
    addMagnetTasks,
    getTaskStatus,
    getTasksStatus,
    getActiveTasks,
    getWaitingTasks,
    getStoppedTasks,
    pauseTask,
    unpauseTask,
    removeTask,
    changeTaskPosition,
    pauseAllTasks,
    unpauseAllTasks,
    getGlobalStats,
    refreshTasks,
  }
}
