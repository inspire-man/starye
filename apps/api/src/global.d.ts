/**
 * Cloudflare Workers 全局类型扩展
 */

declare global {
  /**
   * 扩展 CacheStorage 以支持 Cloudflare Workers 的 default cache
   */
  interface CacheStorage {
    default: Cache
  }
}

export {}
