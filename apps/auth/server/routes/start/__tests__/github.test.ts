import { describe, expect, it, vi } from 'vitest'
import { buildGitHubOAuthBody, readSetCookieHeaders } from '../github.get'

vi.mock('h3', () => ({
  createError: vi.fn(),
  defineEventHandler: <T>(handler: T) => handler,
  getQuery: vi.fn(),
  sendRedirect: vi.fn(),
}))

describe('github OAuth start route', () => {
  it('uses the login page as both success and error callback', () => {
    expect(buildGitHubOAuthBody('http://localhost:8080/auth/login?next=%2Fblog%2F')).toEqual({
      provider: 'github',
      callbackURL: 'http://localhost:8080/auth/login?next=%2Fblog%2F',
      errorCallbackURL: 'http://localhost:8080/auth/login?next=%2Fblog%2F',
    })
  })

  it('preserves all OAuth state cookies returned by the API', () => {
    const getSetCookie = vi.fn(() => [
      'starye.state=state-value; Path=/; HttpOnly',
      'starye.pkce=verifier; Path=/; HttpOnly',
    ])
    const headers = { getSetCookie } as unknown as Headers

    expect(readSetCookieHeaders(headers)).toEqual([
      'starye.state=state-value; Path=/; HttpOnly',
      'starye.pkce=verifier; Path=/; HttpOnly',
    ])
  })
})
