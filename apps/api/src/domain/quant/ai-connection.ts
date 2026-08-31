import type { QuantDecryptedAiConfig } from './ai-config'
import { resolveQuantAiConnectionTimeout } from './ai-timeout'
import { requestQuantAiCompletion } from './ai-transport'
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

export async function testQuantAiConnection(input: QuantAiConnectionTestRequest): Promise<QuantAiConnectionTestResult> {
  const { config } = input
  if (!config.apiKey && config.provider !== 'ollama')
    throw connectionError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI API key is not configured', 503)

  const timeoutMs = resolveQuantAiConnectionTimeout(input.timeoutMs)
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const nowMs = input.nowMs ?? (() => Date.now())
  const now = input.now ?? (() => new Date())
  const startedAt = nowMs()
  await requestQuantAiCompletion({
    config,
    timeoutMs,
    fetchImpl,
    maxCompletionTokens: 64,
    maxResponseLength: 256,
    temperature: 0,
    messages: [{ role: 'user', content: 'Reply with OK only.' }],
    errorCodes: {
      configuration: 'QUANT_AI_SUMMARY_CONFIGURATION',
      timeout: 'QUANT_AI_SUMMARY_TIMEOUT',
      upstream: 'QUANT_AI_SUMMARY_UPSTREAM',
      invalid_response: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
    },
  })
  return {
    provider: config.provider,
    model: config.model,
    testedAt: now().toISOString(),
    latencyMs: Math.max(0, nowMs() - startedAt),
  }
}
