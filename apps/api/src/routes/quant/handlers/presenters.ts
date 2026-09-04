import type { QuantAiRunAudit as QuantAiRunAuditRecord, QuantDecisionAssessment as QuantDecisionAssessmentRecord, QuantDecisionRecord as QuantDecisionRecordRecord, QuantResearchRun as QuantResearchRunRecord, QuantResearchSummary as QuantResearchSummaryRecord } from '@starye/db/schema'
import type { QuantAiChangeExplanationResult } from '../../../domain/quant/ai-change-explanation'
import type { QuantAiComparisonResult } from '../../../domain/quant/ai-comparison'
import type { QuantAiQuestionResult } from '../../../domain/quant/ai-question'
import type { QuantAiSummary } from '../../../domain/quant/ai-summary'
import type { QuantResearchReport } from '../../../domain/quant/research-report'
import { buildQuantAiFactorImpact, parseQuantAiFactorImpactSnapshot, parseQuantAiSummary } from '../../../domain/quant/ai-summary'
import { parseQuantDecisionAssistantSnapshot } from '../../../domain/quant/decision-assistant'
import { parseQuantDecisionRecordSnapshot } from '../../../domain/quant/decision-record'
import { QuantError } from '../../../domain/quant/errors'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseResearchReport(reportJson: string): QuantResearchReport {
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

export function researchRunView(row: QuantResearchRunRecord) {
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

export function quantAiRunAuditView(row: QuantAiRunAuditRecord) {
  if (row.operation !== 'research-summary'
    || !['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'].includes(row.provider)
    || !['stream', 'json'].includes(row.responseMode)
    || !['completed', 'failed', 'cancelled'].includes(row.status)
    || !Number.isInteger(row.generationTimeoutMs) || row.generationTimeoutMs < 300_000 || row.generationTimeoutMs > 600_000
    || !Number.isInteger(row.receivedChars) || row.receivedChars < 0 || row.receivedChars > 8_000
    || !Number.isInteger(row.durationMs) || row.durationMs < 0
    || !(row.startedAt instanceof Date) || Number.isNaN(row.startedAt.getTime())
    || !(row.completedAt instanceof Date) || Number.isNaN(row.completedAt.getTime())) {
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Persisted AI run audit is invalid', 500)
  }
  return {
    id: row.id,
    researchRunId: row.researchRunId,
    summaryId: row.summaryId,
    operation: row.operation,
    provider: row.provider,
    model: row.model,
    responseMode: row.responseMode,
    generationTimeoutMs: row.generationTimeoutMs,
    status: row.status,
    receivedChars: row.receivedChars,
    durationMs: row.durationMs,
    finishReason: row.finishReason,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }
}

export function researchSummaryView(row: QuantResearchSummaryRecord, report: QuantResearchReport, evaluatedAt: Date = new Date(), audit?: QuantAiRunAuditRecord | null) {
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
    audit: audit ? quantAiRunAuditView(audit) : null,
  }
}

export function decisionRecordView(row: QuantDecisionRecordRecord) {
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

export function decisionAssistantView(row: QuantDecisionAssessmentRecord, report?: QuantResearchReport) {
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

export function researchComparisonView(comparison: QuantAiComparisonResult) {
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

export function researchQuestionView(question: QuantAiQuestionResult) {
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

export function researchChangeExplanationView(explanation: QuantAiChangeExplanationResult) {
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

export function isComparableResearchReport(report: QuantResearchReport): boolean {
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
