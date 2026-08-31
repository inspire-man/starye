import type { QuantDecryptedAiConfig } from './ai-config'
import type { QuantResearchReport } from './research-report'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { QuantError } from './errors'

export const QUANT_AI_QUESTION_VERSION = 'research-question-v1' as const
export const QUANT_AI_QUESTION_MAX_PROMPT_LENGTH = 16_000
export const QUANT_AI_QUESTION_MAX_RESPONSE_LENGTH = 12_000
export const QUANT_AI_QUESTION_MAX_ANSWER_LENGTH = 8_000

export interface QuantAiQuestion {
  readonly answer: string
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantAiQuestionResult extends QuantAiQuestion {
  readonly questionVersion: typeof QUANT_AI_QUESTION_VERSION
  readonly provider: QuantDecryptedAiConfig['provider']
  readonly model: string
  readonly generatedAt: string
  readonly question: string
}

export interface QuantAiQuestionRequest {
  readonly report: QuantResearchReport
  readonly question: string
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

const PROHIBITED_TRADING_LANGUAGE = /买入|卖出|做多|做空|建议买|建议卖|目标价|价格目标|止损价|止盈|止损|涨到|跌到|收益预测|price[-\s]*target|target[-\s]*price|return[-\s]+forecast|buy(?:ing)?(?:\s+recommendation)?|sell(?:ing)?(?:\s+recommendation)?|\blong\b|\bshort\b|stop[-\s]*loss|take[-\s]*profit/iu

function questionError(
  code: 'QUANT_AI_QUESTION_CONFIGURATION' | 'QUANT_AI_QUESTION_TIMEOUT' | 'QUANT_AI_QUESTION_UPSTREAM' | 'QUANT_AI_QUESTION_INVALID_RESPONSE',
  message: string,
  status: 502 | 503 | 504,
): QuantError {
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
    throw questionError('QUANT_AI_QUESTION_CONFIGURATION', 'AI base URL is invalid', 503)
  }
  return value.replace(/\/+$/u, '')
}

function chatCompletionsUrl(config: QuantDecryptedAiConfig): string {
  const value = baseUrl(config)
  return value.endsWith('/chat/completions') ? value : `${value}/chat/completions`
}

function boundedText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

function reportPrompt(report: QuantResearchReport): Record<string, unknown> {
  return {
    reportVersion: boundedText(report.reportVersion, 40),
    tsCode: boundedText(report.tsCode, 20),
    name: report.name ? boundedText(report.name, 120) : null,
    generatedAt: boundedText(report.generatedAt, 80),
    status: boundedText(report.status, 40),
    action: boundedText(report.action, 40),
    score: report.score,
    headline: boundedText(report.headline, 480),
    factorModel: report.factorModel
      ? {
          modelVersion: boundedText(report.factorModel.modelVersion, 80),
          score: report.factorModel.score,
          coverage: report.factorModel.coverage,
          configuration: report.factorModel.configuration ?? null,
          factors: report.factorModel.factors.slice(0, 8).map(factor => ({
            key: factor.key,
            label: boundedText(factor.label, 80),
            weight: factor.weight,
            source: boundedText(factor.source, 180),
            status: factor.status,
            score: factor.score,
          })),
        }
      : null,
    decision: report.decision
      ? {
          recommendation: report.decision.recommendation,
          deterministicScore: report.decision.deterministicScore,
          confidence: report.decision.confidence,
          coverage: report.decision.coverage,
          headline: boundedText(report.decision.headline, 480),
        }
      : null,
    sources: report.sources.slice(0, 16).map(source => ({
      id: boundedText(source.id, 80),
      name: boundedText(source.name, 180),
      observedAt: source.observedAt,
      formulaVersion: boundedText(source.formulaVersion, 120),
    })),
    evidence: report.evidence.slice(0, 32).map(item => ({
      key: boundedText(item.key, 80),
      dimension: boundedText(item.dimension, 80),
      label: boundedText(item.label, 160),
      status: boundedText(item.status, 40),
      value: item.value,
      threshold: boundedText(item.threshold, 180),
      source: boundedText(item.source, 180),
      observedAt: item.observedAt,
      formulaVersion: boundedText(item.formulaVersion, 120),
      optional: item.optional === true,
      detail: boundedText(item.detail, 360),
    })),
  }
}

export function buildQuantAiQuestionPrompt(report: QuantResearchReport, question: string): string {
  const instruction = [
    '请回答用户关于下面这份 Quant 确定性研究报告的问题。只能使用报告中已有的事实，不得补充外部知识、猜测或改变报告结论。',
    '返回一个 JSON 对象，字段只能是 answer 和 citedEvidenceKeys；answer 是直接回答用户问题的证据解释，citedEvidenceKeys 是报告中支持回答的 evidence key 数组，最多 16 个。',
    '如果报告没有足够信息，请明确说明报告中没有足够证据，并引用相关限制证据；不要编造事实。不要输出买入、卖出、做多、做空、目标价、止损价、止盈或收益预测。',
  ].join('\n')
  const separator = '\n用户问题：'
  const reportSeparator = '\n研究报告：'
  const questionPayload = JSON.stringify(question.trim())
  const reportPayload = JSON.stringify(reportPrompt(report))
  const maxReportLength = Math.max(1, QUANT_AI_QUESTION_MAX_PROMPT_LENGTH - instruction.length - separator.length - questionPayload.length - reportSeparator.length)
  const boundedReport = reportPayload.length <= maxReportLength
    ? reportPayload
    : JSON.stringify({
        reportVersion: report.reportVersion,
        tsCode: report.tsCode,
        status: report.status,
        action: report.action,
        factorModel: report.factorModel
          ? {
              modelVersion: report.factorModel.modelVersion,
              score: report.factorModel.score,
              coverage: report.factorModel.coverage,
              configuration: report.factorModel.configuration ?? null,
            }
          : null,
        decision: report.decision
          ? {
              recommendation: report.decision.recommendation,
              deterministicScore: report.decision.deterministicScore,
              coverage: report.decision.coverage,
            }
          : null,
        evidence: report.evidence.slice(0, 4).map(item => ({
          key: boundedText(item.key, 80),
          status: boundedText(item.status, 40),
          value: item.value,
          detail: boundedText(item.detail, 120),
        })),
      })
  return `${instruction}${separator}${questionPayload}${reportSeparator}${boundedReport}`.slice(0, QUANT_AI_QUESTION_MAX_PROMPT_LENGTH)
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

function invalid(message: string): never {
  throw questionError('QUANT_AI_QUESTION_INVALID_RESPONSE', message, 502)
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    invalid(`AI question field ${field} is invalid`)
  return value.trim()
}

function validateQuestion(value: unknown, report: QuantResearchReport): QuantAiQuestion {
  const parsed = record(value)
  if (!parsed)
    invalid('AI question response is not an object')
  if (Object.keys(parsed).some(key => key !== 'answer' && key !== 'citedEvidenceKeys'))
    invalid('AI question response contains unknown fields')
  const answer = stringValue(parsed.answer, 'answer', QUANT_AI_QUESTION_MAX_ANSWER_LENGTH)
  const rawKeys = parsed.citedEvidenceKeys
  if (!Array.isArray(rawKeys) || rawKeys.length > 16 || rawKeys.some(key => typeof key !== 'string'))
    invalid('AI question evidence references are invalid')
  const allowed = new Set(report.evidence.map(item => item.key))
  const citedEvidenceKeys = [...new Set(rawKeys as string[])]
  if (citedEvidenceKeys.some(key => !allowed.has(key)))
    invalid('AI question cited an unknown evidence key')
  if (PROHIBITED_TRADING_LANGUAGE.test(answer))
    invalid('AI question contains a prohibited trading instruction')
  return { answer, citedEvidenceKeys }
}

function responseContent(value: unknown): string {
  const root = record(value)
  const choices = root?.choices
  if (!Array.isArray(choices) || !choices.length)
    invalid('AI question response has no choices')
  const message = record(record(choices[0])?.message)
  return stringValue(message?.content, 'content', QUANT_AI_QUESTION_MAX_RESPONSE_LENGTH)
}

export async function generateQuantAiQuestion(input: QuantAiQuestionRequest): Promise<QuantAiQuestionResult> {
  const { report, question, config } = input
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion || normalizedQuestion.length > 500)
    throw questionError('QUANT_AI_QUESTION_INVALID_RESPONSE', 'AI question is invalid', 502)
  if (!config.apiKey && config.provider !== 'ollama')
    throw questionError('QUANT_AI_QUESTION_CONFIGURATION', 'AI API key is not configured', 503)
  const timeoutMs = resolveQuantAiGenerationTimeout(input.timeoutMs)
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
        max_tokens: 1200,
        messages: [
          { role: 'system', content: '你是严格的研究报告问答器，只能回答给定报告中的证据，不得创造事实或给出交易指令。' },
          { role: 'user', content: buildQuantAiQuestionPrompt(report, normalizedQuestion) },
        ],
      }),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw questionError('QUANT_AI_QUESTION_TIMEOUT', 'AI question request timed out', 504)
    if (!response.ok)
      throw questionError('QUANT_AI_QUESTION_UPSTREAM', `AI question endpoint returned HTTP ${response.status}`, 502)
    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw questionError('QUANT_AI_QUESTION_INVALID_RESPONSE', 'AI question response is not JSON', 502)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(responseContent(payload)))
    }
    catch (error) {
      if (error instanceof QuantError)
        throw error
      throw questionError('QUANT_AI_QUESTION_INVALID_RESPONSE', 'AI question content is not valid JSON', 502)
    }
    const result = validateQuestion(parsed, report)
    return {
      questionVersion: QUANT_AI_QUESTION_VERSION,
      provider: config.provider,
      model: config.model,
      generatedAt: new Date().toISOString(),
      question: normalizedQuestion,
      ...result,
    }
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw questionError('QUANT_AI_QUESTION_TIMEOUT', 'AI question request timed out', 504)
    throw questionError('QUANT_AI_QUESTION_UPSTREAM', 'AI question request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
