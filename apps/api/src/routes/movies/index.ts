import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { serviceAuth } from '../../middleware/service-auth'
import { getActorDetail, getActorsList } from './handlers/actors.handler'
import { getHotMoviesList, getMovieDetail, getMovieList } from './handlers/movies.handler'
import { getPublisherDetail, getPublishersList } from './handlers/publishers.handler'
import { syncMovies } from './handlers/sync.handler'

export const moviesRoutes = new Hono<AppEnv>()
  .get('/', getMovieList)
  .get('/featured/hot', getHotMoviesList)
  .get('/actors/list', getActorsList)
  .get('/actors/:slug', getActorDetail)
  .get('/publishers/list', getPublishersList)
  .get('/publishers/:slug', getPublisherDetail)
  .post('/sync', serviceAuth(), syncMovies)
  .get('/:identifier', getMovieDetail)
