import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkUserAdultStatus } from '../services/auth.service'
import { getComicBySlug, getComics } from '../services/comic.service'

/**
 * GET /comics - 获取漫画列表
 */
export async function getComicList(c: Context<AppEnv>) {
  const db = c.get('db')
  const isAdult = await checkUserAdultStatus(c)

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 20
  const region = c.req.query('region')
  const genre = c.req.query('genre')
  const status = c.req.query('status') as 'serializing' | 'completed' | undefined

  const result = await getComics({
    db,
    isAdult,
    page,
    pageSize: limit,
    region,
    genre,
    status,
  })

  return c.json(result)
}

/**
 * GET /comics/:slug - 获取漫画详情
 */
export async function getComicDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!
  const isAdult = await checkUserAdultStatus(c)

  const comic = await getComicBySlug({ db, slug, isAdult })

  if (!comic) {
    throw new HTTPException(404, { message: 'Comic not found' })
  }

  return c.json({ data: comic })
}
