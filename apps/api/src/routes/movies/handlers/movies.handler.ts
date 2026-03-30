import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkUserAdultStatus } from '../services/auth.service'
import { getHotMovies, getMovieByIdentifier, getMovies } from '../services/movie.service'

export async function getMovieList(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  const isAdult = await checkUserAdultStatus({
    auth,
    headers: c.req.raw.headers,
  })

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 24
  const genre = c.req.query('genre')
  const actor = c.req.query('actor')
  const publisherId = c.req.query('publisherId')
  const searchKeyword = c.req.query('search')

  const result = await getMovies({
    db,
    isAdult,
    page,
    pageSize,
    genre,
    actor,
    publisherId,
    searchKeyword,
  })

  return c.json(result)
}

export async function getMovieDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')
  const identifier = c.req.param('identifier')!

  const isAdult = await checkUserAdultStatus({
    auth,
    headers: c.req.raw.headers,
  })

  // 获取当前用户 ID（用于查询用户评分）
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const userId = session?.user?.id

  const movie = await getMovieByIdentifier({
    db,
    identifier,
    isAdult,
    userId,
  })

  if (!movie) {
    throw new HTTPException(404, { message: 'Movie not found' })
  }

  return c.json({ data: movie })
}

export async function getHotMoviesList(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  const isAdult = await checkUserAdultStatus({
    auth,
    headers: c.req.raw.headers,
  })

  const limit = Number(c.req.query('limit')) || 12

  const movies = await getHotMovies({
    db,
    isAdult,
    limit,
  })

  return c.json({ data: movies })
}
