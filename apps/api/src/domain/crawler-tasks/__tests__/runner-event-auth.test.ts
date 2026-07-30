import { describe, expect, it } from 'vitest'
import {
  MAX_SAFE_LOG_BYTES,
  normalizeRunnerEventForStorage,
} from '../log-redaction'
import {
  base64UrlEncode,
  verifyRunnerEventSignature,
} from '../runner-event-auth'

async function sign(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, body))
}

describe('runner event signature and safe normalization', () => {
  const body = new TextEncoder().encode('{"run_id":"run-1"}')
  const keys = {
    current: { id: 'current-1', secret: 'current-secret' },
    previous: { id: 'previous-1', secret: 'previous-secret', validUntil: 1_700_086_400_000 },
  }

  it('verifies only the current raw-body HMAC and rejects malformed input or unknown key ids', async () => {
    const signature = await sign(keys.current.secret, body)
    await expect(verifyRunnerEventSignature({ body, keyId: 'current-1', keys, signature, now: 1_700_000_000_000 }))
      .resolves
      .toEqual({ keyId: 'current-1', valid: true })
    await expect(verifyRunnerEventSignature({ body, keyId: 'current-1', keys, signature: 'not*base64url', now: 1_700_000_000_000 }))
      .resolves
      .toEqual({ valid: false })
    await expect(verifyRunnerEventSignature({ body, keyId: 'missing', keys, signature, now: 1_700_000_000_000 }))
      .resolves
      .toEqual({ valid: false })
  })

  it('accepts a previous key only before the exact rotation cutoff', async () => {
    const signature = await sign(keys.previous.secret, body)
    await expect(verifyRunnerEventSignature({ body, keyId: 'previous-1', keys, signature, now: keys.previous.validUntil - 1 }))
      .resolves
      .toEqual({ keyId: 'previous-1', valid: true })
    await expect(verifyRunnerEventSignature({ body, keyId: 'previous-1', keys, signature, now: keys.previous.validUntil }))
      .resolves
      .toEqual({ valid: false })
  })

  it('allowlists structured lifecycle fields and redacts secrets before a persistence projection exists', () => {
    const normalized = normalizeRunnerEventForStorage({
      code: 'crawl_progress',
      counts: { completed: 2 },
      level: 'info',
      message: 'Authorization: Bearer hidden cookie=session token=abc https://host.example/path?secret=yes',
      receipt: { contentIds: ['movie-1'], templateKey: 'movie' },
      type: 'progress',
    })

    expect(normalized.log).toMatchObject({ code: 'crawl_progress', counts: { completed: 2 }, level: 'info' })
    expect(normalized.log?.message).toContain('[REDACTED]')
    expect(normalized.log?.message).not.toContain('hidden')
    expect(normalized.receipt).toEqual({ contentIds: ['movie-1'], templateKey: 'movie' })
  })

  it('caps normal UTF-8 log detail without dropping terminal summaries', () => {
    const normalized = normalizeRunnerEventForStorage({
      code: 'runner_failed',
      level: 'error',
      message: '你'.repeat(MAX_SAFE_LOG_BYTES),
      type: 'failed',
    })

    expect(new TextEncoder().encode(normalized.log?.message).byteLength).toBeLessThanOrEqual(MAX_SAFE_LOG_BYTES)
    expect(normalized.terminalSummary).toContain('[truncated]')
  })
})
