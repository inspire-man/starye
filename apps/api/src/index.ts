import type { AppEnv } from './types'
import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth'
import { corsMiddleware } from './middleware/cors'
import { databaseMiddleware } from './middleware/database'
import { errorHandler } from './middleware/error-handler'
import adminRoutes from './routes/admin'
import authRoutes from './routes/auth'
import comicsRoutes from './routes/comics'
import healthRoutes from './routes/health'
import uploadRoutes from './routes/upload'

const app = new Hono<AppEnv>()

// Global Middlewares
app.use('*', corsMiddleware())
app.use('*', databaseMiddleware())
app.use('*', authMiddleware())

// Global Error Handler
app.onError(errorHandler)

// Routes
app.get('/', c => c.text('Starye API'))
app.route('/api/health', healthRoutes)
app.route('/api/comics', comicsRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/upload', uploadRoutes)

export default app
export type AppType = typeof app
