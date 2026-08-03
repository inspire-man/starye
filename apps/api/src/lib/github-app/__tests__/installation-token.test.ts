import { describe, expect, it } from 'vitest'

import { withGitHubInstallationToken } from '../installation-token'

async function createPrivateKeyPem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { hash: 'SHA-256', modulusLength: 2048, name: 'RSASSA-PKCS1-v1_5', publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))))
  return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`
}

describe('github installation token exchange', () => {
  it('mints a repository-scoped actions token in request memory and never returns it in the result DTO', async () => {
    const calls: Array<{ readonly input: RequestInfo | URL, readonly init?: RequestInit }> = []
    let deliveredToken = ''
    const result = await withGitHubInstallationToken({
      credentials: {
        appId: '12345',
        installationId: '67890',
        privateKeyPem: await createPrivateKeyPem(),
        repository: 'starye',
      },
      fetch: async (input, init) => {
        calls.push({ init, input })
        return Response.json({ token: 'installation-token-value' })
      },
      now: 1_700_000_000,
    }, async (token) => {
      deliveredToken = token
      return { kind: 'dispatched' as const }
    })

    expect(result).toEqual({ ok: true, value: { kind: 'dispatched' } })
    expect(JSON.stringify(result)).not.toContain('installation-token-value')
    expect(deliveredToken).toBe('installation-token-value')
    expect(calls).toHaveLength(1)
    expect(String(calls[0].input)).toBe('https://api.github.com/app/installations/67890/access_tokens')
    expect(calls[0].init?.headers).toMatchObject({
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'starye-api',
      'X-GitHub-Api-Version': '2022-11-28',
    })
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      permissions: { actions: 'write' },
      repositories: ['starye'],
    })
  })

  it.each([
    [408, 'github_provider_request_timeout', true],
    [429, 'github_provider_rate_limited', true],
    [503, 'github_provider_unavailable', true],
    [401, 'github_provider_authorization_failed', false],
    [403, 'github_provider_authorization_failed', false],
  ])('classifies provider response %i without returning credential material', async (status, code, retryable) => {
    const result = await withGitHubInstallationToken({
      credentials: {
        appId: '12345',
        installationId: '67890',
        privateKeyPem: await createPrivateKeyPem(),
        repository: 'starye',
      },
      fetch: async () => new Response('sensitive provider body', { status }),
    }, async () => ({ kind: 'unreachable' as const }))

    expect(result).toEqual({ code, ok: false, retryable, status })
    expect(JSON.stringify(result)).not.toContain('sensitive provider body')
  })

  it('treats non-JSON and transport failures as safe terminal or retryable codes', async () => {
    const credentials = {
      appId: '12345',
      installationId: '67890',
      privateKeyPem: await createPrivateKeyPem(),
      repository: 'starye',
    }
    await expect(withGitHubInstallationToken({
      credentials,
      fetch: async () => new Response('not json', { status: 201 }),
    }, async () => ({ kind: 'unreachable' as const }))).resolves.toEqual({
      code: 'github_installation_token_response_invalid',
      ok: false,
      retryable: false,
      status: 201,
    })
    await expect(withGitHubInstallationToken({
      credentials,
      fetch: async () => {
        throw new DOMException('aborted', 'AbortError')
      },
    }, async () => ({ kind: 'unreachable' as const }))).resolves.toEqual({
      code: 'github_provider_request_timeout',
      ok: false,
      retryable: true,
    })
  })
})

