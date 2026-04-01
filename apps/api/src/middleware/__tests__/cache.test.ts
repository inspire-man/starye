import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detailCache, listCache, publicCache, userCache } from '../cache'

describe('cache Middleware', () => {
  let app: Hono<AppEnv>
  let mockCache: Map<string, Response>

  beforeEach(() => {
    app = new Hono<AppEnv>()
    mockCache = new Map()

    // Mock caches.default
    globalThis.caches = {
      default: {
        match: vi.fn(async (req: Request) => {
          const key = req.url
          return mockCache.get(key) || null
        }),
        put: vi.fn(async (req: Request, res: Response) => {
          const key = req.url
          mockCache.set(key, res.clone())
        }),
        delete: vi.fn(async (req: Request) => {
          const key = req.url
          mockCache.delete(key)
          return true
        }),
      } as unknown as Cache,
    } as CacheStorage
  })

  describe('publicCache', () => {
    it('应返回 Cache-Control 头', async () => {
      app.get('/test', publicCache(), (c) => {
        return c.json({ message: 'test' })
      })

      const res = await app.request('/test', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toContain('public')
      expect(res.headers.get('Cache-Control')).toContain('max-age=60')
    })

    it('应跳过非 GET 请求', async () => {
      app.post('/test', publicCache(), (c) => {
        return c.json({ message: 'test' })
      })

      const res = await app.request('/test', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBeNull()
    })

    it('应在二次请求时返回缓存命中', async () => {
      app.get('/test', publicCache(), (c) => {
        return c.json({ message: 'test', timestamp: Date.now() })
      })

      // 首次请求
      const res1 = await app.request('/test', {
        method: 'GET',
      })
      expect(res1.headers.get('X-Cache')).toBe('MISS')

      // 等待缓存存储
      await new Promise(resolve => setTimeout(resolve, 100))

      // 二次请求
      const res2 = await app.request('/test', {
        method: 'GET',
      })
      expect(res2.headers.get('X-Cache')).toBe('HIT')
    })
  })

  describe('listCache', () => {
    it('应设置 5 分钟缓存', async () => {
      app.get('/list', listCache(), (c) => {
        return c.json({ items: [] })
      })

      const res = await app.request('/list', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toContain('max-age=300')
    })
  })

  describe('detailCache', () => {
    it('应设置 3 分钟缓存', async () => {
      app.get('/detail/:id', detailCache(), (c) => {
        return c.json({ id: c.req.param('id') })
      })

      const res = await app.request('/detail/123', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toContain('max-age=180')
    })
  })

  describe('userCache', () => {
    it('应设置私有缓存并包含 Vary: Cookie', async () => {
      app.get('/user', userCache(), (c) => {
        return c.json({ user: 'test' })
      })

      const res = await app.request('/user', {
        method: 'GET',
        headers: {
          Cookie: 'session=abc123',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toContain('private')
      expect(res.headers.get('Vary')).toBe('Cookie')
    })

    it('应为不同用户创建独立缓存键', async () => {
      app.get('/user', userCache(), (c) => {
        const cookie = c.req.header('Cookie') || 'no-cookie'
        return c.json({ cookie })
      })

      // 用户 A
      const res1 = await app.request('/user', {
        method: 'GET',
        headers: {
          Cookie: 'session=user-a',
        },
      })
      const json1 = await res1.json() as any

      // 用户 B
      const res2 = await app.request('/user', {
        method: 'GET',
        headers: {
          Cookie: 'session=user-b',
        },
      })
      const json2 = await res2.json() as any

      // 两个响应应该不同
      expect(json1.cookie).toBe('session=user-a')
      expect(json2.cookie).toBe('session=user-b')
    })
  })

  describe('错误处理', () => {
    it('应跳过非 200 响应的缓存', async () => {
      app.get('/error', publicCache(), (c) => {
        return c.json({ error: 'Not Found' }, 404)
      })

      const res = await app.request('/error', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
      // 错误响应不应被缓存
      expect(mockCache.size).toBe(0)
    })
  })

  describe('stale-while-revalidate', () => {
    it('应包含 stale-while-revalidate 指令', async () => {
      app.get('/test', publicCache(), (c) => {
        return c.json({ message: 'test' })
      })

      const res = await app.request('/test', {
        method: 'GET',
      })

      expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate')
    })
  })
})
