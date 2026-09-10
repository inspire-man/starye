import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { requireAuth } from '../../middleware/guard'
import { serviceAuth } from '../../middleware/service-auth'
import { getActorDetail, getActorsList } from './handlers/actors.handler'
import { getHotMoviesList, getMovieDetail, getMovieList } from './handlers/movies.handler'
import { recordPlayerPlaybackFailure } from './handlers/player-playback-failure.handler'
import { reportPlayer } from './handlers/player-report.handler'
import { getPublisherDetail, getPublishersList } from './handlers/publishers.handler'
import { syncMovies } from './handlers/sync.handler'

export const moviesRoutes = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    c.header('Vary', 'Cookie')
    await next()
  })
  .get('/', getMovieList)
  .get('/featured/hot', getHotMoviesList)
  .get('/actors/list', getActorsList)
  .get('/actors/:slug', getActorDetail)
  .get('/publishers/list', getPublishersList)
  .get('/publishers/:slug', getPublisherDetail)
  .post('/sync', serviceAuth(), syncMovies)
  // 播放源上报失效（已登录用户）
  .post('/players/:id/report', requireAuth(), reportPlayer)
  .post('/players/:id/playback-failure', requireAuth(), recordPlayerPlaybackFailure)
  .get('/:identifier', getMovieDetail)
