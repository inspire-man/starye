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
   * 批量查询影片状态
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
        return {}
      }

      return await response.json()
    }
    catch (error) {
      console.warn('⚠️  批量状态查询失败，将作为新影片处理', error)
      return {}
    }
  }
}
