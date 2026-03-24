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
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { canAccessCrawler } from '../../../lib/permissions'
import { serviceAuth } from '../../../middleware/service-auth'

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
  zValidator('json', z.object({
    type: z.enum(['comic', 'movie']),
  })),
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
  zValidator('json', z.object({
    type: z.enum(['comic', 'movie']),
  })),
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

export const adminCrawlersRoutes = adminCrawlers
