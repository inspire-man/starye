import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { getActorBySlug, getActors } from '../services/actor.service'
import { checkUserAdultStatus } from '../services/auth.service'

export async function getActorsList(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const isAdult = checkUserAdultStatus(user)

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 50

  const result = await getActors({
    db,
    page,
    pageSize,
  })

  return c.json(result)
}

export async function getActorDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!
  const user = c.get('user')
  const isAdult = checkUserAdultStatus(user)

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 24

  const result = await getActorBySlug({
    db,
    slug,
    page,
    pageSize,
  })

  if (!result) {
    throw new HTTPException(404, { message: 'Actor not found' })
  }

  return c.json(result)
}
