import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'

/**
 * 缓存策略配置
 */
interface CacheOptions {
  /**
   * 缓存时长（秒）
   */
  maxAge: number

  /**
   * 是否为私有缓存（需要 Vary: Cookie）
   */
  isPrivate?: boolean

  /**
   * 是否在后台重新验证
   */
  staleWhileRevalidate?: number

  /**
   * 自定义缓存键生成函数
   */
  cacheKey?: (url: string) => string
}

/**
 * 创建缓存中间件
 */
function createCacheMiddleware(options: CacheOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const req = c.req.raw
    const url = new URL(req.url)

    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next()
    }

    // 生成缓存键
    const cacheKey = options.cacheKey
      ? options.cacheKey(url.toString())
      : url.toString()

    // 创建缓存请求（确保协议正确）
    const cacheUrl = new URL(cacheKey)
    cacheUrl.protocol = 'https:'
    const cacheRequest = new Request(cacheUrl.toString(), {
      method: 'GET',
      headers: req.headers,
    })

    // 尝试从缓存获取
    const cache = caches.default
    let response = await cache.match(cacheRequest)

    if (response) {
      // 缓存命中
      const headers = new Headers(response.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    // 缓存未命中，执行请求
    await next()

    // 获取响应
    response = c.res

    // 只缓存成功的响应
    if (response.status !== 200) {
      return
    }

    // 克隆响应以便缓存
    const responseToCache = response.clone()

    // 构建缓存控制头
    const cacheControl = options.isPrivate
      ? `private, max-age=${options.maxAge}`
      : `public, max-age=${options.maxAge}`

    const headers = new Headers(responseToCache.headers)
    headers.set('Cache-Control', cacheControl)
    headers.set('X-Cache', 'MISS')

    if (options.staleWhileRevalidate) {
      headers.set(
        'Cache-Control',
        `${cacheControl}, stale-while-revalidate=${options.staleWhileRevalidate}`,
      )
    }

    if (options.isPrivate) {
      headers.set('Vary', 'Cookie')
    }

    // 创建带缓存头的响应
    const cachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers,
    })

    // 异步存入缓存
    // 在 Cloudflare Workers 环境中使用 waitUntil，在测试环境中直接执行
    const cachePutPromise = cache.put(cacheRequest, cachedResponse.clone())
    try {
      c.executionCtx.waitUntil(cachePutPromise)
    }
    catch {
      // 测试环境：executionCtx 不可用，直接 await
      await cachePutPromise
    }

    // 返回带缓存头的响应
    c.res = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * 公开资源缓存 (1 分钟)
 * 用于首页、列表等高频公开内容
 */
export function publicCache(): MiddlewareHandler<AppEnv> {
  return createCacheMiddleware({
    maxAge: 60, // 1 分钟
    staleWhileRevalidate: 30, // 后台重新验证 30 秒
  })
}

/**
 * 列表缓存 (5 分钟)
 * 用于分页列表，更新频率较低
 */
export function listCache(): MiddlewareHandler<AppEnv> {
  return createCacheMiddleware({
    maxAge: 300, // 5 分钟
    staleWhileRevalidate: 60,
  })
}

/**
 * 详情缓存 (3 分钟)
 * 用于详情页，平衡新鲜度和性能
 */
export function detailCache(): MiddlewareHandler<AppEnv> {
  return createCacheMiddleware({
    maxAge: 180, // 3 分钟
    staleWhileRevalidate: 60,
  })
}

/**
 * 用户个性化缓存 (1 分钟)
 * 用于用户相关的内容，需要 Vary: Cookie
 */
export function userCache(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const req = c.req.raw
    const url = new URL(req.url)

    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next()
    }

    // 为每个用户生成独立缓存键（基于 Cookie）
    const cookie = req.headers.get('Cookie') || 'anonymous'
    const cacheKey = `user:${cookie}:${url.toString()}`

    // 创建缓存请求
    const cacheUrl = new URL(cacheKey)
    cacheUrl.protocol = 'https:'
    const cacheRequest = new Request(cacheUrl.toString(), {
      method: 'GET',
      headers: req.headers,
    })

    // 尝试从缓存获取
    const cache = caches.default
    let response = await cache.match(cacheRequest)

    if (response) {
      // 缓存命中
      const headers = new Headers(response.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    // 缓存未命中，执行请求
    await next()

    // 获取响应
    response = c.res

    // 只缓存成功的响应
    if (response.status !== 200) {
      return
    }

    // 克隆响应以便缓存
    const responseToCache = response.clone()

    // 构建缓存控制头
    const headers = new Headers(responseToCache.headers)
    headers.set('Cache-Control', 'private, max-age=60')
    headers.set('X-Cache', 'MISS')
    headers.set('Vary', 'Cookie')

    // 创建带缓存头的响应
    const cachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers,
    })

    // 异步存入缓存
    const cachePutPromise = cache.put(cacheRequest, cachedResponse.clone())
    try {
      c.executionCtx.waitUntil(cachePutPromise)
    }
    catch {
      // 测试环境：executionCtx 不可用，直接 await
      await cachePutPromise
    }

    // 返回带缓存头的响应
    c.res = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * 主动失效缓存
 */
export async function invalidateCache(patterns: string[]) {
  const cache = caches.default

  for (const pattern of patterns) {
    try {
      const cacheUrl = new URL(pattern)
      cacheUrl.protocol = 'https:'
      const cacheRequest = new Request(cacheUrl.toString())
      await cache.delete(cacheRequest)
    }
    catch (error) {
      console.error(`Failed to invalidate cache for ${pattern}:`, error)
    }
  }
}
