import type { QuantDecryptedAiConfig } from '../ai-config'
import { describe, expect, it, vi } from 'vitest'
import { isQuantAiReasoningModel, quantAiChatCompletionsUrl, requestQuantAiCompletion } from '../ai-transport'

const config: QuantDecryptedAiConfig = {
  id: 'transport-config',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1/',
  apiKey: 'transport-secret',
}

const errorCodes = {
  configuration: 'QUANT_AI_SUMMARY_CONFIGURATION' as const,
  timeout: 'QUANT_AI_SUMMARY_TIMEOUT' as const,
  upstream: 'QUANT_AI_SUMMARY_UPSTREAM' as const,
  invalid_response: 'QUANT_AI_SUMMARY_INVALID_RESPONSE' as const,
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function streamResponse(chunks: readonly string[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function request(fetchImpl: typeof fetch, overrides: Partial<QuantDecryptedAiConfig> = {}, transportOverrides: { onTextDelta?: (delta: string, receivedLength: number) => void, signal?: AbortSignal } = {}) {
  return requestQuantAiCompletion({
    config: { ...config, ...overrides },
    messages: [{ role: 'user', content: 'Return a JSON object.' }],
    maxCompletionTokens: 512,
    maxResponseLength: 2_000,
    timeoutMs: 100,
    temperature: 0.2,
    responseFormat: 'json_object',
    errorCodes,
    fetchImpl,
    ...transportOverrides,
  })
}

describe('quant AI transport', () => {
  it('uses the non-streaming GPT-5 reasoning request contract', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
    }))

    await expect(request(fetchImpl)).resolves.toMatchObject({ content: '{"ok":true}', finishReason: 'stop' })

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'gpt-5.4',
      max_completion_tokens: 512,
      stream: false,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    })
    expect(body).not.toHaveProperty('max_tokens')
    expect(body).not.toHaveProperty('temperature')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://ai.example.test/v1/chat/completions')
  })

  it('keeps sampling temperature for non-reasoning compatible models', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      choices: [{ message: { content: 'OK' } }],
    }))

    await expect(request(fetchImpl, { model: 'gpt-4o' })).resolves.toMatchObject({ content: 'OK' })
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(body).toMatchObject({ temperature: 0.2, stream: false, max_completion_tokens: 512 })
    expect(body).not.toHaveProperty('reasoning_effort')
  })

  it('assembles streamed Chat Completions deltas and sends stream true', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"true}"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ]))

    await expect(request(fetchImpl, { responseMode: 'stream' })).resolves.toMatchObject({ content: '{"ok":true}', finishReason: 'stop' })
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(body).toMatchObject({ stream: true, response_format: { type: 'json_object' } })
  })

  it('reports bounded streamed deltas while retaining the complete result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"true}"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ]))
    const deltas: Array<{ delta: string, receivedLength: number }> = []

    await expect(request(fetchImpl, { responseMode: 'stream' }, {
      onTextDelta: (delta, receivedLength) => deltas.push({ delta, receivedLength }),
    })).resolves.toMatchObject({ content: '{"ok":true}' })
    expect(deltas).toEqual([
      { delta: '{"ok":', receivedLength: 6 },
      { delta: 'true}', receivedLength: 11 },
    ])
  })

  it('accepts a complete JSON body when a compatible gateway ignores stream mode', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
    }))

    await expect(request(fetchImpl, { responseMode: 'stream' })).resolves.toMatchObject({ content: '{"ok":true}', finishReason: 'stop' })
  })

  it('rejects malformed streamed events and classifies 524 as timeout', async () => {
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(streamResponse(['data: {"choices":\n\n']))
    await expect(request(malformed, { responseMode: 'stream' })).rejects.toMatchObject({ code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE', status: 502 })

    const gatewayTimeout = vi.fn<typeof fetch>().mockResolvedValue(response({}, 524))
    await expect(request(gatewayTimeout)).rejects.toMatchObject({ code: 'QUANT_AI_SUMMARY_TIMEOUT', status: 504, message: expect.stringContaining('524') })
  })

  it('normalizes Chat content arrays and Responses output shapes', async () => {
    const chatParts = vi.fn<typeof fetch>().mockResolvedValue(response({
      choices: [{ message: { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] } }],
    }))
    await expect(request(chatParts)).resolves.toMatchObject({ content: '{"a":1}' })

    const outputText = vi.fn<typeof fetch>().mockResolvedValue(response({ output_text: '{"b":2}', status: 'completed' }))
    await expect(request(outputText)).resolves.toMatchObject({ content: '{"b":2}', finishReason: 'completed' })

    const output = vi.fn<typeof fetch>().mockResolvedValue(response({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"c":3}' }] }],
    }))
    await expect(request(output)).resolves.toMatchObject({ content: '{"c":3}', finishReason: 'completed' })
  })

  it('classifies truncated Chat and Responses payloads as invalid responses', async () => {
    const truncated = vi.fn<typeof fetch>().mockResolvedValue(response({
      choices: [{ finish_reason: 'length', message: { content: '{"partial":' } }],
    }))
    await expect(request(truncated)).rejects.toMatchObject({ code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE', status: 502 })

    const incomplete = vi.fn<typeof fetch>().mockResolvedValue(response({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output_text: '{"partial":',
    }))
    await expect(request(incomplete)).rejects.toMatchObject({ code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE', status: 502 })
  })

  it('validates the configured base URL before making a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(request(fetchImpl, { baseUrl: 'ftp://invalid.example.test' })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_CONFIGURATION',
      status: 503,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('normalizes endpoint suffixes and reasoning model names', () => {
    expect(quantAiChatCompletionsUrl(config)).toBe('https://ai.example.test/v1/chat/completions')
    expect(quantAiChatCompletionsUrl({ ...config, baseUrl: 'https://ai.example.test/v1/chat/completions' })).toBe('https://ai.example.test/v1/chat/completions')
    expect(isQuantAiReasoningModel('gpt-5.4')).toBe(true)
    expect(isQuantAiReasoningModel('o3-mini')).toBe(true)
    expect(isQuantAiReasoningModel('gpt-4o')).toBe(false)
  })
})
