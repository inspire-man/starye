# Movies Module

电影模块的 Services/Handlers 架构实现。

## 目录结构

```
movies/
├── services/           # 业务逻辑层
│   ├── auth.service.ts       # 权限验证服务
│   ├── movie.service.ts      # 电影数据服务
│   ├── actor.service.ts      # 演员数据服务
│   └── publisher.service.ts  # 厂商数据服务
├── handlers/           # HTTP 处理层
│   ├── movies.handler.ts     # 电影接口处理
│   ├── actors.handler.ts     # 演员接口处理
│   ├── publishers.handler.ts # 厂商接口处理
│   ├── home.handler.ts       # 首页聚合接口
│   └── sync.handler.ts       # 数据同步接口
├── __tests__/          # 测试文件
│   ├── services/             # Services 层测试
│   └── handlers/             # Handlers 层测试
└── index.ts            # 路由定义（使用方法链）
```

## Services 层

### 职责

- 实现纯业务逻辑
- 数据库操作封装
- 可复用的数据处理函数
- 不依赖 HTTP 请求/响应

### 示例：使用 movie.service.ts

```typescript
import { getMovies } from './services/movie.service'

// 查询电影列表
const result = await getMovies({
  db, // Drizzle Database 实例
  isAdult: true, // 用户是否有成人内容权限
  page: 1, // 页码
  pageSize: 20, // 每页数量
  genres: ['action'], // 类型筛选
  publisher: 'ACME', // 厂商筛选
  releaseDateFrom: new Date('2024-01-01'),
  releaseDateTo: new Date('2024-12-31'),
})

// 返回格式
console.log(result.data) // 电影列表数组
console.log(result.meta) // { total, page, limit, totalPages }
```

### 权限验证

```typescript
import { checkUserAdultStatus } from './services/auth.service'

// 检查用户是否有 R18 权限
const isAdult = await checkUserAdultStatus(c) // c 是 Hono Context
```

## Handlers 层

### 职责

- 解析 HTTP 请求参数
- 调用 Services 层函数
- 格式化 HTTP 响应
- 错误处理

### 示例：movies.handler.ts

```typescript
import type { Context } from 'hono'
import type { AppEnv } from '@/types'
import { checkUserAdultStatus } from '../services/auth.service'
import { getMovies } from '../services/movie.service'

export async function getMovieList(c: Context<AppEnv>) {
  const db = c.get('db')
  const isAdult = await checkUserAdultStatus(c)

  // 解析查询参数
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 24
  const genres = c.req.query('genres')?.split(',')

  // 调用 Service
  const result = await getMovies({
    db,
    isAdult,
    page,
    pageSize: limit,
    genres,
  })

  // 返回响应
  return c.json(result)
}
```

## 路由定义

使用 **方法链** 定义路由以支持 Hono RPC 类型推导：

```typescript
import type { AppEnv } from '@/types'
import { Hono } from 'hono'
import { getActorDetail, getActorList } from './handlers/actors.handler'
import { getMovieDetail, getMovieList } from './handlers/movies.handler'

export const moviesRoutes = new Hono<AppEnv>()
  // 电影接口
  .get('/', getMovieList)
  .get('/:slug', getMovieDetail)

  // 演员接口
  .get('/actors/list', getActorList)
  .get('/actors/:slug', getActorDetail)
```

**重要**：必须使用方法链（`.get().get()...`）而不是多个独立的 `.get()` 调用。

## FilterBuilder 使用

`FilterBuilder` 类用于动态构建 Drizzle ORM 查询条件：

```typescript
import { movies } from '@starye/db/schema'
import { FilterBuilder } from '@/services/query-builder'

const whereClause = new FilterBuilder()
  .eq(movies.publisher, publisherName) // 相等条件（自动忽略 undefined）
  .like(movies.title, `%${search}%`) // LIKE 模糊匹配
  .between(movies.releaseDate, fromDate, toDate) // 范围查询
  .jsonContains(movies.genres, 'action') // JSON 数组包含
  .build() // 返回 SQL | undefined

// 在查询中使用
const results = await db.query.movies.findMany({
  where: whereClause,
  limit: 20,
})
```

## 测试

### 测试工具

```typescript
import { vi } from 'vitest'
import { createMockContext, createMockDb } from '@/test/helpers'

// Mock 数据库
const mockDb = {
  query: {
    movies: {
      findMany: vi.fn().mockResolvedValue([/* mock data */]),
    },
  },
} as unknown as Database

// Mock Hono Context
const mockContext = createMockContext({
  db: mockDb,
  user: { id: 'user1', isAdult: true },
})
```

### Services 层测试

专注于业务逻辑和数据处理：

```typescript
describe('movie.service', () => {
  it('应该过滤成人内容', async () => {
    const result = await getMovies({
      db: mockDb,
      isAdult: false, // 无成人权限
    })

    // 验证返回的电影都是非 R18
    expect(result.data.every(m => !m.isR18)).toBe(true)
  })
})
```

### Handlers 层测试

测试 HTTP 请求处理和响应：

```typescript
import { Hono } from 'hono'
import { getMovieList } from '../handlers/movies.handler'

describe('movies.handler', () => {
  it('应该解析查询参数', async () => {
    const app = new Hono<AppEnv>()
    app.get('/movies', getMovieList)

    const req = new Request('http://localhost/movies?page=2&limit=50')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.meta.page).toBe(2)
  })
})
```

## 类型安全

所有函数都使用 TypeScript 严格类型：

```typescript
// ✅ 正确：所有参数都有类型
export interface GetMoviesOptions {
  db: Database
  isAdult: boolean
  page?: number
  pageSize?: number
  genres?: string[]
  publisher?: string
}

export interface GetMoviesResult {
  data: MovieListItem[]
  meta: PaginationMeta
}

export async function getMovies(
  options: GetMoviesOptions
): Promise<GetMoviesResult> {
  // ...
}
```

## 性能优化

1. **并行查询**：使用 `Promise.all` 同时执行数据和计数查询
2. **按需加载**：只 select 需要的字段
3. **索引利用**：where 条件使用索引字段（`slug`, `code`）
4. **分页限制**：默认 limit 20，最大 100

## RPC 客户端

在 Dashboard 中使用类型安全的 RPC 客户端：

```typescript
import type { AppType } from '@starye/api-types'
import { hc } from 'hono/client'

const client = hc<AppType>('http://localhost:8787')

// 自动类型提示和检查
const response = await client.api.movies.$get({
  query: {
    page: 1,
    limit: 24,
    genres: 'action,comedy',
  },
})

const data = await response.json()
// data 类型自动推导为 GetMoviesResult
```

## 下一步

- 将其他模块（actors, publishers, comics, posts）迁移到相同架构
- 添加更多集成测试
- 实现 GraphQL 或 tRPC 支持（可选）
