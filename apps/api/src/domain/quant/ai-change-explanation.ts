import type { QuantDecryptedAiConfig } from './ai-config'
import type { QuantResearchEvidence, QuantResearchReport } from './research-report'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { QuantError } from './errors'

export const QUANT_AI_CHANGE_EXPLANATION_VERSION = 'research-change-explanation-v1' as const
export const QUANT_AI_CHANGE_EXPLANATION_MAX_PROMPT_LENGTH = 18_000
export const QUANT_AI_CHANGE_EXPLANATION_MAX_RESPONSE_LENGTH = 12_000
export const QUANT_AI_CHANGE_EXPLANATION_MAX_EXPLANATION_LENGTH = 480

export type QuantResearchChangeKind = 'improved' | 'weakened' | 'restored' | 'newly-missing' | 'persistent-missing' | 'changed' | 'incomparable' | 'added'
type QuantResearchInternalChangeKind = QuantResearchChangeKind | 'unchanged'
type QuantResearchChangeDirection = 'up' | 'down' | 'flat' | 'none'

export interface QuantAiChangeExplanationItem {
  readonly evidenceKey: string
  readonly label: string
  readonly kind: QuantResearchInternalChangeKind
  readonly kindLabel: string
  readonly explanation: string
}

export interface QuantAiChangeExplanation {
  readonly overview: string
  readonly changes: readonly QuantAiChangeExplanationItem[]
  readonly nextChecks: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantAiChangeExplanationResult extends QuantAiChangeExplanation {
  readonly changeExplanationVersion: typeof QUANT_AI_CHANGE_EXPLANATION_VERSION
  readonly provider: QuantDecryptedAiConfig['provider']
  readonly model: string
  readonly generatedAt: string
  readonly currentGeneratedAt: string
  readonly previousGeneratedAt: string
}

export interface QuantAiChangeExplanationRequest {
  readonly currentReport: QuantResearchReport
  readonly previousReport: QuantResearchReport
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

interface QuantResearchChangeComparisonItem {
  readonly key: string
  readonly label: string
  readonly kind: QuantResearchInternalChangeKind
  readonly kindLabel: string
  readonly direction: QuantResearchChangeDirection
  readonly previousValue: number | null
  readonly currentValue: number | null
  readonly previousStatus: QuantResearchEvidence['status'] | null
  readonly currentStatus: QuantResearchEvidence['status'] | null
  readonly previousObservedAt: string | null
  readonly currentObservedAt: string | null
  readonly previousSource: string | null
  readonly currentSource: string | null
  readonly previousFormulaVersion: string | null
  readonly currentFormulaVersion: string | null
  readonly currentDetail: string | null
}

interface QuantResearchChangeComparison {
  readonly currentGeneratedAt: string
  readonly previousGeneratedAt: string
  readonly items: readonly QuantResearchChangeComparisonItem[]
}

const DEFAULT_BASE_URLS: Record<QuantDecryptedAiConfig['provider'], string> = {
  openai_compatible: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
}

const PROHIBITED_TRADING_LANGUAGE = /买入|卖出|做多|做空|建议买|建议卖|目标价|价格目标|止损价|止盈|止损|涨到|跌到|收益预测|price[-\s]*target|target[-\s]*price|return[-\s]+forecast|\bbuy(?:ing)?\b|\bsell(?:ing)?\b|\blong\b|\bshort\b|stop[-\s]*loss|take[-\s]*profit/iu
const UNSUPPORTED_CAUSAL_LANGUAGE = /导致|造成|因为|由于|从而|因此|原因(?:是|在于)|源于|直接(?:导致|造成)|because|caused?\s+by|due\s+to/iu
const STATUS_RANK: Record<QuantResearchEvidence['status'], number> = {
  missing: 0,
  fail: 1,
  caution: 2,
  pass: 3,
}
const CHANGE_PRIORITY: Record<QuantResearchInternalChangeKind, number> = {
  'newly-missing': 0,
  'weakened': 1,
  'persistent-missing': 2,
  'restored': 3,
  'improved': 4,
  'added': 5,
  'changed': 6,
  'incomparable': 7,
  'unchanged': 8,
}

function changeError(
  code: 'QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION' | 'QUANT_AI_CHANGE_EXPLANATION_TIMEOUT' | 'QUANT_AI_CHANGE_EXPLANATION_UPSTREAM' | 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE',
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
    throw changeError('QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION', 'AI base URL is invalid', 503)
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

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function changeLabel(kind: QuantResearchInternalChangeKind, direction: QuantResearchChangeDirection): string {
  if (kind === 'improved')
    return '状态改善'
  if (kind === 'weakened')
    return '状态转弱'
  if (kind === 'restored')
    return '数据恢复'
  if (kind === 'newly-missing')
    return '转为缺失'
  if (kind === 'persistent-missing')
    return '持续缺失'
  if (kind === 'added')
    return '新增证据'
  if (kind === 'changed')
    return direction === 'up' ? '数值上升' : direction === 'down' ? '数值下降' : '数值变化'
  if (kind === 'unchanged')
    return '无明显变化'
  return '口径变化'
}

function compareEvidence(previous: QuantResearchEvidence | null, current: QuantResearchEvidence | null): QuantResearchChangeComparisonItem {
  const previousValue = previous?.status === 'missing' ? null : finite(previous?.value)
  const currentValue = current?.status === 'missing' ? null : finite(current?.value)
  const provenanceChanged = Boolean(previous && current && (previous.source !== current.source || previous.formulaVersion !== current.formulaVersion))
  const valueDelta = !provenanceChanged && previousValue !== null && currentValue !== null ? round(currentValue - previousValue) : null
  const direction: QuantResearchChangeDirection = valueDelta === null ? 'none' : valueDelta > 0 ? 'up' : valueDelta < 0 ? 'down' : 'flat'
  let kind: QuantResearchInternalChangeKind

  if (!previous && current)
    kind = 'added'
  else if (previous?.status === 'missing' && current?.status === 'missing')
    kind = 'persistent-missing'
  else if (previous?.status === 'missing' && current?.status !== 'missing')
    kind = 'restored'
  else if (previous?.status !== 'missing' && current?.status === 'missing')
    kind = 'newly-missing'
  else if (previous && current && STATUS_RANK[current.status] > STATUS_RANK[previous.status])
    kind = 'improved'
  else if (previous && current && STATUS_RANK[current.status] < STATUS_RANK[previous.status])
    kind = 'weakened'
  else if (provenanceChanged)
    kind = 'incomparable'
  else
    kind = valueDelta !== null && valueDelta !== 0 ? 'changed' : 'unchanged'

  return {
    key: current?.key || previous?.key || '',
    label: current?.label || previous?.label || '',
    kind,
    kindLabel: changeLabel(kind, direction),
    direction,
    previousValue,
    currentValue,
    previousStatus: previous?.status || null,
    currentStatus: current?.status || null,
    previousObservedAt: previous?.observedAt || null,
    currentObservedAt: current?.observedAt || null,
    previousSource: previous?.source || null,
    currentSource: current?.source || null,
    previousFormulaVersion: previous?.formulaVersion || null,
    currentFormulaVersion: current?.formulaVersion || null,
    currentDetail: current?.detail || null,
  }
}

function buildChangeComparison(currentReport: QuantResearchReport, previousReport: QuantResearchReport): QuantResearchChangeComparison {
  const previousByKey = new Map(previousReport.evidence.map(item => [item.key, item]))
  const currentByKey = new Map(currentReport.evidence.map(item => [item.key, item]))
  const keys = [...new Set([...currentReport.evidence.map(item => item.key), ...previousReport.evidence.map(item => item.key)])]
  const items = keys
    .map(key => compareEvidence(previousByKey.get(key) || null, currentByKey.get(key) || null))
    .filter(item => item.kind !== 'unchanged')
    .filter(item => item.currentStatus !== null)
    .sort((left, right) => CHANGE_PRIORITY[left.kind] - CHANGE_PRIORITY[right.kind] || left.label.localeCompare(right.label))
    .slice(0, 8)
  return {
    currentGeneratedAt: currentReport.generatedAt,
    previousGeneratedAt: previousReport.generatedAt,
    items,
  }
}

function reportPrompt(report: QuantResearchReport): Record<string, unknown> {
  return {
    reportVersion: boundedText(report.reportVersion, 40),
    tsCode: boundedText(report.tsCode, 20),
    status: boundedText(report.status, 40),
    action: boundedText(report.action, 40),
    score: report.score,
    generatedAt: boundedText(report.generatedAt, 80),
  }
}

function changePrompt(item: QuantResearchChangeComparisonItem): Record<string, unknown> {
  return {
    evidenceKey: boundedText(item.key, 80),
    label: boundedText(item.label, 160),
    kind: item.kind,
    kindLabel: item.kindLabel,
    direction: item.direction,
    previous: {
      value: item.previousValue,
      status: item.previousStatus,
      observedAt: item.previousObservedAt,
      source: item.previousSource,
      formulaVersion: item.previousFormulaVersion,
    },
    current: {
      value: item.currentValue,
      status: item.currentStatus,
      observedAt: item.currentObservedAt,
      source: item.currentSource,
      formulaVersion: item.currentFormulaVersion,
      detail: item.currentDetail ? boundedText(item.currentDetail, 360) : null,
    },
  }
}

const CHANGE_EXPLANATION_INSTRUCTION = [
  '请解释同一只股票两份 Quant 确定性研究报告之间最值得关注的证据变化，只使用给定 JSON 中已有的事实。',
  '返回 JSON 对象，字段只能是 overview、changes、nextChecks、citedEvidenceKeys。changes 每项只能是 {"evidenceKey":"变化输入中的 key","explanation":"对观察到的变化或口径限制的解释"}，最多 8 项；nextChecks 最多 6 项；citedEvidenceKeys 最多 16 项。',
  '不要重算、修改或替代报告的 status、action、score；不要补充外部数值、来源、日期或事实。source、formulaVersion、报告期不同只能描述为口径变化或核对线索。',
  '只能描述观察到的前后变化、数据可用性和人工核对路径，不把同时发生的变化说成因果关系，不使用“导致”“原因是”等确定性因果表述。',
  '不要写买入、卖出、做多、做空、目标价、止损价、止盈或收益预测。',
].join('\n')

export function buildQuantAiChangeExplanationPrompt(currentReport: QuantResearchReport, previousReport: QuantResearchReport): string {
  const comparison = buildChangeComparison(currentReport, previousReport)
  const payloadCandidates = [
    JSON.stringify({ current: reportPrompt(currentReport), previous: reportPrompt(previousReport), changes: comparison.items.map(changePrompt) }),
    JSON.stringify({ current: reportPrompt(currentReport), previous: reportPrompt(previousReport), changes: comparison.items.map(item => ({ evidenceKey: item.key, label: item.label, kind: item.kind, previousValue: item.previousValue, currentValue: item.currentValue, previousStatus: item.previousStatus, currentStatus: item.currentStatus, currentDetail: item.currentDetail ? boundedText(item.currentDetail, 160) : null })) }),
    JSON.stringify({ current: reportPrompt(currentReport), previous: reportPrompt(previousReport), changes: comparison.items.slice(0, 4).map(item => ({ evidenceKey: item.key, kind: item.kind, previousValue: item.previousValue, currentValue: item.currentValue, currentStatus: item.currentStatus })) }),
  ]
  const separator = '\n变化数据：'
  const maxPayloadLength = Math.max(1, QUANT_AI_CHANGE_EXPLANATION_MAX_PROMPT_LENGTH - CHANGE_EXPLANATION_INSTRUCTION.length - separator.length)
  const payload = payloadCandidates.find(value => value.length <= maxPayloadLength) || payloadCandidates.at(-1)!
  return `${CHANGE_EXPLANATION_INSTRUCTION}${separator}${payload}`.slice(0, QUANT_AI_CHANGE_EXPLANATION_MAX_PROMPT_LENGTH)
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
  throw changeError('QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE', message, 502)
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    invalid(`AI change explanation field ${field} is invalid`)
  return value.trim()
}

function stringList(value: unknown, field: string, maxItems: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    invalid(`AI change explanation field ${field} is invalid`)
  return value.map(item => stringValue(item, field, maxLength))
}

function responseContent(value: unknown): string {
  const root = record(value)
  const choices = root?.choices
  if (!Array.isArray(choices) || !choices.length)
    invalid('AI change explanation response has no choices')
  const message = record(record(choices[0])?.message)
  return stringValue(message?.content, 'content', QUANT_AI_CHANGE_EXPLANATION_MAX_RESPONSE_LENGTH)
}

function validateChangeExplanation(value: unknown, currentReport: QuantResearchReport, comparison: QuantResearchChangeComparison): QuantAiChangeExplanation {
  const parsed = record(value)
  if (!parsed)
    invalid('AI change explanation is not an object')
  const allowedFields = new Set(['overview', 'changes', 'nextChecks', 'citedEvidenceKeys'])
  if (Object.keys(parsed).some(key => !allowedFields.has(key)))
    invalid('AI change explanation contains unknown fields')
  const overview = stringValue(parsed.overview, 'overview', 1_200)
  if (!Array.isArray(parsed.changes) || parsed.changes.length > 8)
    invalid('AI change explanation changes are invalid')
  const allowedChangeKeys = new Set(comparison.items.map(item => item.key))
  const changes = parsed.changes.map((item) => {
    const change = record(item)
    if (!change)
      invalid('AI change explanation change is invalid')
    if (Object.keys(change).some(key => key !== 'evidenceKey' && key !== 'explanation'))
      invalid('AI change explanation change contains unknown fields')
    const evidenceKey = stringValue(change.evidenceKey, 'changes.evidenceKey', 80)
    const explanation = stringValue(change.explanation, 'changes.explanation', QUANT_AI_CHANGE_EXPLANATION_MAX_EXPLANATION_LENGTH)
    if (!allowedChangeKeys.has(evidenceKey) || !currentReport.evidence.some(item => item.key === evidenceKey))
      invalid('AI change explanation cited an unknown changed evidence key')
    return { evidenceKey, explanation }
  })
  const dedupedChanges = [...new Map(changes.map(item => [item.evidenceKey, item])).values()]
  const nextChecks = stringList(parsed.nextChecks, 'nextChecks', 6, 360)
  const rawCitations = parsed.citedEvidenceKeys
  if (!Array.isArray(rawCitations) || rawCitations.length > 16 || rawCitations.some(item => typeof item !== 'string'))
    invalid('AI change explanation citations are invalid')
  const allowedEvidenceKeys = new Set(currentReport.evidence.map(item => item.key))
  const citedEvidenceKeys = [...new Set((rawCitations as string[]).map(item => stringValue(item, 'citedEvidenceKeys', 80)))]
  if (citedEvidenceKeys.some(key => !allowedEvidenceKeys.has(key)))
    invalid('AI change explanation cited an unknown evidence key')
  const text = [overview, ...dedupedChanges.map(item => item.explanation), ...nextChecks].join('\n')
  if (PROHIBITED_TRADING_LANGUAGE.test(text))
    invalid('AI change explanation contains a prohibited trading conclusion')
  if (UNSUPPORTED_CAUSAL_LANGUAGE.test(text))
    invalid('AI change explanation contains an unsupported causal claim')
  return {
    overview,
    changes: dedupedChanges.map((item) => {
      const source = comparison.items.find(candidate => candidate.key === item.evidenceKey)!
      return {
        evidenceKey: item.evidenceKey,
        label: source.label,
        kind: source.kind,
        kindLabel: source.kindLabel,
        explanation: item.explanation,
      }
    }),
    nextChecks,
    citedEvidenceKeys,
  }
}

export async function generateQuantAiChangeExplanation(input: QuantAiChangeExplanationRequest): Promise<QuantAiChangeExplanationResult> {
  const { currentReport, previousReport, config } = input
  if (currentReport.tsCode !== previousReport.tsCode)
    throw changeError('QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE', 'AI change explanation requires two distinct reports for the same stock', 502)
  if (!config.apiKey && config.provider !== 'ollama')
    throw changeError('QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION', 'AI API key is not configured', 503)
  const comparison = buildChangeComparison(currentReport, previousReport)
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
        max_tokens: 1400,
        messages: [
          { role: 'system', content: '你是严格的研究变化解释器，只能解释给定的两份报告差异，不得创造事实、因果关系或交易指令。' },
          { role: 'user', content: buildQuantAiChangeExplanationPrompt(currentReport, previousReport) },
        ],
      }),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw changeError('QUANT_AI_CHANGE_EXPLANATION_TIMEOUT', 'AI change explanation request timed out', 504)
    if (!response.ok)
      throw changeError('QUANT_AI_CHANGE_EXPLANATION_UPSTREAM', `AI change explanation endpoint returned HTTP ${response.status}`, 502)
    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw changeError('QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE', 'AI change explanation response is not JSON', 502)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(responseContent(payload)))
    }
    catch (error) {
      if (error instanceof QuantError)
        throw error
      throw changeError('QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE', 'AI change explanation content is not valid JSON', 502)
    }
    const explanation = validateChangeExplanation(parsed, currentReport, comparison)
    return {
      changeExplanationVersion: QUANT_AI_CHANGE_EXPLANATION_VERSION,
      provider: config.provider,
      model: config.model,
      generatedAt: new Date().toISOString(),
      currentGeneratedAt: comparison.currentGeneratedAt,
      previousGeneratedAt: comparison.previousGeneratedAt,
      ...explanation,
    }
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw changeError('QUANT_AI_CHANGE_EXPLANATION_TIMEOUT', 'AI change explanation request timed out', 504)
    throw changeError('QUANT_AI_CHANGE_EXPLANATION_UPSTREAM', 'AI change explanation request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
