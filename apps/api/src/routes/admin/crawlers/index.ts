/* eslint-disable no-console */
/**
 * 爬虫监控与管理 API 路由
 *
 * 提供爬虫统计、失败任务查看、恢复触发等功能
 * 权限要求：根据资源类型动态检查（comic_admin 只能查看漫画爬虫）
 *
 * 注意：Cloudflare Workers 不支持文件系统访问
 * 失败任务日志仅在本地环境或 GitHub Actions 中可用
 */

import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { canAccessCrawler } from '../../../lib/permissions'
import { serviceAuth } from '../../../middleware/service-auth'
import { CrawlerActionSchema } from '../../../schemas/admin'

const adminCrawlers = new Hono<AppEnv>()

// 基础认证（至少需要是管理员角色）
adminCrawlers.use('/*', serviceAuth(['admin', 'comic_admin', 'movie_admin']))

/**
 * 失败任务接口
 */
interface FailedTask {
  url: string
  errorType: string
  errorMessage: string
  retryCount: number
  timestamp: string
}

/**
 * GET /api/admin/crawlers/stats
 * 爬虫统计信息（根据角色过滤）
 */
adminCrawlers.get('/stats', async (c) => {
  const user = c.get('user')
  const db = c.get('db')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const canViewComics = canAccessCrawler(user, 'comic')
  const canViewMovies = canAccessCrawler(user, 'movie')

  const stats: any = {}

  // 代理池状态（如果配置了）
  // eslint-disable-next-line node/prefer-global/process
  const proxyPoolEnabled = !!process.env.PROXY_POOL
  if (proxyPoolEnabled) {
    stats.proxyPool = {
      enabled: true,
      status: 'Proxy pool status available in crawler logs',
      // eslint-disable-next-line node/prefer-global/process
      healthCheckInterval: Number(process.env.PROXY_HEALTH_CHECK_INTERVAL) || 300000,
      // eslint-disable-next-line node/prefer-global/process
      strategy: process.env.PROXY_ROTATION_STRATEGY || 'on-failure',
    }
  }
  else {
    stats.proxyPool = {
      enabled: false,
      message: 'Proxy pool not configured',
    }
  }

  try {
    if (canViewComics) {
      const comicStats = await db.query.comics.findMany({
        columns: {
          crawlStatus: true,
          isSerializing: true,
          lastCrawledAt: true,
        },
      })

      const lastCrawl = comicStats
        .filter(c => c.lastCrawledAt)
        .sort((a, b) => (b.lastCrawledAt?.getTime() || 0) - (a.lastCrawledAt?.getTime() || 0))[0]
        ?.lastCrawledAt

      stats.comics = {
        total: comicStats.length,
        pending: comicStats.filter(c => c.crawlStatus === 'pending').length,
        partial: comicStats.filter(c => c.crawlStatus === 'partial').length,
        complete: comicStats.filter(c => c.crawlStatus === 'complete').length,
        serializing: comicStats.filter(c => c.isSerializing).length,
        lastCrawlAt: lastCrawl?.toISOString() || null,
      }
    }

    if (canViewMovies) {
      const movieStats = await db.query.movies.findMany({
        columns: {
          crawlStatus: true,
          lastCrawledAt: true,
        },
      })

      const lastCrawl = movieStats
        .filter(m => m.lastCrawledAt)
        .sort((a, b) => (b.lastCrawledAt?.getTime() || 0) - (a.lastCrawledAt?.getTime() || 0))[0]
        ?.lastCrawledAt

      stats.movies = {
        total: movieStats.length,
        pending: movieStats.filter(m => m.crawlStatus === 'pending').length,
        partial: movieStats.filter(m => m.crawlStatus === 'partial').length,
        complete: movieStats.filter(m => m.crawlStatus === 'complete').length,
        lastCrawlAt: lastCrawl?.toISOString() || null,
      }

      // 女优统计
      const actorStats = await db.query.actors.findMany({
        columns: {
          hasDetailsCrawled: true,
          crawlFailureCount: true,
          lastCrawlAttempt: true,
          sourceUrl: true,
        },
      })

      const lastActorCrawl = actorStats
        .filter(a => a.lastCrawlAttempt)
        .sort((a, b) => (b.lastCrawlAttempt?.getTime() || 0) - (a.lastCrawlAttempt?.getTime() || 0))[0]
        ?.lastCrawlAttempt

      const actorsPending = actorStats.filter(a => !a.hasDetailsCrawled && a.sourceUrl && (a.crawlFailureCount ?? 0) < 3).length
      const actorsFailed = actorStats.filter(a => (a.crawlFailureCount ?? 0) >= 3).length

      stats.actors = {
        total: actorStats.length,
        crawled: actorStats.filter(a => a.hasDetailsCrawled).length,
        pending: actorsPending,
        failed: actorsFailed,
        lastCrawlAt: lastActorCrawl?.toISOString() || null,
      }

      // 厂商统计
      const publisherStats = await db.query.publishers.findMany({
        columns: {
          hasDetailsCrawled: true,
          crawlFailureCount: true,
          lastCrawlAttempt: true,
          sourceUrl: true,
        },
      })

      const lastPublisherCrawl = publisherStats
        .filter(p => p.lastCrawlAttempt)
        .sort((a, b) => (b.lastCrawlAttempt?.getTime() || 0) - (a.lastCrawlAttempt?.getTime() || 0))[0]
        ?.lastCrawlAttempt

      const publishersPending = publisherStats.filter(p => !p.hasDetailsCrawled && p.sourceUrl && (p.crawlFailureCount ?? 0) < 3).length
      const publishersFailed = publisherStats.filter(p => (p.crawlFailureCount ?? 0) >= 3).length

      stats.publishers = {
        total: publisherStats.length,
        crawled: publisherStats.filter(p => p.hasDetailsCrawled).length,
        pending: publishersPending,
        failed: publishersFailed,
        lastCrawlAt: lastPublisherCrawl?.toISOString() || null,
      }

      // 告警逻辑（任务 15.4）
      const alerts: string[] = []

      // 女优失败率告警
      if (actorStats.length > 50) {
        const actorFailureRate = actorsFailed / actorStats.length
        if (actorFailureRate > 0.5) {
          const alert = `⚠️ 女优爬取失败率过高: ${(actorFailureRate * 100).toFixed(1)}% (${actorsFailed}/${actorStats.length})`
          alerts.push(alert)
          console.error(`[Crawlers/Stats] ${alert}`)
        }
      }

      // 厂商失败率告警
      if (publisherStats.length > 50) {
        const publisherFailureRate = publishersFailed / publisherStats.length
        if (publisherFailureRate > 0.5) {
          const alert = `⚠️ 厂商爬取失败率过高: ${(publisherFailureRate * 100).toFixed(1)}% (${publishersFailed}/${publisherStats.length})`
          alerts.push(alert)
          console.error(`[Crawlers/Stats] ${alert}`)
        }
      }

      if (alerts.length > 0) {
        stats.alerts = alerts
      }
    }

    return c.json(stats)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/Stats] ❌ Failed to get stats:', message)
    return c.json({ error: 'Failed to get crawler stats' }, 500)
  }
})

/**
 * GET /api/admin/crawlers/failed-tasks
 * 获取失败任务列表
 *
 * 注意：Cloudflare Workers 不支持文件系统访问
 * 失败任务文件存储在 GitHub Actions 或本地环境
 */
adminCrawlers.get('/failed-tasks', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const canViewComics = canAccessCrawler(user, 'comic')
  const canViewMovies = canAccessCrawler(user, 'movie')

  const result: {
    comics?: {
      total: number
      tasks: FailedTask[]
      groupedByError: Record<string, number>
    }
    movies?: {
      total: number
      tasks: FailedTask[]
      groupedByError: Record<string, number>
    }
    message?: string
  } = {
    message: '失败任务日志仅在本地环境或 GitHub Actions 中可用。请查看 GitHub Actions 运行日志或本地 .crawler-failed-tasks.json / .javbus-failed-tasks.json 文件。',
  }

  if (canViewComics) {
    result.comics = {
      total: 0,
      tasks: [],
      groupedByError: {},
    }
  }

  if (canViewMovies) {
    result.movies = {
      total: 0,
      tasks: [],
      groupedByError: {},
    }
  }

  return c.json(result)
})

/**
 * POST /api/admin/crawlers/recover
 * 返回恢复任务指令
 */
adminCrawlers.post(
  '/recover',
  describeRoute({
    summary: '恢复爬虫任务',
    description: '返回恢复爬虫任务的指令',
    tags: ['Admin'],
    operationId: 'recoverCrawlerTasks',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '恢复指令' },
    },
  }),
  validator('json', CrawlerActionSchema),
  async (c) => {
    const { type } = c.req.valid('json')
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (!canAccessCrawler(user, type)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    const instructions = type === 'comic'
      ? {
          manual: 'pnpm crawl:manga --recovery',
          githubActions: 'GitHub Actions → Daily Manga Crawl → Run workflow → 设置 RECOVERY_MODE=true',
          workflow: 'daily-manga-crawl.yml',
        }
      : {
          manual: 'pnpm crawl:movie --recovery',
          githubActions: 'GitHub Actions → Daily Movie Crawl → Run workflow → 设置 RECOVERY_MODE=true',
          workflow: 'daily-movie-crawl.yml',
        }

    return c.json({
      message: '请手动触发恢复任务',
      type,
      instructions,
    })
  },
)

/**
 * POST /api/admin/crawlers/clear-failed
 * 清空失败任务记录
 *
 * 注意：Cloudflare Workers 不支持文件系统操作
 * 需要在本地环境或 GitHub Actions 中手动删除失败任务文件
 */
adminCrawlers.post(
  '/clear-failed',
  describeRoute({
    summary: '清理失败任务',
    description: '清理爬虫失败任务文件',
    tags: ['Admin'],
    operationId: 'clearFailedCrawlerTasks',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '清理结果' },
    },
  }),
  validator('json', CrawlerActionSchema),
  async (c) => {
    const { type } = c.req.valid('json')
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (!canAccessCrawler(user, type)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    console.log(`[Crawlers/Clear] 请求清空 ${type} 失败任务`)

    const fileName = type === 'comic' ? '.crawler-failed-tasks.json' : '.javbus-failed-tasks.json'

    return c.json({
      success: false,
      message: `此功能在 Cloudflare Workers 环境中不可用。请在本地环境手动删除失败任务文件：${fileName}`,
    })
  },
)

/**
 * GET /api/admin/crawlers/unmapped-actors
 * 获取未匹配女优清单
 *
 * 数据来源：R2 存储的 mappings/unmapped-actors.json 文件
 */
adminCrawlers.get('/unmapped-actors', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!canAccessCrawler(user, 'movie')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  try {
    const r2 = c.env.BUCKET

    if (!r2) {
      return c.json({
        data: [],
        message: 'R2 存储桶未配置。请检查环境变量 BUCKET。',
      })
    }

    const file = await r2.get('mappings/unmapped-actors.json')

    if (!file) {
      return c.json({
        data: [],
        message: '未找到未匹配女优清单。请先运行女优索引爬虫生成映射文件。',
      })
    }

    const payload = await file.json() as { metadata?: any, data?: any }
    const data = payload.data || payload // 兼容旧格式

    return c.json({
      data: Array.isArray(data) ? data : [],
      metadata: payload.metadata,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/UnmappedActors] ❌ Failed to fetch:', message)
    return c.json({
      data: [],
      error: '获取未匹配女优清单失败',
    }, 500)
  }
})

/**
 * GET /api/admin/crawlers/unmapped-publishers
 * 获取未匹配厂商清单
 *
 * 数据来源：R2 存储的 mappings/unmapped-publishers.json 文件
 */
adminCrawlers.get('/unmapped-publishers', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!canAccessCrawler(user, 'movie')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  try {
    const r2 = c.env.BUCKET

    if (!r2) {
      return c.json({
        data: [],
        message: 'R2 存储桶未配置。',
      })
    }

    const file = await r2.get('mappings/unmapped-publishers.json')

    if (!file) {
      return c.json({
        data: [],
        message: '未找到未匹配厂商清单。请先运行厂商索引爬虫生成映射文件。',
      })
    }

    const payload = await file.json() as { metadata?: any, data?: any }
    const data = payload.data || payload

    return c.json({
      data: Array.isArray(data) ? data : [],
      metadata: payload.metadata,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/UnmappedPublishers] ❌ Failed to fetch:', message)
    return c.json({
      data: [],
      error: '获取未匹配厂商清单失败',
    }, 500)
  }
})

/**
 * POST /api/admin/crawlers/add-mapping
 * 手动添加名字映射
 *
 * 持久化到 R2 存储
 */
adminCrawlers.post('/add-mapping', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!canAccessCrawler(user, 'movie')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  const body = await c.req.json()
  const { type, javbusName, wikiUrl } = body

  if (!type || !javbusName || !wikiUrl) {
    return c.json({ error: 'Missing required fields: type, javbusName, wikiUrl' }, 400)
  }

  if (type !== 'actor' && type !== 'publisher') {
    return c.json({ error: 'Invalid type: must be "actor" or "publisher"' }, 400)
  }

  try {
    const r2 = c.env.BUCKET

    if (!r2) {
      return c.json({ error: 'R2 存储桶未配置' }, 500)
    }

    // 1. 读取现有映射表
    const fileName = type === 'actor' ? 'actor-name-map.json' : 'publisher-name-map.json'
    const key = `mappings/${fileName}`

    let mappingData: any = {}

    const existingFile = await r2.get(key)
    if (existingFile) {
      const payload = await existingFile.json() as { metadata?: any, data?: any }
      mappingData = payload.data || payload
    }

    // 2. 从 wikiUrl 提取 wikiName
    const urlMatch = wikiUrl.match(/\/d\/([^/?#]+)/)
    if (!urlMatch) {
      return c.json({ error: 'Invalid wikiUrl format' }, 400)
    }
    const wikiName = decodeURIComponent(urlMatch[1])

    // 3. 添加新映射
    mappingData[javbusName] = {
      javbusName,
      wikiName,
      wikiUrl,
      lastUpdated: Math.floor(Date.now() / 1000),
    }

    // 4. 保存回 R2
    const updatedPayload = {
      metadata: {
        version: new Date().toISOString(),
        uploadedAt: Date.now(),
        totalEntries: Object.keys(mappingData).length,
        source: 'api',
        lastModifiedBy: user.email || user.id,
      },
      data: mappingData,
    }

    await r2.put(key, JSON.stringify(updatedPayload, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    // 5. 创建备份
    const backupKey = `mappings/backups/${fileName.replace('.json', '')}-${Date.now()}.json`
    await r2.put(backupKey, JSON.stringify(updatedPayload, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    console.log(`[Crawlers/AddMapping] ✅ 添加 ${type} 映射: ${javbusName} -> ${wikiName}`)
    console.log(`[Crawlers/AddMapping] 📦 已创建备份: ${backupKey}`)

    // 6. 从未匹配清单中移除
    const unmappedKey = `mappings/${type === 'actor' ? 'unmapped-actors' : 'unmapped-publishers'}.json`
    const unmappedFile = await r2.get(unmappedKey)

    if (unmappedFile) {
      const unmappedPayload = await unmappedFile.json() as { metadata?: any, data?: any }
      let unmappedList = unmappedPayload.data || unmappedPayload

      if (Array.isArray(unmappedList)) {
        unmappedList = unmappedList.filter((item: any) => item.javbusName !== javbusName || item.name !== javbusName)

        const updatedUnmappedPayload = {
          metadata: {
            version: new Date().toISOString(),
            uploadedAt: Date.now(),
            totalEntries: unmappedList.length,
            source: 'api',
          },
          data: unmappedList,
        }

        await r2.put(unmappedKey, JSON.stringify(updatedUnmappedPayload, null, 2), {
          httpMetadata: {
            contentType: 'application/json',
          },
        })

        console.log(`[Crawlers/AddMapping] ✅ 已从未匹配清单移除: ${javbusName}`)
      }
    }

    return c.json({
      success: true,
      message: '映射添加成功',
      mapping: {
        javbusName,
        wikiName,
        wikiUrl,
      },
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/AddMapping] ❌ Failed:', message)
    return c.json({ error: '添加映射失败' }, 500)
  }
})

/**
 * GET /api/admin/crawlers/mapping-quality
 * 获取映射质量指标
 */
adminCrawlers.get('/mapping-quality', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!canAccessCrawler(user, 'movie')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  const db = c.get('db')

  try {
    // 统计女优数据
    const actorStats = await db.query.actors.findMany({
      columns: {
        id: true,
        hasDetailsCrawled: true,
        wikiUrl: true,
        movieCount: true,
      },
    })

    const totalActors = actorStats.length
    const mappedActors = actorStats.filter(a => a.wikiUrl).length
    const unmappedActors = totalActors - mappedActors
    const highPriorityUnmapped = actorStats.filter(
      a => !a.wikiUrl && (a.movieCount || 0) > 50,
    ).length

    // 统计厂商数据
    const publisherStats = await db.query.publishers.findMany({
      columns: {
        id: true,
        hasDetailsCrawled: true,
        wikiUrl: true,
      },
    })

    const totalPublishers = publisherStats.length
    const mappedPublishers = publisherStats.filter(p => p.wikiUrl).length
    const unmappedPublishers = totalPublishers - mappedPublishers

    // 从 R2 读取映射表，计算冲突和失效映射
    let conflictCount = 0
    const invalidMappingCount = 0
    let actorMappingCount = mappedActors
    const publisherMappingCount = mappedPublishers

    try {
      const r2 = c.env.BUCKET

      if (r2) {
        // 读取女优映射表
        const actorMapFile = await r2.get('mappings/actor-name-map.json')
        if (actorMapFile) {
          const payload = await actorMapFile.json() as { metadata?: any, data?: any }
          const actorMap = payload.data || payload
          actorMappingCount = Object.keys(actorMap).length

          // 检测冲突（多个 JavBus 名映射到同一个 wikiUrl）
          const wikiUrlCount = new Map<string, string[]>()
          for (const [javbusName, mapping] of Object.entries(actorMap)) {
            const wikiUrl = (mapping as any).wikiUrl
            if (!wikiUrlCount.has(wikiUrl)) {
              wikiUrlCount.set(wikiUrl, [])
            }
            wikiUrlCount.get(wikiUrl)!.push(javbusName)
          }

          for (const [_wikiUrl, javbusNames] of wikiUrlCount) {
            if (javbusNames.length > 1) {
              conflictCount += javbusNames.length - 1
            }
          }
        }
      }
    }
    catch (e) {
      console.error('[Crawlers/MappingQuality] ⚠️ Failed to read mapping files from R2:', e)
    }

    return c.json({
      data: {
        totalActors,
        mappedActors,
        unmappedActors,
        totalPublishers,
        mappedPublishers,
        unmappedPublishers,
        actorMappingCount,
        publisherMappingCount,
        conflictCount,
        invalidMappingCount, // TODO: 需要定期验证 URL 有效性
        highPriorityUnmapped,
      },
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/MappingQuality] ❌ Failed to get metrics:', message)
    return c.json({ error: 'Failed to get mapping quality metrics' }, 500)
  }
})

/**
 * GET /api/admin/crawlers/mapping-versions
 * 获取映射文件的版本历史
 */
adminCrawlers.get('/mapping-versions', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!canAccessCrawler(user, 'movie')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  const type = c.req.query('type') || 'actor'

  if (type !== 'actor' && type !== 'publisher') {
    return c.json({ error: 'Invalid type parameter' }, 400)
  }

  try {
    const r2 = c.env.BUCKET

    if (!r2) {
      return c.json({ error: 'R2 存储桶未配置' }, 500)
    }

    // 列出备份文件
    const prefix = type === 'actor'
      ? 'mappings/backups/actor-name-map-'
      : 'mappings/backups/publisher-name-map-'

    const listed = await r2.list({ prefix, limit: 50 })

    const versions = await Promise.all(
      listed.objects.map(async (obj: any) => {
        const file = await r2.get(obj.key)
        if (!file)
          return null

        const payload = await file.json() as { metadata?: any }

        return {
          key: obj.key,
          version: payload.metadata?.version || obj.uploaded.toISOString(),
          uploadedAt: payload.metadata?.uploadedAt || obj.uploaded.getTime(),
          totalEntries: payload.metadata?.totalEntries || 0,
          source: payload.metadata?.source || 'unknown',
          size: obj.size,
        }
      }),
    )

    return c.json({
      data: versions.filter((v: any) => v !== null).sort((a: any, b: any) => b!.uploadedAt - a!.uploadedAt),
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Crawlers/MappingVersions] ❌ Failed:', message)
    return c.json({ error: '获取版本历史失败' }, 500)
  }
})

export const adminCrawlersRoutes = adminCrawlers
