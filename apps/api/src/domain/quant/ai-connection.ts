import type { QuantDecryptedAiConfig } from './ai-config'
import { chatCompletionsUrl } from './ai-summary'
import { QuantError } from './errors'

export interface QuantAiConnectionTestRequest {
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  readonly now?: () => Date
  readonly nowMs?: () => number
}

export interface QuantAiConnectionTestResult {
  readonly provider: QuantDecryptedAiConfig['provider']
  readonly model: string
  readonly testedAt: string
  readonly latencyMs: number
}

function connectionError(code: 'QUANT_AI_SUMMARY_CONFIGURATION' | 'QUANT_AI_SUMMARY_TIMEOUT' | 'QUANT_AI_SUMMARY_UPSTREAM' | 'QUANT_AI_SUMMARY_INVALID_RESPONSE', message: string, status: 502 | 503 | 504): QuantError {
  return new QuantError(code, message, status)
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function responseContent(value: unknown): string {
  const root = record(value)
  const choices = root?.choices
  if (!Array.isArray(choices) || !choices.length)
    throw connectionError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI connection response has no choices', 502)
  const firstChoice = record(choices[0])
  const message = record(firstChoice?.message)
  const content = message?.content
  if (typeof content !== 'string' || !content.trim())
    throw connectionError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI connection response has no message content', 502)
  return content.trim()
}

export async function testQuantAiConnection(input: QuantAiConnectionTestRequest): Promise<QuantAiConnectionTestResult> {
  const { config } = input
  if (!config.apiKey && config.provider !== 'ollama')
    throw connectionError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI API key is not configured', 503)

  const timeoutMs = Number.isFinite(input.timeoutMs) && (input.timeoutMs ?? 0) > 0 ? Math.min(input.timeoutMs!, 30_000) : 10_000
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const nowMs = input.nowMs ?? (() => Date.now())
  const now = input.now ?? (() => new Date())
  const startedAt = nowMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'content-type': 'application/json',
    }
    if (config.apiKey)
      headers.authorization = `Bearer ${config.apiKey}`
    const response = await fetchImpl(chatCompletionsUrl(config), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      }),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw connectionError('QUANT_AI_SUMMARY_TIMEOUT', 'AI connection request timed out', 504)
    if (!response.ok)
      throw connectionError('QUANT_AI_SUMMARY_UPSTREAM', `AI connection endpoint returned HTTP ${response.status}`, 502)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw connectionError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI connection response is not JSON', 502)
    }
    responseContent(payload)
    return {
      provider: config.provider,
      model: config.model,
      testedAt: now().toISOString(),
      latencyMs: Math.max(0, nowMs() - startedAt),
    }
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw connectionError('QUANT_AI_SUMMARY_TIMEOUT', 'AI connection request timed out', 504)
    throw connectionError('QUANT_AI_SUMMARY_UPSTREAM', 'AI connection request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
