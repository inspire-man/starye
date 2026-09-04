import type { QuantCandidateAiSession as QuantCandidateAiSessionRecord } from '@starye/db/schema'
import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingResult, QuantCandidateBriefingCandidate, QuantCandidateBriefingMarker } from '../../../domain/quant/ai-candidate-briefing'
import type { QuantAiCandidateBriefingQuestionResult } from '../../../domain/quant/ai-candidate-briefing-question'
import type { CurrentQuantCandidateSnapshot } from '../../../domain/quant/candidate-service'
import type { AppEnv } from '../../../types'
import { buildQuantCandidateBriefingFacts } from '../../../domain/quant/ai-candidate-briefing'
import { QuantError } from '../../../domain/quant/errors'
import { createEastmoneyFinancialProvider, createEastmoneyValuationProvider } from '../../../domain/quant/provider'
import { listQuantResearchMarkers, normalizeTsCode } from '../../../domain/quant/repository'
import { readQuantValueSelection } from '../../../domain/quant/value-selection-service'
import { eastmoneyProviderOptions } from '../route-context'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function candidateBriefingView(briefing: QuantAiCandidateBriefingResult, sessionId?: string) {
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

export function candidateBriefingQuestionView(question: QuantAiCandidateBriefingQuestionResult, sessionId?: string) {
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

export function candidateSessionIdentity(snapshot: CurrentQuantCandidateSnapshot) {
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

export function candidateAiSessionView(row: QuantCandidateAiSessionRecord) {
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

export function assertCandidateSessionMatches(row: QuantCandidateAiSessionRecord, identity: ReturnType<typeof candidateSessionIdentity>): void {
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

export function scopeCurrentQuantCandidates(
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

export async function readCandidateBriefingFacts(db: AppEnv['Variables']['db'], userId: string, env: AppEnv['Bindings'] | undefined, snapshot: CurrentQuantCandidateSnapshot) {
  const markers = await listQuantResearchMarkers(db, userId)
  const options = eastmoneyProviderOptions(env)
  const valueSelection = await readQuantValueSelection(db, userId, {
    valuation: createEastmoneyValuationProvider(options),
    financial: createEastmoneyFinancialProvider(options),
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
