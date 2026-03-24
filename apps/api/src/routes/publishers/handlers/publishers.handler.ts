import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkUserAdultStatus } from '../services/auth.service'
import { getPublisherBySlug, getPublishers } from '../services/publisher.service'

/**
 * GET /publishers - 获取厂商列表
 */
export async function getPublisherList(c: Context<AppEnv>) {
  const db = c.get('db')

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const sort = (c.req.query('sort') as 'name' | 'movieCount' | 'createdAt') || 'name'
  const country = c.req.query('country')
  const hasDetails = c.req.query('hasDetails') !== undefined ? c.req.query('hasDetails') === 'true' : undefined

  try {
    const result = await getPublishers({
      db,
      page,
      pageSize: limit,
      sort,
      country,
      hasDetails,
    })

    return c.json(result)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Publishers] ❌ Failed to query publishers:', message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}

/**
 * GET /publishers/:slug - 获取厂商详情
 */
export async function getPublisherDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!

  // R18 权限校验
  const isAdult = await checkUserAdultStatus(c)
  if (!isAdult) {
    return c.json({ error: 'Adult verification required' }, 403)
  }

  try {
    const publisher = await getPublisherBySlug({ db, slug })

    if (!publisher) {
      throw new HTTPException(404, { message: 'Publisher not found' })
    }

    return c.json(publisher)
  }
  catch (e: unknown) {
    if (e instanceof HTTPException) {
      throw e
    }
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Publishers] ❌ Failed to get publisher ${slug}:`, message)
    return c.json({ error: 'Database operation failed' }, 500)
  }
}
