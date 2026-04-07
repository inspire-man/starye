import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkUserAdultStatus } from '../services/auth.service'
import { getHotMovies, getMovieByIdentifier, getMovies } from '../services/movie.service'

export async function getMovieList(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const isAdult = checkUserAdultStatus(user)

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('limit')) || 24
  const genre = c.req.query('genre')
  const actor = c.req.query('actor')
  const publisher = c.req.query('publisher')
  const searchKeyword = c.req.query('search')
  const sortBy = c.req.query('sortBy') as 'releaseDate' | 'createdAt' | 'updatedAt' | 'title' | undefined
  const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined

  const result = await getMovies({
    db,
    isAdult,
    page,
    pageSize,
    genre,
    actor,
    publisher,
    searchKeyword,
    sortBy,
    sortOrder,
  })

  return c.json(result)
}

export async function getMovieDetail(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const identifier = c.req.param('identifier')!

  const isAdult = checkUserAdultStatus(user)
  const userId = user?.id

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
  const user = c.get('user')
  const isAdult = checkUserAdultStatus(user)

  const limit = Number(c.req.query('limit')) || 12

  const movies = await getHotMovies({
    db,
    isAdult,
    limit,
  })

  return c.json({ data: movies })
}
