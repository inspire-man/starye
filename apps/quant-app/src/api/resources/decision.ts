import type {
  QuantAiDecisionReview,
  QuantDecisionAssistant,
  QuantDecisionAssistantAction,
  QuantDecisionAssistantAiFactorReview,
  QuantDecisionAssistantDeterministic,
  QuantDecisionAssistantFinal,
  QuantDecisionAssistantList,
  QuantDecisionAssistantMarket,
  QuantDecisionAssistantMode,
  QuantDecisionAssistantScenario,
  QuantDecisionAssistantTrust,
  QuantDecisionRecord,
  QuantDecisionRecordAction,
  QuantDecisionRecordSnapshot,
  QuantReferencePriceRange,
  QuantResearchSource,
} from '../../lib/quant-view-models'
import type { QuantRequestOptions } from '../http-client'
import type { CreateDecisionAssistantRequestDto } from '../quant-dtos'
import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readBoolean, readList, readNumber, readString, readStringList } from '../payload'
import { parseFactorConfiguration } from './config'
import { parseAiFactorImpact, parseAiFactorReviews, parseReferencePriceRange } from './research'

export interface CreateQuantDecisionAssistantInput {
  researchRunId: string
  mode: QuantDecisionAssistantMode
  costBasis?: number | null
  quantity?: number | null
  includeAi?: boolean
}

function parseDecisionRecordAiReview(value: unknown): QuantAiDecisionReview | null {
  if (value === null)
    return null
  if (!isRecord(value))
    return null
  const decisionVersion = readString(value, 'decisionVersion', 'decision_version')
  const recommendation = readString(value, 'recommendation')
  const confidence = readNumber(value, 'confidence')
  const accepted = readBoolean(value, 'accepted')
  const factorReviewCoverage = value.factorReviewCoverage === undefined
    ? 0
    : readNumber(value, 'factorReviewCoverage', 'factor_review_coverage')
  const rejectionReason = readString(value, 'rejectionReason', 'rejection_reason')
  const rationale = readString(value, 'rationale')
  if (!decisionVersion || (recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || confidence === null || confidence < 0 || confidence > 100 || accepted === null || !rationale
    || factorReviewCoverage === null || factorReviewCoverage < 0 || factorReviewCoverage > 100
    || (rejectionReason !== null && rejectionReason !== 'low-confidence' && rejectionReason !== 'deterministic-watch' && rejectionReason !== 'factor-review-incomplete' && rejectionReason !== 'factor-conflict')) {
    return null
  }
  return {
    decisionVersion,
    recommendation,
    confidence,
    accepted,
    rejectionReason,
    factorReviewCoverage,
    rationale,
    invalidationConditions: readStringList(value, 'invalidationConditions', 'invalidation_conditions'),
    citedEvidenceKeys: readStringList(value, 'citedEvidenceKeys', 'cited_evidence_keys'),
  }
}

function parseDecisionRecordSnapshot(value: unknown): QuantDecisionRecordSnapshot | null {
  if (!isRecord(value) || readString(value, 'snapshotVersion', 'snapshot_version') !== 'decision-record-v1')
    return null
  const reportVersion = readString(value, 'reportVersion', 'report_version')
  const generatedAt = readString(value, 'generatedAt', 'generated_at')
  const rawRecommendation = readString(value, 'recommendation')
  const recommendation = rawRecommendation === null ? null : rawRecommendation
  const confidence = value.confidence === null ? null : readNumber(value, 'confidence')
  const coverage = value.coverage === null ? null : readNumber(value, 'coverage')
  const currentPrice = value.currentPrice === null ? null : readNumber(value, 'currentPrice', 'current_price')
  const currentPriceObservedAt = value.currentPriceObservedAt === null ? null : readString(value, 'currentPriceObservedAt', 'current_price_observed_at')
  const factorConfiguration = value.factorConfiguration === null || value.factorConfiguration === undefined
    ? null
    : (() => {
        try {
          return parseFactorConfiguration({ data: value.factorConfiguration })
        }
        catch {
          return null
        }
      })()
  const rawBuyPriceRange = value.buyPriceRange
  const rawSellPriceRange = value.sellPriceRange
  const buyPriceRange = rawBuyPriceRange === null ? null : parseReferencePriceRange(rawBuyPriceRange)
  const sellPriceRange = rawSellPriceRange === null ? null : parseReferencePriceRange(rawSellPriceRange)
  const aiDecisionReview = parseDecisionRecordAiReview(value.aiDecisionReview)
  const aiFactorReviews = parseAiFactorReviews(value.aiFactorReviews)
  const factorImpact = parseAiFactorImpact(value.factorImpact ?? value.factor_impact)
  if (!reportVersion || !generatedAt
    || (recommendation !== null && recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || (value.confidence !== null && (confidence === null || confidence < 0 || confidence > 100))
    || (value.coverage !== null && (coverage === null || coverage < 0 || coverage > 100))
    || !Array.isArray(value.evidenceKeys)
    || (value.currentPrice !== null && (currentPrice === null || currentPrice < 0))
    || (value.currentPriceObservedAt !== null && currentPriceObservedAt === null)
    || (rawBuyPriceRange !== null && buyPriceRange === null)
    || (rawSellPriceRange !== null && sellPriceRange === null)
    || (value.aiDecisionReview !== null && aiDecisionReview === null)
    || aiFactorReviews === null
    || (value.factorImpact !== undefined && value.factorImpact !== null && factorImpact === null)
    || (value.factorConfiguration !== null && value.factorConfiguration !== undefined && factorConfiguration === null)) {
    return null
  }
  return {
    snapshotVersion: 'decision-record-v1',
    reportVersion,
    generatedAt,
    recommendation,
    confidence,
    coverage,
    evidenceKeys: readStringList(value, 'evidenceKeys', 'evidence_keys'),
    currentPrice,
    currentPriceObservedAt,
    buyPriceRange,
    sellPriceRange,
    aiDecisionReview,
    aiFactorReviews,
    factorImpact,
    factorConfiguration,
  }
}

function parseDecisionRecord(value: unknown): QuantDecisionRecord | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const researchRunId = readString(value, 'researchRunId', 'research_run_id')
  const tsCode = readString(value, 'tsCode', 'ts_code')
  const action = readString(value, 'action')
  const note = value.note === null ? null : readString(value, 'note')
  const snapshot = parseDecisionRecordSnapshot(value.snapshot)
  const createdAt = readString(value, 'createdAt', 'created_at')
  const updatedAt = readString(value, 'updatedAt', 'updated_at')
  if (!id || !researchRunId || !tsCode || !createdAt || !updatedAt || !snapshot
    || (action !== 'watch' && action !== 'plan-buy' && action !== 'holding' && action !== 'sold')
    || (value.note !== null && value.note !== undefined && note === null)) {
    return null
  }
  return { id, researchRunId, tsCode, action, note, snapshot, createdAt, updatedAt }
}

function parseDecisionRecords(payload: unknown): QuantDecisionRecord[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'records', 'decisionRecords', 'decision_records').flatMap((value) => {
    const record = parseDecisionRecord(value)
    return record ? [record] : []
  })
}

function parseDecisionAssistantSource(value: unknown): QuantResearchSource | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const name = readString(value, 'name')
  const formulaVersion = readString(value, 'formulaVersion', 'formula_version')
  if (!id || !name || !formulaVersion)
    return null
  return { id, name, observedAt: readString(value, 'observedAt', 'observed_at'), formulaVersion }
}

function parseDecisionAssistantPriceRange(value: unknown): QuantReferencePriceRange | null {
  if (value === null || value === undefined)
    return null
  if (!isRecord(value))
    return null
  const low = readNumber(value, 'low')
  const high = readNumber(value, 'high')
  const currency = readString(value, 'currency')
  const formulaVersion = readString(value, 'formulaVersion', 'formula_version')
  const source = readString(value, 'source')
  const observedAt = readString(value, 'observedAt', 'observed_at')
  if (low === null || high === null || low < 0 || high < low || currency !== 'CNY' || !formulaVersion || !source || !observedAt)
    return null
  return { low, high, currency, formulaVersion, source, observedAt, evidenceKeys: readStringList(value, 'evidenceKeys', 'evidence_keys') }
}

function parseDecisionAssistantEvidence(value: unknown): QuantDecisionAssistant['evidence'] | null {
  if (!isRecord(value))
    return null
  const total = readNumber(value, 'total')
  const usable = readNumber(value, 'usable')
  const missing = readNumber(value, 'missing')
  const failed = readNumber(value, 'failed')
  if (total === null || usable === null || missing === null || failed === null || total < 0 || usable < 0 || usable > total || missing < 0 || failed < 0)
    return null
  return { total, usable, missing, failed }
}

function parseDecisionAssistantTrust(value: unknown): QuantDecisionAssistantTrust | null {
  if (!isRecord(value))
    return null
  const level = readString(value, 'level')
  const score = readNumber(value, 'score')
  const coverage = readNumber(value, 'coverage')
  const evidenceCoverage = readNumber(value, 'evidenceCoverage', 'evidence_coverage')
  const sourceCount = readNumber(value, 'sourceCount', 'source_count')
  const freshnessDays = value.freshnessDays === null || value.freshness_days === null ? null : readNumber(value, 'freshnessDays', 'freshness_days')
  const missingEvidenceCount = readNumber(value, 'missingEvidenceCount', 'missing_evidence_count')
  const failedEvidenceCount = readNumber(value, 'failedEvidenceCount', 'failed_evidence_count')
  const crossSourceAlertCount = readNumber(value, 'crossSourceAlertCount', 'cross_source_alert_count')
  if ((level !== 'high' && level !== 'medium' && level !== 'low') || score === null || coverage === null || evidenceCoverage === null || sourceCount === null || freshnessDays === undefined || missingEvidenceCount === null || failedEvidenceCount === null || crossSourceAlertCount === null || !Array.isArray(value.reasons) || value.reasons.some(item => typeof item !== 'string'))
    return null
  return {
    level,
    score,
    coverage,
    evidenceCoverage,
    sourceCount,
    latestObservedAt: readString(value, 'latestObservedAt', 'latest_observed_at'),
    freshnessDays,
    missingEvidenceCount,
    failedEvidenceCount,
    crossSourceAlertCount,
    reasons: value.reasons as string[],
  }
}

function parseDecisionAssistantFactorReviews(value: unknown): QuantDecisionAssistantAiFactorReview[] | null {
  if (!Array.isArray(value) || value.length > 5)
    return null
  const seen = new Set<string>()
  const reviews: QuantDecisionAssistantAiFactorReview[] = []
  for (const item of value) {
    if (!isRecord(item))
      return null
    const factor = readString(item, 'factor')
    const stance = readString(item, 'stance')
    const confidence = readNumber(item, 'confidence')
    const accepted = readBoolean(item, 'accepted')
    const rationale = readString(item, 'rationale')
    const citedEvidenceKeys = readStringList(item, 'citedEvidenceKeys', 'cited_evidence_keys')
    if ((factor !== 'trend' && factor !== 'valuation' && factor !== 'quality' && factor !== 'shareholder-return' && factor !== 'risk')
      || (stance !== 'support' && stance !== 'caution' && stance !== 'oppose' && stance !== 'insufficient')
      || confidence === null || confidence < 0 || confidence > 100 || accepted === null || !rationale || seen.has(factor)) {
      return null
    }
    seen.add(factor)
    reviews.push({ factor: factor as QuantDecisionAssistantAiFactorReview['factor'], stance: stance as QuantDecisionAssistantAiFactorReview['stance'], confidence, accepted, rationale, citedEvidenceKeys })
  }
  return reviews
}

function parseDecisionAssistantDeterministic(value: unknown): QuantDecisionAssistantDeterministic | null {
  if (!isRecord(value))
    return null
  const recommendation = value.recommendation === null ? null : readString(value, 'recommendation')
  const label = readString(value, 'label')
  const action = readString(value, 'action')
  const actionLabel = readString(value, 'actionLabel', 'action_label')
  const rationale = readString(value, 'rationale')
  const priceStatus = readString(value, 'priceStatus', 'price_status')
  const priceLabel = readString(value, 'priceLabel', 'price_label')
  const priceDetail = readString(value, 'priceDetail', 'price_detail')
  const score = value.score === null ? null : readNumber(value, 'score')
  const coverage = readNumber(value, 'coverage')
  const buyPriceRange = parseDecisionAssistantPriceRange(value.buyPriceRange ?? value.buy_price_range)
  const sellPriceRange = parseDecisionAssistantPriceRange(value.sellPriceRange ?? value.sell_price_range)
  const unrealizedPnlPercent = value.unrealizedPnlPercent === null ? null : readNumber(value, 'unrealizedPnlPercent', 'unrealized_pnl_percent')
  const recoveryPercent = value.recoveryPercent === null ? null : readNumber(value, 'recoveryPercent', 'recovery_percent')
  const trust = parseDecisionAssistantTrust(value.trust)
  const evidence = parseDecisionAssistantEvidence(value.evidence)
  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap((item) => {
        const source = parseDecisionAssistantSource(item)
        return source ? [source] : []
      })
    : []
  if ((recommendation !== null && recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || (label !== '看多' && label !== '看空' && label !== '观望')
    || (action !== 'consider-buy' && action !== 'wait' && action !== 'avoid' && action !== 'hold' && action !== 'reduce-review' && action !== 'add-review' && action !== 'verify-price' && action !== 'review-data')
    || !actionLabel || !rationale || (priceStatus !== 'within' && priceStatus !== 'below' && priceStatus !== 'above' && priceStatus !== 'unavailable')
    || !priceLabel || !priceDetail || (score !== null && (score < 0 || score > 100)) || coverage === null || coverage < 0 || coverage > 100
    || (unrealizedPnlPercent === undefined || recoveryPercent === undefined) || !trust || !evidence || !Array.isArray(value.evidenceKeys) || value.evidenceKeys.some(item => typeof item !== 'string')
    || !sources.length || !Array.isArray(value.checks) || value.checks.some(item => typeof item !== 'string') || !Array.isArray(value.invalidationConditions) || value.invalidationConditions.some(item => typeof item !== 'string')) {
    return null
  }
  return {
    recommendation: recommendation as QuantDecisionAssistantDeterministic['recommendation'],
    label: label as QuantDecisionAssistantDeterministic['label'],
    action: action as QuantDecisionAssistantAction,
    actionLabel,
    rationale,
    priceStatus: priceStatus as QuantDecisionAssistantDeterministic['priceStatus'],
    priceLabel,
    priceDetail,
    score,
    coverage,
    buyPriceRange,
    sellPriceRange,
    unrealizedPnlPercent,
    recoveryPercent,
    trust,
    evidence,
    evidenceKeys: value.evidenceKeys as string[],
    sources,
    checks: value.checks as string[],
    invalidationConditions: value.invalidationConditions as string[],
  }
}

function parseDecisionAssistantAi(value: unknown): QuantDecisionAssistant['ai'] | null {
  if (!isRecord(value))
    return null
  const aiVersion = readString(value, 'aiVersion', 'ai_version')
  const status = readString(value, 'status')
  const provider = value.provider === null ? null : readString(value, 'provider')
  const model = value.model === null ? null : readString(value, 'model')
  const recommendation = value.recommendation === null ? null : readString(value, 'recommendation')
  const action = value.action === null ? null : readString(value, 'action')
  const confidence = value.confidence === null ? null : readNumber(value, 'confidence')
  const accepted = readBoolean(value, 'accepted')
  const rejectionReason = value.rejectionReason === null ? null : readString(value, 'rejectionReason', 'rejection_reason')
  const factorReviewCoverage = readNumber(value, 'factorReviewCoverage', 'factor_review_coverage')
  const rationale = value.rationale === null ? null : readString(value, 'rationale')
  const errorCode = value.errorCode === null ? null : readString(value, 'errorCode', 'error_code')
  const factorReviews = parseDecisionAssistantFactorReviews(value.factorReviews ?? value.factor_reviews)
  if (!aiVersion || (status !== 'accepted' && status !== 'rejected' && status !== 'failed' && status !== 'unavailable' && status !== 'not-requested')
    || (provider !== null && provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    || (recommendation !== null && recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || (action !== null && action !== 'consider-buy' && action !== 'wait' && action !== 'avoid' && action !== 'hold' && action !== 'reduce-review' && action !== 'add-review' && action !== 'verify-price' && action !== 'review-data')
    || (confidence !== null && (confidence < 0 || confidence > 100)) || accepted === null || (rejectionReason !== null && !['low-confidence', 'deterministic-watch', 'factor-review-incomplete', 'factor-conflict', 'missing-citation', 'invalid-action'].includes(rejectionReason))
    || factorReviewCoverage === null || factorReviewCoverage < 0 || factorReviewCoverage > 100 || factorReviews === null || !Array.isArray(value.risks) || value.risks.some(item => typeof item !== 'string') || !Array.isArray(value.invalidationConditions) || value.invalidationConditions.some(item => typeof item !== 'string') || !Array.isArray(value.citedEvidenceKeys) || value.citedEvidenceKeys.some(item => typeof item !== 'string')) {
    return null
  }
  return {
    aiVersion,
    status,
    provider: provider as QuantDecisionAssistant['ai']['provider'],
    model,
    recommendation: recommendation as QuantDecisionAssistant['ai']['recommendation'],
    action: action as QuantDecisionAssistant['ai']['action'],
    confidence,
    accepted,
    rejectionReason: rejectionReason as QuantDecisionAssistant['ai']['rejectionReason'],
    factorReviewCoverage,
    rationale,
    risks: value.risks as string[],
    invalidationConditions: value.invalidationConditions as string[],
    citedEvidenceKeys: value.citedEvidenceKeys as string[],
    factorReviews,
    errorCode,
  }
}

function parseDecisionAssistantFinal(value: unknown): QuantDecisionAssistantFinal | null {
  if (!isRecord(value))
    return null
  const recommendation = value.recommendation === null ? null : readString(value, 'recommendation')
  const label = readString(value, 'label')
  const action = readString(value, 'action')
  const actionLabel = readString(value, 'actionLabel', 'action_label')
  const confidence = value.confidence === null ? null : readNumber(value, 'confidence')
  const source = readString(value, 'source')
  const rationale = readString(value, 'rationale')
  if ((recommendation !== null && recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch') || (label !== '看多' && label !== '看空' && label !== '观望') || (action !== 'consider-buy' && action !== 'wait' && action !== 'avoid' && action !== 'hold' && action !== 'reduce-review' && action !== 'add-review' && action !== 'verify-price' && action !== 'review-data') || !actionLabel || (confidence !== null && (confidence < 0 || confidence > 100)) || (source !== 'ai' && source !== 'deterministic') || !rationale)
    return null
  return { recommendation: recommendation as QuantDecisionAssistantFinal['recommendation'], label: label as QuantDecisionAssistantFinal['label'], action: action as QuantDecisionAssistantAction, actionLabel, confidence, source, rationale }
}

function parseDecisionAssistant(value: unknown): QuantDecisionAssistant | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const snapshotVersion = readString(value, 'snapshotVersion', 'snapshot_version')
  const tsCode = readString(value, 'tsCode', 'ts_code')
  const researchRunId = readString(value, 'researchRunId', 'research_run_id')
  const assessedAt = readString(value, 'assessedAt', 'assessed_at')
  const createdAt = readString(value, 'createdAt', 'created_at')
  const reportGeneratedAt = readString(value, 'reportGeneratedAt', 'report_generated_at')
  const scenarioValue = isRecord(value.scenario) ? value.scenario : null
  const marketValue = isRecord(value.market) ? value.market : null
  const currentPriceSource = marketValue ? readString(marketValue, 'currentPriceSource', 'current_price_source') : null
  const currentPriceStatus = marketValue ? readString(marketValue, 'currentPriceStatus', 'current_price_status') : null
  const currentPriceObservedAt = marketValue ? readString(marketValue, 'currentPriceObservedAt', 'current_price_observed_at') || assessedAt : null
  const currentPriceChangePercent = marketValue && marketValue.currentPriceChangePercent === null ? null : marketValue ? readNumber(marketValue, 'currentPriceChangePercent', 'current_price_change_percent') : null
  const quoteErrorCode = marketValue ? readString(marketValue, 'quoteErrorCode', 'quote_error_code') : null
  const evidence = parseDecisionAssistantEvidence(value.evidence)
  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap((item) => {
        const source = parseDecisionAssistantSource(item)
        return source ? [source] : []
      })
    : []
  const deterministic = parseDecisionAssistantDeterministic(value.deterministic)
  const ai = parseDecisionAssistantAi(value.ai)
  const factorImpact = parseAiFactorImpact(value.factorImpact ?? value.factor_impact)
  const final = parseDecisionAssistantFinal(value.final)
  if (!id || snapshotVersion !== 'decision-assistant-v1' || !tsCode || !researchRunId || !assessedAt || !createdAt || !reportGeneratedAt || !scenarioValue || (scenarioValue.mode !== 'buy' && scenarioValue.mode !== 'holding') || (readNumber(scenarioValue, 'currentPrice') ?? 0) <= 0 || (scenarioValue.costBasis !== null && (readNumber(scenarioValue, 'costBasis') ?? 0) <= 0) || (scenarioValue.quantity !== null && (readNumber(scenarioValue, 'quantity') ?? 0) <= 0) || !marketValue || (currentPriceSource !== 'eastmoney-realtime' && currentPriceSource !== 'local-daily-bars' && currentPriceSource !== 'user-input') || (currentPriceStatus !== 'realtime' && currentPriceStatus !== 'latest-close' && currentPriceStatus !== 'user-input' && currentPriceStatus !== null) || !currentPriceObservedAt || readNumber(marketValue, 'currentPrice') === null || !evidence || !sources.length || !deterministic || !ai || !final)
    return null
  const scenario: QuantDecisionAssistantScenario = {
    mode: scenarioValue.mode,
    currentPrice: readNumber(scenarioValue, 'currentPrice')!,
    costBasis: scenarioValue.costBasis === null ? null : readNumber(scenarioValue, 'costBasis'),
    quantity: scenarioValue.quantity === null ? null : readNumber(scenarioValue, 'quantity'),
  }
  const market: QuantDecisionAssistantMarket = {
    currentPrice: readNumber(marketValue, 'currentPrice')!,
    currentPriceSource: currentPriceSource as QuantDecisionAssistantMarket['currentPriceSource'],
    currentPriceStatus: (currentPriceStatus || (currentPriceSource === 'user-input' ? 'user-input' : currentPriceSource === 'eastmoney-realtime' ? 'realtime' : 'latest-close')) as QuantDecisionAssistantMarket['currentPriceStatus'],
    currentPriceObservedAt,
    currentPriceChangePercent,
    quoteErrorCode,
    latestClose: marketValue.latestClose === null ? null : readNumber(marketValue, 'latestClose'),
    latestTradeDate: marketValue.latestTradeDate === null ? null : readString(marketValue, 'latestTradeDate', 'latest_trade_date'),
    latestCloseSource: marketValue.latestCloseSource === null ? null : readString(marketValue, 'latestCloseSource', 'latest_close_source') === 'local-daily-bars' ? 'local-daily-bars' : null,
    priceDeltaPercent: marketValue.priceDeltaPercent === null ? null : readNumber(marketValue, 'priceDeltaPercent', 'price_delta_percent'),
  }
  return { id, snapshotVersion: 'decision-assistant-v1', tsCode, name: value.name === null ? null : readString(value, 'name'), researchRunId, assessedAt, createdAt, reportGeneratedAt, scenario, market, evidence, sources, deterministic, ai, factorImpact, final }
}

function parseDecisionAssistants(payload: unknown): QuantDecisionAssistantList {
  const data = unwrapData(payload)
  const items = readList(data, 'items', 'assessments', 'decisionAssistants').flatMap((value) => {
    const item = parseDecisionAssistant(value)
    return item ? [item] : []
  })
  const limit = isRecord(data) ? readNumber(data, 'limit') ?? items.length : items.length
  return { items, limit }
}

export const quantDecisionApi = {
  async createDecisionAssistant(input: CreateQuantDecisionAssistantInput): Promise<QuantDecisionAssistant> {
    const body: CreateDecisionAssistantRequestDto = {
      research_run_id: input.researchRunId,
      mode: input.mode,
      ...(input.costBasis !== undefined ? { cost_basis: input.costBasis } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.includeAi !== undefined ? { include_ai: input.includeAi } : {}),
    }
    const assessment = parseDecisionAssistant(unwrapData(await requestJson('/decision-assistant', {
      method: 'POST',
      body: JSON.stringify(body),
    })))
    if (!assessment)
      throw new QuantApiError('今日决策助手数据格式无效', 502, 'QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT')
    return assessment
  },

  async getDecisionAssistants(tsCode: string, limit = 10): Promise<QuantDecisionAssistant[]> {
    return parseDecisionAssistants(await requestJson(`/decision-assistant/${encodeURIComponent(tsCode)}?limit=${encodeURIComponent(String(limit))}`)).items
  },

  async getResearchDecisionRecord(runId: string): Promise<QuantDecisionRecord | null> {
    const data = unwrapData(await requestJson(`/research/runs/${encodeURIComponent(runId)}/decision`))
    if (data === null)
      return null
    const record = parseDecisionRecord(data)
    if (!record)
      throw new QuantApiError('决策记录数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return record
  },

  async saveResearchDecisionRecord(runId: string, action: QuantDecisionRecordAction, note?: string | null): Promise<QuantDecisionRecord> {
    const record = parseDecisionRecord(unwrapData(await requestJson(`/research/runs/${encodeURIComponent(runId)}/decision`, {
      method: 'PUT',
      body: JSON.stringify({ action, note }),
    })))
    if (!record)
      throw new QuantApiError('决策记录数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return record
  },

  async getResearchDecisionRecords(tsCode: string, limit = 10): Promise<QuantDecisionRecord[]> {
    return parseDecisionRecords(await requestJson(`/research/decisions/${encodeURIComponent(tsCode)}?limit=${encodeURIComponent(String(limit))}`))
  },

  async getResearchDecisionQueue(limit = 20, options: QuantRequestOptions = {}): Promise<QuantDecisionRecord[]> {
    return parseDecisionRecords(await requestJson(`/research/decisions?limit=${encodeURIComponent(String(limit))}`, options.signal ? { signal: options.signal } : undefined))
  },
}
