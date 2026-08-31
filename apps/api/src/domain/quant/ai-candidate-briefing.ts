import type { QuantDecryptedAiConfig } from './ai-config'
import type { MomentumFactors } from './types'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { QuantError } from './errors'

export const QUANT_AI_CANDIDATE_BRIEFING_VERSION = 'candidate-briefing-v1' as const
export const QUANT_AI_CANDIDATE_BRIEFING_MAX_PROMPT_LENGTH = 18_000
export const QUANT_AI_CANDIDATE_BRIEFING_MAX_RESPONSE_LENGTH = 12_000
export const QUANT_AI_CANDIDATE_BRIEFING_MAX_EXPLANATION_LENGTH = 480

export type QuantCandidateBriefingPriorityLevel = 'urgent' | 'high' | 'normal' | 'low'
export type QuantCandidateBriefingAction = 'complete-data' | 'review' | 'check-risk' | 'check-value' | 'continue-research' | 'observe' | 'defer'
export type QuantCandidateBriefingMarkerStatus = 'unreviewed' | 'priority' | 'paused' | 'excluded'
export type QuantCandidateBriefingPersistenceState = 'first_seen' | 'confirming' | 'weakening' | 'not_in_latest' | 'insufficient_history'

export interface QuantCandidateBriefingPersistence {
  readonly sampleSize: number
  readonly appearanceCount: number
  readonly scoreDelta: number | null
  readonly state: QuantCandidateBriefingPersistenceState
}

export interface QuantCandidateBriefingValueQuality {
  readonly score: number | null
  readonly status: 'ready' | 'partial' | 'insufficient_data'
  readonly riskDeduction: number
}

export interface QuantCandidateBriefingCandidate {
  readonly tsCode: string
  readonly name: string | null
  readonly factorVersion?: string | null
  readonly score: number | null
  readonly changePercent: number | null
  readonly dataQuality: string
  readonly matchedFactors: readonly string[]
  readonly missingFactors: readonly string[]
  readonly pendingSync: boolean
  readonly pendingReason: string | null
  readonly factors?: Partial<MomentumFactors> | null
  readonly persistence?: QuantCandidateBriefingPersistence
  readonly valueQuality?: QuantCandidateBriefingValueQuality | null
}

export interface QuantCandidateBriefingMarker {
  readonly tsCode: string
  readonly status: QuantCandidateBriefingMarkerStatus
  readonly reviewDate: string | null
}

export interface QuantCandidateBriefingPriorityFact {
  readonly tsCode: string
  readonly name: string | null
  readonly factorVersion: string | null
  readonly priorityLevel: QuantCandidateBriefingPriorityLevel
  readonly priorityScore: number
  readonly changePercent: number | null
  readonly action: QuantCandidateBriefingAction
  readonly actionLabel: string
  readonly reasons: readonly string[]
  readonly markerStatus: QuantCandidateBriefingMarkerStatus
  readonly reviewState: 'overdue' | 'today' | 'upcoming' | 'scheduled' | 'unscheduled'
  readonly dataQuality: string
  readonly matchedFactors: readonly string[]
  readonly missingFactors: readonly string[]
  readonly pendingSync: boolean
  readonly persistence: QuantCandidateBriefingPersistence | null
  readonly valueQuality?: QuantCandidateBriefingValueQuality | null
}

export interface QuantAiCandidateBriefingFocusItem {
  readonly tsCode: string
  readonly name: string | null
  readonly priorityLevel: QuantCandidateBriefingPriorityLevel
  readonly priorityScore: number
  readonly actionLabel: string
  readonly reasons: readonly string[]
  readonly explanation: string
}

export interface QuantAiCandidateBriefing {
  readonly overview: string
  readonly focusItems: readonly QuantAiCandidateBriefingFocusItem[]
  readonly nextChecks: readonly string[]
  readonly citedCandidateCodes: readonly string[]
}

export interface QuantAiCandidateBriefingResult extends QuantAiCandidateBriefing {
  readonly briefingVersion: typeof QUANT_AI_CANDIDATE_BRIEFING_VERSION
  readonly provider: QuantDecryptedAiConfig['provider']
  readonly model: string
  readonly generatedAt: string
}

export interface QuantAiCandidateBriefingRequest {
  readonly candidates: readonly QuantCandidateBriefingPriorityFact[]
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

const PROHIBITED_TRADING_LANGUAGE = /买入|卖出|做多|做空|建议买|建议卖|目标价|价格目标|止损价|止盈|止损|涨到|跌到|收益预测|price[-\s]*target|target[-\s]*price|return[-\s]+forecast|\bbuy(?:ing)?\b|\bsell(?:ing)?\b|\blong\b|\bshort\b|stop[-\s]*loss|take[-\s]*profit/iu
const UNSUPPORTED_CAUSAL_LANGUAGE = /导致|造成|因为|由于|从而|因此|原因(?:是|在于)|源于|直接(?:导致|造成)|because|caused?\s+by|due\s+to/iu

const LEVEL_RANK: Record<QuantCandidateBriefingPriorityLevel, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
}

const SCORE_BASE: Record<QuantCandidateBriefingPriorityLevel, number> = {
  urgent: 76,
  high: 50,
  normal: 25,
  low: 0,
}

const ACTION_LABEL: Record<QuantCandidateBriefingAction, string> = {
  'complete-data': '补齐数据',
  'review': '优先复查',
  'check-risk': '核对风险',
  'check-value': '补看价值质量',
  'continue-research': '继续研究',
  'observe': '先观察',
  'defer': '暂缓研究',
}

function briefingError(
  code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' | 'QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION' | 'QUANT_AI_CANDIDATE_BRIEFING_TIMEOUT' | 'QUANT_AI_CANDIDATE_BRIEFING_UPSTREAM' | 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE',
  message: string,
  status: 422 | 502 | 503 | 504,
): QuantError {
  return new QuantError(code, message, status)
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value))
    target.push(value)
}

function normalizeToday(value?: string): string {
  if (value && isValidDateOnly(value))
    return value
  return new Date().toISOString().slice(0, 10)
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function reviewState(reviewDate: string | null, today: string): QuantCandidateBriefingPriorityFact['reviewState'] {
  if (!reviewDate || !isValidDateOnly(reviewDate))
    return 'unscheduled'
  if (reviewDate < today)
    return 'overdue'
  if (reviewDate === today)
    return 'today'
  const reviewTimestamp = Date.parse(`${reviewDate}T00:00:00.000Z`)
  const todayTimestamp = Date.parse(`${today}T00:00:00.000Z`)
  if (!Number.isFinite(reviewTimestamp) || !Number.isFinite(todayTimestamp))
    return 'unscheduled'
  return reviewTimestamp - todayTimestamp <= 7 * 24 * 60 * 60 * 1000 ? 'upcoming' : 'scheduled'
}

function factorLabel(value: string): string {
  return {
    ma5: '短线趋势',
    ma20: '20 日均线',
    new_high_20: '20 日新高',
    continuation: '连续上涨',
    volume_ratio: '成交活跃度',
    relative_strength: '池内强度',
  }[value] || value
}

function dataGapReason(candidate: QuantCandidateBriefingCandidate): string | null {
  if (candidate.pendingSync)
    return candidate.pendingReason || '尚未进入最新候选快照，先更新日线数据'
  if (candidate.dataQuality === 'ready')
    return null
  if (candidate.missingFactors.length)
    return `候选数据不完整，缺少 ${candidate.missingFactors.map(factorLabel).join('、')}`
  return '候选日线数据不足，先更新数据'
}

function persistenceReason(persistence: QuantCandidateBriefingPersistence | null): { reason: string | null, points: number } {
  if (!persistence)
    return { reason: null, points: 0 }
  if (persistence.state === 'weakening')
    return { reason: `信号减弱，相邻分数 ${persistence.scoreDelta === null ? '暂无变化' : `${persistence.scoreDelta >= 0 ? '+' : ''}${persistence.scoreDelta}`}`, points: 8 }
  if (persistence.state === 'first_seen')
    return { reason: '信号首次出现，先确认是否可重复', points: 4 }
  if (persistence.state === 'confirming')
    return { reason: `信号已持续出现 ${persistence.appearanceCount} / ${persistence.sampleSize} 次`, points: 2 }
  if (persistence.state === 'insufficient_history')
    return { reason: '信号历史不足，暂不判断持续性', points: 1 }
  return { reason: null, points: 0 }
}

function riskReasons(candidate: QuantCandidateBriefingCandidate): string[] {
  const reasons: string[] = []
  if (candidate.changePercent !== null && candidate.changePercent <= -3)
    reasons.push('近日日线回撤达到 3%')
  const consecutiveUpDays = finite(candidate.factors?.consecutiveUpDays)
  const volumeRatio = finite(candidate.factors?.volumeRatio)
  if (consecutiveUpDays !== null && consecutiveUpDays >= 5)
    reasons.push('连续上涨达到 5 日')
  if (volumeRatio !== null && volumeRatio >= 2)
    reasons.push('成交活跃度达到 2 倍')
  if (candidate.persistence?.state === 'weakening')
    reasons.push('信号持续性出现减弱')
  return reasons
}

function valueQualityReason(valueQuality: QuantCandidateBriefingCandidate['valueQuality']): { reason: string | null, points: number, concern: boolean } {
  if (valueQuality === undefined)
    return { reason: null, points: 0, concern: false }
  if (valueQuality === null)
    return { reason: '价值质量尚未形成可比较结果', points: 14, concern: true }
  if (valueQuality.status !== 'ready' || valueQuality.score === null)
    return { reason: '价值质量数据不完整，先补看估值和财务字段', points: 14, concern: true }
  if (valueQuality.score < 50)
    return { reason: `价值质量 ${valueQuality.score.toFixed(1)} 分，先核对低分维度`, points: 11, concern: true }
  if (valueQuality.riskDeduction >= 5)
    return { reason: `价值质量含 ${valueQuality.riskDeduction.toFixed(1)} 分风险扣分`, points: 8, concern: true }
  if (valueQuality.riskDeduction > 0)
    return { reason: `价值质量有 ${valueQuality.riskDeduction.toFixed(1)} 分风险扣分`, points: 3, concern: false }
  return { reason: null, points: 0, concern: false }
}

function actionLevel(action: QuantCandidateBriefingAction, review: QuantCandidateBriefingPriorityFact['reviewState']): QuantCandidateBriefingPriorityLevel {
  if (action === 'complete-data')
    return 'urgent'
  if (action === 'check-risk' || (action === 'review' && (review === 'overdue' || review === 'today')))
    return 'high'
  if (action === 'check-value' || action === 'continue-research' || (action === 'review' && review === 'upcoming'))
    return 'normal'
  return 'low'
}

function markerPoints(status: QuantCandidateBriefingMarkerStatus, hasDataGap: boolean): number {
  if (hasDataGap)
    return 0
  return { priority: 8, paused: -18, excluded: -30, unreviewed: 0 }[status]
}

function markerReason(status: QuantCandidateBriefingMarkerStatus): string | null {
  return {
    priority: '已标记为重点关注',
    paused: '已标记为暂缓研究',
    excluded: '已标记为已排除',
    unreviewed: null,
  }[status]
}

function buildPriority(
  candidate: QuantCandidateBriefingCandidate,
  marker: QuantCandidateBriefingMarker | undefined,
  today: string,
): QuantCandidateBriefingPriorityFact {
  const markerStatus = marker?.status || 'unreviewed'
  const review = reviewState(marker?.reviewDate || null, today)
  const dataReason = dataGapReason(candidate)
  const risks = riskReasons(candidate)
  const persistence = persistenceReason(candidate.persistence || null)
  const value = valueQualityReason(candidate.valueQuality)
  const hasDataGap = dataReason !== null
  let action: QuantCandidateBriefingAction
  if (hasDataGap)
    action = 'complete-data'
  else if (markerStatus === 'excluded' || markerStatus === 'paused')
    action = 'defer'
  else if (review === 'overdue' || review === 'today')
    action = 'review'
  else if (risks.length)
    action = 'check-risk'
  else if (value.concern)
    action = 'check-value'
  else if (review === 'upcoming')
    action = 'review'
  else if (markerStatus === 'priority' || (candidate.score ?? 0) >= 2 || ['first_seen', 'confirming'].includes(candidate.persistence?.state || ''))
    action = 'continue-research'
  else
    action = 'observe'

  const level = actionLevel(action, review)
  const reviewPoints = { overdue: 30, today: 26, upcoming: 15, scheduled: 4, unscheduled: 0 }[review]
  const supportingPoints = reviewPoints + Math.min(24, risks.length * 6) + value.points + persistence.points + Math.max(markerPoints(markerStatus, hasDataGap), 0)
  const priorityScore = action === 'complete-data'
    ? 100
    : Math.round(clamp(SCORE_BASE[level] + Math.min(24, supportingPoints * 0.5)))
  const reasons: string[] = []
  if (dataReason)
    addUnique(reasons, dataReason)
  if (action === 'defer' || markerStatus === 'priority')
    addUnique(reasons, markerReason(markerStatus) || '')
  if (review === 'overdue')
    addUnique(reasons, `复查已逾期${marker?.reviewDate ? `（${marker.reviewDate}）` : ''}`)
  else if (review === 'today')
    addUnique(reasons, '今天需要复查')
  else if (review === 'upcoming')
    addUnique(reasons, `近 7 日需要复查${marker?.reviewDate ? `（${marker.reviewDate}）` : ''}`)
  risks.forEach(reason => addUnique(reasons, reason))
  if (value.reason)
    addUnique(reasons, value.reason)
  if (persistence.reason)
    addUnique(reasons, persistence.reason)
  if (!reasons.length)
    addUnique(reasons, '暂无到期、风险或强信号依据，保持观察')

  return {
    tsCode: candidate.tsCode,
    name: candidate.name,
    factorVersion: candidate.factorVersion || null,
    priorityLevel: level,
    priorityScore,
    changePercent: candidate.changePercent,
    action,
    actionLabel: action === 'defer' && markerStatus === 'excluded' ? '已排除' : ACTION_LABEL[action],
    reasons: reasons.slice(0, 3),
    markerStatus,
    reviewState: review,
    dataQuality: candidate.dataQuality,
    matchedFactors: [...candidate.matchedFactors],
    missingFactors: [...candidate.missingFactors],
    pendingSync: candidate.pendingSync,
    ...(candidate.valueQuality === undefined ? {} : { valueQuality: candidate.valueQuality || null }),
    persistence: candidate.persistence || null,
  }
}

export function buildQuantCandidateBriefingFacts(
  candidates: readonly QuantCandidateBriefingCandidate[],
  markers: readonly QuantCandidateBriefingMarker[],
  today?: string,
): readonly QuantCandidateBriefingPriorityFact[] {
  const markerByCode = new Map(markers.map(marker => [marker.tsCode.toUpperCase(), marker]))
  const normalizedToday = normalizeToday(today)
  return candidates
    .map(candidate => buildPriority(candidate, markerByCode.get(candidate.tsCode.toUpperCase()), normalizedToday))
    .sort(compareQuantCandidateBriefingFacts)
}

export function compareQuantCandidateBriefingFacts(left: QuantCandidateBriefingPriorityFact, right: QuantCandidateBriefingPriorityFact): number {
  const levelDifference = LEVEL_RANK[right.priorityLevel] - LEVEL_RANK[left.priorityLevel]
  if (levelDifference !== 0)
    return levelDifference
  if (right.priorityScore !== left.priorityScore)
    return right.priorityScore - left.priorityScore
  return left.tsCode.localeCompare(right.tsCode)
}

function baseUrl(config: QuantDecryptedAiConfig): string {
  const value = config.baseUrl?.trim() || DEFAULT_BASE_URLS[config.provider]
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('protocol')
  }
  catch {
    throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION', 'AI base URL is invalid', 503)
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

function briefingPromptFact(fact: QuantCandidateBriefingPriorityFact, detailLength = 360): Record<string, unknown> {
  return {
    tsCode: boundedText(fact.tsCode, 20),
    name: fact.name ? boundedText(fact.name, 120) : null,
    factorVersion: fact.factorVersion ? boundedText(fact.factorVersion, 80) : null,
    priorityLevel: fact.priorityLevel,
    priorityScore: fact.priorityScore,
    action: fact.action,
    actionLabel: fact.actionLabel,
    reasons: fact.reasons.map(reason => boundedText(reason, detailLength)),
    markerStatus: fact.markerStatus,
    reviewState: fact.reviewState,
    dataQuality: boundedText(fact.dataQuality, 40),
    matchedFactors: fact.matchedFactors.slice(0, 6),
    missingFactors: fact.missingFactors.slice(0, 6),
    pendingSync: fact.pendingSync,
    changePercent: fact.changePercent,
    valueQuality: fact.valueQuality,
    persistence: fact.persistence
      ? {
          sampleSize: fact.persistence.sampleSize,
          appearanceCount: fact.persistence.appearanceCount,
          scoreDelta: fact.persistence.scoreDelta,
          state: fact.persistence.state,
        }
      : null,
  }
}

function briefingSummary(facts: readonly QuantCandidateBriefingPriorityFact[]): Record<string, number> {
  return {
    total: facts.length,
    urgent: facts.filter(fact => fact.priorityLevel === 'urgent').length,
    high: facts.filter(fact => fact.priorityLevel === 'high').length,
    normal: facts.filter(fact => fact.priorityLevel === 'normal').length,
    low: facts.filter(fact => fact.priorityLevel === 'low').length,
    dataGap: facts.filter(fact => fact.action === 'complete-data').length,
    review: facts.filter(fact => fact.action === 'review').length,
    risk: facts.filter(fact => fact.action === 'check-risk').length,
    continueResearch: facts.filter(fact => fact.action === 'continue-research').length,
  }
}

const CANDIDATE_BRIEFING_INSTRUCTION = [
  '请把下面的 Quant 候选研究队列整理成一份研究简报，只使用给定 JSON 中已有的事实。',
  '返回 JSON 对象，字段只能是 overview、focusItems、nextChecks、citedCandidateCodes。overview 用 1-3 句说明这一批候选的核对顺序。',
  'focusItems 最多 5 项，每项字段只能是 {"tsCode":"输入候选代码","explanation":"与该候选 reasons 和数据完整性事实相符的核对说明"}。不要在 focusItems 中重写 priorityLevel、priorityScore、action 或 reasons。',
  'nextChecks 最多 6 项，只写可执行的研究核对步骤；citedCandidateCodes 只能引用输入候选代码，最多 5 个。',
  '确定性优先级、分数、研究动作、原因和候选排序由系统提供，不能修改、重算或解释成交易结论。数据不足只能表述为需要补齐或核对。',
  '不要输出买入、卖出、做多、做空、目标价、止损、收益预测，也不要把同时出现的事实写成确定性因果关系。',
].join('\n')

export function buildQuantAiCandidateBriefingPrompt(facts: readonly QuantCandidateBriefingPriorityFact[]): string {
  const ranked = [...facts].sort(compareQuantCandidateBriefingFacts)
  const selected = ranked.slice(0, 5)
  const payloadCandidates = [
    JSON.stringify({ summary: briefingSummary(ranked), candidates: selected.map(fact => briefingPromptFact(fact)) }),
    JSON.stringify({ summary: briefingSummary(ranked), candidates: selected.map(fact => briefingPromptFact(fact, 180)) }),
    JSON.stringify({ summary: briefingSummary(ranked), candidates: selected.map(fact => ({
      tsCode: fact.tsCode,
      priorityLevel: fact.priorityLevel,
      priorityScore: fact.priorityScore,
      action: fact.action,
      reasons: fact.reasons.slice(0, 2),
      dataQuality: fact.dataQuality,
      persistence: fact.persistence?.state || null,
    })) }),
  ]
  const separator = '\n候选事实：'
  const maxPayloadLength = Math.max(1, QUANT_AI_CANDIDATE_BRIEFING_MAX_PROMPT_LENGTH - CANDIDATE_BRIEFING_INSTRUCTION.length - separator.length)
  const payload = payloadCandidates.find(value => value.length <= maxPayloadLength) || payloadCandidates.at(-1)!
  return `${CANDIDATE_BRIEFING_INSTRUCTION}${separator}${payload}`.slice(0, QUANT_AI_CANDIDATE_BRIEFING_MAX_PROMPT_LENGTH)
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
  throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE', message, 502)
}

function assertKnownFields(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const allowed = new Set(fields)
  if (Object.keys(value).some(key => !allowed.has(key)))
    invalid(`AI candidate briefing ${label} contains unknown fields`)
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    invalid(`AI candidate briefing field ${field} is invalid`)
  return value.trim()
}

function stringList(value: unknown, field: string, maxItems: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    invalid(`AI candidate briefing field ${field} is invalid`)
  return value.map(item => stringValue(item, field, maxLength))
}

function responseContent(value: unknown): string {
  const root = record(value)
  const choices = root?.choices
  if (!Array.isArray(choices) || !choices.length)
    invalid('AI candidate briefing response has no choices')
  const message = record(record(choices[0])?.message)
  return stringValue(message?.content, 'content', QUANT_AI_CANDIDATE_BRIEFING_MAX_RESPONSE_LENGTH)
}

function validateBriefing(value: unknown, facts: readonly QuantCandidateBriefingPriorityFact[]): QuantAiCandidateBriefing {
  const parsed = record(value)
  if (!parsed)
    invalid('AI candidate briefing is not an object')
  assertKnownFields(parsed, ['overview', 'focusItems', 'nextChecks', 'citedCandidateCodes'], 'response')
  const overview = stringValue(parsed.overview, 'overview', 1_200)
  const factByCode = new Map(facts.map(fact => [fact.tsCode.toUpperCase(), fact]))
  if (!Array.isArray(parsed.focusItems) || parsed.focusItems.length > 5)
    invalid('AI candidate briefing focus items are invalid')
  const focusItems = parsed.focusItems.map((value) => {
    const item = record(value)
    if (!item)
      invalid('AI candidate briefing focus item is invalid')
    assertKnownFields(item, ['tsCode', 'explanation'], 'focus item')
    const tsCode = stringValue(item.tsCode, 'focusItems.tsCode', 20).toUpperCase()
    const fact = factByCode.get(tsCode)
    if (!fact)
      invalid('AI candidate briefing cited an unknown candidate code')
    return { fact, explanation: stringValue(item.explanation, 'focusItems.explanation', QUANT_AI_CANDIDATE_BRIEFING_MAX_EXPLANATION_LENGTH) }
  })
  const dedupedFocusItems = [...new Map(focusItems.map(item => [item.fact.tsCode, item])).values()]
    .sort((left, right) => compareQuantCandidateBriefingFacts(left.fact, right.fact))
    .map(item => ({
      tsCode: item.fact.tsCode,
      name: item.fact.name,
      priorityLevel: item.fact.priorityLevel,
      priorityScore: item.fact.priorityScore,
      actionLabel: item.fact.actionLabel,
      reasons: item.fact.reasons,
      explanation: item.explanation,
    }))
  const nextChecks = stringList(parsed.nextChecks, 'nextChecks', 6, 360)
  const citedCandidateCodes = [...new Set(stringList(parsed.citedCandidateCodes, 'citedCandidateCodes', 5, 20).map(code => code.toUpperCase()))]
  if (citedCandidateCodes.some(code => !factByCode.has(code)))
    invalid('AI candidate briefing cited an unknown candidate code')
  const text = [overview, ...dedupedFocusItems.map(item => item.explanation), ...nextChecks].join('\n')
  if (PROHIBITED_TRADING_LANGUAGE.test(text))
    invalid('AI candidate briefing contains a prohibited trading conclusion')
  if (UNSUPPORTED_CAUSAL_LANGUAGE.test(text))
    invalid('AI candidate briefing contains an unsupported causal claim')
  return { overview, focusItems: dedupedFocusItems, nextChecks, citedCandidateCodes }
}

export async function generateQuantAiCandidateBriefing(input: QuantAiCandidateBriefingRequest): Promise<QuantAiCandidateBriefingResult> {
  const facts = [...input.candidates].sort(compareQuantCandidateBriefingFacts)
  const promptFacts = facts.slice(0, 5)
  const { config } = input
  if (!facts.length)
    throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_INPUT', 'Candidate snapshot is not available', 422)
  if (!config.apiKey && config.provider !== 'ollama')
    throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION', 'AI API key is not configured', 503)
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
          { role: 'system', content: '你是严格的 Quant 研究简报器，只能解释给定候选事实，不得创造事实、因果关系或交易指令。' },
          { role: 'user', content: buildQuantAiCandidateBriefingPrompt(facts) },
        ],
      }),
      signal: controller.signal,
    })
    if (response.status === 408 || response.status === 504)
      throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_TIMEOUT', 'AI candidate briefing request timed out', 504)
    if (!response.ok)
      throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_UPSTREAM', `AI candidate briefing endpoint returned HTTP ${response.status}`, 502)
    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE', 'AI candidate briefing response is not JSON', 502)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(responseContent(payload)))
    }
    catch (error) {
      if (error instanceof QuantError)
        throw error
      throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE', 'AI candidate briefing content is not valid JSON', 502)
    }
    const briefing = validateBriefing(parsed, promptFacts)
    return {
      briefingVersion: QUANT_AI_CANDIDATE_BRIEFING_VERSION,
      provider: config.provider,
      model: config.model,
      generatedAt: new Date().toISOString(),
      ...briefing,
    }
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    if (controller.signal.aborted)
      throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_TIMEOUT', 'AI candidate briefing request timed out', 504)
    throw briefingError('QUANT_AI_CANDIDATE_BRIEFING_UPSTREAM', 'AI candidate briefing request failed', 502)
  }
  finally {
    clearTimeout(timer)
  }
}
