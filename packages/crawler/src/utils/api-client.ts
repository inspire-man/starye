/**
 * API 客户端工具类
 */

import type { ApiConfig } from '../types/config'

export class ApiClient {
  constructor(private config: ApiConfig) {}

  async sync(endpoint: string, data: unknown): Promise<any> {
    const url = `${this.config.url}${endpoint}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': this.config.token,
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      })

      if (!response.ok) {
        console.warn(`⚠️  API 返回错误 ${response.status}: ${url}`)
        return null
      }

      return await response.json()
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        console.warn('⚠️  API 离线或无法连接，跳过同步')
      }
      else if (errorMessage.includes('timeout')) {
        console.warn('⚠️  API 请求超时')
      }
      else {
        console.warn(`⚠️  API 同步失败: ${errorMessage}`)
      }

      return null
    }
  }

  async syncMovie(movieData: unknown): Promise<any> {
    return this.sync('/api/movies/sync', {
      type: 'movie',
      data: movieData,
    })
  }

  /**
   * 批量查询影片状态（增量爬取核心方法）
   *
   * 通过单次 API 调用查询多个影片的存在状态，用于增量爬取过滤。
   * 相比逐个查询，批量查询显著减少 API 调用次数，提升爬取效率。
   *
   * @param codes 影片代码数组（如 ['ABC-001', 'ABC-002']）
   * @returns 状态映射对象，key 为影片代码，value 为 { exists: boolean, code: string }
   *
   * **容错处理**：
   * - 失败时返回空对象 {}，爬虫将回退到全量爬取模式
   * - 避免因批量查询失败导致爬虫完全中断
   */
  async batchQueryMovieStatus(codes: string[]): Promise<Record<string, { exists: boolean, code: string }>> {
    if (codes.length === 0) {
      return {}
    }

    const url = `${this.config.url}/api/admin/movies/batch-status?codes=${codes.join(',')}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-service-token': this.config.token,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      })

      if (!response.ok) {
        console.warn(`⚠️  批量状态查询失败 ${response.status}`)
        return {} // 回退到全量爬取
      }

      return await response.json()
    }
    catch (error) {
      // 网络错误或超时：返回空对象，回退到全量爬取
      console.warn('⚠️  批量状态查询失败，将作为新影片处理', error)
      return {}
    }
  }
}
