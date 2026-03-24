import type { AppEnv } from './types'
import { Hono } from 'hono'
import { corsMiddleware } from './middleware/cors'
import { databaseMiddleware } from './middleware/database'
import { errorHandler } from './middleware/error-handler'
import { actorsRoutes } from './routes/actors'
import { adminMainRoutes } from './routes/admin/main'
import { authRoutes } from './routes/auth'
import { comicsRoutes } from './routes/comics'
import { healthRoutes } from './routes/health'
import { moviesRoutes } from './routes/movies'
import { postsRoutes } from './routes/posts'
import { publicComicsRoutes } from './routes/public/comics'
import { publicMoviesRoutes } from './routes/public/movies'
import { publicProgressRoutes } from './routes/public/progress'
import { publishersRoutes } from './routes/publishers'
import { uploadRoutes } from './routes/upload'

const app = new Hono<AppEnv>()

// Global Middlewares
app.use('*', corsMiddleware())
app.use('*', databaseMiddleware())

// Global Error Handler
app.onError(errorHandler)

// Routes - Chain all route registrations for RPC type inference
const routes = app
  .get('/', c => c.text('Starye API'))
  .route('/api/health', healthRoutes)
  .route('/api/actors', actorsRoutes)
  .route('/api/publishers', publishersRoutes)
  .route('/api/comics', comicsRoutes)
  .route('/api/movies', moviesRoutes)
  .route('/api/posts', postsRoutes)
  .route('/api/admin', adminMainRoutes)
  .route('/api/auth', authRoutes)
  .route('/api/upload', uploadRoutes)
  // 公开 API
  .route('/api/public/comics', publicComicsRoutes)
  .route('/api/public/movies', publicMoviesRoutes)
  .route('/api/public/progress', publicProgressRoutes)

export default routes
// Export the routes type for RPC, not the app type
export type AppType = typeof routes
