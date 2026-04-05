import type { AppEnv } from './types'
import { Scalar } from '@scalar/hono-api-reference'
import { Hono } from 'hono'
import { openAPIRouteHandler } from 'hono-openapi'
import { etag } from 'hono/etag'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { timeout } from 'hono/timeout'
import { timing } from 'hono/timing'
import { authMiddleware } from './middleware/auth'
import { corsMiddleware } from './middleware/cors'
import { databaseMiddleware } from './middleware/database'
import { errorHandler } from './middleware/error-handler'
import { actorsRoutes } from './routes/actors'
import adminMainRoutes from './routes/admin/main'
import aria2Routes from './routes/aria2'
import { authRoutes } from './routes/auth'
import { comicsRoutes } from './routes/comics'
import { favoritesRoutes } from './routes/favorites'
import featureFlagsRouter from './routes/feature-flags'
import feedbackRouter from './routes/feedback'
import { healthRoutes } from './routes/health'
import monitoringRouter from './routes/monitoring'
import { moviesRoutes } from './routes/movies'
import { postsRoutes } from './routes/posts'
import { publicComicsRoutes } from './routes/public/comics'
import { publicMoviesRoutes } from './routes/public/movies'
import { publicProgressRoutes } from './routes/public/progress'
import { publicSearchRoutes } from './routes/public/search'
import { publicSeriesRoutes } from './routes/public/series'
import { publicSettingsRoutes } from './routes/public/settings'
import { publishersRoutes } from './routes/publishers'
import ratingsRoutes from './routes/ratings'
import { uploadRoutes } from './routes/upload'

const app = new Hono<AppEnv>()

// Global Middlewares - Production-grade stack
app.use('*', requestId()) // 1️⃣ 请求追踪
app.use('*', logger()) // 2️⃣ 结构化日志
app.use('*', timing()) // 3️⃣ 性能指标
app.use('*', secureHeaders()) // 4️⃣ 安全头部
// Cloudflare Workers 自动压缩响应，无需 compress 中间件
// 参考: https://hono.dev/docs/middleware/builtin/compress
app.use('*', timeout(30000)) // 5️⃣ 超时控制 (30s)
app.use('*', corsMiddleware()) // 7️⃣ CORS 策略
app.use('*', databaseMiddleware()) // 8️⃣ 数据库连接
app.use('*', authMiddleware()) // 9️⃣ 认证会话
app.use('*', etag()) // 🔟 ETag 缓存

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
  .route('/api/favorites', favoritesRoutes)
  .route('/api/ratings', ratingsRoutes)
  .route('/api/aria2', aria2Routes)
  .route('/api/feedback', feedbackRouter)
  .route('/api/feature-flags', featureFlagsRouter)
  .route('/api/monitoring', monitoringRouter)
  .route('/api/admin', adminMainRoutes)
  .route('/api/auth', authRoutes)
  .route('/api/upload', uploadRoutes)
  // 公开 API
  .route('/api/public/comics', publicComicsRoutes)
  .route('/api/public/movies', publicMoviesRoutes)
  .route('/api/public/progress', publicProgressRoutes)
  .route('/api/public/settings', publicSettingsRoutes)
  .route('/api/series', publicSeriesRoutes)
  .route('/api/search', publicSearchRoutes)
  // OpenAPI 文档
  .get(
    '/api/openapi.json',
    openAPIRouteHandler(app, {
      documentation: {
        openapi: '3.0.0',
        info: {
          title: 'Starye API',
          version: '1.0.0',
          description: `
Starye 是一个现代化的内容聚合平台，支持漫画、电影和演员信息的管理与浏览。

## 功能特性
- 🎬 电影与漫画内容管理
- 👤 演员信息与关联
- 📖 阅读进度追踪
- 🔒 基于 Better Auth 的认证系统
- 🚀 高性能 Edge Runtime
          `.trim(),
          contact: {
            name: 'Starye Team',
            url: 'https://github.com/your-org/starye',
          },
        },
        servers: [
          {
            url: 'http://localhost:8787',
            description: '本地开发环境',
          },
          {
            url: 'https://api.starye.com',
            description: '生产环境',
          },
        ],
        tags: [
          {
            name: 'Comics',
            description: '漫画相关接口',
          },
          {
            name: 'Movies',
            description: '电影相关接口',
          },
          {
            name: 'Actors',
            description: '演员相关接口',
          },
          {
            name: 'Publishers',
            description: '出版商相关接口',
          },
          {
            name: 'Progress',
            description: '用户进度追踪',
          },
          {
            name: 'Favorites',
            description: '用户收藏',
          },
          {
            name: 'Admin',
            description: '管理后台接口（需要认证）',
          },
          {
            name: 'Auth',
            description: '认证与授权',
          },
          {
            name: 'Upload',
            description: '文件上传',
          },
          {
            name: 'Health',
            description: '健康检查',
          },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'better-auth.session_token',
              description: 'Better Auth 会话 token（自动管理）',
            },
          },
        },
      },
    }),
  )
  // Scalar UI 文档页面
  .get(
    '/api/docs',
    Scalar({
      url: '/api/openapi.json',
      theme: 'moon',
      darkMode: true,
      searchHotKey: 'k',
      defaultOpenAllTags: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      authentication: {
        preferredSecurityScheme: 'cookieAuth',
      },
      pageTitle: 'Starye API Documentation',
      customCss: `
        :root {
          --scalar-color-accent: #6366f1;
          --scalar-color-1: #1e293b;
          --scalar-color-2: #0f172a;
        }
      `,
      // sources: [
      //   { url: '/', title: 'API' },
      //   { url: '/api/auth/open-api/generate-schema', title: 'Auth' },
      // ],
    }),
  )

export default routes
// Export the routes type for RPC, not the app type
export type AppType = typeof routes
