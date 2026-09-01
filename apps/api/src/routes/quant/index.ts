import type { Database } from '@starye/db'
import type { QuantCandidateAiSession as QuantCandidateAiSessionRecord, QuantDecisionAssessment as QuantDecisionAssessmentRecord, QuantDecisionRecord as QuantDecisionRecordRecord, QuantResearchRun as QuantResearchRunRecord, QuantResearchSummary as QuantResearchSummaryRecord } from '@starye/db/schema'
import type { Context } from 'hono'
import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingResult, QuantCandidateBriefingCandidate, QuantCandidateBriefingMarker } from '../../domain/quant/ai-candidate-briefing'
import type { QuantAiCandidateBriefingQuestionResult } from '../../domain/quant/ai-candidate-briefing-question'
import type { QuantAiChangeExplanationResult } from '../../domain/quant/ai-change-explanation'
import type { QuantAiComparisonResult } from '../../domain/quant/ai-comparison'
import type { QuantAiQuestionResult } from '../../domain/quant/ai-question'
import type { QuantAiSummary } from '../../domain/quant/ai-summary'
import type { QuantDecisionAssistantMarketInput, QuantDecisionAssistantSnapshot } from '../../domain/quant/decision-assistant'
import type { EastmoneyProviderOptions, TushareProviderOptions } from '../../domain/quant/provider'
import type { QuantResearchReport } from '../../domain/quant/research-report'
import type { QuantSignalHistoryCandidate, QuantSignalHistorySnapshot } from '../../domain/quant/signal-persistence'
import type { MomentumCandidate } from '../../domain/quant/types'
import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { buildQuantCandidateBriefingFacts, generateQuantAiCandidateBriefing } from '../../domain/quant/ai-candidate-briefing'
import { generateQuantAiCandidateBriefingQuestion } from '../../domain/quant/ai-candidate-briefing-question'
import { generateQuantAiChangeExplanation } from '../../domain/quant/ai-change-explanation'
import { generateQuantAiComparison } from '../../domain/quant/ai-comparison'
import { deleteQuantAiConfig, getDecryptedQuantAiConfig, getQuantAiConfig, saveQuantAiConfig } from '../../domain/quant/ai-config'
import { testQuantAiConnection } from '../../domain/quant/ai-connection'
import { generateQuantAiQuestion } from '../../domain/quant/ai-question'
import { buildQuantAiFactorImpact, generateQuantAiSummary, parseQuantAiFactorImpactSnapshot, parseQuantAiSummary } from '../../domain/quant/ai-summary'
import { createQuantAkshareBridge, QuantAkshareBridgeError } from '../../domain/quant/akshare-bridge'
import { createQuantCapabilityRegistryFromEnv } from '../../domain/quant/capabilities'
import { buildQuantValuationComparison } from '../../domain/quant/comparison'
import { applyQuantDecisionAssistantAiReview, buildQuantDecisionAssistant, buildQuantDecisionAssistantAiFailure, buildQuantDecisionAssistantAiReview, buildQuantDecisionAssistantAiUnavailable, generateQuantAiDecisionAssistant, parseQuantDecisionAssistantSnapshot } from '../../domain/quant/decision-assistant'
import { buildQuantDecisionRecordSnapshot, parseQuantDecisionRecordSnapshot } from '../../domain/quant/decision-record'
import { QuantError } from '../../domain/quant/errors'
import { screenMomentum } from '../../domain/quant/factor'
import { buildQuantFinancialQualityComparison } from '../../domain/quant/financial-comparison'
import { getQuantInvestmentKnowledge } from '../../domain/quant/investment-knowledge'
import { createEastmoneyDividendProvider, createEastmoneyFinancialProvider, createEastmoneyMarketQuoteProvider, createEastmoneyStockBasicProvider, createEastmoneyValuationProvider, createQuantDividendProviderChain, createTushareDividendProvider, createTushareStockBasicProvider, mapQuantProviderError, resolveQuantProviderName } from '../../domain/quant/provider'
import {
  appendQuantCandidateAiSessionQuestion,
  createQuantCandidateAiSession,
  createQuantDecisionAssessment,
  createQuantResearchRun,
  createQuantResearchSummary,
  createQuantWatchlistItem,
  deleteQuantCandidateAiSession,
  deleteQuantFactorConfiguration,
  deleteQuantWatchlistItem,
  ensureQuantStarterWatchlist,
  getLatestQuantDailyBar,
  getQuantCandidateAiSession,
  getQuantDecisionRecord,
  getQuantFactorConfiguration,
  getQuantResearchRun,
  getQuantSyncState,
  getQuantWatchlistItem,
  listQuantCandidateAiSessions,
  listQuantDailyBars,
  listQuantDecisionAssessments,
  listQuantDecisionQueue,
  listQuantDecisionRecords,
  listQuantResearchMarkers,
  listQuantResearchRuns,
  listQuantResearchSummaries,
  listQuantScanSnapshots,
  listQuantWatchlist,
  listQuantWatchlistWithStats,
  normalizeTsCode,
  saveQuantFactorConfiguration,
  updateQuantWatchlistItem,
  upsertQuantDecisionRecord,
  upsertQuantResearchMarker,
} from '../../domain/quant/repository'
import { buildQuantResearchReport } from '../../domain/quant/research-report'
import { readQuantShareholderReturn, readQuantShareholderReturns } from '../../domain/quant/shareholder-return'
import { buildQuantSignalPersistence } from '../../domain/quant/signal-persistence'
import { syncQuantDaily } from '../../domain/quant/sync'
import { readQuantValueSelection } from '../../domain/quant/value-selection-service'
import { requireAuth } from '../../middleware/guard'
import {
  QuantAiCandidateBriefingQuestionRequestSchema,
  QuantAiCandidateBriefingRequestSchema,
  QuantAiCandidateBriefingSessionIdParamSchema,
  QuantAiCandidateBriefingSessionQuerySchema,
  QuantAiConfigUpdateSchema,
  QuantDailyQuerySchema,
  QuantDecisionAssistantCreateSchema,
  QuantDecisionRecordQuerySchema,
  QuantDecisionRecordUpdateSchema,
  QuantFactorConfigUpdateSchema,
  QuantFinancialHistoryQuerySchema,
  QuantResearchChangeExplanationSchema,
  QuantResearchComparisonSchema,
  QuantResearchMarkerUpdateSchema,
  QuantResearchQuestionSchema,
  QuantResearchRunCreateSchema,
  QuantResearchRunIdParamSchema,
  QuantResearchRunsQuerySchema,
  QuantResearchSummaryQuerySchema,
  QuantSyncSchema,
  QuantWatchlistCreateSchema,
  QuantWatchlistParamSchema,
  QuantWatchlistUpdateSchema,
} from '../../schemas/quant'

export const quantRoutes = new Hono<AppEnv>()

function currentQuantUserId(c: Context<AppEnv>): string {
  const userId = c.get('user')?.id
  if (!userId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Authenticated user is required', 401)
  return userId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface CurrentQuantCandidateView {
  readonly [key: string]: unknown
  readonly id: string
  readonly tsCode: string
  readonly factorVersion: string | null
  readonly name: string | null
  readonly score: number | null
  readonly changePercent: number | null
  readonly dataQuality: string
  readonly matchedFactors: readonly string[]
  readonly missingFactors: readonly string[]
  readonly factors: unknown
  readonly pendingSync: boolean
  readonly pendingReason: string | null
  readonly persistence?: ReturnType<typeof buildQuantSignalPersistence>
}

interface CurrentQuantCandidateSnapshot {
  readonly id: string
  readonly factorVersion: string
  readonly generatedAt: Date | null
  readonly fromDate: string | null
  readonly toDate: string | null
  readonly inputTsCodes: readonly string[]
  readonly candidates: readonly CurrentQuantCandidateView[]
}

function parseStoredCandidates(snapshot: { readonly candidatesJson: string } | undefined): ReadonlyMap<string, Record<string, unknown>> {
  if (!snapshot)
    return new Map()
  try {
    const value: unknown = JSON.parse(snapshot.candidatesJson)
    if (!Array.isArray(value))
      return new Map()
    return new Map(value.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.tsCode === 'string').map(item => [item.tsCode as string, item]))
  }
  catch {
    return new Map()
  }
}

function parseSignalHistoryCandidate(value: Record<string, unknown>): QuantSignalHistoryCandidate {
  const rawScore = value.score
  const score = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null
  const rawFactors = value.matchedFactors
  const matchedFactors = Array.isArray(rawFactors)
    ? rawFactors.filter((factor): factor is string => typeof factor === 'string')
    : []
  return { score, matchedFactors }
}

function parseSignalHistorySnapshot(snapshot: {
  readonly id: string
  readonly generatedAt: Date
  readonly candidatesJson: string
}): QuantSignalHistorySnapshot {
  const candidates = new Map([...parseStoredCandidates(snapshot)].map(([tsCode, candidate]) => [tsCode, parseSignalHistoryCandidate(candidate)] as const))
  return { id: snapshot.id, generatedAt: snapshot.generatedAt, candidates }
}

function parseResearchReport(reportJson: string): QuantResearchReport {
  try {
    const parsed: unknown = JSON.parse(reportJson)
    if (!isRecord(parsed) || (parsed.reportVersion !== 'research-report-v1' && parsed.reportVersion !== 'research-report-v2') || !Array.isArray(parsed.evidence))
      throw new Error('invalid report')
    return parsed as unknown as QuantResearchReport
  }
  catch {
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research report is invalid', 500)
  }
}

function researchRunView(row: QuantResearchRunRecord) {
  return {
    id: row.id,
    tsCode: row.tsCode,
    name: row.name,
    status: row.status,
    reportVersion: row.reportVersion,
    sourceSnapshotId: row.sourceSnapshotId,
    generatedAt: row.generatedAt,
    createdAt: row.createdAt,
    report: parseResearchReport(row.reportJson),
  }
}

function parseStoredAiSummary(value: string, report: QuantResearchReport, evaluatedAt: Date): QuantAiSummary {
  try {
    const summary = parseQuantAiSummary(value, report, evaluatedAt)
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || !Object.hasOwn(parsed, 'factorImpactSnapshot'))
      return summary
    if (parsed.factorImpactSnapshot === null)
      return { ...summary, factorImpactSnapshot: null }
    const persistedImpact = parseQuantAiFactorImpactSnapshot(parsed.factorImpactSnapshot)
    const snapshotAt = new Date(persistedImpact.evaluatedAt)
    const factorImpactSnapshot = buildQuantAiFactorImpact(report, summary.factorReviews, snapshotAt)
    if (!factorImpactSnapshot)
      throw new Error('Persisted AI factor impact snapshot has no report factors')
    return { ...summary, factorImpactSnapshot }
  }
  catch {
    throw new QuantError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'Persisted AI summary is invalid', 500)
  }
}

function parseStoredEvidenceKeys(value: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string'))
      throw new Error('invalid evidence keys')
    return parsed as string[]
  }
  catch {
    throw new QuantError('QUANT_AI_SUMMARY_INVALID_RESPONSE', 'Persisted AI summary evidence references are invalid', 500)
  }
}

function researchSummaryView(row: QuantResearchSummaryRecord, report: QuantResearchReport, evaluatedAt: Date = new Date()) {
  const summary = parseStoredAiSummary(row.summaryJson, report, evaluatedAt)
  const citedEvidenceKeys = parseStoredEvidenceKeys(row.citedEvidenceKeysJson)
  const { factorImpactSnapshot, ...summaryView } = summary
  return {
    id: row.id,
    researchRunId: row.researchRunId,
    summaryVersion: row.summaryVersion,
    reportVersion: row.reportVersion,
    provider: row.provider,
    model: row.model,
    generatedAt: row.generatedAt,
    createdAt: row.createdAt,
    summary: summaryView,
    factorImpact: buildQuantAiFactorImpact(report, summary.factorReviews, evaluatedAt),
    factorImpactSnapshot: factorImpactSnapshot ?? null,
    citedEvidenceKeys,
  }
}

function decisionRecordView(row: QuantDecisionRecordRecord) {
  if (!['watch', 'plan-buy', 'holding', 'sold'].includes(row.action))
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted decision record action is invalid', 500)
  return {
    id: row.id,
    researchRunId: row.researchRunId,
    tsCode: row.tsCode,
    action: row.action,
    note: row.note,
    snapshot: parseQuantDecisionRecordSnapshot(row.snapshotJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function decisionAssistantView(row: QuantDecisionAssessmentRecord, report?: QuantResearchReport) {
  const snapshot = parseQuantDecisionAssistantSnapshot(row.snapshotJson, report)
  const sameNumber = (left: number | null, right: number | null) => left === right
  if (snapshot.tsCode !== row.tsCode
    || snapshot.researchRunId !== row.researchRunId
    || snapshot.scenario.mode !== row.mode
    || !sameNumber(snapshot.scenario.currentPrice, row.currentPrice)
    || !sameNumber(snapshot.scenario.costBasis, row.costBasis)
    || !sameNumber(snapshot.scenario.quantity, row.quantity)) {
    throw new QuantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant identity does not match its row', 500)
  }
  const factorImpact = snapshot.factorImpact !== undefined
    ? snapshot.factorImpact
    : report ? buildQuantAiFactorImpact(report, snapshot.ai.factorReviews, new Date(snapshot.assessedAt)) : null
  return {
    id: row.id,
    createdAt: row.createdAt,
    ...snapshot,
    factorImpact,
  }
}

function researchComparisonView(comparison: QuantAiComparisonResult) {
  return {
    comparisonVersion: comparison.comparisonVersion,
    provider: comparison.provider,
    model: comparison.model,
    generatedAt: comparison.generatedAt,
    overview: comparison.overview,
    commonGround: comparison.commonGround,
    differences: comparison.differences,
    risks: comparison.risks,
    nextChecks: comparison.nextChecks,
    citedEvidence: comparison.citedEvidence,
  }
}

function researchQuestionView(question: QuantAiQuestionResult) {
  return {
    questionVersion: question.questionVersion,
    provider: question.provider,
    model: question.model,
    generatedAt: question.generatedAt,
    question: question.question,
    answer: question.answer,
    citedEvidenceKeys: question.citedEvidenceKeys,
  }
}

function researchChangeExplanationView(explanation: QuantAiChangeExplanationResult) {
  return {
    changeExplanationVersion: explanation.changeExplanationVersion,
    provider: explanation.provider,
    model: explanation.model,
    generatedAt: explanation.generatedAt,
    currentGeneratedAt: explanation.currentGeneratedAt,
    previousGeneratedAt: explanation.previousGeneratedAt,
    overview: explanation.overview,
    changes: explanation.changes,
    nextChecks: explanation.nextChecks,
    citedEvidenceKeys: explanation.citedEvidenceKeys,
  }
}

function candidateBriefingView(briefing: QuantAiCandidateBriefingResult, sessionId?: string) {
  return {
    ...(sessionId ? { sessionId } : {}),
    briefingVersion: briefing.briefingVersion,
    provider: briefing.provider,
    model: briefing.model,
    generatedAt: briefing.generatedAt,
    overview: briefing.overview,
    focusItems: briefing.focusItems,
    nextChecks: briefing.nextChecks,
    citedCandidateCodes: briefing.citedCandidateCodes,
  }
}

function candidateBriefingQuestionView(question: QuantAiCandidateBriefingQuestionResult, sessionId?: string) {
  return {
    ...(sessionId ? { sessionId } : {}),
    questionVersion: question.questionVersion,
    provider: question.provider,
    model: question.model,
    generatedAt: question.generatedAt,
    question: question.question,
    answer: question.answer,
    citedCandidateCodes: question.citedCandidateCodes,
  }
}

type CandidateAiBriefingView = ReturnType<typeof candidateBriefingView>
type CandidateAiQuestionView = ReturnType<typeof candidateBriefingQuestionView>

const QUANT_AI_PROVIDERS = new Set<QuantAiCandidateBriefingResult['provider']>(['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'])

function parseStoredJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value)
  }
  catch {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', `Persisted candidate AI ${label} is invalid`, 500)
  }
}

function storedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', `Persisted candidate AI ${label} is invalid`, 500)
  return value.trim()
}

function storedNullableString(value: unknown, label: string, maxLength: number): string | null {
  if (value === null)
    return null
  return storedString(value, label, maxLength)
}

function storedStringList(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', `Persisted candidate AI ${label} is invalid`, 500)
  return value.map(item => storedString(item, label, maxLength))
}

function parseStoredCandidateBriefing(value: string, allowedCodes: ReadonlySet<string>): CandidateAiBriefingView {
  const parsed = parseStoredJson(value, 'briefing')
  if (!isRecord(parsed))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing is invalid', 500)
  const briefingVersion = storedString(parsed.briefingVersion, 'briefingVersion', 64)
  const provider = storedString(parsed.provider, 'provider', 32)
  const model = storedString(parsed.model, 'model', 128)
  const generatedAt = storedString(parsed.generatedAt, 'generatedAt', 128)
  const overview = storedString(parsed.overview, 'overview', 1200)
  if (briefingVersion !== 'candidate-briefing-v1' || !QUANT_AI_PROVIDERS.has(provider as QuantAiCandidateBriefingResult['provider']))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing version or provider is invalid', 500)

  if (!Array.isArray(parsed.focusItems) || parsed.focusItems.length > 5)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing focus items are invalid', 500)
  const validPriorityLevels = new Set(['urgent', 'high', 'normal', 'low'])
  const focusItems = parsed.focusItems.map((value) => {
    if (!isRecord(value))
      throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing focus item is invalid', 500)
    const tsCode = storedString(value.tsCode, 'focusItems.tsCode', 20).toUpperCase()
    const name = storedNullableString(value.name, 'focusItems.name', 128)
    const priorityLevel = storedString(value.priorityLevel, 'focusItems.priorityLevel', 16)
    const priorityScore = value.priorityScore
    const actionLabel = storedString(value.actionLabel, 'focusItems.actionLabel', 80)
    const reasons = storedStringList(value.reasons, 'focusItems.reasons', 3, 360)
    const explanation = storedString(value.explanation, 'focusItems.explanation', 480)
    if (!/^[A-Z0-9.-]{1,20}$/u.test(tsCode) || !validPriorityLevels.has(priorityLevel) || typeof priorityScore !== 'number' || !Number.isFinite(priorityScore) || priorityScore < 0 || priorityScore > 100)
      throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing focus item values are invalid', 500)
    return {
      tsCode,
      name,
      priorityLevel: priorityLevel as QuantAiCandidateBriefing['focusItems'][number]['priorityLevel'],
      priorityScore,
      actionLabel,
      reasons,
      explanation,
    }
  })
  const nextChecks = storedStringList(parsed.nextChecks, 'nextChecks', 6, 360)
  const citedCandidateCodes = storedStringList(parsed.citedCandidateCodes, 'citedCandidateCodes', 5, 20).map(code => code.toUpperCase())
  if ([...focusItems.map(item => item.tsCode), ...citedCandidateCodes].some(code => !/^[A-Z0-9.-]{1,20}$/u.test(code) || !allowedCodes.has(code)))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing candidate codes are invalid', 500)
  return {
    briefingVersion: 'candidate-briefing-v1',
    provider: provider as QuantAiCandidateBriefingResult['provider'],
    model,
    generatedAt,
    overview,
    focusItems,
    nextChecks,
    citedCandidateCodes: [...new Set(citedCandidateCodes)],
  }
}

function parseStoredCandidateQuestion(value: unknown, allowedCodes: ReadonlySet<string>): CandidateAiQuestionView {
  if (!isRecord(value))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI question is invalid', 500)
  const questionVersion = storedString(value.questionVersion, 'questionVersion', 64)
  const provider = storedString(value.provider, 'provider', 32)
  const model = storedString(value.model, 'model', 128)
  const generatedAt = storedString(value.generatedAt, 'generatedAt', 128)
  const question = storedString(value.question, 'question', 500)
  const answer = storedString(value.answer, 'answer', 8000)
  const citedCandidateCodes = storedStringList(value.citedCandidateCodes, 'citedCandidateCodes', 16, 20).map(code => code.toUpperCase())
  if (questionVersion !== 'candidate-briefing-question-v1' || !QUANT_AI_PROVIDERS.has(provider as QuantAiCandidateBriefingQuestionResult['provider']) || citedCandidateCodes.some(code => !/^[A-Z0-9.-]{1,20}$/u.test(code) || !allowedCodes.has(code)))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI question version or provider is invalid', 500)
  return {
    questionVersion: 'candidate-briefing-question-v1',
    provider: provider as QuantAiCandidateBriefingQuestionResult['provider'],
    model,
    generatedAt,
    question,
    answer,
    citedCandidateCodes: [...new Set(citedCandidateCodes)],
  }
}

function canonicalCandidateCodes(codes: readonly string[]): string[] {
  return [...new Set(codes.map(normalizeTsCode))].sort((left, right) => left.localeCompare(right))
}

function candidateSessionIdentity(snapshot: CurrentQuantCandidateSnapshot) {
  if (!snapshot.generatedAt || !snapshot.fromDate || !snapshot.toDate || snapshot.id === 'pending')
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_INPUT', 'Candidate snapshot identity is incomplete', 422)
  const candidateCodes = canonicalCandidateCodes(snapshot.inputTsCodes)
  if (!candidateCodes.length)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_INPUT', 'Candidate snapshot scope is empty', 422)
  return {
    snapshotId: snapshot.id,
    snapshotGeneratedAt: snapshot.generatedAt,
    fromDate: snapshot.fromDate,
    toDate: snapshot.toDate,
    scopeKey: candidateCodes.join('|'),
    candidateCodes,
    candidateCodesJson: JSON.stringify(candidateCodes),
  }
}

function parseStoredCandidateCodes(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string'))
      throw new Error('candidate codes must be an array')
    return canonicalCandidateCodes(parsed)
  }
  catch {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI session scope is invalid', 500)
  }
}

function candidateAiSessionView(row: QuantCandidateAiSessionRecord) {
  if (!QUANT_AI_PROVIDERS.has(row.provider as QuantAiCandidateBriefingResult['provider']) || !row.model.trim())
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI session provider or model is invalid', 500)
  const candidateCodes = parseStoredCandidateCodes(row.candidateCodesJson)
  if (row.scopeKey !== candidateCodes.join('|'))
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI session scope key is invalid', 500)
  const rawBriefing = parseStoredJson(row.briefingJson, 'briefing')
  const allowedCodes = new Set(candidateCodes)
  const briefing = rawBriefing === null ? null : parseStoredCandidateBriefing(row.briefingJson, allowedCodes)
  const rawQuestions = parseStoredJson(row.questionsJson, 'questions')
  if (!Array.isArray(rawQuestions) || rawQuestions.length > 10)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI session questions are invalid', 500)
  const questions = rawQuestions.map(question => parseStoredCandidateQuestion(question, allowedCodes))
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    snapshotGeneratedAt: row.snapshotGeneratedAt,
    fromDate: row.fromDate,
    toDate: row.toDate,
    scopeKey: row.scopeKey,
    candidateCodes,
    briefing: briefing ? { ...briefing, sessionId: row.id } : null,
    questions: questions.map(question => ({ ...question, sessionId: row.id })),
    provider: row.provider,
    model: row.model,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function assertCandidateSessionMatches(row: QuantCandidateAiSessionRecord, identity: ReturnType<typeof candidateSessionIdentity>): void {
  const storedCodes = parseStoredCandidateCodes(row.candidateCodesJson)
  if (row.snapshotId !== identity.snapshotId
    || row.snapshotGeneratedAt.getTime() !== identity.snapshotGeneratedAt.getTime()
    || row.fromDate !== identity.fromDate
    || row.toDate !== identity.toDate
    || row.scopeKey !== identity.scopeKey
    || JSON.stringify(storedCodes) !== identity.candidateCodesJson) {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_STALE', 'Candidate AI session scope no longer matches the current snapshot', 422)
  }
}

function isComparableResearchReport(report: QuantResearchReport): boolean {
  const validStatuses = new Set(['ready', 'partial', 'insufficient_data'])
  const validActions = new Set(['research-window', 'wait-confirmation', 'reassess', 'complete-data'])
  const validEvidenceStatuses = new Set(['pass', 'caution', 'fail', 'missing'])
  return typeof report.generatedAt === 'string'
    && typeof report.headline === 'string'
    && (report.name === null || typeof report.name === 'string')
    && (report.score === null || (typeof report.score === 'number' && Number.isFinite(report.score)))
    && Array.isArray(report.strengths)
    && report.strengths.every(item => typeof item === 'string')
    && Array.isArray(report.risks)
    && report.risks.every(item => typeof item === 'string')
    && Array.isArray(report.gaps)
    && report.gaps.every(item => typeof item === 'string')
    && Array.isArray(report.nextActions)
    && report.nextActions.every(item => typeof item === 'string')
    && validStatuses.has(report.status)
    && validActions.has(report.action)
    && Array.isArray(report.evidence)
    && report.evidence.every(item => isRecord(item)
      && typeof item.key === 'string'
      && typeof item.dimension === 'string'
      && typeof item.label === 'string'
      && typeof item.status === 'string'
      && validEvidenceStatuses.has(item.status)
      && (item.value === null || (typeof item.value === 'number' && Number.isFinite(item.value)))
      && typeof item.threshold === 'string'
      && typeof item.source === 'string'
      && (item.observedAt === null || typeof item.observedAt === 'string')
      && typeof item.formulaVersion === 'string'
      && typeof item.detail === 'string')
    && Array.isArray(report.sources)
    && report.sources.every(item => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && (item.observedAt === null || typeof item.observedAt === 'string')
      && typeof item.formulaVersion === 'string')
}

function snapshotIncludesCode(snapshot: { readonly inputTsCodesJson: string }, tsCode: string): boolean {
  try {
    const parsed: unknown = JSON.parse(snapshot.inputTsCodesJson)
    return Array.isArray(parsed) && parsed.some(code => typeof code === 'string' && code.trim().toUpperCase() === tsCode)
  }
  catch {
    return false
  }
}

function parseSnapshotInputTsCodes(snapshot: { readonly inputTsCodesJson: string } | undefined): readonly string[] {
  if (!snapshot)
    return []
  try {
    const parsed: unknown = JSON.parse(snapshot.inputTsCodesJson)
    if (!Array.isArray(parsed))
      return []
    return [...new Set(parsed
      .filter((code): code is string => typeof code === 'string')
      .map(code => code.trim().toUpperCase())
      .filter(code => /^[A-Z0-9.-]{1,20}$/u.test(code)))]
  }
  catch {
    return []
  }
}

function scopeCurrentQuantCandidates(
  snapshot: CurrentQuantCandidateSnapshot,
  tsCodes: readonly string[] | undefined,
  inputErrorCode: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' | 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INPUT' = 'QUANT_AI_CANDIDATE_BRIEFING_INPUT',
): CurrentQuantCandidateSnapshot {
  if (tsCodes === undefined)
    return snapshot

  const normalizedCodes = [...new Set(tsCodes.map(normalizeTsCode))]
  if (!normalizedCodes.length)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_INPUT', 'Candidate briefing scope must contain at least one candidate', 422)

  const candidatesByCode = new Map(snapshot.candidates.map(candidate => [candidate.tsCode.toUpperCase(), candidate] as const))
  const snapshotCodes = new Set(snapshot.inputTsCodes)
  const unknownCodes = normalizedCodes.filter(tsCode => !snapshotCodes.has(tsCode) || !candidatesByCode.has(tsCode))
  if (unknownCodes.length)
    throw new QuantError(inputErrorCode, 'Candidate briefing scope contains a candidate outside the current snapshot', 422, { tsCodes: unknownCodes })

  return {
    ...snapshot,
    inputTsCodes: normalizedCodes,
    candidates: normalizedCodes.map(tsCode => candidatesByCode.get(tsCode)!),
  }
}

async function readCurrentQuantCandidates(db: AppEnv['Variables']['db'], userId: string): Promise<CurrentQuantCandidateSnapshot> {
  const [watchlist, snapshotHistory] = await Promise.all([
    listQuantWatchlist(db, userId),
    listQuantScanSnapshots(db, userId),
  ])
  const snapshot = snapshotHistory[0]
  const barsByCode = Object.fromEntries(await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const)))
  const recalculated = new Map(screenMomentum(barsByCode).map(candidate => [candidate.tsCode, candidate]))
  const stored = parseStoredCandidates(snapshot)
  const signalHistory = snapshotHistory.map(parseSignalHistorySnapshot)
  const persistenceByCode = new Map(watchlist.map(item => [item.tsCode, buildQuantSignalPersistence(item.tsCode, signalHistory)] as const))
  const candidates = watchlist.map((item) => {
    const snapshotCandidate = stored.get(item.tsCode)
    if (snapshotCandidate) {
      return {
        ...snapshotCandidate,
        id: `snapshot-${item.tsCode}`,
        tsCode: item.tsCode,
        factorVersion: typeof snapshotCandidate.factorVersion === 'string' ? snapshotCandidate.factorVersion : snapshot?.factorVersion ?? 'momentum-v1',
        name: item.name ?? (typeof snapshotCandidate.name === 'string' ? snapshotCandidate.name : null),
        score: typeof snapshotCandidate.score === 'number' && Number.isFinite(snapshotCandidate.score) ? snapshotCandidate.score : null,
        changePercent: typeof snapshotCandidate.changePercent === 'number' && Number.isFinite(snapshotCandidate.changePercent) ? snapshotCandidate.changePercent : null,
        dataQuality: typeof snapshotCandidate.dataQuality === 'string' ? snapshotCandidate.dataQuality : 'insufficient_data',
        matchedFactors: Array.isArray(snapshotCandidate.matchedFactors) ? snapshotCandidate.matchedFactors.filter((factor): factor is string => typeof factor === 'string') : [],
        missingFactors: Array.isArray(snapshotCandidate.missingFactors) ? snapshotCandidate.missingFactors.filter((factor): factor is string => typeof factor === 'string') : [],
        factors: isRecord(snapshotCandidate.factors) ? snapshotCandidate.factors : null,
        pendingSync: false,
        pendingReason: null,
        persistence: persistenceByCode.get(item.tsCode),
      } satisfies CurrentQuantCandidateView
    }

    const candidate = recalculated.get(item.tsCode) as MomentumCandidate | undefined
    return {
      ...(candidate ?? {
        tsCode: item.tsCode,
        factorVersion: 'momentum-v1',
        factors: {
          ma5: null,
          ma20: null,
          isNewHigh20: null,
          consecutiveUpDays: null,
          volumeRatio: null,
          return20: null,
          relativeStrength: null,
        },
        matchedFactors: [],
        missingFactors: ['ma5', 'ma20', 'new_high_20', 'continuation', 'volume_ratio', 'relative_strength'],
        dataQuality: 'insufficient_data' as const,
        score: 0,
      }),
      id: `watchlist-${item.tsCode}`,
      tsCode: item.tsCode,
      name: item.name,
      score: candidate?.score ?? 0,
      changePercent: null,
      dataQuality: candidate?.dataQuality ?? 'insufficient_data',
      matchedFactors: candidate?.matchedFactors ?? [],
      missingFactors: candidate?.missingFactors ?? ['ma5', 'ma20', 'new_high_20', 'continuation', 'volume_ratio', 'relative_strength'],
      factorVersion: candidate?.factorVersion ?? 'momentum-v1',
      factors: candidate?.factors ?? {
        ma5: null,
        ma20: null,
        isNewHigh20: null,
        consecutiveUpDays: null,
        volumeRatio: null,
        return20: null,
        relativeStrength: null,
      },
      pendingSync: true,
      pendingReason: '尚未进入最近一次候选快照，请更新观察池',
      persistence: persistenceByCode.get(item.tsCode),
    } satisfies CurrentQuantCandidateView
  })

  return {
    id: snapshot?.id ?? 'pending',
    factorVersion: snapshot?.factorVersion ?? 'momentum-v1',
    generatedAt: snapshot?.generatedAt ?? null,
    fromDate: snapshot?.fromDate ?? null,
    toDate: snapshot?.toDate ?? null,
    inputTsCodes: parseSnapshotInputTsCodes(snapshot),
    candidates,
  }
}

async function readCandidateBriefingFacts(db: AppEnv['Variables']['db'], userId: string, env: AppEnv['Bindings'] | undefined, snapshot: CurrentQuantCandidateSnapshot) {
  const markers = await listQuantResearchMarkers(db, userId)
  const valueSelection = await readQuantValueSelection(db, userId, {
    valuation: createEastmoneyValuationProvider(eastmoneyProviderOptions(env)),
    financial: createEastmoneyFinancialProvider(eastmoneyProviderOptions(env)),
  })
  const valueQualityByCode = new Map(valueSelection.items.map(item => [item.tsCode, {
    score: item.score,
    status: item.status,
    riskDeduction: item.riskDeduction,
  }] as const))
  const candidates: QuantCandidateBriefingCandidate[] = snapshot.candidates.map((candidate) => {
    const rawFactors = isRecord(candidate.factors) ? candidate.factors : {}
    const factorNumber = (...keys: string[]): number | null => {
      for (const key of keys) {
        const value = rawFactors[key]
        if (typeof value === 'number' && Number.isFinite(value))
          return value
      }
      return null
    }
    const factorValues = {
      consecutiveUpDays: factorNumber('consecutiveUpDays', 'upStreak', 'up_streak', 'continuation'),
      volumeRatio: factorNumber('volumeRatio', 'volume_ratio'),
      return20: factorNumber('return20', 'return_20'),
    }
    return {
      tsCode: candidate.tsCode,
      name: candidate.name,
      factorVersion: candidate.factorVersion,
      score: candidate.score,
      changePercent: candidate.changePercent,
      dataQuality: candidate.dataQuality,
      matchedFactors: candidate.matchedFactors,
      missingFactors: candidate.missingFactors,
      pendingSync: candidate.pendingSync ?? false,
      pendingReason: candidate.pendingReason ?? null,
      factors: factorValues,
      ...(candidate.persistence
        ? {
            persistence: {
              sampleSize: candidate.persistence.sampleSize,
              appearanceCount: candidate.persistence.appearanceCount,
              scoreDelta: candidate.persistence.scoreDelta,
              state: candidate.persistence.state,
            },
          }
        : {}),
      valueQuality: valueQualityByCode.get(candidate.tsCode) ?? null,
    }
  })
  const briefingMarkers: QuantCandidateBriefingMarker[] = markers.map(marker => ({
    tsCode: marker.tsCode,
    status: marker.status,
    reviewDate: marker.reviewDate,
  }))
  return buildQuantCandidateBriefingFacts(candidates, briefingMarkers)
}

function eastmoneyProviderOptions(env?: AppEnv['Bindings']): EastmoneyProviderOptions {
  const baseUrl = env?.EASTMONEY_BASE_URL?.trim()
  const dividendBaseUrl = env?.EASTMONEY_DIVIDEND_BASE_URL?.trim()
  const timeoutMs = Number(env?.EASTMONEY_TIMEOUT_MS)
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(dividendBaseUrl ? { dividendBaseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

function tushareProviderOptions(env?: AppEnv['Bindings']): TushareProviderOptions {
  const token = env?.TUSHARE_TOKEN?.trim()
  const baseUrl = env?.TUSHARE_BASE_URL?.trim()
  const timeoutMs = Number(env?.TUSHARE_TIMEOUT_MS)
  return {
    ...(token ? { token } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

function akshareBridgeOptions(env?: AppEnv['Bindings']) {
  const timeoutMs = Number(env?.QUANT_AKSHARE_BRIDGE_TIMEOUT_MS)
  return {
    baseUrl: env?.QUANT_AKSHARE_BRIDGE_URL,
    token: env?.QUANT_AKSHARE_BRIDGE_TOKEN,
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

function akshareBridgeErrorCode(error: unknown): string {
  return error instanceof QuantAkshareBridgeError ? `BRIDGE_${error.code}` : 'BRIDGE_UPSTREAM'
}

function aiGenerationTimeoutMs(env?: AppEnv['Bindings']): number | undefined {
  const timeoutMs = Number(env?.QUANT_AI_GENERATION_TIMEOUT_MS)
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined
}

function stockBasicProvider(env?: AppEnv['Bindings']) {
  const options = tushareProviderOptions(env)
  return resolveQuantProviderName(env) === 'tushare'
    ? createTushareStockBasicProvider(options)
    : createEastmoneyStockBasicProvider(eastmoneyProviderOptions(env))
}

async function resolveDecisionAssistantMarket(env: AppEnv['Bindings'] | undefined, db: Database, tsCode: string): Promise<{ readonly latestDailyBar: Awaited<ReturnType<typeof getLatestQuantDailyBar>>, readonly market: QuantDecisionAssistantMarketInput }> {
  const [dailyResult, quoteResult] = await Promise.allSettled([
    getLatestQuantDailyBar(db, tsCode),
    createEastmoneyMarketQuoteProvider(eastmoneyProviderOptions(env)).fetchMarketQuote({ tsCode }),
  ])
  if (dailyResult.status === 'rejected')
    throw dailyResult.reason

  if (quoteResult.status === 'fulfilled' && isCurrentMarketDate(quoteResult.value.observedAt)) {
    return {
      latestDailyBar: dailyResult.value,
      market: {
        currentPrice: quoteResult.value.price,
        currentPriceSource: 'eastmoney-realtime',
        currentPriceStatus: 'realtime',
        currentPriceObservedAt: quoteResult.value.observedAt,
        currentPriceChangePercent: quoteResult.value.changePercent,
        quoteErrorCode: null,
      },
    }
  }

  const quoteError = quoteResult.status === 'rejected' ? mapQuantProviderError(quoteResult.reason) : null
  const quoteFallbackCode = quoteError?.code ?? 'QUANT_MARKET_QUOTE_STALE'
  if (dailyResult.value && Number.isFinite(dailyResult.value.close) && dailyResult.value.close > 0) {
    return {
      latestDailyBar: dailyResult.value,
      market: {
        currentPrice: dailyResult.value.close,
        currentPriceSource: 'local-daily-bars',
        currentPriceStatus: 'latest-close',
        currentPriceObservedAt: dailyResult.value.tradeDate,
        currentPriceChangePercent: null,
        quoteErrorCode: quoteFallbackCode,
      },
    }
  }

  throw new QuantError('QUANT_DECISION_ASSISTANT_MARKET_UNAVAILABLE', 'Automatic market price is unavailable and no local latest close exists', 503, {
    provider: 'eastmoney',
    errorCode: quoteFallbackCode,
  })
}

function isCurrentMarketDate(observedAt: string, now = new Date()): boolean {
  const observed = new Date(observedAt)
  if (Number.isNaN(observed.getTime()) || observed.getTime() > now.getTime() + 5 * 60 * 1_000)
    return false
  const dateKey = (value: Date): string => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
    const year = parts.find(part => part.type === 'year')?.value ?? ''
    const month = parts.find(part => part.type === 'month')?.value ?? ''
    const day = parts.find(part => part.type === 'day')?.value ?? ''
    return `${year}-${month}-${day}`
  }
  return dateKey(observed) === dateKey(now)
}

function dividendProvider(env?: AppEnv['Bindings']) {
  const tushare = createTushareDividendProvider(tushareProviderOptions(env))
  const eastmoney = createEastmoneyDividendProvider(eastmoneyProviderOptions(env))
  const selected = resolveQuantProviderName(env)
  const primary = selected === 'tushare' && tushare.isConfigured ? tushare : eastmoney
  const fallback = primary.name === 'tushare' && eastmoney.isConfigured
    ? eastmoney
    : primary.name === 'eastmoney' && tushare.isConfigured
      ? tushare
      : undefined
  return createQuantDividendProviderChain(primary, fallback)
}

quantRoutes.use('*', requireAuth())

quantRoutes.onError((error, c) => {
  if (error instanceof QuantError) {
    return c.json({
      success: false as const,
      code: error.code,
      error: error.message,
      details: error.details ?? null,
    }, error.status)
  }
  throw error
})

quantRoutes.get('/capabilities', (c) => {
  const registry = createQuantCapabilityRegistryFromEnv(c.env)
  return c.json({
    success: true as const,
    data: {
      tier: registry.tier,
      provider: registry.provider,
      enabled: registry.enabled,
      capabilities: registry.capabilities,
    },
  })
})

quantRoutes.get('/knowledge', (c) => {
  return c.json({
    success: true as const,
    data: getQuantInvestmentKnowledge(),
  })
})

quantRoutes.get('/watchlist', async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const data = await listQuantWatchlistWithStats(c.get('db'), userId)
  return c.json({ success: true as const, data })
})

quantRoutes.get('/ai-config', async (c) => {
  const data = await getQuantAiConfig(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantRoutes.get('/factor-config', async (c) => {
  const data = await getQuantFactorConfiguration(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantRoutes.put('/factor-config', validator('json', QuantFactorConfigUpdateSchema), async (c) => {
  const input = c.req.valid('json')
  const data = await saveQuantFactorConfiguration(c.get('db'), {
    userId: currentQuantUserId(c),
    weights: input.weights,
  })
  return c.json({ success: true as const, data })
})

quantRoutes.delete('/factor-config', async (c) => {
  const data = await deleteQuantFactorConfiguration(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantRoutes.put('/ai-config', validator('json', QuantAiConfigUpdateSchema), async (c) => {
  const input = c.req.valid('json')
  const data = await saveQuantAiConfig(c.get('db'), {
    userId: currentQuantUserId(c),
    provider: input.provider,
    model: input.model,
    baseUrl: input.base_url,
    apiKey: input.api_key,
    clearApiKey: input.clear_api_key,
  }, c.env.QUANT_AI_ENCRYPTION_KEY)
  return c.json({ success: true as const, data })
})

quantRoutes.post('/ai-config/test', async (c) => {
  const userId = currentQuantUserId(c)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI summary configuration is not available', 503)
  const data = await testQuantAiConnection({
    config,
  })
  return c.json({ success: true as const, data })
})

quantRoutes.delete('/ai-config', async (c) => {
  const deleted = await deleteQuantAiConfig(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data: { deleted } })
})

quantRoutes.get('/stock-basic/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const data = await stockBasicProvider(c.env).fetchStockBasic({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/research', async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const data = await listQuantResearchMarkers(c.get('db'), userId)
  return c.json({ success: true as const, data })
})

quantRoutes.post('/research/runs', validator('json', QuantResearchRunCreateSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const input = c.req.valid('json')
  const tsCode = normalizeTsCode(input.ts_code)
  const watchlistItem = await getQuantWatchlistItem(c.get('db'), userId, tsCode)
  if (!watchlistItem)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const [dailyBars, snapshots] = await Promise.all([
    listQuantDailyBars(c.get('db'), { tsCode }),
    listQuantScanSnapshots(c.get('db'), userId, 1),
  ])
  const sourceSnapshotId = snapshots[0] && snapshotIncludesCode(snapshots[0], tsCode)
    ? snapshots[0].id
    : null
  const candidate = screenMomentum({ [tsCode]: dailyBars }).find(item => item.tsCode === tsCode) ?? null
  const factorConfiguration = await getQuantFactorConfiguration(c.get('db'), userId)
  const valuationProvider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
  const financialProvider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
  const dividendSourceProvider = dividendProvider(c.env)
  const akshareBridge = createQuantAkshareBridge(akshareBridgeOptions(c.env))
  const [valuationResult, financialResult, shareholderResult, akshareResult] = await Promise.allSettled([
    valuationProvider.fetchValuation({ tsCode }),
    financialProvider.fetchFinancialQualityHistory({ tsCode, limit: 4 }),
    readQuantShareholderReturn(c.get('db'), userId, tsCode, dividendSourceProvider),
    akshareBridge.isConfigured ? akshareBridge.fetchEvidence({ tsCode }) : Promise.resolve(null),
  ])
  const generatedAt = new Date()
  const report = buildQuantResearchReport({
    tsCode,
    name: watchlistItem.name,
    generatedAt,
    sourceSnapshotId,
    candidate,
    dailyBars,
    valuation: valuationResult.status === 'fulfilled' ? valuationResult.value : null,
    financialReports: financialResult.status === 'fulfilled' ? financialResult.value : [],
    shareholderReturn: shareholderResult.status === 'fulfilled' ? shareholderResult.value : null,
    valuationErrorCode: valuationResult.status === 'rejected' ? mapQuantProviderError(valuationResult.reason).code : null,
    financialErrorCode: financialResult.status === 'rejected' ? mapQuantProviderError(financialResult.reason).code : null,
    akshare: akshareResult.status === 'fulfilled' ? akshareResult.value : null,
    akshareConfigured: akshareBridge.isConfigured,
    akshareErrorCode: akshareResult.status === 'rejected' ? akshareBridgeErrorCode(akshareResult.reason) : null,
    factorConfiguration,
  })
  const persisted = await createQuantResearchRun(c.get('db'), {
    userId,
    tsCode,
    name: watchlistItem.name,
    status: report.status,
    reportVersion: report.reportVersion,
    sourceSnapshotId: report.sourceSnapshotId,
    reportJson: JSON.stringify(report),
    generatedAt,
  })
  return c.json({ success: true as const, data: researchRunView(persisted) }, 201)
})

quantRoutes.post('/decision-assistant', validator('json', QuantDecisionAssistantCreateSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const input = c.req.valid('json')
  const run = await getQuantResearchRun(c.get('db'), userId, input.research_run_id)
  if (!run)
    throw new QuantError('QUANT_DECISION_ASSISTANT_RESEARCH_REQUIRED', 'Research run is required before creating a decision assistant assessment', 422)
  const report = parseResearchReport(run.reportJson)
  if (report.tsCode !== run.tsCode || report.status !== run.status || report.reportVersion !== run.reportVersion)
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)
  if (input.mode === 'holding' && (input.cost_basis === undefined || input.cost_basis === null))
    throw new QuantError('QUANT_DECISION_ASSISTANT_INPUT', 'Holding assessment requires a cost basis', 422)

  const marketResolution = await resolveDecisionAssistantMarket(c.env, c.get('db'), run.tsCode)
  const scenario = {
    mode: input.mode,
    currentPrice: marketResolution.market.currentPrice,
    costBasis: input.cost_basis ?? null,
    quantity: input.quantity ?? null,
  } as const
  const deterministic = buildQuantDecisionAssistant({
    report,
    researchRunId: run.id,
    tsCode: run.tsCode,
    name: run.name,
    scenario,
    latestDailyBar: marketResolution.latestDailyBar,
    market: marketResolution.market,
  })
  let assessment: QuantDecisionAssistantSnapshot = deterministic
  if (input.include_ai !== false) {
    let config: Awaited<ReturnType<typeof getDecryptedQuantAiConfig>> = null
    try {
      config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
    }
    catch (error) {
      assessment = applyQuantDecisionAssistantAiReview(assessment, buildQuantDecisionAssistantAiFailure(error))
    }
    if (!config && assessment.ai.status === 'not-requested')
      assessment = applyQuantDecisionAssistantAiReview(assessment, buildQuantDecisionAssistantAiUnavailable())
    if (config) {
      try {
        const generated = await generateQuantAiDecisionAssistant({
          report,
          deterministic: assessment.deterministic,
          scenario,
          market: assessment.market,
          config,
          ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
        })
        assessment = applyQuantDecisionAssistantAiReview(assessment, buildQuantDecisionAssistantAiReview({
          generated,
          config,
          report,
          deterministic: assessment.deterministic,
          scenario,
          evaluatedAt: new Date(assessment.assessedAt),
        }))
      }
      catch (error) {
        assessment = applyQuantDecisionAssistantAiReview(assessment, buildQuantDecisionAssistantAiFailure(error, config))
      }
    }
  }
  assessment = {
    ...assessment,
    factorImpact: buildQuantAiFactorImpact(report, assessment.ai.factorReviews, new Date(assessment.assessedAt)),
  }
  const persisted = await createQuantDecisionAssessment(c.get('db'), {
    userId,
    researchRunId: run.id,
    tsCode: run.tsCode,
    mode: scenario.mode,
    currentPrice: scenario.currentPrice,
    costBasis: scenario.costBasis,
    quantity: scenario.quantity,
    snapshotJson: JSON.stringify(assessment),
  })
  return c.json({ success: true as const, data: decisionAssistantView(persisted, report) }, 201)
})

quantRoutes.get('/decision-assistant/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantDecisionRecordQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const boundedLimit = limit ? Number(limit) : 10
  const userId = currentQuantUserId(c)
  const assessments = await listQuantDecisionAssessments(c.get('db'), userId, tsCode, boundedLimit)
  const items = await Promise.all(assessments.map(async (assessment) => {
    const run = await getQuantResearchRun(c.get('db'), userId, assessment.researchRunId)
    if (!run)
      throw new QuantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Decision assistant research run readback failed', 500)
    const report = parseResearchReport(run.reportJson)
    if (report.tsCode !== run.tsCode || report.status !== run.status || report.reportVersion !== run.reportVersion)
      throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)
    return decisionAssistantView(assessment, report)
  }))
  return c.json({
    success: true as const,
    data: {
      items,
      limit: Math.min(30, Math.max(1, Math.floor(boundedLimit))),
    },
  })
})

quantRoutes.post('/research/runs/:runId/summary', validator('param', QuantResearchRunIdParamSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI summary configuration is not available', 503)
  const summary = await generateQuantAiSummary({
    report,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  const generatedAt = new Date()
  const factorImpactSnapshot = buildQuantAiFactorImpact(report, summary.factorReviews, generatedAt)
  const persistedSummary = factorImpactSnapshot
    ? { ...summary, factorImpactSnapshot }
    : summary
  const persisted = await createQuantResearchSummary(c.get('db'), {
    userId,
    researchRunId: run.id,
    summaryVersion: summary.summaryVersion,
    reportVersion: report.reportVersion,
    provider: config.provider,
    model: config.model,
    summaryJson: JSON.stringify(persistedSummary),
    citedEvidenceKeys: summary.citedEvidenceKeys,
    generatedAt,
  })
  return c.json({ success: true as const, data: researchSummaryView(persisted, report) }, 201)
})

quantRoutes.get('/research/runs/:runId/decision', validator('param', QuantResearchRunIdParamSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const record = await getQuantDecisionRecord(c.get('db'), userId, runId)
  return c.json({ success: true as const, data: record ? decisionRecordView(record) : null })
})

quantRoutes.put('/research/runs/:runId/decision', validator('param', QuantResearchRunIdParamSchema), validator('json', QuantDecisionRecordUpdateSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const input = c.req.valid('json')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  if (report.tsCode !== run.tsCode || report.status !== run.status || report.reportVersion !== run.reportVersion)
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)

  const [latestDailyBar, summaries] = await Promise.all([
    getLatestQuantDailyBar(c.get('db'), run.tsCode),
    listQuantResearchSummaries(c.get('db'), userId, run.id, 1),
  ])
  const latestSummary = summaries[0]
  const latestSummaryView = latestSummary ? researchSummaryView(latestSummary, report) : null
  const snapshot = buildQuantDecisionRecordSnapshot({
    report,
    latestDailyBar,
    aiDecisionReview: latestSummaryView?.summary.decisionReview,
    aiFactorReviews: latestSummaryView?.summary.factorReviews,
    aiFactorImpact: latestSummaryView?.factorImpact,
  })
  const persisted = await upsertQuantDecisionRecord(c.get('db'), {
    userId,
    researchRunId: run.id,
    tsCode: run.tsCode,
    action: input.action,
    note: input.note?.trim() || null,
    snapshotJson: JSON.stringify(snapshot),
  })
  return c.json({ success: true as const, data: decisionRecordView(persisted) })
})

quantRoutes.post('/research/runs/:runId/question', validator('param', QuantResearchRunIdParamSchema), validator('json', QuantResearchQuestionSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const { question } = c.req.valid('json')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  if (report.tsCode !== run.tsCode || report.status !== run.status || report.reportVersion !== run.reportVersion || !isComparableResearchReport(report))
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_QUESTION_CONFIGURATION', 'AI question configuration is not available', 503)
  const generated = await generateQuantAiQuestion({
    report,
    question,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  return c.json({ success: true as const, data: researchQuestionView(generated) })
})

quantRoutes.post('/research/runs/:runId/change-explanation', validator('param', QuantResearchRunIdParamSchema), validator('json', QuantResearchChangeExplanationSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const { previous_run_id: previousRunId } = c.req.valid('json')
  if (runId === previousRunId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Change explanation requires two different research runs', 400)
  const [currentRun, previousRun] = await Promise.all([
    getQuantResearchRun(c.get('db'), userId, runId),
    getQuantResearchRun(c.get('db'), userId, previousRunId),
  ])
  if (!currentRun || !previousRun)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const currentReport = parseResearchReport(currentRun.reportJson)
  const previousReport = parseResearchReport(previousRun.reportJson)
  if (currentReport.tsCode !== currentRun.tsCode || currentReport.status !== currentRun.status || currentReport.reportVersion !== currentRun.reportVersion || !isComparableResearchReport(currentReport)
    || previousReport.tsCode !== previousRun.tsCode || previousReport.status !== previousRun.status || previousReport.reportVersion !== previousRun.reportVersion || !isComparableResearchReport(previousReport)) {
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)
  }
  if (currentRun.tsCode !== previousRun.tsCode)
    throw new QuantError('QUANT_INVALID_INPUT', 'Change explanation requires research runs for the same stock', 400)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION', 'AI change explanation configuration is not available', 503)
  const explanation = await generateQuantAiChangeExplanation({
    currentReport,
    previousReport,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  return c.json({ success: true as const, data: researchChangeExplanationView(explanation) })
})

quantRoutes.post('/research/comparison', validator('json', QuantResearchComparisonSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { run_ids: runIds } = c.req.valid('json')
  const runs = await Promise.all(runIds.map(runId => getQuantResearchRun(c.get('db'), userId, runId)))
  if (runs.some(run => !run))
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)

  const records = runs.filter((run): run is QuantResearchRunRecord => run !== undefined)
  const tsCodes = new Set(records.map(run => run.tsCode))
  if (tsCodes.size !== records.length)
    throw new QuantError('QUANT_INVALID_INPUT', 'Research comparison requires different stocks', 400)

  const reports = records.map((run) => {
    const report = parseResearchReport(run.reportJson)
    if (report.tsCode !== run.tsCode || report.status !== run.status || report.reportVersion !== run.reportVersion || !isComparableResearchReport(report))
      throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted research run does not match its report', 500)
    return { runId: run.id, report }
  })
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_COMPARISON_CONFIGURATION', 'AI comparison configuration is not available', 503)
  const comparison = await generateQuantAiComparison({
    reports,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  return c.json({ success: true as const, data: researchComparisonView(comparison) })
})

quantRoutes.get('/candidates/ai-sessions', validator('query', QuantAiCandidateBriefingSessionQuerySchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { limit } = c.req.valid('query')
  const boundedLimit = limit ? Number(limit) : 5
  const sessions = await listQuantCandidateAiSessions(c.get('db'), userId, boundedLimit)
  return c.json({
    success: true as const,
    data: {
      items: sessions.map(candidateAiSessionView),
      limit: Math.min(10, Math.max(1, Math.floor(boundedLimit))),
    },
  })
})

quantRoutes.get('/candidates/ai-sessions/:sessionId', validator('param', QuantAiCandidateBriefingSessionIdParamSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const session = await getQuantCandidateAiSession(c.get('db'), currentQuantUserId(c), sessionId)
  if (!session)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  return c.json({ success: true as const, data: candidateAiSessionView(session) })
})

quantRoutes.delete('/candidates/ai-sessions/:sessionId', validator('param', QuantAiCandidateBriefingSessionIdParamSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const deleted = await deleteQuantCandidateAiSession(c.get('db'), currentQuantUserId(c), sessionId)
  if (!deleted)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  return c.json({ success: true as const, data: { deleted: true as const, sessionId } })
})

quantRoutes.post('/candidates/ai-briefing', validator('json', QuantAiCandidateBriefingRequestSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { ts_codes: tsCodes } = c.req.valid('json')
  const snapshot = await readCurrentQuantCandidates(c.get('db'), userId)
  if (!snapshot.candidates.length || snapshot.id === 'pending' || !snapshot.generatedAt)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_INPUT', 'Candidate snapshot is not available', 422)
  const scopedSnapshot = scopeCurrentQuantCandidates(snapshot, tsCodes)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env?.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION', 'AI candidate briefing configuration is not available', 503)
  const facts = await readCandidateBriefingFacts(c.get('db'), userId, c.env, scopedSnapshot)
  const briefing = await generateQuantAiCandidateBriefing({
    candidates: facts,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  const identity = candidateSessionIdentity(scopedSnapshot)
  const persisted = await createQuantCandidateAiSession(c.get('db'), {
    userId,
    ...identity,
    briefingJson: JSON.stringify(candidateBriefingView(briefing)),
    provider: briefing.provider,
    model: briefing.model,
  })
  const persistedView = candidateAiSessionView(persisted)
  if (!persistedView.briefing)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI briefing is missing', 500)
  return c.json({ success: true as const, data: persistedView.briefing })
})

quantRoutes.post('/candidates/ai-briefing/question', validator('json', QuantAiCandidateBriefingQuestionRequestSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { ts_codes: tsCodes, question, session_id: sessionId } = c.req.valid('json')
  const snapshot = await readCurrentQuantCandidates(c.get('db'), userId)
  if (!snapshot.candidates.length || snapshot.id === 'pending' || !snapshot.generatedAt)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INPUT', 'Candidate snapshot is not available', 422)
  const scopedSnapshot = scopeCurrentQuantCandidates(snapshot, tsCodes, 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INPUT')
  const identity = candidateSessionIdentity(scopedSnapshot)
  const existingSession = sessionId
    ? await getQuantCandidateAiSession(c.get('db'), userId, sessionId)
    : undefined
  if (sessionId && !existingSession)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  if (existingSession)
    assertCandidateSessionMatches(existingSession, identity)
  if (existingSession)
    candidateAiSessionView(existingSession)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env?.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_CANDIDATE_BRIEFING_QUESTION_CONFIGURATION', 'AI candidate briefing question configuration is not available', 503)
  const facts = await readCandidateBriefingFacts(c.get('db'), userId, c.env, scopedSnapshot)
  const generated = await generateQuantAiCandidateBriefingQuestion({
    candidates: facts,
    question,
    config,
    ...(aiGenerationTimeoutMs(c.env) ? { timeoutMs: aiGenerationTimeoutMs(c.env) } : {}),
  })
  let persistedSession: QuantCandidateAiSessionRecord
  if (existingSession) {
    persistedSession = await appendQuantCandidateAiSessionQuestion(c.get('db'), {
      userId,
      sessionId: existingSession.id,
      ...identity,
      questionJson: JSON.stringify(candidateBriefingQuestionView(generated)),
      provider: generated.provider,
      model: generated.model,
    })
  }
  else {
    persistedSession = await createQuantCandidateAiSession(c.get('db'), {
      userId,
      ...identity,
      briefingJson: null,
      questionsJson: JSON.stringify([candidateBriefingQuestionView(generated)]),
      provider: generated.provider,
      model: generated.model,
    })
  }
  const persistedView = candidateAiSessionView(persistedSession)
  const persistedQuestion = persistedView.questions.at(-1)
  if (!persistedQuestion)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Persisted candidate AI question is missing', 500)
  return c.json({ success: true as const, data: persistedQuestion })
})

quantRoutes.get('/research/runs/:runId/summary', validator('param', QuantResearchRunIdParamSchema), validator('query', QuantResearchSummaryQuerySchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  const summaries = await listQuantResearchSummaries(c.get('db'), userId, run.id, limit ? Number(limit) : 10)
  return c.json({ success: true as const, data: summaries.map(summary => researchSummaryView(summary, report)) })
})

quantRoutes.get('/research/decisions', validator('query', QuantDecisionRecordQuerySchema), async (c) => {
  const { limit } = c.req.valid('query')
  const data = await listQuantDecisionQueue(c.get('db'), currentQuantUserId(c), limit ? Number(limit) : undefined)
  return c.json({ success: true as const, data: data.map(decisionRecordView) })
})

quantRoutes.get('/research/decisions/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantDecisionRecordQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const data = await listQuantDecisionRecords(c.get('db'), currentQuantUserId(c), tsCode, limit ? Number(limit) : 10)
  return c.json({ success: true as const, data: data.map(decisionRecordView) })
})

quantRoutes.get('/research/runs/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantResearchRunsQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const data = await listQuantResearchRuns(c.get('db'), currentQuantUserId(c), tsCode, limit ? Number(limit) : 5)
  return c.json({ success: true as const, data: data.map(researchRunView) })
})

quantRoutes.put(
  '/research/:tsCode',
  validator('param', QuantWatchlistParamSchema),
  validator('json', QuantResearchMarkerUpdateSchema),
  async (c) => {
    const { tsCode } = c.req.valid('param')
    const input = c.req.valid('json')
    const data = await upsertQuantResearchMarker(c.get('db'), {
      userId: currentQuantUserId(c),
      tsCode,
      status: input.status,
      note: input.note,
      reviewDate: input.review_date,
    })
    return c.json({ success: true as const, data })
  },
)

quantRoutes.post('/watchlist', validator('json', QuantWatchlistCreateSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const input = c.req.valid('json')
  let name = input.name?.trim() || null
  if (!name) {
    try {
      name = (await stockBasicProvider(c.env).fetchStockBasic({ tsCode: input.ts_code })).name
    }
    catch {
      name = null
    }
  }
  let data = await createQuantWatchlistItem(c.get('db'), { userId, tsCode: input.ts_code, name })
  if (!data.name && name)
    data = await updateQuantWatchlistItem(c.get('db'), userId, input.ts_code, name)
  return c.json({ success: true as const, data }, 201)
})

quantRoutes.patch(
  '/watchlist/:tsCode',
  validator('param', QuantWatchlistParamSchema),
  validator('json', QuantWatchlistUpdateSchema),
  async (c) => {
    const { tsCode } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const data = await updateQuantWatchlistItem(c.get('db'), currentQuantUserId(c), tsCode, name)
    return c.json({ success: true as const, data })
  },
)

quantRoutes.delete('/watchlist/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const deleted = await deleteQuantWatchlistItem(c.get('db'), currentQuantUserId(c), tsCode)
  if (!deleted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)
  return c.json({ success: true as const, data: { tsCode } })
})

quantRoutes.get('/daily/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantDailyQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  const data = await listQuantDailyBars(c.get('db'), {
    tsCode,
    ...(input.from ? { fromDate: input.from } : {}),
    ...(input.to ? { toDate: input.to } : {}),
  })
  const limit = input.limit ? Math.min(120, Math.max(1, Number(input.limit))) : 120
  return c.json({ success: true as const, data: data.slice(-limit) })
})

quantRoutes.get('/valuation/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchValuation({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/valuation/compare/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'), currentQuantUserId(c))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          valuation: await provider.fetchValuation({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, valuation: null }
      }
    }))
    const data = buildQuantValuationComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchFinancialQuality({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/history/:tsCode', validator('param', QuantWatchlistParamSchema), validator('query', QuantFinancialHistoryQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const reports = await provider.fetchFinancialQualityHistory({
      tsCode,
      ...(input.limit ? { limit: Number(input.limit) } : {}),
    })
    return c.json({
      success: true as const,
      data: {
        tsCode: reports[0]?.tsCode ?? tsCode.toUpperCase(),
        observedAt: reports[0]?.observedAt ?? new Date().toISOString(),
        reports,
      },
    })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/financial/compare/:tsCode', validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'), currentQuantUserId(c))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          quality: await provider.fetchFinancialQuality({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, quality: null }
      }
    }))
    const data = buildQuantFinancialQualityComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantRoutes.get('/candidates', async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  return c.json({ success: true as const, data: await readCurrentQuantCandidates(c.get('db'), userId) })
})

quantRoutes.get('/value-selection', async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const options = eastmoneyProviderOptions(c.env)
  const data = await readQuantValueSelection(c.get('db'), userId, {
    valuation: createEastmoneyValuationProvider(options),
    financial: createEastmoneyFinancialProvider(options),
  })
  return c.json({ success: true as const, data })
})

quantRoutes.get('/shareholder-returns', async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const data = await readQuantShareholderReturns(
    c.get('db'),
    userId,
    dividendProvider(c.env),
  )
  return c.json({ success: true as const, data })
})

quantRoutes.get('/sync', async (c) => {
  const state = await getQuantSyncState(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data: state ?? null })
})

quantRoutes.post('/sync', validator('json', QuantSyncSchema), async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const input = c.req.valid('json')
  const result = await syncQuantDaily(c.get('db'), c.env, {
    ...(input.from_date ? { fromDate: input.from_date } : {}),
    ...(input.to_date ? { toDate: input.to_date } : {}),
    ...(input.ts_codes ? { tsCodes: input.ts_codes } : {}),
  }, { userId })
  const status = result.status === 'rejected' ? 409 : 200
  return c.json({ success: result.status !== 'rejected', data: result }, status)
})

export default quantRoutes
