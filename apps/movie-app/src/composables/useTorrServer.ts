/**
 * TorrServer 连接和流媒体管理 Composable
 */

import type { TorrentFile, TorrentInfo } from '../utils/torrServerClient'
import { computed, ref } from 'vue'
import { createTorrServerClient } from '../utils/torrServerClient'
import { useToast } from './useToast'

// TorrServer 配置
export interface TorrServerConfig {
  serverUrl: string
}

// 流媒体结果
export interface StreamResult {
  streamUrl: string
  fileName: string
}

// 文件选择结果（需要用户选择时）
export interface FileSelectionNeeded {
  needsSelection: true
  files: TorrentFile[]
  magnetUrl: string
}

export type StreamMagnetResult = StreamResult | FileSelectionNeeded

const STORAGE_KEY = 'torrserver-config'
const SYSTEM_DEFAULT_API = '/api/public/settings/torrserver'

// 全局状态（单例模式）
const config = ref<TorrServerConfig | null>(null)
const isConnected = ref(false)
const serverVersion = ref<string | null>(null)
const isLoading = ref(false)
/** 标记是否已尝试过系统默认值回落（避免重复请求） */
const systemDefaultFetched = ref(false)

export function useTorrServer() {
  const toast = useToast()

  const client = computed(() => {
    if (!config.value)
      return null
    return createTorrServerClient({ serverUrl: config.value.serverUrl })
  })

  /**
   * 从 localStorage 加载配置；若未设置则尝试从 API 读取系统默认值
   */
  function loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        config.value = JSON.parse(stored)
      }
    }
    catch (err) {
      console.warn('加载 TorrServer 本地配置失败', err)
    }
  }

  /**
   * 从 API 读取管理员配置的系统默认地址（仅在未设置本地配置时调用）
   * 不阻塞，静默失败
   */
  async function loadSystemDefault() {
    if (config.value || systemDefaultFetched.value)
      return
    systemDefaultFetched.value = true
    try {
      const res = await fetch(SYSTEM_DEFAULT_API)
      if (!res.ok)
        return
      const json = await res.json() as { success: boolean, data: { defaultUrl: string | null } }
      if (json.success && json.data.defaultUrl) {
        config.value = { serverUrl: json.data.defaultUrl }
      }
    }
    catch {
      // 网络不可用时静默忽略
    }
  }

  /**
   * 保存配置到 localStorage
   */
  function saveConfig(newConfig: TorrServerConfig) {
    config.value = newConfig
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
    toast.success('TorrServer 配置已保存')
  }

  /**
   * 测试连接
   */
  async function testConnection(): Promise<boolean> {
    if (!config.value) {
      toast.error('请先配置 TorrServer 地址')
      return false
    }

    isLoading.value = true

    try {
      if (!client.value) {
        throw new Error('客户端未初始化')
      }

      const version = await client.value.getVersion()
      serverVersion.value = version
      isConnected.value = true
      toast.success(`已连接到 TorrServer ${version}`)
      return true
    }
    catch (error) {
      isConnected.value = false
      serverVersion.value = null

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error('连接被浏览器安全策略阻止，请确保 TorrServer 已启用 CORS（启动参数 --cors）')
        }
        else {
          toast.error(`连接失败: ${error.message}`)
        }
      }
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * 核心方法：将磁力链接转为可播放的 HTTP 流 URL
   *
   * 流程：提交磁链 → 获取文件列表 → 选择视频文件 → 构建流 URL
   * 如果需要用户手动选择文件，返回 { needsSelection: true, files, magnetUrl }
   */
  async function streamMagnet(magnetUrl: string): Promise<StreamMagnetResult> {
    if (!client.value || !isConnected.value) {
      throw new Error('TorrServer 未连接')
    }

    // 提交磁链到 TorrServer
    let torrentInfo: TorrentInfo
    try {
      torrentInfo = await client.value.addTorrent(magnetUrl)
    }
    catch (error) {
      throw new Error(`磁力链接无效或无法解析: ${error instanceof Error ? error.message : '未知错误'}`)
    }

    if (!torrentInfo?.hash) {
      throw new Error('磁力链接无效或无法解析')
    }

    // 获取文件列表（addTorrent 可能已包含，否则重新获取）
    let files = torrentInfo.file_stats
    if (!files || files.length === 0) {
      // 等一会儿让 TorrServer 解析种子元数据
      await sleep(2000)
      const info = await client.value.getTorrentInfo(torrentInfo.hash)
      files = info.file_stats
    }

    if (!files || files.length === 0) {
      // 再等一会儿
      await sleep(3000)
      const info = await client.value.getTorrentInfo(torrentInfo.hash)
      files = info.file_stats
    }

    if (!files || files.length === 0) {
      throw new Error('无法获取种子文件列表，种子可能无法解析')
    }

    // 筛选视频文件
    const videoFiles = client.value.filterVideoFiles(files)

    if (videoFiles.length === 0) {
      throw new Error('该种子中未找到视频文件')
    }

    // 自动选择逻辑
    if (videoFiles.length === 1) {
      return buildStreamResult(magnetUrl, videoFiles[0])
    }

    // 多个视频文件：检查大小差异
    const largest = videoFiles[0].length
    const secondLargest = videoFiles[1].length
    const sizeDiffRatio = (largest - secondLargest) / largest

    if (sizeDiffRatio > 0.1) {
      // 最大文件明显比第二大的大，自动选择
      return buildStreamResult(magnetUrl, videoFiles[0])
    }

    // 大小接近，需要用户选择
    return {
      needsSelection: true,
      files: videoFiles,
      magnetUrl,
    }
  }

  /**
   * 为指定文件构建流播放结果
   */
  function buildStreamResult(magnetUrl: string, file: TorrentFile): StreamResult {
    if (!client.value) {
      throw new Error('TorrServer 未连接')
    }

    return {
      streamUrl: client.value.getStreamUrl(magnetUrl, file.id),
      fileName: file.path.split('/').pop() || file.path,
    }
  }

  /**
   * 根据用户选择的文件构建流 URL（文件选择 Modal 回调用）
   */
  function buildStreamForFile(magnetUrl: string, file: TorrentFile): StreamResult {
    return buildStreamResult(magnetUrl, file)
  }

  // 初始化时加载配置，并自动尝试连接
  if (!config.value) {
    loadConfig()
    const afterLoad = config.value as TorrServerConfig | null
    if (afterLoad?.serverUrl) {
      testConnection().catch(() => {})
    }
    else {
      // 本地未配置时，异步读取系统默认值并尝试连接
      loadSystemDefault().then(() => {
        const cfg = config.value as TorrServerConfig | null
        if (cfg?.serverUrl) {
          testConnection().catch(() => {})
        }
      })
    }
  }

  return {
    config,
    isConnected,
    serverVersion,
    isLoading,

    loadConfig,
    loadSystemDefault,
    saveConfig,
    testConnection,
    streamMagnet,
    buildStreamForFile,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
