# Hono API 健壮性增强 - 技术设计

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                 请求处理流程                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  HTTP 请求                                           │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 层级 1: 基础中间件 (Foundation)            │     │
│  │  requestId → logger → timing               │     │
│  │  → secureHeaders → compress → timeout      │     │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 层级 2: 业务中间件 (Business)              │     │
│  │  cors → database → auth                    │     │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 层级 3: 缓存层 (Cache)                     │     │
│  │  etag / Cloudflare Cache (可选)           │     │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 层级 4: 路由授权 (Authorization)           │     │
│  │  requireAuth / requireRole / requireResource│    │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 层级 5: 业务处理 (Handler)                 │     │
│  │  路由处理器                                │     │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  ┌────────────────────────────────────────────┐     │
│  │ 错误处理器 (Error Handler)                 │     │
│  │  分层错误处理 → JSON 响应                  │     │
│  └────────────────────────────────────────────┘     │
│     ↓                                                │
│  HTTP 响应                                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 阶段 1: 认证流程优化

### 问题分析

**当前实现:**
```typescript
// apps/api/src/routes/ratings/handlers/rating.handler.ts
export async function submitPlayerRating(c: Context<AppEnv>) {
  const auth = c.get('auth')
  // ❌ 每个 handler 都调用一次
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }
  // ...
}

export async function getUserRatings(c: Context<AppEnv>) {
  const auth = c.get('auth')
  // ❌ 又调用一次
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }
  // ...
}
```

**数据流分析:**
```
请求进入
  ↓
Handler 1: auth.api.getSession() → DB 查询
  ↓
Handler 2: auth.api.getSession() → DB 查询  ← 重复!
  ↓
Handler 3: auth.api.getSession() → DB 查询  ← 重复!
```

### 设计方案

#### 1.1 全局认证中间件

**文件:** `apps/api/src/middleware/auth.ts`

```typescript
import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { createAuth } from '../lib/auth'

export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    // 创建 auth 实例
    const auth = createAuth(c.env, c.req.raw)
    c.set('auth', auth)

    // 🔑 关键改进: 尝试获取 session 并存入 context
    try {
      const session = await auth.api.getSession({ 
        headers: c.req.raw.headers 
      })
      
      if (session) {
        // 注入 user 和 session
        c.set('user', session.user as unknown as SessionUser)
        c.set('session', session)
      }
    } catch (error) {
      // 未登录或 token 无效是正常情况，不抛出异常
      // 让后续的 requireAuth() 中间件处理
    }

    await next()
  })
}
```

#### 1.2 注册全局中间件

**文件:** `apps/api/src/index.ts`

```typescript
// 修改前
app.use('*', corsMiddleware())
app.use('*', databaseMiddleware())

// 修改后
app.use('*', corsMiddleware())
app.use('*', databaseMiddleware())
app.use('*', authMiddleware())  // ← 新增
```

#### 1.3 简化 Handler 逻辑

**修改前:**
```typescript
export async function submitPlayerRating(c: Context<AppEnv>) {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }
  const userId = session.user.id
  // ...
}
```

**修改后 (方案 A - 手动检查):**
```typescript
export async function submitPlayerRating(c: Context<AppEnv>) {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '请先登录' })
  }
  const userId = user.id
  // ...
}
```

**修改后 (方案 B - 中间件检查，推荐):**
```typescript
// 路由定义
ratingsRoutes.use('/', requireAuth())
ratingsRoutes.post('/', submitPlayerRating)

// Handler 直接使用
export async function submitPlayerRating(c: Context<AppEnv>) {
  const user = c.get('user')!  // 类型断言: requireAuth 已确保存在
  const userId = user.id
  // ...
}
```

### 性能收益分析

```
优化前:
  请求 → Handler 1 → getSession() → DB (50ms)
      → Handler 2 → getSession() → DB (50ms)
      → Handler 3 → getSession() → DB (50ms)
  总计: 150ms

优化后:
  请求 → authMiddleware() → getSession() → DB (50ms)
      → Handler 1 (直接读取)
      → Handler 2 (直接读取)
      → Handler 3 (直接读取)
  总计: 50ms

性能提升: 66.7%
```

## 阶段 2: Hono 官方中间件集成

### 中间件栈设计

```typescript
// apps/api/src/index.ts
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { timing } from 'hono/timing'
import { secureHeaders } from 'hono/secure-headers'
import { compress } from 'hono/compress'
import { etag } from 'hono/etag'
import { timeout } from 'hono/timeout'

const app = new Hono<AppEnv>()

// 🎯 中间件执行顺序很重要!
app.use('*', requestId())        // 1️⃣ 生成请求 ID
app.use('*', logger())           // 2️⃣ 记录日志
app.use('*', timing())           // 3️⃣ 性能追踪
app.use('*', secureHeaders())    // 4️⃣ 安全头部
app.use('*', compress())         // 5️⃣ 压缩响应
app.use('*', timeout(30000))     // 6️⃣ 超时控制
app.use('*', corsMiddleware())   // 7️⃣ CORS
app.use('*', databaseMiddleware())  // 8️⃣ 数据库
app.use('*', authMiddleware())   // 9️⃣ 认证
app.use('*', etag())            // 🔟 ETag (必须在 compress 之后)
```

### 各中间件功能详解

#### 2.1 Request ID 中间件

**作用:** 为每个请求生成唯一 ID，用于日志关联和错误追踪

**响应头:**
```
X-Request-Id: req_abc123def456
```

**使用:**
```typescript
// 在 handler 中获取
const requestId = c.get('requestId')

// 在错误处理器中使用
console.error('[Error]', {
  requestId,
  error: err.message,
})
```

#### 2.2 Logger 中间件

**作用:** 结构化日志输出

**日志格式:**
```
[2026-04-01 10:30:15] GET /api/movies 200 45ms
[2026-04-01 10:30:16] POST /api/ratings 201 120ms
```

**Cloudflare Workers 集成:**
```typescript
// 日志自动发送到 Cloudflare Logpush
```

#### 2.3 Timing 中间件

**作用:** 添加 Server-Timing 头，前端可以读取性能指标

**响应头:**
```
Server-Timing: total;dur=45.2, db;dur=12.3, cache;dur=0.5
```

**前端使用:**
```typescript
// 前端可以读取
performance.getEntriesByType('navigation')[0].serverTiming
```

#### 2.4 Secure Headers 中间件

**作用:** 自动添加安全相关的 HTTP 头

**添加的头部:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

#### 2.5 Compress 中间件

**作用:** 自动压缩响应体 (gzip/brotli)

**配置:**
```typescript
compress({
  encoding: 'gzip', // 或 'br' (brotli)
  threshold: 1024,  // 仅压缩 > 1KB 的响应
})
```

**效果:**
```
压缩前: Content-Length: 52341 (51KB)
压缩后: Content-Length: 12458 (12KB)
压缩率: 76%
```

#### 2.6 Timeout 中间件

**作用:** 防止长时间运行的请求

**配置:**
```typescript
timeout(30000) // 30 秒超时
```

**超时响应:**
```json
{
  "success": false,
  "error": "Request timeout",
  "code": "TIMEOUT"
}
```

#### 2.7 ETag 中间件

**作用:** 自动生成 ETag，支持 304 Not Modified

**流程:**
```
客户端第一次请求:
  ← ETag: "abc123"
  ← 完整响应 (200)

客户端再次请求:
  → If-None-Match: "abc123"
  ← 304 Not Modified (无响应体)
```

## 阶段 3: 分层错误处理

### 错误类型分析

```
错误类型树:
├─ Valibot 验证错误 (400)
│  └─ 字段级别错误详情
├─ Better Auth 错误 (401)
│  ├─ Session 过期
│  ├─ Token 无效
│  └─ OAuth 错误
├─ Drizzle 数据库错误 (500)
│  ├─ 约束冲突
│  ├─ 查询超时
│  └─ 连接失败
├─ Hono HTTP 异常 (自定义)
│  ├─ 401 Unauthorized
│  ├─ 403 Forbidden
│  ├─ 404 Not Found
│  └─ 429 Too Many Requests
└─ 未知错误 (500)
   └─ 应急处理 + 日志记录
```

### 错误处理器实现

**文件:** `apps/api/src/middleware/error-handler.ts`

```typescript
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { HTTPException } from 'hono/http-exception'

interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
  requestId?: string
  timestamp: string
}

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId')
  
  const baseResponse: ErrorResponse = {
    success: false,
    error: 'Unknown error',
    requestId,
    timestamp: new Date().toISOString(),
  }

  // 1️⃣ Valibot 验证错误
  if (err.name === 'ValiError' || err.constructor.name === 'ValiError') {
    console.warn('[Validation Error]', {
      requestId,
      path: c.req.path,
      method: c.req.method,
    })
    
    return c.json({
      ...baseResponse,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: (err as any).issues?.map((issue: any) => ({
        path: issue.path?.map((p: any) => p.key).join('.'),
        message: issue.message,
        expected: issue.expected,
        received: issue.received,
      })),
    }, 400)
  }

  // 2️⃣ Better Auth 错误
  if (err.message?.includes('BETTER_AUTH') || 
      err.message?.includes('session') ||
      err.message?.includes('Unauthorized')) {
    console.warn('[Auth Error]', {
      requestId,
      message: err.message,
      path: c.req.path,
    })
    
    return c.json({
      ...baseResponse,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    }, 401)
  }

  // 3️⃣ Drizzle 数据库错误
  if (err.message?.includes('SQLITE') || 
      err.message?.includes('D1_ERROR') ||
      err.message?.includes('UNIQUE constraint')) {
    console.error('[Database Error]', {
      requestId,
      message: err.message,
      stack: err.stack,
      path: c.req.path,
    })
    
    // 区分约束冲突和其他数据库错误
    if (err.message?.includes('UNIQUE constraint')) {
      return c.json({
        ...baseResponse,
        error: 'Resource already exists',
        code: 'DUPLICATE_ERROR',
      }, 409)
    }
    
    return c.json({
      ...baseResponse,
      error: 'Database operation failed',
      code: 'DATABASE_ERROR',
    }, 500)
  }

  // 4️⃣ Hono HTTP 异常
  if (err instanceof HTTPException) {
    return c.json({
      ...baseResponse,
      error: err.message,
      code: 'HTTP_EXCEPTION',
    }, err.status)
  }

  // 5️⃣ 未知错误
  console.error('[Unhandled Error]', {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

  return c.json({
    ...baseResponse,
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  }, 500)
}
```

### 错误响应示例

**验证错误:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": "body.score",
      "message": "Expected number >= 1, received 0",
      "expected": "number>=1",
      "received": "0"
    }
  ],
  "requestId": "req_abc123",
  "timestamp": "2026-04-01T10:30:15.123Z"
}
```

**认证错误:**
```json
{
  "success": false,
  "error": "Authentication failed",
  "code": "AUTH_ERROR",
  "requestId": "req_abc123",
  "timestamp": "2026-04-01T10:30:15.123Z"
}
```

## 阶段 4: Admin 路由模块化

### 重构策略

#### 4.1 目录结构

```
apps/api/src/routes/admin/
├── index.ts                 # 20 行 - 路由组装
├── users/
│   ├── index.ts            # 路由定义
│   ├── handlers.ts         # 处理函数
│   └── services.ts         # 业务逻辑
├── comics/
│   ├── index.ts
│   ├── handlers.ts
│   └── services.ts
├── chapters/
│   ├── index.ts
│   └── handlers.ts
├── sync/
│   ├── index.ts
│   ├── movie.handler.ts
│   └── manga.handler.ts
└── stats/
    ├── index.ts
    └── handlers.ts
```

#### 4.2 主入口文件

**文件:** `apps/api/src/routes/admin/index.ts`

```typescript
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { serviceAuth } from '../../middleware/service-auth'

// 导入子路由
import { usersRoutes } from './users'
import { comicsRoutes } from './comics'
import { chaptersRoutes } from './chapters'
import { syncRoutes } from './sync'
import { statsRoutes } from './stats'
import { adminActorsRoutes } from './actors'
import { adminPublishersRoutes } from './publishers'
import { adminAuditLogsRoutes } from './audit-logs'
import { adminR18WhitelistRoutes } from './r18-whitelist'
import { adminCacheRoutes } from './cache'
import { adminMoviesRoutes } from './movies'
import { adminCrawlersRoutes } from './crawlers'

const admin = new Hono<AppEnv>()

// 全局管理员认证
admin.use('*', serviceAuth(['admin']))

// 挂载子路由
admin.route('/users', usersRoutes)
admin.route('/comics', comicsRoutes)
admin.route('/chapters', chaptersRoutes)
admin.route('/sync', syncRoutes)
admin.route('/stats', statsRoutes)
admin.route('/movies', adminMoviesRoutes)
admin.route('/actors', adminActorsRoutes)
admin.route('/publishers', adminPublishersRoutes)
admin.route('/crawlers', adminCrawlersRoutes)
admin.route('/audit-logs', adminAuditLogsRoutes)
admin.route('/r18-whitelist', adminR18WhitelistRoutes)
admin.route('/cache', adminCacheRoutes)

export const adminMainRoutes = admin
```

#### 4.3 模块示例 - Users

**文件:** `apps/api/src/routes/admin/users/index.ts`

```typescript
import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { describeRoute, validator } from 'hono-openapi'
import { UpdateUserRoleSchema, UpdateUserStatusSchema } from '../../../schemas/admin'
import { getUserList, updateUserRole, updateUserStatus } from './handlers'

export const usersRoutes = new Hono<AppEnv>()
  .get('/', describeRoute({
    summary: '获取用户列表',
    tags: ['Admin'],
  }), getUserList)
  
  .patch('/:email/role', describeRoute({
    summary: '更新用户角色',
    tags: ['Admin'],
  }), validator('json', UpdateUserRoleSchema), updateUserRole)
  
  .patch('/:email/status', describeRoute({
    summary: '更新用户状态',
    tags: ['Admin'],
  }), validator('json', UpdateUserStatusSchema), updateUserStatus)
```

**文件:** `apps/api/src/routes/admin/users/handlers.ts`

```typescript
import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import * as services from './services'

export async function getUserList(c: Context<AppEnv>) {
  const db = c.get('db')
  const users = await services.fetchUsers(db)
  return c.json(users)
}

export async function updateUserRole(c: Context<AppEnv>) {
  const db = c.get('db')
  const email = c.req.param('email')
  const { role } = c.req.valid('json')
  
  const result = await services.updateRole(db, email, role)
  
  if (!result) {
    return c.json({ success: false, error: 'User not found' }, 404)
  }
  
  return c.json({ success: true, user: result })
}

export async function updateUserStatus(c: Context<AppEnv>) {
  const db = c.get('db')
  const email = c.req.param('email')
  const { isAdult } = c.req.valid('json')
  
  await services.updateStatus(db, email, isAdult)
  return c.json({ success: true })
}
```

**文件:** `apps/api/src/routes/admin/users/services.ts`

```typescript
import type { Database } from '@starye/db'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'

export async function fetchUsers(db: Database) {
  return await db.query.user.findMany({
    orderBy: (user, { desc }) => [desc(user.createdAt)],
    limit: 100,
  })
}

export async function updateRole(
  db: Database, 
  email: string, 
  role: string
) {
  const result = await db.update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email, role: user.role })
  
  return result[0] || null
}

export async function updateStatus(
  db: Database,
  email: string,
  isAdult: boolean
) {
  await db.update(user)
    .set({ isAdult, updatedAt: new Date() })
    .where(eq(user.email, email))
}
```

## 阶段 5: Cloudflare Cache API 集成

### 缓存架构

```
┌──────────────────────────────────────────────────┐
│              三层缓存架构                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  Layer 1: Cloudflare Cache (Edge Network)       │
│  ┌────────────────────────────────────────┐     │
│  │ - 公开列表 (电影、女优、厂商)          │     │
│  │ - 统计数据 (热门、趋势)                │     │
│  │ - TTL: 1-5 分钟                        │     │
│  │ - 全球 200+ 数据中心共享               │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Layer 2: KV Namespace (Persistent)             │
│  ┌────────────────────────────────────────┐     │
│  │ - 用户配置 (Aria2 设置)                │     │
│  │ - Feature Flags                        │     │
│  │ - TTL: 10-60 分钟                      │     │
│  │ - 持久化存储                            │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Layer 3: Memory Cache (Hot Data)               │
│  ┌────────────────────────────────────────┐     │
│  │ - 评分数据                              │     │
│  │ - 临时会话                              │     │
│  │ - TTL: 1-2 分钟                        │     │
│  │ - Worker 实例本地                       │     │
│  └────────────────────────────────────────┘     │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 实现方案

#### 5.1 创建缓存中间件

**文件:** `apps/api/src/middleware/cache.ts`

```typescript
import { cache } from 'hono/cache'

/**
 * 公开内容边缘缓存 (1 分钟)
 */
export const publicCache = cache({
  cacheName: 'starye-api-public',
  cacheControl: 'public, max-age=60',
  wait: true,
})

/**
 * 列表内容边缘缓存 (5 分钟)
 */
export const listCache = cache({
  cacheName: 'starye-api-lists',
  cacheControl: 'public, max-age=300',
  wait: true,
})

/**
 * 详情内容边缘缓存 (3 分钟)
 */
export const detailCache = cache({
  cacheName: 'starye-api-details',
  cacheControl: 'public, max-age=180',
  wait: true,
})

/**
 * 用户个性化内容 (需要 Vary)
 */
export const userCache = cache({
  cacheName: 'starye-api-user',
  cacheControl: 'private, max-age=60',
  vary: ['Cookie'],  // 🔑 关键: 根据 Cookie 区分缓存
  wait: true,
})
```

#### 5.2 应用到路由

```typescript
// apps/api/src/routes/movies/index.ts
import { publicCache, detailCache } from '../../middleware/cache'

export const moviesRoutes = new Hono<AppEnv>()
  .get('/', publicCache, getMovieList)           // 缓存列表
  .get('/featured/hot', publicCache, getHotMoviesList)  // 缓存热门
  .get('/:identifier', detailCache, getMovieDetail)     // 缓存详情
```

```typescript
// apps/api/src/routes/ratings/index.ts
import { userCache } from '../../middleware/cache'

const ratingsRoutes = new Hono<AppEnv>()
  .post('/', submitPlayerRating)  // 不缓存 POST
  .get('/player/:playerId', publicCache, getPlayerRatingStats)  // 缓存评分统计
  .get('/user', userCache, getUserRatings)  // 用户个性化，需 Vary: Cookie
```

#### 5.3 缓存失效策略

```typescript
// apps/api/src/utils/cache.ts (保留内存缓存)
export const CacheInvalidation = {
  /**
   * 评分更新后失效缓存
   */
  onRatingUpdate: async (playerId: string) => {
    // 内存缓存失效
    apiCache.delete(CacheKeys.playerRating(playerId))
    
    // Cloudflare Cache 自动过期 (基于 TTL)
    // 无需手动清理
  },
  
  /**
   * 电影更新后失效缓存
   */
  onMovieUpdate: async (movieId: string) => {
    // 需要主动清理 Cloudflare Cache
    // 使用 Cache API
    const cache = caches.default
    await cache.delete(`https://api.starye.com/api/movies/${movieId}`)
  },
}
```

### 缓存效果对比

```
┌──────────────────────────────────────────────┐
│        缓存前 vs 缓存后对比                   │
├──────────────────────────────────────────────┤
│                                              │
│  场景: 获取电影列表                          │
│                                              │
│  缓存前:                                     │
│  ├─ 客户端 → Worker → D1 查询               │
│  ├─ 响应时间: 120ms                          │
│  └─ 成本: $0.50 / 百万请求                  │
│                                              │
│  缓存后:                                     │
│  ├─ 客户端 → Edge Cache → 直接返回          │
│  ├─ 响应时间: 15ms (↓ 87.5%)               │
│  └─ 成本: $0.05 / 百万请求 (↓ 90%)         │
│                                              │
│  缓存命中率: 75%                             │
│  节省成本: 67.5%                             │
│                                              │
└──────────────────────────────────────────────┘
```

## 类型系统增强

### Context Variables 扩展

```typescript
// apps/api/src/types.ts
export interface Variables {
  db: Database
  auth: Auth
  user?: SessionUser
  session?: Session
  requestId: string  // ← 新增
  hasAccess?: boolean
}
```

### Handler 类型改进

```typescript
// 优化前
export async function getMovieList(c: Context<AppEnv>) {
  const user = c.get('user')  // 类型: SessionUser | undefined
  // ...
}

// 优化后 (使用中间件后)
export const getMovieList = createHandler(
  requireAuth(),  // 中间件确保 user 存在
  async (c) => {
    const user = c.get('user')!  // 类型断言安全
    // ...
  }
)
```

## 测试策略

### 单元测试

```typescript
// apps/api/src/middleware/__tests__/auth.test.ts
import { describe, it, expect } from 'vitest'
import { authMiddleware } from '../auth'
import { createMockContext } from '../../test/helpers'

describe('authMiddleware', () => {
  it('should inject user when session exists', async () => {
    const mockSession = { user: { id: '1', email: 'test@example.com' } }
    const c = createMockContext({
      auth: {
        api: {
          getSession: () => Promise.resolve(mockSession),
        },
      },
    })
    
    const middleware = authMiddleware()
    await middleware(c, async () => {})
    
    expect(c.get('user')).toEqual(mockSession.user)
  })
  
  it('should not throw when session is null', async () => {
    const c = createMockContext({
      auth: {
        api: {
          getSession: () => Promise.resolve(null),
        },
      },
    })
    
    const middleware = authMiddleware()
    await expect(middleware(c, async () => {})).resolves.not.toThrow()
  })
})
```

### 集成测试

```typescript
// apps/api/src/routes/__tests__/movies.integration.test.ts
import { describe, it, expect } from 'vitest'
import app from '../../index'

describe('Movies API with caching', () => {
  it('should return Cache-Control header', async () => {
    const res = await app.request('/api/movies')
    
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
    expect(res.headers.get('Server-Timing')).toBeTruthy()
  })
  
  it('should compress response', async () => {
    const res = await app.request('/api/movies', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    
    expect(res.headers.get('Content-Encoding')).toBe('gzip')
  })
})
```

## 部署注意事项

### Wrangler 配置

```toml
# wrangler.toml
[env.production]
compatibility_date = "2024-01-01"

# 启用 Cache API
[env.production.services]
cache = "default"

# 性能优化
[env.production.limits]
cpu_ms = 50  # 单个请求 CPU 限制
```

### 环境变量

```bash
# 不需要新增环境变量
# 使用现有的:
# - DB (D1 绑定)
# - CACHE (KV 命名空间，可选)
# - BETTER_AUTH_SECRET
# - ...
```

## 监控指标

```
关键指标:
├─ 认证查询次数 (目标: ↓ 60%)
├─ 缓存命中率 (目标: > 70%)
├─ P95 响应时间 (目标: ↓ 15%)
├─ 压缩率 (目标: > 60%)
└─ 错误率 (目标: < 0.1%)
```

## 总结

通过以上设计，我们将实现:
1. 认证性能提升 66% MUST
2. 响应体积减小 60-80% MUST
3. 边缘缓存全球加速 MUST
4. 代码可维护性显著改善 MUST
5. 生产级监控能力 MUST
