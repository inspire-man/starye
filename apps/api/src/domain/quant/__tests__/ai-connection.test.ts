import type { QuantDecryptedAiConfig } from '../ai-config'
import { describe, expect, it, vi } from 'vitest'
import { testQuantAiConnection } from '../ai-connection'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-test-secret',
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('quant AI connection test', () => {
  it('sends an authenticated JSON contract probe and returns only connection metadata', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ choices: [{ message: { content: '{"ok":true}' } }] }))
    let clockCall = 0

    await expect(testQuantAiConnection({
      config,
      fetchImpl,
      now: () => new Date('2026-08-28T12:00:00.000Z'),
      nowMs: () => clockCall++ === 0 ? 1000 : 1042,
    })).resolves.toEqual({
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      testedAt: '2026-08-28T12:00:00.000Z',
      latencyMs: 42,
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-test-secret' }),
    }))
    const requestInit = fetchImpl.mock.calls[0]?.[1]
    const requestBody = JSON.parse(String(requestInit?.body)) as Record<string, unknown>
    expect(requestBody).toMatchObject({
      model: 'gpt-5.4',
      max_completion_tokens: 256,
      stream: false,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'Return exactly one JSON object: {"ok":true}.' }],
    })
    expect(requestBody).not.toHaveProperty('max_tokens')
    expect(requestBody).not.toHaveProperty('temperature')
    expect(String(requestInit?.body)).not.toContain('sk-test-secret')
  })

  it('rejects a successful HTTP response with non-object model content', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ choices: [{ message: { content: 'OK' } }] }))
    await expect(testQuantAiConnection({ config, fetchImpl })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('rejects missing keys without making an upstream request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(testQuantAiConnection({ config: { ...config, apiKey: null }, fetchImpl })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_CONFIGURATION',
      status: 503,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('classifies upstream and invalid response failures without exposing response bodies', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(response({ error: 'provider secret' }, 503))
    await expect(testQuantAiConnection({ config, fetchImpl: upstream })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_UPSTREAM',
      status: 502,
    })
    await expect(testQuantAiConnection({ config, fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ choices: [] })) })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('classifies an aborted request as a timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))

    await expect(testQuantAiConnection({ config, timeoutMs: 5, fetchImpl })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_TIMEOUT',
      status: 504,
    })
  })
})
