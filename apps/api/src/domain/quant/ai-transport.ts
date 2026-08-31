import type { QuantAiProvider, QuantDecryptedAiConfig } from './ai-config'
import type { QuantErrorCode } from './errors'
import { QuantError } from './errors'

export type QuantAiTransportErrorKind = 'configuration' | 'timeout' | 'upstream' | 'invalid_response'

export interface QuantAiTransportErrorCodes {
  readonly configuration: QuantErrorCode
  readonly timeout: QuantErrorCode
  readonly upstream: QuantErrorCode
  readonly invalid_response: QuantErrorCode
}

export type QuantAiMessageRole = 'system' | 'user' | 'assistant' | 'developer'

export interface QuantAiMessage {
  readonly role: QuantAiMessageRole
  readonly content: string
}

export interface QuantAiCompletionRequest {
  readonly config: QuantDecryptedAiConfig
  readonly messages: readonly QuantAiMessage[]
  readonly maxCompletionTokens: number
  readonly maxResponseLength: number
  readonly timeoutMs: number
  readonly temperature?: number
  readonly responseFormat?: 'json_object'
  readonly errorCodes: QuantAiTransportErrorCodes
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export interface QuantAiCompletionResult {
  readonly content: string
  readonly finishReason: string | null
}

const DEFAULT_BASE_URLS: Record<QuantAiProvider, string> = {
  openai_compatible: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function transportError(
  input: QuantAiCompletionRequest,
  kind: QuantAiTransportErrorKind,
  message: string,
  status: 502 | 503 | 504,
): QuantError {
  return new QuantError(input.errorCodes[kind], message, status)
}

export function isQuantAiReasoningModel(model: string): boolean {
  return /^(?:gpt-5(?:[.-]|$)|o[1-4](?:[.-]|$))/iu.test(model.trim())
}

export function quantAiChatCompletionsUrl(config: QuantDecryptedAiConfig): string {
  const value = config.baseUrl?.trim() || DEFAULT_BASE_URLS[config.provider]
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error('AI base URL must use HTTP or HTTPS')
  const normalized = value.replace(/\/+$/u, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function textFromContent(value: unknown): string | null {
  if (typeof value === 'string')
    return value
  if (!Array.isArray(value))
    return null

  const parts = value.flatMap((part) => {
    if (typeof part === 'string')
      return [part]
    const parsed = record(part)
    if (!parsed)
      return []
    if (typeof parsed.text === 'string')
      return [parsed.text]
    if (typeof parsed.content === 'string')
      return [parsed.content]
    return []
  })
  return parts.length ? parts.join('') : null
}

function boundedResponseContent(
  value: unknown,
  maxResponseLength: number,
  input: QuantAiCompletionRequest,
): string {
  const content = textFromContent(value)?.trim() || null
  if (!content)
    throw transportError(input, 'invalid_response', 'AI response has no text content', 502)
  if (content.length > maxResponseLength)
    throw transportError(input, 'invalid_response', 'AI response content exceeds the allowed length', 502)
  return content
}

function responseContent(
  value: unknown,
  input: QuantAiCompletionRequest,
): QuantAiCompletionResult {
  const root = record(value)
  if (!root)
    throw transportError(input, 'invalid_response', 'AI response is not an object', 502)

  if (root.status === 'incomplete') {
    const details = record(root.incomplete_details)
    const reason = typeof details?.reason === 'string' ? `: ${details.reason}` : ''
    throw transportError(input, 'invalid_response', `AI response is incomplete${reason}`, 502)
  }

  const choices = root.choices
  if (Array.isArray(choices) && choices.length) {
    const firstChoice = record(choices[0])
    const finishReason = typeof firstChoice?.finish_reason === 'string' ? firstChoice.finish_reason : null
    if (finishReason === 'length' || finishReason === 'max_tokens')
      throw transportError(input, 'invalid_response', 'AI response was truncated before completion', 502)

    const message = record(firstChoice?.message)
    const content = textFromContent(message?.content) ?? textFromContent(firstChoice?.text)
    return {
      content: boundedResponseContent(content, input.maxResponseLength, input),
      finishReason,
    }
  }

  const outputText = textFromContent(root.output_text)
  if (outputText)
    return { content: boundedResponseContent(outputText, input.maxResponseLength, input), finishReason: 'completed' }

  if (Array.isArray(root.output)) {
    const output = root.output.flatMap((item) => {
      const parsed = record(item)
      if (!parsed)
        return []
      return [textFromContent(parsed.content) ?? textFromContent(parsed.text) ?? '']
    }).join('')
    return { content: boundedResponseContent(output, input.maxResponseLength, input), finishReason: 'completed' }
  }

  throw transportError(input, 'invalid_response', 'AI response has no choices or output content', 502)
}

export async function requestQuantAiCompletion(input: QuantAiCompletionRequest): Promise<QuantAiCompletionResult> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    let endpoint: string
    try {
      endpoint = quantAiChatCompletionsUrl(input.config)
    }
    catch {
      throw transportError(input, 'configuration', 'AI base URL is invalid', 503)
    }

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'content-type': 'application/json',
    }
    if (input.config.apiKey)
      headers.authorization = `Bearer ${input.config.apiKey}`

    const body: Record<string, unknown> = {
      model: input.config.model,
      max_completion_tokens: input.maxCompletionTokens,
      stream: false,
      messages: input.messages,
    }
    if (input.responseFormat)
      body.response_format = { type: input.responseFormat }
    if (isQuantAiReasoningModel(input.config.model))
      body.reasoning_effort = 'low'
    else if (input.temperature !== undefined)
      body.temperature = input.temperature

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw transportError(input, 'timeout', 'AI request timed out upstream', 504)
    if (!response.ok)
      throw transportError(input, 'upstream', `AI endpoint returned HTTP ${response.status}`, 502)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw transportError(input, 'invalid_response', 'AI response is not valid JSON', 502)
    }
    return responseContent(payload, input)
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw transportError(input, 'timeout', 'AI request timed out', 504)
    throw transportError(input, 'upstream', 'AI request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
