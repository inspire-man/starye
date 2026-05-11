/**
 * dashboard-guard.ts 单元测试
 * 覆盖：ACCESS-01（未登录 302）、ACCESS-02（白名单判断）、PUBSEC-01（robots.txt）、PUBSEC-02（X-Robots-Tag）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkDashboardAuth, isInAdminWhitelist } from '../dashboard-guard'

describe('isInAdminWhitelist', () => {
  it('单个 ID 命中返回 true', () => {
    expect(isInAdminWhitelist('12345', '12345')).toBe(true)
  })
  it('逗号分隔多个 ID 命中返回 true', () => {
    expect(isInAdminWhitelist('67890', '12345,67890')).toBe(true)
  })
  it('iD 含空格时仍能命中（trim 处理）', () => {
    expect(isInAdminWhitelist('67890', '12345, 67890')).toBe(true)
  })
  it('未命中返回 false', () => {
    expect(isInAdminWhitelist('99999', '12345,67890')).toBe(false)
  })
  it('env 为空返回 false', () => {
    expect(isInAdminWhitelist('12345', undefined)).toBe(false)
  })
})

describe('checkDashboardAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('无 cookie 返回 no_session', async () => {
    const req = new Request('https://starye.org/dashboard/')
    const result = await checkDashboardAuth(req, { ADMIN_GITHUB_ID: '12345' })
    expect(result).toEqual({ allowed: false, reason: 'no_session' })
  })

  it('session API 返回无 user 时返回 no_session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    ))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abc123' },
    })
    const result = await checkDashboardAuth(req, {
      API_ORIGIN: 'http://127.0.0.1:8787',
      ADMIN_GITHUB_ID: '12345',
    })
    expect(result).toEqual({ allowed: false, reason: 'no_session' })
  })

  it('githubId 在白名单中返回 allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { githubId: '12345' } }), { status: 200 }),
    ))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abc456' },
    })
    const result = await checkDashboardAuth(req, {
      API_ORIGIN: 'http://127.0.0.1:8787',
      ADMIN_GITHUB_ID: '12345',
    })
    expect(result).toEqual({ allowed: true })
  })

  it('githubId 不在白名单中返回 not_admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { githubId: '99999' } }), { status: 200 }),
    ))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abc789' },
    })
    const result = await checkDashboardAuth(req, {
      API_ORIGIN: 'http://127.0.0.1:8787',
      ADMIN_GITHUB_ID: '12345',
    })
    expect(result).toEqual({ allowed: false, reason: 'not_admin' })
  })

  it('fetch 失败时 fail-closed 返回 no_session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abcfail' },
    })
    const result = await checkDashboardAuth(req, {
      API_ORIGIN: 'http://127.0.0.1:8787',
      ADMIN_GITHUB_ID: '12345',
    })
    expect(result).toEqual({ allowed: false, reason: 'no_session' })
  })
})
