/**
 * API 缓存工具
 *
 * 为评分查询和聚合数据提供缓存支持
 */

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * 内存缓存存储
 *
 * 注意：Cloudflare Workers 不支持在全局作用域使用 setInterval
 * 改为惰性清理策略（在访问时清理过期缓存）
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>()
  private lastCleanup = Date.now()
  private cleanupThreshold = 60 * 1000 // 每分钟触发一次清理

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl: number = 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    // 惰性清理：定期触发清理操作
    const now = Date.now()
    if (now - this.lastCleanup > this.cleanupThreshold) {
      this.cleanup()
      this.lastCleanup = now
    }

    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number, keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    this.clear()
  }
}

// 全局缓存实例
export const apiCache = new MemoryCache()

/**
 * 缓存键生成器
 */
export const CacheKeys = {
  /**
   * 播放源评分
   */
  playerRating: (playerId: string) => `rating:player:${playerId}`,

  /**
   * 播放源列表评分（批量）
   */
  playerRatings: (playerIds: string[]) => `rating:players:${playerIds.sort().join(',')}`,

  /**
   * 电影的所有播放源评分
   */
  moviePlayerRatings: (movieId: string) => `rating:movie:${movieId}`,

  /**
   * 用户的所有评分
   */
  userRatings: (userId: string) => `rating:user:${userId}`,

  /**
   * Aria2 配置
   */
  aria2Config: (userId: string) => `aria2:config:${userId}`,
}

/**
 * 使缓存失效
 */
export const InvalidateCache = {
  /**
   * 播放源评分更新后
   */
  onRatingUpdate: (playerId: string, movieId?: string, userId?: string) => {
    apiCache.delete(CacheKeys.playerRating(playerId))

    if (movieId) {
      apiCache.delete(CacheKeys.moviePlayerRatings(movieId))
    }

    if (userId) {
      apiCache.delete(CacheKeys.userRatings(userId))
    }
  },

  /**
   * Aria2 配置更新后
   */
  onAria2ConfigUpdate: (userId: string) => {
    apiCache.delete(CacheKeys.aria2Config(userId))
  },
}

/**
 * 缓存配置
 */
export const CacheTTL = {
  /**
   * 播放源评分（5 分钟）
   */
  PLAYER_RATING: 5 * 60 * 1000,

  /**
   * 电影播放源列表（3 分钟）
   */
  MOVIE_PLAYERS: 3 * 60 * 1000,

  /**
   * Aria2 配置（10 分钟）
   */
  ARIA2_CONFIG: 10 * 60 * 1000,

  /**
   * 用户评分列表（2 分钟）
   */
  USER_RATINGS: 2 * 60 * 1000,
}
