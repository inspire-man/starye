import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { getActorBySlug, getActorRelations, getActors } from '../services/actor.service'
import { checkUserAdultStatus } from '../services/auth.service'

/**
 * GET /actors - 获取女优列表
 */
export async function getActorList(c: Context<AppEnv>) {
  const db = c.get('db')

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const sort = (c.req.query('sort') as 'name' | 'movieCount' | 'createdAt') || 'name'
  const nationality = c.req.query('nationality')
  const isActive = c.req.query('isActive') !== undefined ? c.req.query('isActive') === 'true' : undefined
  const hasDetails = c.req.query('hasDetails') !== undefined ? c.req.query('hasDetails') === 'true' : undefined

  try {
    const result = await getActors({
      db,
      page,
      pageSize: limit,
      sort,
      nationality,
      isActive,
      hasDetails,
    })

    return c.json(result)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Actors] ❌ Failed to query actors:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}

/**
 * GET /actors/:slug - 获取女优详情
 */
export async function getActorDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!

  // R18 权限校验
  const isAdult = await checkUserAdultStatus(c)
  if (!isAdult) {
    return c.json({ error: 'Adult verification required' }, 403)
  }

  try {
    const actor = await getActorBySlug({ db, slug })

    if (!actor) {
      throw new HTTPException(404, { message: 'Actor not found' })
    }

    return c.json(actor)
  }
  catch (e: unknown) {
    if (e instanceof HTTPException) {
      throw e
    }
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Actors] ❌ Failed to get actor ${slug}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}

/**
 * GET /actors/:id/relations - 获取女优合作关系
 */
export async function getActorRelationsHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const actorId = c.req.param('id')!
  const minCollaborations = Number(c.req.query('minCollaborations')) || 3
  const limit = Number(c.req.query('limit')) || 20

  // R18 权限校验
  const isAdult = await checkUserAdultStatus(c)
  if (!isAdult) {
    return c.json({ error: 'Adult verification required' }, 403)
  }

  try {
    const relations = await getActorRelations({
      db,
      actorId,
      minCollaborations,
      limit,
    })

    return c.json({
      success: true,
      data: {
        actorId,
        relations,
        meta: {
          totalPartners: relations.length,
          minCollaborations,
        },
      },
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Actors] ❌ Failed to get relations for ${actorId}:`, message)
    return c.json({ error: 'Failed to get actor relations' }, 500)
  }
}
