/* eslint-disable no-console */
/**
 * 演员管理 API 路由
 *
 * 提供演员 CRUD、搜索、合并等功能
 * 权限要求：admin 或 movie_admin
 */

import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { actors, movies } from '@starye/db/schema'
import { count, desc, eq, like } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { captureResourceState, createAuditLog } from '../middleware/audit-logger'
import { requireResource } from '../middleware/resource-guard'

const adminActors = new Hono<AppEnv>()

adminActors.use('/*', requireResource('movie'))

/**
 * GET /api/admin/actors
 * 演员列表（按作品数排序，支持搜索）
 */
adminActors.get(
  '/',
  zValidator('query', z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
  })),
  async (c) => {
    const { page, limit, search } = c.req.valid('query')
    const db = c.get('db')
    const offset = (page - 1) * limit

    try {
      const whereClause = search ? like(actors.name, `%${search}%`) : undefined

      const [results, totalResult] = await Promise.all([
        db.query.actors.findMany({
          where: whereClause,
          orderBy: desc(actors.movieCount),
          limit,
          offset,
        }),
        db
          .select({ value: count() })
          .from(actors)
          .where(whereClause)
          .then(res => res[0]?.value || 0),
      ])

      return c.json({
        data: results,
        meta: {
          total: totalResult,
          page,
          limit,
          totalPages: Math.ceil(totalResult / limit),
        },
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to query actors:', message)
      return c.json({ error: 'Database operation failed' }, 500)
    }
  },
)

/**
 * GET /api/admin/actors/:id
 * 演员详情（包含关联电影列表）
 */
adminActors.get('/:id', async (c) => {
  const actorId = c.req.param('id')
  const db = c.get('db')

  try {
    const actor = await db.query.actors.findFirst({
      where: eq(actors.id, actorId),
    })

    if (!actor) {
      return c.json({ error: 'Actor not found' }, 404)
    }

    const relatedMovies = await db.query.movies.findMany({
      where: like(movies.actors, `%${actor.name}%`),
      columns: {
        id: true,
        code: true,
        title: true,
        coverImage: true,
        releaseDate: true,
      },
      orderBy: desc(movies.releaseDate),
      limit: 100,
    })

    return c.json({
      ...actor,
      relatedMovies,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin/Actors] ❌ Failed to get actor ${actorId}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
})

/**
 * PATCH /api/admin/actors/:id
 * 编辑演员信息
 */
adminActors.patch(
  '/:id',
  zValidator('json', z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar: z.string().optional(),
    birthDate: z.string().optional(),
    height: z.number().optional(),
    measurements: z.string().optional(),
    nationality: z.string().optional(),
    socialLinks: z.record(z.string(), z.string()).optional(),
  })),
  async (c) => {
    const actorId = c.req.param('id')
    const data = c.req.valid('json')
    const db = c.get('db')

    try {
      const before = await captureResourceState(c, 'actor', actorId)

      if (!before) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      }

      if (data.birthDate) {
        updateData.birthDate = new Date(data.birthDate)
      }

      await db.update(actors)
        .set(updateData)
        .where(eq(actors.id, actorId))

      console.log(`[Admin/Actors] ✓ Updated actor ${actorId}`)
      return c.json({ success: true })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[Admin/Actors] ❌ Failed to update actor ${actorId}:`, message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/:id/avatar
 * 上传演员头像到 R2
 *
 * TODO: 实现 R2 上传逻辑
 */
adminActors.post('/:id/avatar', async (c) => {
  const _actorId = c.req.param('id')

  return c.json({
    error: 'R2 upload not implemented yet',
    todo: 'Implement R2 upload logic',
  }, 501)
})

/**
 * POST /api/admin/actors/merge
 * 合并重复演员
 */
adminActors.post(
  '/merge',
  zValidator('json', z.object({
    sourceId: z.string(),
    targetId: z.string(),
  })),
  async (c) => {
    const { sourceId, targetId } = c.req.valid('json')
    const db = c.get('db')

    try {
      const [sourceActor, targetActor] = await Promise.all([
        db.query.actors.findFirst({ where: eq(actors.id, sourceId) }),
        db.query.actors.findFirst({ where: eq(actors.id, targetId) }),
      ])

      if (!sourceActor || !targetActor) {
        return c.json({ error: 'Actor not found' }, 404)
      }

      const affectedMovies = await db.query.movies.findMany({
        where: like(movies.actors, `%${sourceActor.name}%`),
      })

      for (const movie of affectedMovies) {
        const actorList = (movie.actors as string[]) || []
        const updatedActors = actorList.map(name =>
          name === sourceActor.name ? targetActor.name : name,
        )

        await db.update(movies)
          .set({ actors: updatedActors, updatedAt: new Date() })
          .where(eq(movies.id, movie.id))
      }

      await db.update(actors)
        .set({
          movieCount: targetActor.movieCount + sourceActor.movieCount,
          updatedAt: new Date(),
        })
        .where(eq(actors.id, targetId))

      await db.delete(actors).where(eq(actors.id, sourceId))

      const mergeChanges: Record<string, any> = {
        operation: 'merge',
        sourceActor: sourceActor.name,
        targetActor: targetActor.name,
        affectedMovies: affectedMovies.length,
      }

      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'actor',
        resourceId: targetId,
        resourceIdentifier: targetActor.name,
        affectedCount: affectedMovies.length,
        changes: mergeChanges,
      })

      console.log(`[Admin/Actors] ✓ Merged ${sourceActor.name} into ${targetActor.name}, affected ${affectedMovies.length} movies`)

      return c.json({
        success: true,
        mergedCount: affectedMovies.length,
        targetName: targetActor.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to merge actors:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors
 * 创建新女优
 */
adminActors.post(
  '/',
  zValidator('json', z.object({
    name: z.string().min(1),
  })),
  async (c) => {
    const { name } = c.req.valid('json')
    const db = c.get('db')

    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-')

      const newActor = {
        id: crypto.randomUUID(),
        name,
        slug,
        source: 'manual',
        sourceId: slug,
        movieCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await db.insert(actors).values(newActor)

      await createAuditLog(c, {
        action: 'CREATE',
        resourceType: 'actor',
        resourceId: newActor.id,
        resourceIdentifier: name,
        changes: { name },
      })

      console.log(`[Admin/Actors] ✓ Created actor: ${name}`)

      return c.json({
        id: newActor.id,
        name: newActor.name,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to create actor:', message)
      return c.json({ error: message }, 500)
    }
  },
)

/**
 * POST /api/admin/actors/batch-recrawl
 * 批量标记演员为待重新爬取
 * 重置 crawlFailureCount 和 hasDetailsCrawled，下次爬虫运行时会重新尝试
 */
adminActors.post(
  '/batch-recrawl',
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100),
  })),
  async (c) => {
    const { ids } = c.req.valid('json')
    const db = c.get('db')

    try {
      let successCount = 0

      for (const id of ids) {
        const actor = await db.query.actors.findFirst({
          where: eq(actors.id, id),
        })

        if (!actor) {
          console.warn(`[Admin/Actors] ⚠️ Actor not found: ${id}`)
          continue
        }

        await db
          .update(actors)
          .set({
            hasDetailsCrawled: false,
            crawlFailureCount: 0,
            lastCrawlAttempt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actors.id, id))

        await createAuditLog(c, {
          action: 'UPDATE',
          resourceType: 'actor',
          resourceId: id,
          resourceIdentifier: actor.name,
          changes: { action: 'mark_for_recrawl' },
        })

        successCount++
      }

      console.log(`[Admin/Actors] ✓ Marked ${successCount}/${ids.length} actors for recrawl`)

      return c.json({
        success: true,
        total: ids.length,
        marked: successCount,
        message: `已标记 ${successCount} 个演员为待重新爬取`,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Admin/Actors] ❌ Failed to batch recrawl:', message)
      return c.json({ error: message }, 500)
    }
  },
)

export default adminActors
