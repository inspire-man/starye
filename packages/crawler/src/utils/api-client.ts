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
        signal: AbortSignal.timeout(this.config.timeout || 60000), // 增加超时到 60 秒
      })

      if (!response.ok) {
        // 尝试获取错误详情
        let errorDetails = ''
        try {
          const errorBody = await response.json() as { error?: string, message?: string }
          errorDetails = errorBody.error || errorBody.message || JSON.stringify(errorBody)
        }
        catch {
          errorDetails = await response.text().catch(() => 'No error details')
        }

        console.warn(`⚠️  API 返回错误 ${response.status}: ${url}`)
        if (errorDetails) {
          console.warn(`   错误详情: ${errorDetails}`)
        }
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
      movies: [movieData],
      mode: 'upsert',
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
        signal: AbortSignal.timeout(this.config.timeout || 60000),
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

  /**
   * 获取待爬取女优列表
   */
  async fetchPendingActors(maxCount: number): Promise<any[]> {
    const url = `${this.config.url}/api/admin/actors/pending?limit=${maxCount}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-service-token': this.config.token,
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      })

      if (!response.ok) {
        console.warn(`⚠️  获取待爬取女优列表失败 ${response.status}`)
        return []
      }

      const data = await response.json() as { actors?: any[] }
      return data.actors || []
    }
    catch (error) {
      console.warn('⚠️  获取待爬取女优列表失败', error)
      return []
    }
  }

  /**
   * 批量查询女优状态
   */
  async batchQueryActorStatus(ids: string[]): Promise<Record<string, any>> {
    if (ids.length === 0) {
      return {}
    }

    const url = `${this.config.url}/api/admin/actors/batch-status?ids=${ids.join(',')}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-service-token': this.config.token,
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      })

      if (!response.ok) {
        console.warn(`⚠️  批量查询女优状态失败 ${response.status}`)
        return {}
      }

      return await response.json()
    }
    catch (error) {
      console.warn('⚠️  批量查询女优状态失败', error)
      return {}
    }
  }

  /**
   * 同步女优详情
   */
  async syncActorDetails(id: string, details: any): Promise<any> {
    return this.sync(`/api/admin/actors/${id}/details`, details)
  }

  /**
   * 获取待爬取厂商列表
   */
  async fetchPendingPublishers(maxCount: number): Promise<any[]> {
    const url = `${this.config.url}/api/admin/publishers/pending?limit=${maxCount}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-service-token': this.config.token,
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      })

      if (!response.ok) {
        console.warn(`⚠️  获取待爬取厂商列表失败 ${response.status}`)
        return []
      }

      const data = await response.json() as { publishers?: any[] }
      return data.publishers || []
    }
    catch (error) {
      console.warn('⚠️  获取待爬取厂商列表失败', error)
      return []
    }
  }

  /**
   * 批量查询厂商状态
   */
  async batchQueryPublisherStatus(ids: string[]): Promise<Record<string, any>> {
    if (ids.length === 0) {
      return {}
    }

    const url = `${this.config.url}/api/admin/publishers/batch-status?ids=${ids.join(',')}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-service-token': this.config.token,
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      })

      if (!response.ok) {
        console.warn(`⚠️  批量查询厂商状态失败 ${response.status}`)
        return {}
      }

      return await response.json()
    }
    catch (error) {
      console.warn('⚠️  批量查询厂商状态失败', error)
      return {}
    }
  }

  /**
   * 同步厂商详情
   */
  async syncPublisherDetails(id: string, details: any): Promise<any> {
    return this.sync(`/api/admin/publishers/${id}/details`, details)
  }

  /**
   * 批量同步女优
   */
  async batchSyncActors(actors: Array<{ name: string, sourceUrl: string }>): Promise<any> {
    return this.sync('/api/admin/actors/batch-sync', { actors })
  }

  /**
   * 批量同步厂商
   */
  async batchSyncPublishers(publishers: Array<{ name: string, sourceUrl: string }>): Promise<any> {
    return this.sync('/api/admin/publishers/batch-sync', { publishers })
  }
}
