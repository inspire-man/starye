/**
 * auth.ts 单元测试
 * 覆盖：ACCESS-02（githubId 字段注入逻辑）
 */
import { describe, expect, it } from 'vitest'
import { injectGithubIdIntoSession } from '../auth'

describe('injectGithubIdIntoSession', () => {
  it('有 GitHub account 时返回 accountId', () => {
    const result = injectGithubIdIntoSession('user-1', { accountId: '12345678' })
    expect(result).toBe('12345678')
  })

  it('无 GitHub account（undefined）时返回 null', () => {
    const result = injectGithubIdIntoSession('user-1', undefined)
    expect(result).toBeNull()
  })

  it('accountId 为空字符串时返回空字符串（不转为 null）', () => {
    const result = injectGithubIdIntoSession('user-1', { accountId: '' })
    expect(result).toBe('')
  })
})

describe('createAuth 基础验证', () => {
  it('createAuth 返回包含 api 的 auth 实例', async () => {
    // 动态 import 避免 Better Auth 初始化副作用
    const { createAuth } = await import('../auth')
    const mockEnv = {
      DB: {} as any,
      CACHE: {} as any,
      BETTER_AUTH_SECRET: 'test-secret-32-chars-minimum-len',
      BETTER_AUTH_URL: 'http://localhost:8787',
      WEB_URL: 'http://localhost:8080',
      ADMIN_URL: 'http://localhost:5173',
      GITHUB_CLIENT_ID: 'test-client-id',
      GITHUB_CLIENT_SECRET: 'test-client-secret',
    } as any
    const mockRequest = new Request('http://localhost:8787/api/auth/get-session')
    const auth = createAuth(mockEnv, mockRequest)
    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
  })
})
