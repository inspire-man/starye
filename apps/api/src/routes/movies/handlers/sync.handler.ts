import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { syncMovieData } from '../services/sync.service'

export async function syncMovies(c: Context<AppEnv>) {
  const db = c.get('db')
  const body = await c.req.json()

  // 验证请求体
  if (!Array.isArray(body.movies) || body.movies.length === 0) {
    throw new HTTPException(400, { message: 'Invalid request: movies array is required' })
  }

  // 调用 service 层同步数据
  const result = await syncMovieData({
    db,
    movies: body.movies,
    mode: body.mode || 'upsert',
  })

  return c.json({
    message: 'Sync completed',
    result,
  })
}
