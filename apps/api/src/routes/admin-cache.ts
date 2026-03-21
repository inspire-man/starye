/* eslint-disable no-console */
/**
 * 缓存管理 API 路由
 *
 * 提供缓存清除、监控等管理功能
 * 权限要求：admin
 */

import type { AppEnv } from '../types'
import { Hono } from 'hono'
import { CacheManager } from '../lib/cache'
import { requireResource } from '../middleware/resource-guard'

const adminCache = new Hono<AppEnv>()

adminCache.use('/*', requireResource('movie'))

/**
 * POST /api/admin/cache/clear
 * 清空所有缓存
 */
adminCache.post('/clear', async (c) => {
  const cache = new CacheManager(c.env.CACHE)

  try {
    await Promise.all([
      cache.clearActorCache(),
      cache.clearPublisherCache(),
    ])

    console.log('[Admin/Cache] ✓ Cleared all cache')

    return c.json({
      success: true,
      message: '缓存已清空',
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Admin/Cache] ❌ Failed to clear cache:', message)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/admin/cache/clear/actors
 * 清空女优相关缓存
 */
adminCache.post('/clear/actors', async (c) => {
  const cache = new CacheManager(c.env.CACHE)

  try {
    await cache.clearActorCache()

    console.log('[Admin/Cache] ✓ Cleared actor cache')

    return c.json({
      success: true,
      message: '女优缓存已清空',
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Admin/Cache] ❌ Failed to clear actor cache:', message)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/admin/cache/clear/publishers
 * 清空厂商相关缓存
 */
adminCache.post('/clear/publishers', async (c) => {
  const cache = new CacheManager(c.env.CACHE)

  try {
    await cache.clearPublisherCache()

    console.log('[Admin/Cache] ✓ Cleared publisher cache')

    return c.json({
      success: true,
      message: '厂商缓存已清空',
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Admin/Cache] ❌ Failed to clear publisher cache:', message)
    return c.json({ error: message }, 500)
  }
})

export default adminCache
