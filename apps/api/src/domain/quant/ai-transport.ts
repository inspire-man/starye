import type { QuantAiProvider, QuantAiResponseMode, QuantDecryptedAiConfig } from './ai-config'
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
  readonly responseMode?: QuantAiResponseMode
  readonly onTextDelta?: (delta: string, receivedLength: number) => void
  readonly onFinishReason?: (finishReason: string | null) => void
  readonly signal?: AbortSignal
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

function streamChunkContent(
  value: unknown,
  input: QuantAiCompletionRequest,
): { readonly content: string, readonly finishReason: string | null } {
  const root = record(value)
  if (!root)
    throw transportError(input, 'invalid_response', 'AI stream event is not an object', 502)
  const choices = root.choices
  if (Array.isArray(choices) && choices.length) {
    const firstChoice = record(choices[0])
    const finishReason = typeof firstChoice?.finish_reason === 'string' ? firstChoice.finish_reason : null
    const delta = record(firstChoice?.delta)
    const message = record(firstChoice?.message)
    const content = textFromContent(delta?.content) ?? textFromContent(delta?.text) ?? textFromContent(message?.content) ?? textFromContent(firstChoice?.text) ?? ''
    return { content, finishReason }
  }

  const outputText = textFromContent(root.output_text)
  if (outputText)
    return { content: outputText, finishReason: 'completed' }
  return { content: '', finishReason: null }
}

function eventData(event: string): string | null {
  const lines = event.split(/\r?\n/u)
  const data = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
  return data.length ? data.join('\n').trim() : null
}

async function responseStreamContent(
  body: ReadableStream<Uint8Array>,
  input: QuantAiCompletionRequest,
): Promise<QuantAiCompletionResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let raw = ''
  let content = ''
  let finishReason: string | null = null
  let sawSseEvent = false
  let doneMarker = false

  const consumeEvent = (event: string): void => {
    const data = eventData(event)
    if (data === null)
      return
    sawSseEvent = true
    if (data === '[DONE]') {
      doneMarker = true
      return
    }
    let payload: unknown
    try {
      payload = JSON.parse(data)
    }
    catch {
      throw transportError(input, 'invalid_response', 'AI stream event is not valid JSON', 502)
    }
    const chunk = streamChunkContent(payload, input)
    if (chunk.content) {
      content += chunk.content
      if (content.length > input.maxResponseLength)
        throw transportError(input, 'invalid_response', 'AI response content exceeds the allowed length', 502)
      input.onTextDelta?.(chunk.content, content.length)
    }
    finishReason = chunk.finishReason ?? finishReason
  }

  while (true) {
    const next = await reader.read()
    if (next.done || doneMarker)
      break
    const chunk = decoder.decode(next.value, { stream: true })
    raw += chunk
    buffer += chunk
    const events = buffer.split(/\r?\n\r?\n/u)
    buffer = events.pop() || ''
    for (const event of events) {
      consumeEvent(event)
      if (doneMarker)
        break
    }
    if (doneMarker)
      break
  }
  raw += decoder.decode()
  if (!doneMarker && buffer.trim())
    consumeEvent(buffer)
  if (doneMarker)
    await reader.cancel()

  if (!sawSseEvent) {
    let result: QuantAiCompletionResult
    try {
      result = responseContent(JSON.parse(raw.trim()), input)
    }
    catch (error) {
      if (error instanceof QuantError)
        throw error
      throw transportError(input, 'invalid_response', 'AI response is not valid JSON', 502)
    }
    if (result.content)
      input.onTextDelta?.(result.content, result.content.length)
    input.onFinishReason?.(result.finishReason)
    return result
  }
  if (finishReason === 'length' || finishReason === 'max_tokens')
    throw transportError(input, 'invalid_response', 'AI response was truncated before completion', 502)
  input.onFinishReason?.(finishReason)
  return { content: boundedResponseContent(content, input.maxResponseLength, input), finishReason }
}

export async function requestQuantAiCompletion(input: QuantAiCompletionRequest): Promise<QuantAiCompletionResult> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const responseMode = input.responseMode ?? input.config.responseMode ?? 'json'
  const controller = new AbortController()
  const abortFromInput = () => controller.abort()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)

  if (input.signal) {
    if (input.signal.aborted)
      controller.abort()
    else
      input.signal.addEventListener('abort', abortFromInput, { once: true })
  }

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

    if (input.signal?.aborted)
      throw transportError(input, 'timeout', 'AI request was cancelled', 504)

    const body: Record<string, unknown> = {
      model: input.config.model,
      max_completion_tokens: input.maxCompletionTokens,
      stream: responseMode === 'stream',
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
    if (response.status === 408 || response.status === 504 || response.status === 524)
      throw transportError(input, 'timeout', `AI request timed out upstream (HTTP ${response.status})`, 504)
    if (!response.ok)
      throw transportError(input, 'upstream', `AI endpoint returned HTTP ${response.status}`, 502)

    if (responseMode === 'stream') {
      if (!response.body)
        throw transportError(input, 'invalid_response', 'AI stream response has no body', 502)
      return await responseStreamContent(response.body, input)
    }

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
    if (input.signal?.aborted)
      throw transportError(input, 'timeout', 'AI request was cancelled', 504)
    if (controller.signal.aborted)
      throw transportError(input, 'timeout', 'AI request timed out', 504)
    throw transportError(input, 'upstream', 'AI request failed', 502)
  }
  finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', abortFromInput)
  }
}
