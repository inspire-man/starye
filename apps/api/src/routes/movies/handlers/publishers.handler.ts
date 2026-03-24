import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkUserAdultStatus } from '../services/auth.service'
import { getPublisherBySlug, getPublishers } from '../services/publisher.service'

export async function getPublishersList(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  const isAdult = await checkUserAdultStatus({
    auth,
    headers: c.req.raw.headers,
  })

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 50

  const result = await getPublishers({
    db,
    page,
    pageSize,
  })

  return c.json(result)
}

export async function getPublisherDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')
  const slug = c.req.param('slug')!

  const isAdult = await checkUserAdultStatus({
    auth,
    headers: c.req.raw.headers,
  })

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 24

  const result = await getPublisherBySlug({
    db,
    slug,
    page,
    pageSize,
  })

  if (!result) {
    throw new HTTPException(404, { message: 'Publisher not found' })
  }

  return c.json(result)
}
