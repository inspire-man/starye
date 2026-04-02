import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { addFavorite, checkFavorite, deleteFavorite, getFavorites } from '../services/favorite.service'

/**
 * GET /favorites - 获取收藏列表
 */
export async function getFavoriteList(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const entityType = c.req.query('entityType') as 'actor' | 'publisher' | 'movie' | 'comic' | undefined

  try {
    const result = await getFavorites({
      db,
      userId: user.id,
      page,
      pageSize: limit,
      entityType,
    })

    return c.json({
      success: true,
      ...result,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Favorites] ❌ Failed to get favorites:', message)
    return c.json({ error: 'Failed to get favorites' }, 500)
  }
}

/**
 * POST /favorites - 添加收藏
 */
export async function addFavoriteHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const body = await c.req.json() as { entityType: 'actor' | 'publisher' | 'movie' | 'comic', entityId: string }

  try {
    const result = await addFavorite({
      db,
      userId: user.id,
      entityType: body.entityType,
      entityId: body.entityId,
    })

    return c.json(result)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Favorites] ❌ Failed to add favorite:', message)
    return c.json({ error: 'Failed to add favorite' }, 500)
  }
}

/**
 * DELETE /favorites/:id - 删除收藏
 */
export async function deleteFavoriteHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const favoriteId = c.req.param('id')!

  try {
    const result = await deleteFavorite({
      db,
      userId: user.id,
      favoriteId,
    })

    if (!result.success) {
      throw new HTTPException(404, { message: result.error || 'Not found' })
    }

    return c.json(result)
  }
  catch (e: unknown) {
    if (e instanceof HTTPException) {
      throw e
    }
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Favorites] ❌ Failed to delete favorite:', message)
    return c.json({ error: 'Failed to delete favorite' }, 500)
  }
}

/**
 * GET /favorites/check/:entityType/:entityId - 检查是否已收藏
 */
export async function checkFavoriteHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const entityType = c.req.param('entityType') as 'actor' | 'publisher' | 'movie' | 'comic'
  const entityId = c.req.param('entityId')!

  try {
    const result = await checkFavorite({
      db,
      userId: user.id,
      entityType,
      entityId,
    })

    return c.json({
      success: true,
      data: result,
    })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Favorites] ❌ Failed to check favorite:', message)
    return c.json({ error: 'Failed to check favorite' }, 500)
  }
}
