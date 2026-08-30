import type { QuantAiDecisionReview } from './ai-summary'
import type { QuantDecisionProjection, QuantRecommendation, QuantReferencePriceRange } from './decision-recommendation'
import type { QuantFactorConfiguration } from './factor-configuration'
import type { QuantResearchReport } from './research-report'
import { QuantError } from './errors'

export const QUANT_DECISION_RECORD_VERSION = 'decision-record-v1' as const
export const QUANT_DECISION_RECORD_ACTIONS = ['watch', 'plan-buy', 'holding', 'sold'] as const
export type QuantDecisionRecordAction = typeof QUANT_DECISION_RECORD_ACTIONS[number]

export interface QuantDecisionRecordAiReviewSnapshot {
  readonly decisionVersion: string
  readonly recommendation: QuantRecommendation
  readonly confidence: number
  readonly accepted: boolean
  readonly rejectionReason: 'low-confidence' | 'deterministic-watch' | null
  readonly rationale: string
  readonly invalidationConditions: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantDecisionRecordSnapshot {
  readonly snapshotVersion: typeof QUANT_DECISION_RECORD_VERSION
  readonly reportVersion: string
  readonly generatedAt: string
  readonly recommendation: QuantRecommendation | null
  readonly confidence: number | null
  readonly coverage: number | null
  readonly evidenceKeys: readonly string[]
  readonly currentPrice: number | null
  readonly currentPriceObservedAt: string | null
  readonly buyPriceRange: QuantReferencePriceRange | null
  readonly sellPriceRange: QuantReferencePriceRange | null
  readonly aiDecisionReview: QuantDecisionRecordAiReviewSnapshot | null
  readonly factorConfiguration: QuantFactorConfiguration | null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function textList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim()))
    return null
  return value.map(item => (item as string).trim())
}

function clonePriceRange(value: QuantReferencePriceRange | null | undefined): QuantReferencePriceRange | null {
  if (!value)
    return null
  return { ...value, evidenceKeys: [...value.evidenceKeys] }
}

function cloneFactorConfiguration(value: QuantFactorConfiguration | undefined): QuantFactorConfiguration | null {
  if (!value)
    return null
  return { ...value, weights: { ...value.weights } }
}

function cloneAiDecisionReview(value: QuantAiDecisionReview | null | undefined): QuantDecisionRecordAiReviewSnapshot | null {
  if (!value)
    return null
  return {
    decisionVersion: value.decisionVersion,
    recommendation: value.recommendation,
    confidence: value.confidence,
    accepted: value.accepted,
    rejectionReason: value.rejectionReason,
    rationale: value.rationale,
    invalidationConditions: [...value.invalidationConditions],
    citedEvidenceKeys: [...value.citedEvidenceKeys],
  }
}

export function buildQuantDecisionRecordSnapshot(input: {
  readonly report: QuantResearchReport
  readonly latestDailyBar?: { readonly close: number, readonly tradeDate: string } | null
  readonly aiDecisionReview?: QuantAiDecisionReview | null
}): QuantDecisionRecordSnapshot {
  const decision: QuantDecisionProjection | undefined = input.report.decision
  return {
    snapshotVersion: QUANT_DECISION_RECORD_VERSION,
    reportVersion: input.report.reportVersion,
    generatedAt: input.report.generatedAt,
    recommendation: decision?.recommendation ?? null,
    confidence: finite(decision?.confidence),
    coverage: finite(decision?.coverage),
    evidenceKeys: [...(decision?.evidenceKeys || [])],
    currentPrice: finite(input.latestDailyBar?.close),
    currentPriceObservedAt: input.latestDailyBar?.tradeDate || null,
    buyPriceRange: clonePriceRange(decision?.buyPriceRange),
    sellPriceRange: clonePriceRange(decision?.sellPriceRange),
    aiDecisionReview: cloneAiDecisionReview(input.aiDecisionReview),
    factorConfiguration: cloneFactorConfiguration(input.report.factorModel?.configuration),
  }
}

function parsePriceRange(value: unknown): QuantReferencePriceRange | null {
  if (value === null)
    return null
  if (!isRecord(value))
    throw new Error('invalid price range')
  const low = finite(value.low)
  const high = finite(value.high)
  const currency = text(value.currency)
  const formulaVersion = text(value.formulaVersion)
  const source = text(value.source)
  const observedAt = text(value.observedAt)
  const evidenceKeys = textList(value.evidenceKeys)
  if (low === null || high === null || low < 0 || high < low || currency !== 'CNY' || formulaVersion !== 'reference-price-v1' || !source || !observedAt || !evidenceKeys)
    throw new Error('invalid price range')
  return { low, high, currency: 'CNY', formulaVersion, source, observedAt, evidenceKeys }
}

function parseFactorConfiguration(value: unknown): QuantFactorConfiguration | null {
  if (value === null)
    return null
  if (!isRecord(value) || !isRecord(value.weights))
    throw new Error('invalid factor configuration')
  const version = text(value.version)
  const source = text(value.source)
  const updatedAt = value.updatedAt === null ? null : text(value.updatedAt)
  const weights = value.weights
  const keys = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk'] as const
  if (version !== 'research-factor-config-v1' || (source !== 'default' && source !== 'user') || (value.updatedAt !== null && updatedAt === null))
    throw new Error('invalid factor configuration')
  const parsedWeights = Object.fromEntries(keys.map((key) => {
    const weight = finite(weights[key])
    if (weight === null || weight < 0 || weight > 1)
      throw new Error('invalid factor weight')
    return [key, weight]
  })) as unknown as QuantFactorConfiguration['weights']
  const total = keys.reduce((sum, key) => sum + parsedWeights[key], 0)
  if (Math.abs(total - 1) > 0.0001)
    throw new Error('invalid factor weight total')
  return { version, source, updatedAt, weights: parsedWeights }
}

function parseAiDecisionReview(value: unknown): QuantDecisionRecordAiReviewSnapshot | null {
  if (value === null)
    return null
  if (!isRecord(value))
    throw new Error('invalid AI decision review')
  const decisionVersion = text(value.decisionVersion)
  const recommendation = text(value.recommendation)
  const confidence = finite(value.confidence)
  const rationale = text(value.rationale)
  const rejectionReason = value.rejectionReason === null
    ? null
    : text(value.rejectionReason)
  const invalidationConditions = textList(value.invalidationConditions)
  const citedEvidenceKeys = textList(value.citedEvidenceKeys)
  if (!decisionVersion || (recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || confidence === null || confidence < 0 || confidence > 100 || typeof value.accepted !== 'boolean'
    || (rejectionReason !== null && rejectionReason !== 'low-confidence' && rejectionReason !== 'deterministic-watch')
    || !rationale || !invalidationConditions || !citedEvidenceKeys) {
    throw new Error('invalid AI decision review')
  }
  return {
    decisionVersion,
    recommendation,
    confidence,
    accepted: value.accepted,
    rejectionReason,
    rationale,
    invalidationConditions,
    citedEvidenceKeys,
  }
}

export function parseQuantDecisionRecordSnapshot(value: string): QuantDecisionRecordSnapshot {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.snapshotVersion !== QUANT_DECISION_RECORD_VERSION)
      throw new Error('invalid snapshot version')
    const reportVersion = text(parsed.reportVersion)
    const generatedAt = text(parsed.generatedAt)
    const recommendation = parsed.recommendation === null ? null : text(parsed.recommendation)
    const confidence = parsed.confidence === null ? null : finite(parsed.confidence)
    const coverage = parsed.coverage === null ? null : finite(parsed.coverage)
    const evidenceKeys = textList(parsed.evidenceKeys)
    const currentPrice = parsed.currentPrice === null ? null : finite(parsed.currentPrice)
    const currentPriceObservedAt = parsed.currentPriceObservedAt === null ? null : text(parsed.currentPriceObservedAt)
    if (!reportVersion || !generatedAt
      || (recommendation !== null && recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
      || (parsed.confidence !== null && (confidence === null || confidence < 0 || confidence > 100))
      || (parsed.coverage !== null && (coverage === null || coverage < 0 || coverage > 100))
      || !evidenceKeys
      || (parsed.currentPrice !== null && (currentPrice === null || currentPrice < 0))
      || (parsed.currentPriceObservedAt !== null && currentPriceObservedAt === null)) {
      throw new Error('invalid snapshot fields')
    }
    return {
      snapshotVersion: QUANT_DECISION_RECORD_VERSION,
      reportVersion,
      generatedAt,
      recommendation,
      confidence,
      coverage,
      evidenceKeys,
      currentPrice,
      currentPriceObservedAt,
      buyPriceRange: parsePriceRange(parsed.buyPriceRange),
      sellPriceRange: parsePriceRange(parsed.sellPriceRange),
      aiDecisionReview: parseAiDecisionReview(parsed.aiDecisionReview),
      factorConfiguration: parseFactorConfiguration(parsed.factorConfiguration),
    }
  }
  catch {
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted decision record snapshot is invalid', 500)
  }
}
