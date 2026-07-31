import { describe, expect, it } from 'vitest'

import { createGitHubAppJwt } from '../jwt'

const encoder = new TextEncoder()

function base64UrlDecodeJson(value: string): Readonly<Record<string, unknown>> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  return JSON.parse(atob(base64)) as Readonly<Record<string, unknown>>
}

async function createPrivateKeyPem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { hash: 'SHA-256', modulusLength: 2048, name: 'RSASSA-PKCS1-v1_5', publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))))
  return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`
}

describe('gitHub App JWT', () => {
  it('signs a backdated, short-lived RS256 token with the configured App ID issuer', async () => {
    const result = await createGitHubAppJwt({
      appId: '12345',
      now: 1_700_000_000,
      privateKeyPem: await createPrivateKeyPem(),
    })

    expect(result.ok).toBe(true)
    if (!result.ok)
      return

    const [header, payload, signature] = result.value.split('.')
    expect(base64UrlDecodeJson(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(base64UrlDecodeJson(payload)).toEqual({ exp: 1_700_000_540, iat: 1_699_999_940, iss: '12345' })
    expect(signature).toMatch(/^[\w-]+$/u)
    expect(encoder.encode(signature).byteLength).toBeGreaterThan(0)
  })

  it('returns safe reason codes for malformed PKCS#8 material and invalid expiration windows', async () => {
    await expect(createGitHubAppJwt({
      appId: '12345',
      privateKeyPem: '-----BEGIN PRIVATE KEY-----\nnot a key\n-----END PRIVATE KEY-----',
    })).resolves.toEqual({ code: 'github_app_jwt_private_key_invalid', ok: false })

    await expect(createGitHubAppJwt({
      appId: '12345',
      expiresInSeconds: 601,
      privateKeyPem: await createPrivateKeyPem(),
    })).resolves.toEqual({ code: 'github_app_jwt_expiration_invalid', ok: false })
  })
})
