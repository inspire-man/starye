/**
 * TorrServer HTTP 客户端
 *
 * 实现 TorrServer REST API 接口，支持：
 * - 种子管理（添加/查询/列表/删除）
 * - 流 URL 构建
 * - 版本检测
 * - 视频文件识别
 */

// 种子文件信息
export interface TorrentFile {
  id: number
  path: string
  length: number
}

// 种子信息
export interface TorrentInfo {
  title: string
  hash: string
  stat: number
  file_stats?: TorrentFile[]
}

// 种子统计信息
export interface TorrentStat {
  hash: string
  loaded_size: number
  torrent_size: number
  preloaded_bytes: number
  download_speed: number
  upload_speed: number
  total_peers: number
  active_peers: number
}

// 客户端配置
export interface TorrServerClientConfig {
  serverUrl: string
  timeout?: number
}

// 视频文件扩展名集合
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.ts', '.wmv', '.flv', '.mov', '.webm', '.m4v'])

// 客户端类
export class TorrServerClient {
  private config: TorrServerClientConfig

  constructor(config: TorrServerClientConfig) {
    this.config = {
      timeout: 15000,
      ...config,
    }
  }

  private get baseUrl(): string {
    return this.config.serverUrl.replace(/\/+$/, '')
  }

  /**
   * 发送 GET 请求
   */
  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      try {
        return JSON.parse(text) as T
      }
      catch {
        return text as unknown as T
      }
    }
    catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时（${this.config.timeout}ms）`)
      }
      throw error
    }
  }

  /**
   * 发送 POST 请求到 /torrents 端点
   */
  private async postTorrents<T>(body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      if (!text) {
        return null as unknown as T
      }

      try {
        return JSON.parse(text) as T
      }
      catch {
        return text as unknown as T
      }
    }
    catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时（${this.config.timeout}ms）`)
      }
      throw error
    }
  }

  /**
   * 获取 TorrServer 版本信息
   */
  async getVersion(): Promise<string> {
    return await this.get<string>('/echo')
  }

  /**
   * 添加种子（通过磁力链接）
   */
  async addTorrent(magnetLink: string, title?: string): Promise<TorrentInfo> {
    return await this.postTorrents<TorrentInfo>({
      action: 'add',
      link: magnetLink,
      title: title || '',
      poster: '',
      save_to_db: false,
    })
  }

  /**
   * 获取种子信息
   */
  async getTorrentInfo(hash: string): Promise<TorrentInfo> {
    return await this.postTorrents<TorrentInfo>({
      action: 'get',
      hash,
    })
  }

  /**
   * 列出所有种子
   */
  async listTorrents(): Promise<TorrentInfo[]> {
    const result = await this.postTorrents<TorrentInfo[] | null>({
      action: 'list',
    })
    return result || []
  }

  /**
   * 删除种子
   */
  async removeTorrent(hash: string): Promise<void> {
    await this.postTorrents({
      action: 'rem',
      hash,
    })
  }

  /**
   * 获取种子统计信息（通过 /stream?stat 端点）
   */
  async getTorrentStat(magnetLink: string): Promise<TorrentStat> {
    return await this.get<TorrentStat>('/stream', {
      link: magnetLink,
      stat: '',
    })
  }

  /**
   * 构建流媒体 URL
   */
  getStreamUrl(magnetLink: string, fileIndex: number): string {
    const url = new URL(`${this.baseUrl}/stream/video`)
    url.searchParams.set('link', magnetLink)
    url.searchParams.set('index', String(fileIndex))
    url.searchParams.set('play', '')
    return url.toString()
  }

  /**
   * 获取 M3U 播放列表 URL
   */
  getPlaylistUrl(magnetLink: string): string {
    const url = new URL(`${this.baseUrl}/playlist`)
    url.searchParams.set('link', magnetLink)
    return url.toString()
  }

  /**
   * 从文件列表中过滤视频文件，按大小降序排列
   */
  filterVideoFiles(files: TorrentFile[]): TorrentFile[] {
    return files
      .filter((file) => {
        const ext = getFileExtension(file.path)
        return VIDEO_EXTENSIONS.has(ext)
      })
      .sort((a, b) => b.length - a.length)
  }
}

/**
 * 获取文件扩展名（小写）
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1)
    return ''
  return filePath.slice(lastDot).toLowerCase()
}

/**
 * 创建 TorrServer 客户端实例
 */
export function createTorrServerClient(config: TorrServerClientConfig): TorrServerClient {
  return new TorrServerClient(config)
}

/**
 * 格式化文件大小
 */
export function formatTorrentFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}
