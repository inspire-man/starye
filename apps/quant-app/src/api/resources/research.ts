import type {
  QuantAiDecisionReview,
  QuantAiFactorImpact,
  QuantAiFactorReview,
  QuantAiProvider,
  QuantAiResponseMode,
  QuantAiRunAudit,
  QuantAiRunAuditStatus,
  QuantAiSummaryStreamProgress,
  QuantDecisionProjection,
  QuantFactorConfiguration,
  QuantFactorModel,
  QuantReferencePriceRange,
  QuantResearchChangeExplanation,
  QuantResearchComparison,
  QuantResearchEvidence,
  QuantResearchFactor,
  QuantResearchMarker,
  QuantResearchQuestion,
  QuantResearchReport,
  QuantResearchRun,
  QuantResearchSource,
  QuantResearchSummary,
  ResearchMarkerStatus,
} from '../../lib/quant-view-models'
import type { QuantRequestOptions } from '../http-client'
import type {
  AskResearchQuestionRequestDto,
  GenerateResearchChangeExplanationRequestDto,
  GenerateResearchComparisonRequestDto,
  GenerateResearchRunRequestDto,
  UpdateResearchMarkerRequestDto,
} from '../quant-dtos'
import { QUANT_API_PREFIX, QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readBoolean, readList, readNullableBoundedString, readNumber, readString, readStringList } from '../payload'
import { parseFactorConfiguration, parseFactorFreshness } from './config'

function parseResearchMarker(value: unknown): QuantResearchMarker | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  const statusValue = readString(value, 'status')
  const status: ResearchMarkerStatus = statusValue === 'priority' || statusValue === 'paused' || statusValue === 'excluded' ? statusValue : 'unreviewed'
  return {
    tsCode,
    status,
    note: readString(value, 'note'),
    reviewDate: readString(value, 'reviewDate', 'review_date'),
    createdAt: readString(value, 'createdAt', 'created_at'),
    updatedAt: readString(value, 'updatedAt', 'updated_at'),
  }
}

function parseResearchMarkers(payload: unknown): QuantResearchMarker[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'markers', 'research').flatMap((value) => {
    const marker = parseResearchMarker(value)
    return marker ? [marker] : []
  })
}

function parseResearchEvidence(value: unknown): QuantResearchEvidence | null {
  if (!isRecord(value))
    return null
  const key = readString(value, 'key')
  const label = readString(value, 'label')
  if (!key || !label)
    return null
  const status = readString(value, 'status')
  const normalizedStatus: QuantResearchEvidence['status'] = status === 'pass' || status === 'caution' || status === 'fail' ? status : 'missing'
  return {
    key,
    dimension: readString(value, 'dimension') || 'unknown',
    label,
    status: normalizedStatus,
    value: readNumber(value, 'value', 'numericValue', 'numeric_value'),
    threshold: readString(value, 'threshold') || '--',
    source: readString(value, 'source') || '未记录',
    observedAt: readString(value, 'observedAt', 'observed_at'),
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') || 'unknown',
    detail: readString(value, 'detail') || '',
    optional: value.optional === true,
  }
}

export function parseResearchSource(value: unknown): QuantResearchSource | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const name = readString(value, 'name')
  if (!id || !name)
    return null
  return {
    id,
    name,
    observedAt: readString(value, 'observedAt', 'observed_at'),
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') || 'unknown',
  }
}

function parseResearchFactor(value: unknown): QuantResearchFactor | null {
  if (!isRecord(value))
    return null
  const key = readString(value, 'key')
  const label = readString(value, 'label')
  const weight = readNumber(value, 'weight')
  const sourceId = readString(value, 'sourceId', 'source_id')
  const source = readString(value, 'source')
  const status = readString(value, 'status')
  const score = readNumber(value, 'score')
  if ((key !== 'trend' && key !== 'valuation' && key !== 'quality' && key !== 'shareholder-return' && key !== 'risk')
    || !label || weight === null || weight < 0 || !sourceId || !source
    || (status !== 'ready' && status !== 'partial' && status !== 'missing' && status !== 'unavailable')
    || (score !== null && (score < 0 || score > 100))) {
    return null
  }
  return {
    key,
    label,
    weight,
    sourceId,
    source,
    status,
    score,
    evidenceKeys: readStringList(value, 'evidenceKeys', 'evidence_keys'),
    missingEvidenceKeys: readStringList(value, 'missingEvidenceKeys', 'missing_evidence_keys'),
  }
}

function parseFactorModel(value: unknown): QuantFactorModel | undefined {
  if (!isRecord(value))
    return undefined
  const modelVersion = readString(value, 'modelVersion', 'model_version')
  const totalWeight = readNumber(value, 'totalWeight', 'total_weight')
  const coveredWeight = readNumber(value, 'coveredWeight', 'covered_weight')
  const coverage = readNumber(value, 'coverage')
  const score = readNumber(value, 'score')
  const factors = Array.isArray(value.factors)
    ? value.factors.flatMap((item) => {
        const factor = parseResearchFactor(item)
        return factor ? [factor] : []
      })
    : []
  if (!modelVersion || totalWeight === null || totalWeight < 0 || coveredWeight === null || coveredWeight < 0 || coveredWeight > totalWeight
    || coverage === null || coverage < 0 || coverage > 100 || (score !== null && (score < 0 || score > 100))
    || !factors.length) {
    return undefined
  }
  const factorConfiguration = value.configuration ?? value.factorConfiguration ?? value.factor_configuration
  let parsedConfiguration: QuantFactorConfiguration | undefined
  if (factorConfiguration !== undefined) {
    try {
      parsedConfiguration = parseFactorConfiguration({ data: factorConfiguration })
    }
    catch {
      parsedConfiguration = undefined
    }
  }
  return { modelVersion, totalWeight, coveredWeight, coverage, score, factors, configuration: parsedConfiguration }
}

export function parseReferencePriceRange(value: unknown): QuantReferencePriceRange | null {
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

function parseResearchDecision(value: unknown): QuantDecisionProjection | undefined {
  if (!isRecord(value))
    return undefined
  const decisionVersion = readString(value, 'decisionVersion', 'decision_version')
  const recommendation = readString(value, 'recommendation')
  const label = readString(value, 'label')
  const deterministicScore = readNumber(value, 'deterministicScore', 'deterministic_score')
  const confidence = readNumber(value, 'confidence')
  const coverage = readNumber(value, 'coverage')
  const headline = readString(value, 'headline')
  if (!decisionVersion || (recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')
    || (label !== '看多' && label !== '看空' && label !== '观望') || (deterministicScore !== null && (deterministicScore < 0 || deterministicScore > 100))
    || (confidence !== null && (confidence < 0 || confidence > 100)) || coverage === null || coverage < 0 || coverage > 100 || !headline) {
    return undefined
  }
  return {
    decisionVersion,
    recommendation,
    label,
    deterministicScore,
    confidence,
    coverage,
    buyPriceRange: parseReferencePriceRange(value.buyPriceRange ?? value.buy_price_range),
    sellPriceRange: parseReferencePriceRange(value.sellPriceRange ?? value.sell_price_range),
    evidenceKeys: readStringList(value, 'evidenceKeys', 'evidence_keys'),
    invalidationConditions: readStringList(value, 'invalidationConditions', 'invalidation_conditions'),
    headline,
  }
}

function parseResearchReport(value: unknown): QuantResearchReport | null {
  if (!isRecord(value))
    return null
  const reportVersion = readString(value, 'reportVersion', 'report_version')
  const tsCode = readString(value, 'tsCode', 'ts_code')
  const generatedAt = readString(value, 'generatedAt', 'generated_at')
  if (!reportVersion || !tsCode || !generatedAt)
    return null
  const status = readString(value, 'status')
  const action = readString(value, 'action')
  const normalizedAction: QuantResearchReport['action'] = action === 'research-window' || action === 'wait-confirmation' || action === 'reassess' ? action : 'complete-data'
  const evidence = readList(value, 'evidence', 'items').flatMap((item) => {
    const parsed = parseResearchEvidence(item)
    return parsed ? [parsed] : []
  })
  const sources = readList(value, 'sources').flatMap((item) => {
    const parsed = parseResearchSource(item)
    return parsed ? [parsed] : []
  })
  return {
    reportVersion,
    tsCode,
    name: readString(value, 'name'),
    generatedAt,
    sourceSnapshotId: readString(value, 'sourceSnapshotId', 'source_snapshot_id'),
    status: status === 'ready' || status === 'partial' ? status : 'insufficient_data',
    action: normalizedAction,
    score: readNumber(value, 'score'),
    headline: readString(value, 'headline') || '',
    strengths: readStringList(value, 'strengths'),
    risks: readStringList(value, 'risks'),
    gaps: readStringList(value, 'gaps'),
    nextActions: readStringList(value, 'nextActions', 'next_actions'),
    evidence,
    sources,
    factorModel: parseFactorModel(value.factorModel ?? value.factor_model),
    decision: parseResearchDecision(value.decision),
  }
}

function parseResearchRun(value: unknown): QuantResearchRun | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const tsCode = readString(value, 'tsCode', 'ts_code')
  const report = parseResearchReport(value.report)
  if (!id || !tsCode || !report)
    return null
  const status = readString(value, 'status')
  return {
    id,
    tsCode,
    name: readString(value, 'name'),
    status: status === 'ready' || status === 'partial' ? status : 'insufficient_data',
    reportVersion: readString(value, 'reportVersion', 'report_version') || report.reportVersion,
    sourceSnapshotId: readString(value, 'sourceSnapshotId', 'source_snapshot_id'),
    generatedAt: readString(value, 'generatedAt', 'generated_at'),
    createdAt: readString(value, 'createdAt', 'created_at'),
    report,
  }
}

function parseResearchRuns(payload: unknown): QuantResearchRun[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'runs', 'researchRuns', 'research_runs').flatMap((value) => {
    const run = parseResearchRun(value)
    return run ? [run] : []
  })
}

export function parseAiFactorReviews(value: unknown): QuantAiFactorReview[] | null {
  if (value === undefined)
    return []
  if (!Array.isArray(value) || value.length > 5)
    return null
  const reviews: QuantAiFactorReview[] = []
  const seen = new Set<string>()
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
      || confidence === null || confidence < 0 || confidence > 100 || accepted === null || seen.has(factor) || !rationale || citedEvidenceKeys.length > 16) {
      return null
    }
    seen.add(factor)
    reviews.push({
      factor: factor as QuantAiFactorReview['factor'],
      stance: stance as QuantAiFactorReview['stance'],
      confidence,
      accepted,
      rationale,
      citedEvidenceKeys,
    })
  }
  return reviews
}

export function parseAiFactorImpact(value: unknown): QuantAiFactorImpact | null {
  if (value === undefined || value === null)
    return null
  if (!isRecord(value))
    return null

  const modelVersion = readString(value, 'modelVersion', 'model_version')
  const hasEvaluatedAt = value.evaluatedAt !== undefined || value.evaluated_at !== undefined
  const evaluatedAt = hasEvaluatedAt ? readString(value, 'evaluatedAt', 'evaluated_at') : undefined
  const freshnessVersion = readString(value, 'freshnessVersion', 'freshness_version') || 'unknown'
  const freshnessBlockedFactors = readStringList(value, 'freshnessBlockedFactors', 'freshness_blocked_factors')
  const deterministicScore = value.deterministicScore === null ? null : readNumber(value, 'deterministicScore', 'deterministic_score')
  const hasAiScore = value.aiScore !== undefined || value.ai_score !== undefined
  const aiScore = hasAiScore
    ? value.aiScore === null || value.ai_score === null ? null : readNumber(value, 'aiScore', 'ai_score')
    : undefined
  const hasAiScoreDelta = value.aiScoreDelta !== undefined || value.ai_score_delta !== undefined
  const aiScoreDelta = hasAiScoreDelta
    ? value.aiScoreDelta === null || value.ai_score_delta === null ? null : readNumber(value, 'aiScoreDelta', 'ai_score_delta')
    : undefined
  const totalWeight = readNumber(value, 'totalWeight', 'total_weight')
  const scoredWeight = readNumber(value, 'scoredWeight', 'scored_weight')
  const reviewedWeight = readNumber(value, 'reviewedWeight', 'reviewed_weight')
  const reviewCoverage = readNumber(value, 'reviewCoverage', 'review_coverage')
  const supportWeight = readNumber(value, 'supportWeight', 'support_weight')
  const cautionWeight = readNumber(value, 'cautionWeight', 'caution_weight')
  const opposeWeight = readNumber(value, 'opposeWeight', 'oppose_weight')
  const unacceptedWeight = readNumber(value, 'unacceptedWeight', 'unaccepted_weight')
  if (!modelVersion || (hasEvaluatedAt && !evaluatedAt) || totalWeight === null || scoredWeight === null || reviewedWeight === null || reviewCoverage === null || supportWeight === null || cautionWeight === null || opposeWeight === null || unacceptedWeight === null
    || (aiScore !== undefined && aiScore !== null && (aiScore < 0 || aiScore > 100))
    || (aiScoreDelta !== undefined && aiScoreDelta !== null && (aiScoreDelta < -100 || aiScoreDelta > 100))
    || totalWeight < 0 || totalWeight > 1 || scoredWeight < 0 || scoredWeight > 1 || reviewedWeight < 0 || reviewedWeight > 1 || reviewCoverage < 0 || reviewCoverage > 100 || supportWeight < 0 || supportWeight > 1 || cautionWeight < 0 || cautionWeight > 1 || opposeWeight < 0 || opposeWeight > 1 || unacceptedWeight < 0 || unacceptedWeight > 1) {
    return null
  }

  const factors = readList(value, 'factors').flatMap((item): QuantAiFactorImpact['factors'] => {
    if (!isRecord(item))
      return []
    const factor = readString(item, 'factor')
    const label = readString(item, 'label')
    const weight = readNumber(item, 'weight')
    const deterministicScore = item.deterministicScore === null ? null : readNumber(item, 'deterministicScore', 'deterministic_score')
    const deterministicStance = readString(item, 'deterministicStance', 'deterministic_stance')
    const deterministicContribution = item.deterministicContribution === null ? null : readNumber(item, 'deterministicContribution', 'deterministic_contribution')
    const aiStance = item.aiStance === null ? null : readString(item, 'aiStance', 'ai_stance')
    const aiConfidence = item.aiConfidence === null ? null : readNumber(item, 'aiConfidence', 'ai_confidence')
    const aiAccepted = readBoolean(item, 'aiAccepted', 'ai_accepted')
    const aiWeight = readNumber(item, 'aiWeight', 'ai_weight')
    const hasAiContribution = item.aiContribution !== undefined || item.ai_contribution !== undefined
    const aiContribution = hasAiContribution
      ? item.aiContribution === null || item.ai_contribution === null ? null : readNumber(item, 'aiContribution', 'ai_contribution')
      : undefined
    const freshnessValue = item.freshness ?? item.factorFreshness ?? item.factor_freshness
    const freshness = freshnessValue === undefined || freshnessValue === null ? undefined : parseFactorFreshness(freshnessValue)
    const hasAiFreshnessEligible = item.aiFreshnessEligible !== undefined || item.ai_freshness_eligible !== undefined
    const aiFreshnessEligible = hasAiFreshnessEligible ? readBoolean(item, 'aiFreshnessEligible', 'ai_freshness_eligible') : undefined
    if ((factor !== 'trend' && factor !== 'valuation' && factor !== 'quality' && factor !== 'shareholder-return' && factor !== 'risk')
      || !label || weight === null || weight < 0 || weight > 1
      || (deterministicStance !== 'support' && deterministicStance !== 'caution' && deterministicStance !== 'oppose' && deterministicStance !== 'insufficient')
      || (aiStance !== null && aiStance !== 'support' && aiStance !== 'caution' && aiStance !== 'oppose' && aiStance !== 'insufficient')
      || (deterministicContribution !== null && (deterministicContribution < 0 || deterministicContribution > 100))
      || (aiConfidence !== null && (aiConfidence < 0 || aiConfidence > 100))
      || (aiContribution !== undefined && aiContribution !== null && (aiContribution < 0 || aiContribution > 100))
      || aiAccepted === null || aiWeight === null || aiWeight < 0 || aiWeight > 1 || (hasAiFreshnessEligible && aiFreshnessEligible === null) || (freshnessValue !== undefined && freshnessValue !== null && !freshness)) {
      return []
    }
    return [{ factor, label, weight, deterministicScore, deterministicStance, deterministicContribution, aiStance, aiConfidence, aiAccepted, aiWeight, ...(aiContribution !== undefined ? { aiContribution } : {}), ...(freshness ? { freshness } : {}), ...(aiFreshnessEligible !== undefined ? { aiFreshnessEligible } : {}) } as QuantAiFactorImpact['factors'][number]]
  })
  if (!factors.length || factors.length > 5)
    return null
  return { modelVersion, ...(evaluatedAt ? { evaluatedAt } : {}), freshnessVersion, freshnessBlockedFactors, totalWeight, deterministicScore, ...(aiScore !== undefined ? { aiScore } : {}), ...(aiScoreDelta !== undefined ? { aiScoreDelta } : {}), scoredWeight, reviewedWeight, reviewCoverage, supportWeight, cautionWeight, opposeWeight, unacceptedWeight, factors }
}

function parseQuantAiRunAudit(value: unknown): QuantAiRunAudit | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const researchRunId = readString(value, 'researchRunId', 'research_run_id')
  const summaryId = readNullableBoundedString(value, 128, 'summaryId', 'summary_id')
  const operation = readString(value, 'operation')
  const provider = readString(value, 'provider')
  const model = readString(value, 'model')
  const responseMode = readString(value, 'responseMode', 'response_mode')
  const generationTimeoutMs = readNumber(value, 'generationTimeoutMs', 'generation_timeout_ms')
  const status = readString(value, 'status')
  const receivedChars = readNumber(value, 'receivedChars', 'received_chars')
  const durationMs = readNumber(value, 'durationMs', 'duration_ms')
  const finishReason = readNullableBoundedString(value, 64, 'finishReason', 'finish_reason')
  const errorCode = readNullableBoundedString(value, 128, 'errorCode', 'error_code')
  const errorMessage = readNullableBoundedString(value, 240, 'errorMessage', 'error_message')
  const startedAt = readString(value, 'startedAt', 'started_at')
  const completedAt = readString(value, 'completedAt', 'completed_at')
  const createdAt = readString(value, 'createdAt', 'created_at')
  if (!id || !researchRunId || summaryId === undefined || operation !== 'research-summary'
    || (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    || !model || model.length > 128
    || (responseMode !== 'stream' && responseMode !== 'json')
    || generationTimeoutMs === null || !Number.isInteger(generationTimeoutMs) || generationTimeoutMs < 300_000 || generationTimeoutMs > 600_000
    || (status !== 'completed' && status !== 'failed' && status !== 'cancelled')
    || receivedChars === null || !Number.isInteger(receivedChars) || receivedChars < 0 || receivedChars > 8_000
    || durationMs === null || !Number.isInteger(durationMs) || durationMs < 0 || durationMs > 86_400_000
    || finishReason === undefined || errorCode === undefined || errorMessage === undefined
    || !startedAt || !completedAt || !createdAt) {
    return null
  }
  return {
    id,
    researchRunId,
    summaryId,
    operation: 'research-summary',
    provider: provider as QuantAiRunAudit['provider'],
    model,
    responseMode: responseMode as QuantAiRunAudit['responseMode'],
    generationTimeoutMs,
    status: status as QuantAiRunAuditStatus,
    receivedChars,
    durationMs,
    finishReason,
    errorCode,
    errorMessage,
    startedAt,
    completedAt,
    createdAt,
  }
}

function parseResearchSummary(value: unknown): QuantResearchSummary | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const researchRunId = readString(value, 'researchRunId', 'research_run_id')
  const summaryVersion = readString(value, 'summaryVersion', 'summary_version')
  const reportVersion = readString(value, 'reportVersion', 'report_version')
  const provider = readString(value, 'provider')
  const model = readString(value, 'model')
  const rawSummary = isRecord(value.summary) ? value.summary : null
  if (!id || !researchRunId || !summaryVersion || !reportVersion || !model || !rawSummary)
    return null
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    return null
  const normalizedProvider: QuantAiProvider = provider
  const parseSummaryList = (...keys: string[]) => readStringList(rawSummary, ...keys)
  const overview = readString(rawSummary, 'overview')
  if (!overview)
    return null
  const citedEvidenceKeys = parseSummaryList('citedEvidenceKeys')
  const factorReviews = parseAiFactorReviews(rawSummary.factorReviews ?? rawSummary.factor_reviews)
  if (!factorReviews)
    return null
  const factorImpact = parseAiFactorImpact(value.factorImpact ?? value.factor_impact)
  const factorImpactSnapshot = parseAiFactorImpact(value.factorImpactSnapshot ?? value.factor_impact_snapshot)
  const rawAudit = value.audit
  const audit = rawAudit === undefined || rawAudit === null ? null : parseQuantAiRunAudit(rawAudit)
  if (rawAudit !== undefined && rawAudit !== null && !audit)
    return null
  const rawDecisionReview = rawSummary.decisionReview ?? rawSummary.decision_review
  const decisionReview: QuantAiDecisionReview | null = isRecord(rawDecisionReview)
    ? (() => {
        const decisionVersion = readString(rawDecisionReview, 'decisionVersion', 'decision_version')
        const recommendation = readString(rawDecisionReview, 'recommendation')
        const confidence = readNumber(rawDecisionReview, 'confidence')
        const rationale = readString(rawDecisionReview, 'rationale')
        const invalidationConditions = readStringList(rawDecisionReview, 'invalidationConditions', 'invalidation_conditions')
        const accepted = readBoolean(rawDecisionReview, 'accepted')
        const factorReviewCoverage = rawDecisionReview.factorReviewCoverage === undefined
          ? 0
          : readNumber(rawDecisionReview, 'factorReviewCoverage', 'factor_review_coverage')
        const rejectionReason = readString(rawDecisionReview, 'rejectionReason', 'rejection_reason')
        const reviewCitations = readStringList(rawDecisionReview, 'citedEvidenceKeys', 'cited_evidence_keys')
        if (!decisionVersion || !recommendation || confidence === null || confidence < 0 || confidence > 100 || !rationale || accepted === null
          || factorReviewCoverage === null || factorReviewCoverage < 0 || factorReviewCoverage > 100
          || (rejectionReason !== null && rejectionReason !== 'low-confidence' && rejectionReason !== 'deterministic-watch' && rejectionReason !== 'factor-review-incomplete' && rejectionReason !== 'factor-conflict')
          || (recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')) {
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
          invalidationConditions,
          citedEvidenceKeys: reviewCitations,
        }
      })()
    : null
  return {
    id,
    researchRunId,
    summaryVersion,
    reportVersion,
    provider: normalizedProvider,
    model,
    generatedAt: readString(value, 'generatedAt', 'generated_at'),
    createdAt: readString(value, 'createdAt', 'created_at'),
    summary: {
      summaryVersion: readString(rawSummary, 'summaryVersion', 'summary_version') || summaryVersion,
      overview,
      supports: parseSummaryList('supports'),
      concerns: parseSummaryList('concerns'),
      nextChecks: parseSummaryList('nextChecks', 'next_checks'),
      citedEvidenceKeys,
      factorReviews,
      decisionReview,
    },
    factorImpact,
    factorImpactSnapshot,
    citedEvidenceKeys: readStringList(value, 'citedEvidenceKeys', 'cited_evidence_keys').length
      ? readStringList(value, 'citedEvidenceKeys', 'cited_evidence_keys')
      : citedEvidenceKeys,
    ...(rawAudit !== undefined ? { audit } : {}),
  }
}

type QuantAiSummaryStreamEventPayload
  = | { readonly type: 'started', readonly researchRunId: string, readonly responseMode: QuantAiResponseMode, readonly generationTimeoutMs: number }
    | { readonly type: 'delta', readonly text: string, readonly receivedLength: number }
    | { readonly type: 'completed', readonly data: unknown }
    | { readonly type: 'error', readonly code: string, readonly error: string, readonly details: unknown }

function parseQuantAiSummaryStreamEvent(value: unknown): QuantAiSummaryStreamEventPayload | null {
  if (!isRecord(value))
    return null
  const type = readString(value, 'type')
  if (type === 'started') {
    const researchRunId = readString(value, 'researchRunId', 'research_run_id')
    const responseMode = readString(value, 'responseMode', 'response_mode')
    const generationTimeoutMs = readNumber(value, 'generationTimeoutMs', 'generation_timeout_ms')
    if (!researchRunId || (responseMode !== 'stream' && responseMode !== 'json') || generationTimeoutMs === null || !Number.isInteger(generationTimeoutMs))
      return null
    return { type, researchRunId, responseMode, generationTimeoutMs }
  }
  if (type === 'delta') {
    const text = readString(value, 'text')
    const receivedLength = readNumber(value, 'receivedLength', 'received_length')
    if (!text || receivedLength === null || !Number.isInteger(receivedLength) || receivedLength < text.length)
      return null
    return { type, text, receivedLength }
  }
  if (type === 'completed')
    return { type, data: value.data }
  if (type === 'error') {
    const code = readString(value, 'code')
    const error = readString(value, 'error', 'message')
    if (!code || !error)
      return null
    return { type, code, error, details: value.details ?? null }
  }
  return null
}

function streamErrorStatus(code: string): number {
  if (code.includes('CONFIGURATION'))
    return 503
  if (code.includes('TIMEOUT'))
    return 504
  return 502
}

async function readQuantAiSummaryStream(
  response: Response,
  onProgress?: (event: QuantAiSummaryStreamProgress) => void,
): Promise<QuantResearchSummary> {
  if (!response.body)
    throw new QuantApiError('AI 流式响应没有可读取的数据', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let started = false
  let completed: QuantResearchSummary | null = null

  const consumeFrame = (frame: string): void => {
    const data = frame.split(/\r?\n/u)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
      .trim()
    if (!data)
      return

    let payload: unknown
    try {
      payload = JSON.parse(data)
    }
    catch {
      throw new QuantApiError('AI 流式事件不是有效 JSON', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    }
    const event = parseQuantAiSummaryStreamEvent(payload)
    if (!event)
      throw new QuantApiError('AI 流式事件格式无效', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    if (event.type === 'started') {
      if (started)
        throw new QuantApiError('AI 流式响应重复开始', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
      started = true
      onProgress?.(event)
      return
    }
    if (!started)
      throw new QuantApiError('AI 流式响应缺少开始事件', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    if (event.type === 'delta') {
      onProgress?.(event)
      return
    }
    if (event.type === 'error')
      throw new QuantApiError(event.error, streamErrorStatus(event.code), event.code)
    if (completed)
      throw new QuantApiError('AI 流式响应重复完成', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    const summary = parseResearchSummary(event.data)
    if (!summary)
      throw new QuantApiError('AI 研究摘要数据格式无效', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    completed = summary
    onProgress?.({ type: 'completed', data: summary })
  }

  try {
    while (true) {
      const next = await reader.read()
      if (next.done)
        break
      buffer += decoder.decode(next.value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/u)
      buffer = frames.pop() || ''
      frames.forEach(consumeFrame)
    }
    buffer += decoder.decode()
    if (buffer.trim())
      consumeFrame(buffer)
  }
  catch (error) {
    if (error instanceof QuantApiError)
      throw error
    throw new QuantApiError('AI 流式响应读取失败', 502, 'QUANT_AI_SUMMARY_UPSTREAM')
  }
  if (!started || !completed)
    throw new QuantApiError('AI 流式响应未完成', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
  return completed
}

export const quantResearchApi = {
  async getResearchMarkers(options: QuantRequestOptions = {}): Promise<QuantResearchMarker[]> {
    return parseResearchMarkers(await requestJson('/research', options.signal ? { signal: options.signal } : undefined))
  },

  async generateResearchRun(tsCode: string): Promise<QuantResearchRun> {
    const body: GenerateResearchRunRequestDto = { ts_code: tsCode }
    const run = parseResearchRun(unwrapData(await requestJson('/research/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    })))
    if (!run)
      throw new QuantApiError('研究报告数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return run
  },

  async getResearchRuns(tsCode: string, limit = 5): Promise<QuantResearchRun[]> {
    return parseResearchRuns(await requestJson(`/research/runs/${encodeURIComponent(tsCode)}?limit=${encodeURIComponent(String(limit))}`))
  },

  async generateResearchSummary(runId: string): Promise<QuantResearchSummary> {
    const summary = parseResearchSummary(unwrapData(await requestJson(`/research/runs/${encodeURIComponent(runId)}/summary`, {
      method: 'POST',
    })))
    if (!summary)
      throw new QuantApiError('AI 研究摘要数据格式无效', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    return summary
  },

  async generateResearchSummaryStream(runId: string, onProgress?: (event: QuantAiSummaryStreamProgress) => void): Promise<QuantResearchSummary> {
    const response = await fetch(`${QUANT_API_PREFIX}/research/runs/${encodeURIComponent(runId)}/summary/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json() as unknown
      }
      catch {
        payload = null
      }
      const record = isRecord(payload) ? payload : {}
      throw new QuantApiError(
        readString(record, 'error', 'message') || `量化接口请求失败（${response.status}）`,
        response.status,
        readString(record, 'code'),
      )
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream'))
      throw new QuantApiError('AI 流式响应类型无效', 502, 'QUANT_AI_SUMMARY_INVALID_RESPONSE')
    return readQuantAiSummaryStream(response, onProgress)
  },

  async getResearchSummaries(runId: string, limit = 1): Promise<QuantResearchSummary[]> {
    return parseResearchSummaries(await requestJson(`/research/runs/${encodeURIComponent(runId)}/summary?limit=${encodeURIComponent(String(limit))}`))
  },

  async getResearchAiAudits(runId: string, limit = 10): Promise<QuantAiRunAudit[]> {
    return parseResearchAiAudits(await requestJson(`/research/runs/${encodeURIComponent(runId)}/ai-audits?limit=${encodeURIComponent(String(limit))}`))
  },

  async generateResearchComparison(runIds: string[]): Promise<QuantResearchComparison> {
    const body: GenerateResearchComparisonRequestDto = { run_ids: runIds }
    return parseResearchComparison(await requestJson('/research/comparison', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
  },

  async askResearchQuestion(runId: string, question: string): Promise<QuantResearchQuestion> {
    const body: AskResearchQuestionRequestDto = { question }
    return parseResearchQuestion(await requestJson(`/research/runs/${encodeURIComponent(runId)}/question`, {
      method: 'POST',
      body: JSON.stringify(body),
    }))
  },

  async generateResearchChangeExplanation(runId: string, previousRunId: string): Promise<QuantResearchChangeExplanation> {
    const body: GenerateResearchChangeExplanationRequestDto = { previous_run_id: previousRunId }
    return parseResearchChangeExplanation(await requestJson(`/research/runs/${encodeURIComponent(runId)}/change-explanation`, {
      method: 'POST',
      body: JSON.stringify(body),
    }))
  },

  async updateResearchMarker(tsCode: string, input: { status: ResearchMarkerStatus, note: string | null, reviewDate: string | null }): Promise<QuantResearchMarker> {
    const body: UpdateResearchMarkerRequestDto = { status: input.status, note: input.note, review_date: input.reviewDate }
    const marker = parseResearchMarker(unwrapData(await requestJson(`/research/${encodeURIComponent(tsCode)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })))
    if (!marker)
      throw new QuantApiError('研究标记数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return marker
  },
}
function parseResearchSummaries(payload: unknown): QuantResearchSummary[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'summaries', 'researchSummaries', 'research_summaries').flatMap((value) => {
    const summary = parseResearchSummary(value)
    return summary ? [summary] : []
  })
}

function parseResearchAiAudits(payload: unknown): QuantAiRunAudit[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'audits', 'aiAudits', 'ai_audits').flatMap((value) => {
    const audit = parseQuantAiRunAudit(value)
    return audit ? [audit] : []
  })
}

function parseResearchComparison(payload: unknown): QuantResearchComparison {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('AI 对比研究数据格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')

  const comparisonVersion = readString(data, 'comparisonVersion', 'comparison_version')
  const provider = readString(data, 'provider')
  const model = readString(data, 'model')
  const generatedAt = readString(data, 'generatedAt', 'generated_at')
  const overview = readString(data, 'overview')
  if (comparisonVersion !== 'research-comparison-v1' || !provider || !model || !generatedAt || !overview)
    throw new QuantApiError('AI 对比研究数据格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI 对比研究 provider 数据格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')

  const parseStringList = (key: string, alias?: string): string[] | null => {
    const raw = data[key] ?? (alias ? data[alias] : undefined)
    if (!Array.isArray(raw) || raw.length > 6 || raw.some(value => typeof value !== 'string' || !value.trim() || value.length > 360))
      return null
    return raw.map(value => (value as string).trim())
  }
  const commonGround = parseStringList('commonGround', 'common_ground')
  const risks = parseStringList('risks')
  const nextChecks = parseStringList('nextChecks', 'next_checks')
  if (!commonGround || !risks || !nextChecks || !Array.isArray(data.differences) || data.differences.length > 6)
    throw new QuantApiError('AI 对比研究数据格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
  const differences = data.differences.map((value) => {
    if (!isRecord(value))
      throw new QuantApiError('AI 对比研究差异格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
    const tsCode = readString(value, 'tsCode', 'ts_code')
    const point = readString(value, 'point')
    const evidenceKeys = Array.isArray(value.evidenceKeys) ? value.evidenceKeys : value.evidence_keys
    if (!tsCode || !point || !Array.isArray(evidenceKeys) || evidenceKeys.length < 1 || evidenceKeys.length > 16 || evidenceKeys.some(item => typeof item !== 'string' || !item.trim() || item.length > 80))
      throw new QuantApiError('AI 对比研究差异格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
    return { tsCode, point, evidenceKeys: evidenceKeys.map(item => (item as string).trim()) }
  })
  const rawCitations = Array.isArray(data.citedEvidence) ? data.citedEvidence : data.cited_evidence
  if (!Array.isArray(rawCitations) || rawCitations.length > 24)
    throw new QuantApiError('AI 对比研究引用格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
  const citedEvidence = rawCitations.map((value) => {
    if (!isRecord(value))
      throw new QuantApiError('AI 对比研究引用格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
    const tsCode = readString(value, 'tsCode', 'ts_code')
    const evidenceKey = readString(value, 'evidenceKey', 'evidence_key')
    if (!tsCode || !evidenceKey)
      throw new QuantApiError('AI 对比研究引用格式无效', 502, 'QUANT_AI_COMPARISON_INVALID_RESPONSE')
    return { tsCode, evidenceKey }
  })

  return {
    comparisonVersion,
    provider,
    model,
    generatedAt,
    overview,
    commonGround,
    differences,
    risks,
    nextChecks,
    citedEvidence,
  }
}

function parseResearchQuestion(payload: unknown): QuantResearchQuestion {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('AI 研究提问数据格式无效', 502, 'QUANT_AI_QUESTION_INVALID_RESPONSE')
  const questionVersion = readString(data, 'questionVersion', 'question_version')
  const provider = readString(data, 'provider')
  const model = readString(data, 'model')
  const generatedAt = readString(data, 'generatedAt', 'generated_at')
  const question = readString(data, 'question')
  const answer = readString(data, 'answer')
  const citedEvidenceKeys = data.citedEvidenceKeys ?? data.cited_evidence_keys
  if (questionVersion !== 'research-question-v1' || !provider || !model || !generatedAt || !question || question.length > 500 || !answer || answer.length > 8000)
    throw new QuantApiError('AI 研究提问数据格式无效', 502, 'QUANT_AI_QUESTION_INVALID_RESPONSE')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI 研究提问 provider 数据格式无效', 502, 'QUANT_AI_QUESTION_INVALID_RESPONSE')
  if (!Array.isArray(citedEvidenceKeys) || citedEvidenceKeys.length > 16 || citedEvidenceKeys.some(key => typeof key !== 'string' || !key.trim() || key.length > 80))
    throw new QuantApiError('AI 研究提问引用格式无效', 502, 'QUANT_AI_QUESTION_INVALID_RESPONSE')
  return {
    questionVersion,
    provider,
    model,
    generatedAt,
    question,
    answer,
    citedEvidenceKeys: [...new Set(citedEvidenceKeys.map(key => (key as string).trim()))],
  }
}

function parseResearchChangeExplanation(payload: unknown): QuantResearchChangeExplanation {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('AI 研究变化解释数据格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  const version = readString(data, 'changeExplanationVersion', 'change_explanation_version')
  const provider = readString(data, 'provider')
  const model = readString(data, 'model')
  const generatedAt = readString(data, 'generatedAt', 'generated_at')
  const currentGeneratedAt = readString(data, 'currentGeneratedAt', 'current_generated_at')
  const previousGeneratedAt = readString(data, 'previousGeneratedAt', 'previous_generated_at')
  const overview = readString(data, 'overview')
  if (version !== 'research-change-explanation-v1' || !provider || !model || !generatedAt || !currentGeneratedAt || !previousGeneratedAt || !overview)
    throw new QuantApiError('AI 研究变化解释数据格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI 研究变化解释 provider 数据格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  if (!Array.isArray(data.changes) || data.changes.length > 8)
    throw new QuantApiError('AI 研究变化解释差异格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  const changes = data.changes.map((value) => {
    if (!isRecord(value))
      throw new QuantApiError('AI 研究变化解释差异格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
    const evidenceKey = readString(value, 'evidenceKey', 'evidence_key')
    const label = readString(value, 'label')
    const kind = readString(value, 'kind')
    const kindLabel = readString(value, 'kindLabel', 'kind_label')
    const explanation = readString(value, 'explanation')
    if (!evidenceKey || !label || label.length > 160 || !kind || !kindLabel || kindLabel.length > 40 || !explanation || explanation.length > 480)
      throw new QuantApiError('AI 研究变化解释差异格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
    const validKinds: QuantResearchChangeExplanation['changes'][number]['kind'][] = ['improved', 'weakened', 'restored', 'newly-missing', 'persistent-missing', 'changed', 'incomparable', 'added']
    if (!validKinds.includes(kind as QuantResearchChangeExplanation['changes'][number]['kind']))
      throw new QuantApiError('AI 研究变化解释差异类型无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
    return { evidenceKey, label, kind: kind as QuantResearchChangeExplanation['changes'][number]['kind'], kindLabel, explanation }
  })
  const rawNextChecks = data.nextChecks ?? data.next_checks
  if (!Array.isArray(rawNextChecks) || rawNextChecks.length > 6 || rawNextChecks.some(item => typeof item !== 'string' || !item.trim() || item.length > 360))
    throw new QuantApiError('AI 研究变化解释核对项格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  const nextChecks = rawNextChecks.map(item => (item as string).trim())
  const citedEvidenceKeys = data.citedEvidenceKeys ?? data.cited_evidence_keys
  if (!Array.isArray(citedEvidenceKeys) || citedEvidenceKeys.length > 16 || citedEvidenceKeys.some(key => typeof key !== 'string' || !key.trim() || key.length > 80))
    throw new QuantApiError('AI 研究变化解释引用格式无效', 502, 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE')
  return {
    changeExplanationVersion: 'research-change-explanation-v1',
    provider: provider as QuantResearchChangeExplanation['provider'],
    model,
    generatedAt,
    currentGeneratedAt,
    previousGeneratedAt,
    overview,
    changes,
    nextChecks,
    citedEvidenceKeys: [...new Set(citedEvidenceKeys.map(key => (key as string).trim()))],
  }
}
