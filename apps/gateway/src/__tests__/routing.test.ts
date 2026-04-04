/**
 * Gateway 路由逻辑单元测试
 * 测试覆盖：路径匹配规则、路径重写逻辑、代理头部设置、本地/生产环境检测
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../index'

// ─── 辅助工具 ───────────────────────────────────────────────────────────────

interface Env {
  API_ORIGIN?: string
  DASHBOARD_ORIGIN?: string
  BLOG_ORIGIN?: string
  MOVIE_ORIGIN?: string
  COMIC_ORIGIN?: string
  AUTH_ORIGIN?: string
}

/** 创建一个来自指定 URL 的模拟请求 */
function makeRequest(url: string, options: RequestInit & { cfConnectingIp?: string } = {}): Request {
  const { cfConnectingIp, ...init } = options
  const req = new Request(url, init)
  if (cfConnectingIp) {
    const headers = new Headers(req.headers)
    headers.set('cf-connecting-ip', cfConnectingIp)
    return new Request(url, { ...init, headers })
  }
  return req
}

/** 捕获代理时实际请求的 URL 和 headers */
let capturedRequest: Request | null = null
let mockFetchResponse: Response = new Response('OK', { status: 200 })

beforeEach(() => {
  capturedRequest = null
  mockFetchResponse = new Response('OK', { status: 200 })
  vi.stubGlobal('fetch', async (req: Request) => {
    capturedRequest = req instanceof Request ? req : new Request(req)
    return mockFetchResponse
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── 本地/生产环境检测 ───────────────────────────────────────────────────────

describe('环境检测', () => {
  it('localhost 应被识别为本地环境', async () => {
    const req = makeRequest('http://localhost:8080/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
  })

  it('127.0.0.1 应被识别为本地环境', async () => {
    const req = makeRequest('http://127.0.0.1:8080/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
  })

  it('192.168.x.x 应被识别为本地环境', async () => {
    const req = makeRequest('http://192.168.1.100:8080/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
  })

  it('生产域名应使用 env 中的 API_ORIGIN', async () => {
    const env: Env = { API_ORIGIN: 'https://api.starye.com' }
    const req = makeRequest('https://starye.com/api/health')
    await worker.fetch(req, env)
    expect(capturedRequest!.url).toContain('api.starye.com')
  })

  it('env.API_ORIGIN 包含 127.0.0.1 时应识别为本地（wrangler dev）', async () => {
    const env: Env = { API_ORIGIN: 'http://127.0.0.1:8787' }
    const req = makeRequest('https://myapp.dev.vars/api/health')
    await worker.fetch(req, env)
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
  })
})

// ─── 路径匹配规则 ────────────────────────────────────────────────────────────

describe('路径匹配规则', () => {
  it('/api/* 应路由到 API 服务', async () => {
    const req = makeRequest('http://localhost/api/movies')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
    expect(capturedRequest!.url).toContain('/api/movies')
  })

  it('/api/admin/* 应路由到 API 服务', async () => {
    const req = makeRequest('http://localhost/api/admin/stats')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:8787')
    expect(capturedRequest!.url).toContain('/api/admin/stats')
  })

  it('/dashboard/* 应路由到 Dashboard 服务', async () => {
    const req = makeRequest('http://localhost/dashboard/')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('localhost:5173')
  })

  it('/movie/* 应路由到 Movie App', async () => {
    const req = makeRequest('http://localhost/movie/')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('localhost:3001')
  })

  it('/comic/* 应路由到 Comic App', async () => {
    const req = makeRequest('http://localhost/comic/')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('localhost:3000')
  })

  it('/auth/* 应路由到 Auth 服务', async () => {
    const req = makeRequest('http://localhost/auth/')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('localhost:3003')
  })

  it('/ 根路径应重定向到 /blog/', async () => {
    const req = makeRequest('http://localhost/')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toContain('/blog/')
  })

  it('未匹配路径应路由到 Blog（默认）', async () => {
    const req = makeRequest('http://localhost/some-article')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:3002')
  })

  it('/blog/* 应路由到 Blog 服务（默认回退）', async () => {
    const req = makeRequest('http://localhost/blog/')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('127.0.0.1:3002')
  })
})

// ─── 单路径重定向 ────────────────────────────────────────────────────────────

describe('单路径 301 重定向', () => {
  it('/dashboard 应重定向到 /dashboard/', async () => {
    const req = makeRequest('http://localhost/dashboard')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('http://localhost/dashboard/')
  })

  it('/movie 应重定向到 /movie/', async () => {
    const req = makeRequest('http://localhost/movie')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('http://localhost/movie/')
  })

  it('/comic 应重定向到 /comic/', async () => {
    const req = makeRequest('http://localhost/comic')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('http://localhost/comic/')
  })

  it('/auth 应重定向到 /auth/', async () => {
    const req = makeRequest('http://localhost/auth')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('http://localhost/auth/')
  })
})

// ─── 路径重写逻辑（生产环境）────────────────────────────────────────────────

describe('生产环境路径重写', () => {
  const prodEnv: Env = {
    DASHBOARD_ORIGIN: 'https://dash.starye.com',
    MOVIE_ORIGIN: 'https://movie.starye.com',
    COMIC_ORIGIN: 'https://comic.starye.com',
    AUTH_ORIGIN: 'https://auth.starye.com',
    BLOG_ORIGIN: 'https://blog.starye.com',
    API_ORIGIN: 'https://api.starye.com',
  }

  it('生产环境 /dashboard/* 应剥离 /dashboard 前缀', async () => {
    const req = makeRequest('https://starye.com/dashboard/movies')
    await worker.fetch(req, prodEnv)
    expect(capturedRequest!.url).not.toContain('/dashboard/movies')
    expect(capturedRequest!.url).toContain('/movies')
  })

  it('生产环境 /movie/* 应剥离 /movie 前缀', async () => {
    const req = makeRequest('https://starye.com/movie/home')
    await worker.fetch(req, prodEnv)
    expect(capturedRequest!.url).not.toContain('/movie/home')
    expect(capturedRequest!.url).toContain('/home')
  })

  it('生产环境 /comic/* 应剥离 /comic 前缀', async () => {
    const req = makeRequest('https://starye.com/comic/list')
    await worker.fetch(req, prodEnv)
    expect(capturedRequest!.url).not.toContain('/comic/list')
    expect(capturedRequest!.url).toContain('/list')
  })

  it('生产环境 /api/* 不重写路径', async () => {
    const req = makeRequest('https://starye.com/api/health')
    await worker.fetch(req, prodEnv)
    expect(capturedRequest!.url).toContain('/api/health')
  })

  it('本地环境 /dashboard/* 不剥离前缀', async () => {
    const req = makeRequest('http://localhost/dashboard/movies')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('/dashboard/movies')
  })
})

// ─── 代理头部 ────────────────────────────────────────────────────────────────

describe('代理头部设置', () => {
  it('应设置 X-Forwarded-Host 为原始 host', async () => {
    const req = makeRequest('http://localhost:8080/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.headers.get('X-Forwarded-Host')).toBe('localhost:8080')
  })

  it('应设置 X-Forwarded-Proto 为原始协议', async () => {
    const req = makeRequest('https://starye.com/api/health')
    await worker.fetch(req, { API_ORIGIN: 'https://api.starye.com' } as Env)
    expect(capturedRequest!.headers.get('X-Forwarded-Proto')).toBe('https')
  })

  it('http 请求 X-Forwarded-Proto 应为 http', async () => {
    const req = makeRequest('http://localhost/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.headers.get('X-Forwarded-Proto')).toBe('http')
  })

  it('应设置 X-Real-IP（有 cf-connecting-ip 时）', async () => {
    const req = makeRequest('http://localhost/api/health', { cfConnectingIp: '203.0.113.5' })
    await worker.fetch(req, {})
    expect(capturedRequest!.headers.get('X-Real-IP')).toBe('203.0.113.5')
  })

  it('无 cf-connecting-ip 时 X-Real-IP 应为空字符串', async () => {
    const req = makeRequest('http://localhost/api/health')
    await worker.fetch(req, {})
    expect(capturedRequest!.headers.get('X-Real-IP')).toBe('')
  })

  it('不应传递原始 host 头部', async () => {
    const req = makeRequest('http://localhost/api/health', {
      headers: { host: 'localhost' },
    })
    await worker.fetch(req, {})
    // host 头应被删除，不传递到目标服务器
    expect(capturedRequest!.headers.get('host')).toBeNull()
  })
})

// ─── fetch 失败处理 ──────────────────────────────────────────────────────────

describe('Gateway 错误处理', () => {
  it('当目标服务不可达时应返回 502', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('Connection refused')
    })
    const req = makeRequest('http://localhost/api/health')
    const resp = await worker.fetch(req, {})
    expect(resp.status).toBe(502)
    const text = await resp.text()
    expect(text).toContain('Gateway Error')
  })
})

// ─── 查询字符串保留 ──────────────────────────────────────────────────────────

describe('查询字符串', () => {
  it('代理时应保留 URL 查询参数', async () => {
    const req = makeRequest('http://localhost/api/movies?page=1&limit=20')
    await worker.fetch(req, {})
    expect(capturedRequest!.url).toContain('page=1')
    expect(capturedRequest!.url).toContain('limit=20')
  })
})
