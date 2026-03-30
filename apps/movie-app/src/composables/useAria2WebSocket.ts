/* eslint-disable no-console */
/**
 * Aria2 WebSocket 实时进度跟踪 Composable
 */

import type { Aria2TaskStatus } from '../utils/aria2Client'
import { onBeforeUnmount, ref } from 'vue'
import { useToast } from './useToast'

// WebSocket 连接状态
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

// 任务进度更新回调
type ProgressCallback = (status: Aria2TaskStatus) => void

// 事件类型
interface Aria2Event {
  method: string
  params: Array<{
    gid: string
  }>
}

// 全局状态（单例模式）
const wsConnection = ref<WebSocket | null>(null)
const connectionState = ref<ConnectionState>('disconnected')
const reconnectAttempts = ref(0)
const taskListeners = new Map<string, Set<ProgressCallback>>()
let heartbeatInterval: number | null = null
let reconnectTimeout: number | null = null

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000 // 3 秒
const HEARTBEAT_INTERVAL = 30000 // 30 秒

export function useAria2WebSocket() {
  const toast = useToast()

  /**
   * 连接 WebSocket
   */
  function connect(url: string, secret?: string) {
    if (connectionState.value === 'connected' || connectionState.value === 'connecting') {
      console.warn('WebSocket 已连接或正在连接')
      return
    }

    try {
      // 构造 WebSocket URL（如果是 http/https，转换为 ws/wss）
      const wsUrl = url.replace(/^http/, 'ws')

      connectionState.value = 'connecting'
      wsConnection.value = new WebSocket(wsUrl)

      wsConnection.value.onopen = () => {
        connectionState.value = 'connected'
        reconnectAttempts.value = 0
        toast.success('WebSocket 已连接')

        // 启动心跳
        startHeartbeat(secret)
      }

      wsConnection.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Aria2Event

          // 处理 Aria2 事件
          if (message.method) {
            handleAria2Event(message)
          }
        }
        catch (error) {
          console.error('解析 WebSocket 消息失败', error)
        }
      }

      wsConnection.value.onerror = (error) => {
        console.error('WebSocket 错误', error)
        connectionState.value = 'error'
        toast.error('WebSocket 连接错误')
      }

      wsConnection.value.onclose = () => {
        connectionState.value = 'disconnected'
        stopHeartbeat()

        // 尝试重连
        if (reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.value++
          console.log(`尝试重连 WebSocket (${reconnectAttempts.value}/${MAX_RECONNECT_ATTEMPTS})`)

          reconnectTimeout = window.setTimeout(() => {
            connect(url, secret)
          }, RECONNECT_DELAY)
        }
        else {
          toast.error('WebSocket 连接已断开，请手动重连')
        }
      }
    }
    catch (error) {
      console.error('连接 WebSocket 失败', error)
      connectionState.value = 'error'
      toast.error('连接失败')
    }
  }

  /**
   * 断开 WebSocket
   */
  function disconnect() {
    if (wsConnection.value) {
      reconnectAttempts.value = MAX_RECONNECT_ATTEMPTS // 防止自动重连
      wsConnection.value.close()
      wsConnection.value = null
    }

    stopHeartbeat()

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    connectionState.value = 'disconnected'
  }

  /**
   * 启动心跳
   */
  function startHeartbeat(secret?: string) {
    stopHeartbeat()

    heartbeatInterval = window.setInterval(() => {
      if (wsConnection.value?.readyState === WebSocket.OPEN) {
        // 发送 getVersion 作为心跳
        const payload = {
          jsonrpc: '2.0',
          id: `heartbeat-${Date.now()}`,
          method: 'aria2.getVersion',
          params: secret ? [`token:${secret}`] : [],
        }

        wsConnection.value.send(JSON.stringify(payload))
      }
    }, HEARTBEAT_INTERVAL)
  }

  /**
   * 停止心跳
   */
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  /**
   * 处理 Aria2 事件
   */
  function handleAria2Event(event: Aria2Event) {
    const gid = event.params[0]?.gid
    if (!gid)
      return

    // 获取该 gid 的监听器
    const listeners = taskListeners.get(gid)
    if (!listeners || listeners.size === 0)
      return

    // 根据事件类型触发回调
    switch (event.method) {
      case 'aria2.onDownloadStart':
      case 'aria2.onDownloadPause':
      case 'aria2.onDownloadStop':
      case 'aria2.onDownloadComplete':
      case 'aria2.onDownloadError':
        // 需要查询完整状态再通知
        fetchAndNotify(gid, listeners)
        break
    }
  }

  /**
   * 查询任务状态并通知监听器
   */
  async function fetchAndNotify(gid: string, listeners: Set<ProgressCallback>) {
    try {
      // 这里需要调用 Aria2 RPC 查询状态
      // 简化实现，假设通过全局的 useAria2 获取
      // 实际可能需要传入 rpcRequest 函数
      const { useAria2 } = await import('./useAria2')
      const { getTaskStatus } = useAria2()
      const status = await getTaskStatus(gid)

      // 通知所有监听器
      listeners.forEach((callback) => {
        try {
          callback(status)
        }
        catch (error) {
          console.error('执行进度回调失败', error)
        }
      })
    }
    catch (error) {
      console.error('查询任务状态失败', error)
    }
  }

  /**
   * 监听任务进度
   */
  function watchTask(gid: string, callback: ProgressCallback) {
    if (!taskListeners.has(gid)) {
      taskListeners.set(gid, new Set())
    }

    taskListeners.get(gid)!.add(callback)

    // 返回取消监听函数
    return () => {
      const listeners = taskListeners.get(gid)
      if (listeners) {
        listeners.delete(callback)

        // 如果没有监听器了，移除该 gid
        if (listeners.size === 0) {
          taskListeners.delete(gid)
        }
      }
    }
  }

  /**
   * 批量监听任务进度
   */
  function watchTasks(gids: string[], callback: ProgressCallback) {
    const unsubscribers = gids.map(gid => watchTask(gid, callback))

    // 返回批量取消函数
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }

  /**
   * 取消监听任务
   */
  function unwatchTask(gid: string) {
    taskListeners.delete(gid)
  }

  /**
   * 清空所有监听
   */
  function clearAllWatchers() {
    taskListeners.clear()
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    disconnect()
    clearAllWatchers()
  })

  return {
    // 状态
    connectionState,
    isConnected: connectionState,

    // 方法
    connect,
    disconnect,
    watchTask,
    watchTasks,
    unwatchTask,
    clearAllWatchers,
  }
}
