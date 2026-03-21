/**
 * Cloudflare KV 缓存工具类
 *
 * 提供统一的缓存键命名、TTL 配置和缓存操作
 */

export interface CacheOptions {
  ttl?: number
}

export const CacheTTL = {
  LIST: 3600, // 列表页：1 小时
  DETAIL: 7200, // 详情页：2 小时
  STATS: 1800, // 统计数据：30 分钟
} as const

/**
 * 缓存键生成函数
 */
export const CacheKeys = {
  actorList: (page: number, limit: number, filters: Record<string, any>) => {
    const filterStr = JSON.stringify(filters)
    return `actors:list:${page}:${limit}:${filterStr}`
  },

  actorDetail: (id: string) => `actors:detail:${id}`,

  actorStats: () => `actors:stats`,

  actorNationalities: () => `actors:nationalities`,

  publisherList: (page: number, limit: number, filters: Record<string, any>) => {
    const filterStr = JSON.stringify(filters)
    return `publishers:list:${page}:${limit}:${filterStr}`
  },

  publisherDetail: (id: string) => `publishers:detail:${id}`,

  publisherStats: () => `publishers:stats`,

  publisherCountries: () => `publishers:countries`,
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
}

/**
 * 缓存管理类
 */
export class CacheManager {
  private stats = {
    hits: 0,
    misses: 0,
  }

  constructor(private kv: KVNamespace) {}

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.kv.get(key, 'json')
      if (cached) {
        this.stats.hits++
        return cached as T
      }
      this.stats.misses++
      return null
    }
    catch (e) {
      console.error(`[Cache] ❌ Failed to get cache for key: ${key}`, e)
      this.stats.misses++
      return null
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats.hits = 0
    this.stats.misses = 0
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || CacheTTL.LIST
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl,
      })
    }
    catch (e) {
      console.error(`[Cache] ❌ Failed to set cache for key: ${key}`, e)
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key)
    }
    catch (e) {
      console.error(`[Cache] ❌ Failed to delete cache for key: ${key}`, e)
    }
  }

  /**
   * 批量删除缓存（通过前缀匹配）
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const list = await this.kv.list({ prefix })
      const deletePromises = list.keys.map(key => this.kv.delete(key.name))
      await Promise.all(deletePromises)
    }
    catch (e) {
      console.error(`[Cache] ❌ Failed to delete cache by prefix: ${prefix}`, e)
    }
  }

  /**
   * 清空所有女优相关缓存
   */
  async clearActorCache(): Promise<void> {
    await Promise.all([
      this.deleteByPrefix('actors:list:'),
      this.deleteByPrefix('actors:detail:'),
      this.delete(CacheKeys.actorStats()),
      this.delete(CacheKeys.actorNationalities()),
    ])
  }

  /**
   * 清空所有厂商相关缓存
   */
  async clearPublisherCache(): Promise<void> {
    await Promise.all([
      this.deleteByPrefix('publishers:list:'),
      this.deleteByPrefix('publishers:detail:'),
      this.delete(CacheKeys.publisherStats()),
      this.delete(CacheKeys.publisherCountries()),
    ])
  }
}

/**
 * 缓存装饰器：用于包装 API 处理函数，自动处理缓存读写
 */
export function withCache<T>(
  cacheKey: string,
  ttl: number,
  fetchFn: () => Promise<T>,
  cache: CacheManager,
): Promise<T> {
  return cache.get<T>(cacheKey).then(async (cached) => {
    if (cached !== null) {
      return cached
    }

    const result = await fetchFn()
    await cache.set(cacheKey, result, { ttl })
    return result
  })
}
