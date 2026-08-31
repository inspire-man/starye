import type { QuantDecryptedAiConfig } from './ai-config'
import type { QuantRecommendation, QuantResearchFactor, QuantResearchFactorKey } from './decision-recommendation'
import type { QuantResearchReport } from './research-report'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { requestQuantAiCompletion } from './ai-transport'
import { QuantError } from './errors'

export const QUANT_AI_SUMMARY_VERSION = 'research-summary-v2' as const
export const QUANT_AI_DECISION_VERSION = 'ai-decision-v1' as const
export const QUANT_AI_SUMMARY_MAX_PROMPT_LENGTH = 16_000
export const QUANT_AI_SUMMARY_MAX_RESPONSE_LENGTH = 8_000

export interface QuantAiSummary {
  readonly summaryVersion: typeof QUANT_AI_SUMMARY_VERSION | 'research-summary-v1'
  readonly overview: string
  readonly supports: readonly string[]
  readonly concerns: readonly string[]
  readonly nextChecks: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
  readonly factorReviews: readonly QuantAiFactorReview[]
  readonly decisionReview: QuantAiDecisionReview | null
}

export type QuantAiFactorReviewStance = 'support' | 'caution' | 'oppose' | 'insufficient'

export interface QuantAiFactorReview {
  readonly factor: QuantResearchFactorKey
  readonly stance: QuantAiFactorReviewStance
  readonly confidence: number
  readonly accepted: boolean
  readonly rationale: string
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantAiDecisionReview {
  readonly decisionVersion: typeof QUANT_AI_DECISION_VERSION
  readonly recommendation: QuantRecommendation
  readonly confidence: number
  readonly accepted: boolean
  readonly rejectionReason: 'low-confidence' | 'deterministic-watch' | 'factor-review-incomplete' | 'factor-conflict' | null
  readonly factorReviewCoverage: number
  readonly rationale: string
  readonly invalidationConditions: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantAiSummaryRequest {
  readonly report: QuantResearchReport
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

function summaryError(code: 'QUANT_AI_SUMMARY_CONFIGURATION' | 'QUANT_AI_SUMMARY_TIMEOUT' | 'QUANT_AI_SUMMARY_UPSTREAM' | 'QUANT_AI_SUMMARY_INVALID_RESPONSE', message: string, status: 502 | 503 | 504): QuantError {
  return new QuantError(code, message, status)
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
    factorModel: report.factorModel ?? null,
    decision: report.decision ?? null,
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
    '请把下面这份 Quant 确定性研究报告解释给金融初学者，并复核其中的结构化推荐。只使用 JSON 中已有的事实和 evidence key。',
    '返回一个 JSON 对象，字段必须是 overview、supports、concerns、nextChecks、citedEvidenceKeys、factorReviews、decisionReview；数组最多各 6 项。',
    'overview 用 1-3 句说明当前证据代表什么；supports、concerns、nextChecks 都写成可核对的短句。',
    'factorReviews 必须逐项复核 factorModel 中的每个因子；每项字段是 factor、stance、confidence、rationale、citedEvidenceKeys。stance 只能是 support、caution、oppose、insufficient；引用只能使用该因子自己的 evidenceKeys。',
    '因子数据缺失、来源不可用或无法核对时使用 insufficient，不要猜测；不要输出 accepted，accepted 会由服务端根据数据、引用和置信度重新计算。',
    'decisionReview 必须是对象或 null。对象字段必须是 decisionVersion、recommendation、confidence、rationale、invalidationConditions、citedEvidenceKeys；recommendation 只能是 bullish、bearish、watch，confidence 为 0-100 的数字。',
    'decisionReview 只能复核报告已有证据；如果报告确定性推荐为 watch 或数据覆盖度不足，不得升级为 bullish/bearish。不要添加报告中不存在的数值、来源或证据 key。',
    '如果报告包含 factorModel.configuration，必须按该报告快照解释权重和确定性分数，不要用当前配置替换历史报告配置。',
    '对于 optional 的 AkShare 证据，必须保留 source、observedAt 和 formulaVersion；报告期不同或 provider 数值不同只能表述为交叉核对线索，并明确需要人工核对。',
    '不要生成买入/卖出价格，不要写目标价、未来收益预测或直接交易指令；价格区间只能使用报告中的确定性字段。',
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

function recommendation(value: unknown): QuantRecommendation {
  if (value === 'bullish' || value === 'bearish' || value === 'watch')
    return value
  throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI decision recommendation is invalid', 502)
}

function factorKey(value: unknown): value is QuantResearchFactorKey {
  return value === 'trend' || value === 'valuation' || value === 'quality' || value === 'shareholder-return' || value === 'risk'
}

function factorStance(value: unknown): QuantAiFactorReviewStance {
  if (value === 'support' || value === 'caution' || value === 'oppose' || value === 'insufficient')
    return value
  throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor review stance is invalid', 502)
}

function factorReview(value: unknown, report: QuantResearchReport): QuantAiFactorReview[] {
  if (value === undefined)
    return []
  if (!Array.isArray(value) || value.length > 5)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor reviews are invalid', 502)

  const factors = new Map<QuantResearchFactorKey, QuantResearchFactor>(
    (report.factorModel?.factors ?? []).map(factor => [factor.key, factor]),
  )
  const seen = new Set<QuantResearchFactorKey>()
  return value.map((item) => {
    const parsed = record(item)
    if (!parsed || !factorKey(parsed.factor) || seen.has(parsed.factor))
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor review key is invalid', 502)
    const factor = factors.get(parsed.factor)
    if (!factor)
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor review references an unknown factor', 502)
    seen.add(parsed.factor)
    const confidence = parsed.confidence
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100)
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor review confidence is invalid', 502)
    const rationale = stringValue(parsed.rationale, 'factorReviews.rationale', 600)
    const cited = citedEvidenceKeys(parsed.citedEvidenceKeys, report)
    const factorEvidenceKeys = new Set(factor.evidenceKeys)
    if (cited.some(key => !factorEvidenceKeys.has(key)))
      throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI factor review cited evidence from another factor', 502)
    const stance = factorStance(parsed.stance)
    const citedUsable = cited.some(key => report.evidence.find(item => item.key === key)?.status !== 'missing')
    const accepted = factor.status === 'ready'
      && factor.score !== null
      && confidence >= 60
      && cited.length > 0
      && citedUsable
      && stance !== 'insufficient'
    return {
      factor: parsed.factor,
      stance,
      confidence,
      accepted,
      rationale,
      citedEvidenceKeys: cited,
    }
  })
}

function factorReviewAssessment(
  report: QuantResearchReport,
  reviews: readonly QuantAiFactorReview[],
  reviewsFieldPresent: boolean,
  recommendation: QuantRecommendation,
): { readonly coverage: number, readonly incomplete: boolean, readonly conflict: boolean } {
  const factors = report.factorModel?.factors ?? []
  if (!reviewsFieldPresent || !factors.length)
    return { coverage: 0, incomplete: false, conflict: false }

  const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0)
  const accepted = reviews.filter(review => review.accepted)
  const reviewedWeight = accepted.reduce((total, review) => total + (factors.find(factor => factor.key === review.factor)?.weight ?? 0), 0)
  const supportWeight = accepted.reduce((total, review) => total + (review.stance === 'support' ? factors.find(factor => factor.key === review.factor)?.weight ?? 0 : 0), 0)
  const opposeWeight = accepted.reduce((total, review) => total + (review.stance === 'oppose' ? factors.find(factor => factor.key === review.factor)?.weight ?? 0 : 0), 0)
  const coverage = totalWeight > 0 ? Math.round(reviewedWeight / totalWeight * 10000) / 100 : 0
  const conflict = recommendation === 'bullish'
    ? opposeWeight > supportWeight
    : recommendation === 'bearish'
      ? supportWeight > opposeWeight
      : false
  return {
    coverage,
    incomplete: accepted.length === 0 || coverage < 60,
    conflict,
  }
}

function decisionReview(value: unknown, report: QuantResearchReport, reviews: readonly QuantAiFactorReview[], reviewsFieldPresent: boolean): QuantAiDecisionReview | null {
  if (value === undefined || value === null)
    return null
  const parsed = record(value)
  if (!parsed || parsed.decisionVersion !== QUANT_AI_DECISION_VERSION)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI decision review version is invalid', 502)
  const confidence = parsed.confidence
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100)
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI decision confidence is invalid', 502)
  const rationale = stringValue(parsed.rationale, 'decisionReview.rationale', 600)
  const invalidationConditions = stringList(parsed.invalidationConditions, 'decisionReview.invalidationConditions')
  const cited = citedEvidenceKeys(parsed.citedEvidenceKeys, report)
  const normalizedRecommendation = recommendation(parsed.recommendation)
  const deterministicWatch = report.decision?.recommendation === 'watch' || (report.decision?.coverage ?? 0) < 80
  const factorAssessment = factorReviewAssessment(report, reviews, reviewsFieldPresent, normalizedRecommendation)
  const accepted = confidence >= 60 && cited.length > 0 && !deterministicWatch && !factorAssessment.incomplete && !factorAssessment.conflict
  const rejectionReason = accepted
    ? null
    : deterministicWatch
      ? 'deterministic-watch'
      : factorAssessment.conflict
        ? 'factor-conflict'
        : factorAssessment.incomplete
          ? 'factor-review-incomplete'
          : 'low-confidence'
  return {
    decisionVersion: QUANT_AI_DECISION_VERSION,
    recommendation: normalizedRecommendation,
    confidence,
    accepted,
    rejectionReason,
    factorReviewCoverage: factorAssessment.coverage,
    rationale,
    invalidationConditions,
    citedEvidenceKeys: cited,
  }
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
  const reviewsFieldPresent = Object.hasOwn(parsed, 'factorReviews')
  const reviews = factorReview(parsed.factorReviews, report)
  const review = decisionReview(parsed.decisionReview, report, reviews, reviewsFieldPresent)
  const text = [overview, ...supports, ...concerns, ...nextChecks, review?.rationale ?? '', ...(review?.invalidationConditions ?? [])].join('\n')
  if (/目标价|收益预测|未来收益|price\s*target|return\s+forecast|直接(?:买入|卖出)|建议(?:买入|卖出)/iu.test(text))
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'AI summary contains a prohibited trading conclusion', 502)
  return {
    summaryVersion: QUANT_AI_SUMMARY_VERSION,
    overview,
    supports,
    concerns,
    nextChecks,
    citedEvidenceKeys: [...new Set([...cited, ...(review?.citedEvidenceKeys ?? [])])],
    factorReviews: reviews,
    decisionReview: review,
  }
}

export function parseQuantAiSummary(value: string, report: QuantResearchReport): QuantAiSummary {
  try {
    return validateSummary(JSON.parse(value), report)
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    throw summaryError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'Persisted AI summary is invalid', 502)
  }
}

export async function generateQuantAiSummary(input: QuantAiSummaryRequest): Promise<QuantAiSummary> {
  const { report, config } = input
  if (!config.apiKey && config.provider !== 'ollama')
    throw summaryError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI API key is not configured', 503)
  const timeoutMs = resolveQuantAiGenerationTimeout(input.timeoutMs)
  const { content } = await requestQuantAiCompletion({
    config,
    timeoutMs,
    fetchImpl: input.fetchImpl,
    maxCompletionTokens: 4_000,
    maxResponseLength: QUANT_AI_SUMMARY_MAX_RESPONSE_LENGTH,
    temperature: 0.2,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: '你是严格的证据解释器和决策复核器，只能使用给定研究报告，不得创造事实、价格或直接交易指令。' },
      { role: 'user', content: buildQuantAiSummaryPrompt(report) },
    ],
    errorCodes: {
      configuration: 'QUANT_AI_SUMMARY_CONFIGURATION',
      timeout: 'QUANT_AI_SUMMARY_TIMEOUT',
      upstream: 'QUANT_AI_SUMMARY_UPSTREAM',
      invalid_response: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
    },
  })
  return parseQuantAiSummary(stripJsonFence(content), report)
}
