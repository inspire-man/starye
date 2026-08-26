import type { QuantDecryptedAiConfig } from './ai-config'
import type { QuantResearchReport } from './research-report'
import { QuantError } from './errors'

export const QUANT_AI_SUMMARY_VERSION = 'research-summary-v1' as const
export const QUANT_AI_SUMMARY_MAX_PROMPT_LENGTH = 16_000
export const QUANT_AI_SUMMARY_MAX_RESPONSE_LENGTH = 8_000

export interface QuantAiSummary {
  readonly summaryVersion: typeof QUANT_AI_SUMMARY_VERSION
  readonly overview: string
  readonly supports: readonly string[]
  readonly concerns: readonly string[]
  readonly nextChecks: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantAiSummaryRequest {
  readonly report: QuantResearchReport
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const DEFAULT_BASE_URLS: Record<QuantDecryptedAiConfig['provider'], string> = {
  openai_compatible: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
}

function summaryError(code: 'QUANT_AI_SUMMARY_CONFIGURATION' | 'QUANT_AI_SUMMARY_TIMEOUT' | 'QUANT_AI_SUMMARY_UPSTREAM' | 'QUANT_AI_SUMMARY_INVALID_RESPONSE', message: string, status: 502 | 503 | 504): QuantError {
  return new QuantError(code, message, status)
}

function baseUrl(config: QuantDecryptedAiConfig): string {
  const value = config.baseUrl?.trim() || DEFAULT_BASE_URLS[config.provider]
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('protocol')
  }
  catch {
    throw summaryError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI base URL is invalid', 503)
  }
  return value.replace(/\/+$/u, '')
}

function chatCompletionsUrl(config: QuantDecryptedAiConfig): string {
  const value = baseUrl(config)
  return value.endsWith('/chat/completions') ? value : `${value}/chat/completions`
}

function reportPrompt(report: QuantResearchReport): string {
  const payload = {
    reportVersion: report.reportVersion,
    tsCode: report.tsCode,
    name: report.name,
    status: report.status,
    action: report.action,
    score: report.score,
    headline: report.headline,
    sources: report.sources,
    evidence: report.evidence.slice(0, 32).map(item => ({
      key: item.key,
      dimension: item.dimension,
      label: item.label,
      status: item.status,
      value: item.value,
      threshold: item.threshold,
      source: item.source,
      observedAt: item.observedAt,
      formulaVersion: item.formulaVersion,
      optional: item.optional === true,
      detail: item.detail.slice(0, 360),
    })),
  }
  const serialized = JSON.stringify(payload)
  return serialized.length <= QUANT_AI_SUMMARY_MAX_PROMPT_LENGTH ? serialized : serialized.slice(0, QUANT_AI_SUMMARY_MAX_PROMPT_LENGTH)
}

export function buildQuantAiSummaryPrompt(report: QuantResearchReport): string {
  return [
    '请把下面这份 Quant 确定性研究报告解释给金融初学者。只使用 JSON 中已有的事实和 evidence key。',
    '返回一个 JSON 对象，字段必须是 overview、supports、concerns、nextChecks、citedEvidenceKeys；数组最多各 6 项。',
    'overview 用 1-3 句说明当前证据代表什么；supports、concerns、nextChecks 都写成可核对的短句。',
    '不要重算或修改 status、action、score；不要添加报告中不存在的数值、来源或证据 key。',
    '对于 optional 的 AkShare 证据，必须保留 source、observedAt 和 formulaVersion；报告期不同或 provider 数值不同只能表述为交叉核对线索，并明确需要人工核对。',
    '不要写目标价、未来收益预测或直接交易指令。',
    `研究报告：${reportPrompt(report)}`,
  ].join('\n')
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('```'))
    return trimmed
  return trimmed.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '').trim()
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', `AI summary field ${field} is invalid`, 502)
  return value.trim()
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 6)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', `AI summary field ${field} is invalid`, 502)
  return value.map(item => stringValue(item, field, 240))
}

function citedEvidenceKeys(value: unknown, report: QuantResearchReport): readonly string[] {
  if (!Array.isArray(value) || value.length > 16 || value.some(item => typeof item !== 'string'))
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary evidence references are invalid', 502)
  const allowed = new Set(report.evidence.map(item => item.key))
  const keys = [...new Set(value as string[])]
  if (keys.some(key => !allowed.has(key)))
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary cited an unknown evidence key', 502)
  return keys
}

function validateSummary(value: unknown, report: QuantResearchReport): QuantAiSummary {
  const parsed = record(value)
  if (!parsed)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary is not an object', 502)
  const overview = stringValue(parsed.overview, 'overview', 800)
  const supports = stringList(parsed.supports, 'supports')
  const concerns = stringList(parsed.concerns, 'concerns')
  const nextChecks = stringList(parsed.nextChecks, 'nextChecks')
  const cited = citedEvidenceKeys(parsed.citedEvidenceKeys, report)
  const text = [overview, ...supports, ...concerns, ...nextChecks].join('\n')
  if (/买入|卖出|目标价|收益预测|price\s*target|return\s+forecast|\bbuy\b|\bsell\b/iu.test(text))
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary contains a prohibited trading conclusion', 502)
  return {
    summaryVersion: QUANT_AI_SUMMARY_VERSION,
    overview,
    supports,
    concerns,
    nextChecks,
    citedEvidenceKeys: cited,
  }
}

function responseContent(value: unknown): string {
  const root = record(value)
  const choices = root?.choices
  if (!Array.isArray(choices) || !choices.length)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI response has no choices', 502)
  const message = record(choices[0] && record(choices[0])?.message)
  return stringValue(message?.content, 'content', QUANT_AI_SUMMARY_MAX_RESPONSE_LENGTH)
}

export async function generateQuantAiSummary(input: QuantAiSummaryRequest): Promise<QuantAiSummary> {
  const { report, config } = input
  if (!config.apiKey && config.provider !== 'ollama')
    throw summaryError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI API key is not configured', 503)
  const timeoutMs = Number.isFinite(input.timeoutMs) && (input.timeoutMs ?? 0) > 0 ? Math.min(input.timeoutMs!, 30_000) : 20_000
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
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
        temperature: 0.2,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: '你是严格的证据解释器，只能解释给定研究报告，不得创造事实或交易指令。' },
          { role: 'user', content: buildQuantAiSummaryPrompt(report) },
        ],
      }),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw summaryError('QUANT_AI_SUMMARY_TIMEOUT', 'AI summary request timed out', 504)
    if (!response.ok)
      throw summaryError('QUANT_AI_SUMMARY_UPSTREAM', `AI summary endpoint returned HTTP ${response.status}`, 502)
    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary response is not JSON', 502)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(responseContent(payload)))
    }
    catch {
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary content is not valid JSON', 502)
    }
    return validateSummary(parsed, report)
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw summaryError('QUANT_AI_SUMMARY_TIMEOUT', 'AI summary request timed out', 504)
    throw summaryError('QUANT_AI_SUMMARY_UPSTREAM', 'AI summary request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
