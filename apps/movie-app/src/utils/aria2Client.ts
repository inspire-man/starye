/**
 * Aria2 JSON-RPC 客户端
 *
 * 实现 Aria2 RPC 接口的核心方法，支持：
 * - 任务添加（单个/批量）
 * - 任务查询（状态、列表）
 * - 任务控制（暂停/恢复/删除）
 * - 版本检测
 */

// JSON-RPC 请求格式
interface Aria2RpcRequest {
  jsonrpc: '2.0'
  method: string
  id: string | number
  params: unknown[]
}

// JSON-RPC 响应格式
interface Aria2RpcResponse<T = any> {
  jsonrpc: '2.0'
  id: string | number
  result?: T
  error?: {
    code: number
    message: string
  }
}

// Aria2 任务状态
export interface Aria2TaskStatus {
  gid: string
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed'
  totalLength: string
  completedLength: string
  uploadLength: string
  downloadSpeed: string
  uploadSpeed: string
  infoHash?: string
  numSeeders?: string
  connections?: string
  errorCode?: string
  errorMessage?: string
  files?: Array<{
    index: string
    path: string
    length: string
    completedLength: string
    selected: 'true' | 'false'
  }>
  bittorrent?: {
    info?: {
      name?: string
    }
  }
}

// Aria2 版本信息
export interface Aria2Version {
  version: string
  enabledFeatures: string[]
}

// 客户端配置
export interface Aria2ClientConfig {
  rpcUrl: string
  secret?: string
  timeout?: number
}

// 请求队列项
interface QueuedRequest {
  resolve: (value: any) => void
  reject: (error: any) => void
  method: string
  params: unknown[]
}

// Aria2 客户端类
export class Aria2Client {
  private config: Aria2ClientConfig
  private requestId = 0
  private requestQueue: QueuedRequest[] = []
  private activeRequests = 0
  private maxConcurrent = 5 // 最大并发请求数
  private processing = false

  constructor(config: Aria2ClientConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    }
  }

  /**
   * 处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return
    }

    this.processing = true

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const queuedRequest = this.requestQueue.shift()
      if (!queuedRequest) {
        break
      }

      this.activeRequests++

      // 异步执行请求
      this.executeRequest(queuedRequest)
        .then(result => queuedRequest.resolve(result))
        .catch(error => queuedRequest.reject(error))
        .finally(() => {
          this.activeRequests--
          this.processQueue() // 继续处理队列
        })
    }

    this.processing = false
  }

  /**
   * 执行单个请求
   */
  private async executeRequest(queuedRequest: QueuedRequest): Promise<any> {
    const requestBody: Aria2RpcRequest = {
      jsonrpc: '2.0',
      method: queuedRequest.method,
      id: ++this.requestId,
      params: this.config.secret
        ? [`token:${this.config.secret}`, ...queuedRequest.params]
        : queuedRequest.params,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: Aria2RpcResponse = await response.json()

      if (data.error) {
        throw new Error(`Aria2 错误 ${data.error.code}: ${data.error.message}`)
      }

      return data.result
    }
    catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`请求超时（${this.config.timeout}ms）`)
        }
        throw error
      }
      throw new Error('未知错误')
    }
  }

  /**
   * 发送 JSON-RPC 请求（使用队列管理）
   */
  private async request<T>(method: string, params: unknown[] = []): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({
        resolve,
        reject,
        method,
        params,
      })

      // 触发队列处理
      this.processQueue()
    })
  }

  /**
   * 获取 Aria2 版本信息
   */
  async getVersion(): Promise<Aria2Version> {
    return await this.request<Aria2Version>('aria2.getVersion')
  }

  /**
   * 添加磁力链接任务
   * @param uris 磁力链接数组
   * @param options 下载选项
   * @returns 任务 GID
   */
  async addUri(uris: string[], options?: Record<string, any>): Promise<string> {
    return await this.request<string>('aria2.addUri', [uris, options || {}])
  }

  /**
   * 批量添加磁力链接
   * @param urisList 磁力链接数组的数组
   * @returns GID 数组
   */
  async addUris(urisList: string[][]): Promise<string[]> {
    const promises = urisList.map(uris => this.addUri(uris))
    return await Promise.all(promises)
  }

  /**
   * 查询任务状态
   * @param gid 任务 GID
   * @param keys 要返回的字段（可选）
   */
  async tellStatus(gid: string, keys?: string[]): Promise<Aria2TaskStatus> {
    return await this.request<Aria2TaskStatus>('aria2.tellStatus', keys ? [gid, keys] : [gid])
  }

  /**
   * 获取所有活跃任务
   * @param keys 要返回的字段（可选）
   */
  async tellActive(keys?: string[]): Promise<Aria2TaskStatus[]> {
    return await this.request<Aria2TaskStatus[]>('aria2.tellActive', keys ? [keys] : [])
  }

  /**
   * 获取等待中的任务
   * @param offset 偏移量
   * @param num 数量
   * @param keys 要返回的字段（可选）
   */
  async tellWaiting(offset: number = 0, num: number = 100, keys?: string[]): Promise<Aria2TaskStatus[]> {
    return await this.request<Aria2TaskStatus[]>('aria2.tellWaiting', keys ? [offset, num, keys] : [offset, num])
  }

  /**
   * 获取已停止的任务
   * @param offset 偏移量
   * @param num 数量
   * @param keys 要返回的字段（可选）
   */
  async tellStopped(offset: number = 0, num: number = 100, keys?: string[]): Promise<Aria2TaskStatus[]> {
    return await this.request<Aria2TaskStatus[]>('aria2.tellStopped', keys ? [offset, num, keys] : [offset, num])
  }

  /**
   * 暂停任务
   * @param gid 任务 GID
   * @returns 任务 GID
   */
  async pause(gid: string): Promise<string> {
    return await this.request<string>('aria2.pause', [gid])
  }

  /**
   * 暂停所有任务
   */
  async pauseAll(): Promise<string> {
    return await this.request<string>('aria2.pauseAll')
  }

  /**
   * 恢复任务
   * @param gid 任务 GID
   * @returns 任务 GID
   */
  async unpause(gid: string): Promise<string> {
    return await this.request<string>('aria2.unpause', [gid])
  }

  /**
   * 恢复所有任务
   */
  async unpauseAll(): Promise<string> {
    return await this.request<string>('aria2.unpauseAll')
  }

  /**
   * 删除任务（如果正在下载会先暂停）
   * @param gid 任务 GID
   * @returns 任务 GID
   */
  async remove(gid: string): Promise<string> {
    return await this.request<string>('aria2.remove', [gid])
  }

  /**
   * 强制删除任务（立即删除，不等待）
   * @param gid 任务 GID
   * @returns 任务 GID
   */
  async forceRemove(gid: string): Promise<string> {
    return await this.request<string>('aria2.forceRemove', [gid])
  }

  /**
   * 调整任务在队列中的位置
   * @param gid 任务 GID
   * @param pos 位置偏移（正数向前，负数向后）
   * @param how 调整方式：'POS_SET', 'POS_CUR', 'POS_END'
   */
  async changePosition(gid: string, pos: number, how: 'POS_SET' | 'POS_CUR' | 'POS_END'): Promise<number> {
    return await this.request<number>('aria2.changePosition', [gid, pos, how])
  }

  /**
   * 获取全局统计信息
   */
  async getGlobalStat(): Promise<{
    downloadSpeed: string
    uploadSpeed: string
    numActive: string
    numWaiting: string
    numStopped: string
  }> {
    return await this.request('aria2.getGlobalStat')
  }
}

/**
 * 创建 Aria2 客户端实例
 */
export function createAria2Client(config: Aria2ClientConfig): Aria2Client {
  return new Aria2Client(config)
}

/**
 * 格式化文件大小（字节转可读格式）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

/**
 * 格式化下载速度
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`
}

/**
 * 计算预计剩余时间（ETA）
 */
export function calculateETA(totalBytes: number, completedBytes: number, speedBytesPerSec: number): string {
  if (speedBytesPerSec === 0 || totalBytes === 0)
    return '--'

  const remainingBytes = totalBytes - completedBytes
  const secondsRemaining = Math.floor(remainingBytes / speedBytesPerSec)

  if (secondsRemaining < 60)
    return `${secondsRemaining}秒`
  if (secondsRemaining < 3600)
    return `${Math.floor(secondsRemaining / 60)}分钟`
  if (secondsRemaining < 86400)
    return `${Math.floor(secondsRemaining / 3600)}小时`

  return `${Math.floor(secondsRemaining / 86400)}天`
}

/**
 * 计算下载进度百分比
 */
export function calculateProgress(totalLength: string, completedLength: string): number {
  const total = Number.parseInt(totalLength, 10)
  const completed = Number.parseInt(completedLength, 10)

  if (total === 0)
    return 0

  return Math.floor((completed / total) * 100)
}
