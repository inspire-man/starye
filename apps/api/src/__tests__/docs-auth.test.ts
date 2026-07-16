/**
 * /api/docs 和 /api/openapi.json 鉴权测试
 * 覆盖：PUBSEC-04（生产环境 /api/docs 需鉴权才能访问）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock createAuth，使 getSession 返回 null（匿名用户）
vi.mock('../lib/auth', () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  })),
  injectGithubIdIntoSession: vi.fn(),
}))

// mock @starye/db，避免 D1 binding 依赖
vi.mock('@starye/db', () => ({
  createDb: vi.fn(() => ({})),
}))

// 动态 import app，确保 mock 先于 import 生效
const { default: app } = await import('../index')

// 最小化 env mock（满足 Env 接口必填字段）
const mockEnv = {
  DB: {} as any,
  CACHE: {} as any,
  BUCKET: {} as any,
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:8787',
  WEB_URL: 'http://localhost:8080',
  ADMIN_URL: 'http://localhost:5173',
  GITHUB_CLIENT_ID: 'test-id',
  GITHUB_CLIENT_SECRET: 'test-secret',
  CRAWLER_SECRET: 'test-crawler-secret',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET_NAME: 'test-bucket',
  R2_PUBLIC_URL: 'http://localhost:9000',
} as any

describe('pubsec-04: /api/docs 鉴权保护', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('匿名访问 /api/docs 返回 401', async () => {
    const req = new Request('http://localhost:8787/api/docs')
    const res = await app.fetch(req, mockEnv)
    expect(res.status).toBe(401)
  })

  it('匿名访问 /api/openapi.json 返回 401', async () => {
    const req = new Request('http://localhost:8787/api/openapi.json')
    const res = await app.fetch(req, mockEnv)
    expect(res.status).toBe(401)
  })
})
