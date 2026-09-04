import type {
  CandidateItem,
  CandidatePersistenceState,
  CandidateQuality,
  CandidateSignalPersistence,
  CandidateSnapshot,
  QuantAiCandidateBriefing,
  QuantAiCandidateBriefingQuestion,
  QuantAiCandidateBriefingSession,
  QuantAiCandidateBriefingSessionDeletion,
  QuantAiCandidateBriefingSessionList,
} from '../../lib/quant-view-models'
import type { AskCandidateAiBriefingQuestionRequestDto, GenerateCandidateAiBriefingRequestDto } from '../quant-dtos'
import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readBoolean, readList, readNumber, readString, readStringList } from '../payload'

function parseCandidateAiBriefing(payload: unknown): QuantAiCandidateBriefing {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('AI 候选简报数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const briefingVersion = readString(data, 'briefingVersion', 'briefing_version')
  const provider = readString(data, 'provider')
  const model = readString(data, 'model')
  const generatedAt = readString(data, 'generatedAt', 'generated_at')
  const overview = readString(data, 'overview')
  if (briefingVersion !== 'candidate-briefing-v1' || !provider || !model || !generatedAt || !overview)
    throw new QuantApiError('AI 候选简报数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI 候选简报 provider 数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const rawFocusItems = data.focusItems ?? data.focus_items
  if (!Array.isArray(rawFocusItems) || rawFocusItems.length > 5)
    throw new QuantApiError('AI 候选简报重点候选格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const validLevels = ['urgent', 'high', 'normal', 'low'] as const
  const focusItems = rawFocusItems.map((value) => {
    if (!isRecord(value))
      throw new QuantApiError('AI 候选简报重点候选格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    const tsCode = readString(value, 'tsCode', 'ts_code')
    const name = value.name === null ? null : readString(value, 'name', 'stockName', 'stock_name')
    const priorityLevel = readString(value, 'priorityLevel', 'priority_level')
    const priorityScore = readNumber(value, 'priorityScore', 'priority_score')
    const actionLabel = readString(value, 'actionLabel', 'action_label')
    const explanation = readString(value, 'explanation')
    const reasons = value.reasons ?? value.reason_list
    if (!tsCode || !priorityLevel || !validLevels.includes(priorityLevel as typeof validLevels[number]) || priorityScore === null || priorityScore < 0 || priorityScore > 100 || !actionLabel || !explanation || explanation.length > 480 || !Array.isArray(reasons) || reasons.length > 3 || reasons.some(item => typeof item !== 'string' || !item.trim() || item.length > 360))
      throw new QuantApiError('AI 候选简报重点候选格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    return {
      tsCode: tsCode.toUpperCase(),
      name,
      priorityLevel: priorityLevel as QuantAiCandidateBriefing['focusItems'][number]['priorityLevel'],
      priorityScore,
      actionLabel,
      reasons: reasons.map(item => (item as string).trim()),
      explanation,
    }
  })
  const parseStringList = (key: string, maxItems: number, maxLength: number): string[] => {
    const raw = data[key]
    if (!Array.isArray(raw) || raw.length > maxItems || raw.some(item => typeof item !== 'string' || !item.trim() || item.length > maxLength))
      throw new QuantApiError('AI 候选简报列表格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    return raw.map(item => (item as string).trim())
  }
  const nextChecks = parseStringList(data.nextChecks !== undefined ? 'nextChecks' : 'next_checks', 6, 360)
  const citedCandidateCodes = [...new Set(parseStringList(data.citedCandidateCodes !== undefined ? 'citedCandidateCodes' : 'cited_candidate_codes', 5, 20).map(code => code.toUpperCase()))]
  return {
    briefingVersion: 'candidate-briefing-v1',
    ...(readString(data, 'sessionId', 'session_id') ? { sessionId: readString(data, 'sessionId', 'session_id')! } : {}),
    provider,
    model,
    generatedAt,
    overview,
    focusItems,
    nextChecks,
    citedCandidateCodes,
  }
}

function parseCandidateAiBriefingQuestion(payload: unknown): QuantAiCandidateBriefingQuestion {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('AI 候选简报追问数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE')
  const questionVersion = readString(data, 'questionVersion', 'question_version')
  const provider = readString(data, 'provider')
  const model = readString(data, 'model')
  const generatedAt = readString(data, 'generatedAt', 'generated_at')
  const question = readString(data, 'question')
  const answer = readString(data, 'answer')
  if (questionVersion !== 'candidate-briefing-question-v1' || !provider || !model || !generatedAt || !question || !answer || question.length > 500 || answer.length > 8000)
    throw new QuantApiError('AI 候选简报追问数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI 候选简报追问 provider 数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE')
  const rawCodes = data.citedCandidateCodes !== undefined ? data.citedCandidateCodes : data.cited_candidate_codes
  if (!Array.isArray(rawCodes) || rawCodes.length > 16 || rawCodes.some(item => typeof item !== 'string' || !item.trim() || item.length > 20))
    throw new QuantApiError('AI 候选简报追问引用格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE')
  const citedCandidateCodes = [...new Set(rawCodes.map(item => (item as string).trim().toUpperCase()))]
  return {
    questionVersion: 'candidate-briefing-question-v1',
    ...(readString(data, 'sessionId', 'session_id') ? { sessionId: readString(data, 'sessionId', 'session_id')! } : {}),
    provider,
    model,
    generatedAt,
    question,
    answer,
    citedCandidateCodes,
  }
}

function parseCandidateAiBriefingSession(value: unknown): QuantAiCandidateBriefingSession {
  if (!isRecord(value))
    throw new QuantApiError('AI 候选会话数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const id = readString(value, 'id')
  const snapshotId = readString(value, 'snapshotId', 'snapshot_id')
  const snapshotGeneratedAt = value.snapshotGeneratedAt === null || value.snapshot_generated_at === null
    ? null
    : readString(value, 'snapshotGeneratedAt', 'snapshot_generated_at')
  const fromDate = value.fromDate === null || value.from_date === null ? null : readString(value, 'fromDate', 'from_date')
  const toDate = value.toDate === null || value.to_date === null ? null : readString(value, 'toDate', 'to_date')
  const scopeKey = readString(value, 'scopeKey', 'scope_key')
  const provider = readString(value, 'provider')
  const model = readString(value, 'model')
  const createdAt = readString(value, 'createdAt', 'created_at')
  const updatedAt = readString(value, 'updatedAt', 'updated_at')
  const rawCodes = value.candidateCodes ?? value.candidate_codes
  const rawQuestions = value.questions
  if (!id || !snapshotId || !scopeKey || !provider || !model || !createdAt || !updatedAt
    || (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    || (snapshotGeneratedAt !== null && !snapshotGeneratedAt)
    || (fromDate !== null && !fromDate)
    || (toDate !== null && !toDate)
    || !Array.isArray(rawCodes)
    || rawCodes.length > 50
    || rawCodes.some(code => typeof code !== 'string' || !code.trim() || code.length > 20)
    || !Array.isArray(rawQuestions)) {
    throw new QuantApiError('AI 候选会话数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  }
  const candidateCodes = [...new Set(rawCodes.map(code => (code as string).trim().toUpperCase()))]
  if (!/^[A-Z0-9.-]{1,20}(?:\|[A-Z0-9.-]{1,20})*$/u.test(scopeKey) || candidateCodes.slice().sort((left, right) => left.localeCompare(right)).join('|') !== scopeKey)
    throw new QuantApiError('AI 候选会话范围数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const briefing = value.briefing === null ? null : parseCandidateAiBriefing(value.briefing)
  return {
    id,
    snapshotId,
    snapshotGeneratedAt,
    fromDate,
    toDate,
    scopeKey,
    candidateCodes,
    briefing,
    questions: rawQuestions.map(question => parseCandidateAiBriefingQuestion(question)),
    provider: provider as QuantAiCandidateBriefingSession['provider'],
    model,
    createdAt,
    updatedAt,
  }
}

function parseCandidateAiBriefingSessionList(payload: unknown): QuantAiCandidateBriefingSessionList {
  const data = unwrapData(payload)
  if (!isRecord(data) || !Array.isArray(data.items))
    throw new QuantApiError('AI 候选会话列表数据格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  const limit = readNumber(data, 'limit')
  if (limit === null || limit < 1 || limit > 10 || !Number.isInteger(limit))
    throw new QuantApiError('AI 候选会话列表限制格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  return { items: data.items.map(parseCandidateAiBriefingSession), limit }
}

function parseCandidateAiBriefingSessionDeletion(payload: unknown): QuantAiCandidateBriefingSessionDeletion {
  const data = unwrapData(payload)
  const sessionId = isRecord(data) ? readString(data, 'sessionId', 'session_id') : null
  if (!isRecord(data) || data.deleted !== true || !sessionId || sessionId.length > 128)
    throw new QuantApiError('AI 候选会话删除响应格式无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
  return { deleted: true, sessionId }
}

function emptyCandidatePersistence(): CandidateSignalPersistence {
  return {
    sampleSize: 0,
    appearanceCount: 0,
    persistenceRate: null,
    latestScore: null,
    previousScore: null,
    scoreDelta: null,
    scoreChange: null,
    state: 'insufficient_history',
    factorPersistence: [],
    evidence: [],
  }
}

function parseCandidatePersistence(value: unknown): CandidateSignalPersistence {
  if (!isRecord(value))
    return emptyCandidatePersistence()

  const state = readString(value, 'state')
  const normalizedState: CandidatePersistenceState = state === 'first_seen' || state === 'confirming' || state === 'weakening' || state === 'not_in_latest' || state === 'insufficient_history'
    ? state
    : 'insufficient_history'
  const factorPersistence = readList(value, 'factorPersistence', 'factor_persistence').flatMap((item) => {
    if (!isRecord(item))
      return []
    const factor = readString(item, 'factor')
    if (!factor)
      return []
    return [{
      factor,
      appearances: Math.max(0, Math.floor(readNumber(item, 'appearances', 'count') ?? 0)),
      rate: readNumber(item, 'rate', 'ratio'),
    }]
  })
  const evidence = readList(value, 'evidence', 'history').flatMap((item) => {
    if (!isRecord(item))
      return []
    const snapshotId = readString(item, 'snapshotId', 'snapshot_id')
    if (!snapshotId)
      return []
    return [{
      snapshotId,
      generatedAt: readString(item, 'generatedAt', 'generated_at'),
      present: readBoolean(item, 'present') ?? false,
      score: readNumber(item, 'score'),
      matchedFactors: readStringList(item, 'matchedFactors', 'matched_factors'),
    }]
  })
  return {
    sampleSize: Math.max(0, Math.floor(readNumber(value, 'sampleSize', 'sample_size') ?? 0)),
    appearanceCount: Math.max(0, Math.floor(readNumber(value, 'appearanceCount', 'appearance_count') ?? 0)),
    persistenceRate: readNumber(value, 'persistenceRate', 'persistence_rate'),
    latestScore: readNumber(value, 'latestScore', 'latest_score'),
    previousScore: readNumber(value, 'previousScore', 'previous_score'),
    scoreDelta: readNumber(value, 'scoreDelta', 'score_delta'),
    scoreChange: readNumber(value, 'scoreChange', 'score_change'),
    state: normalizedState,
    factorPersistence,
    evidence,
  }
}

function parseCandidate(value: unknown, index: number): CandidateItem | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  const factors = isRecord(value.factors) ? value.factors : value
  const quality = readString(value, 'dataQuality', 'data_quality', 'quality')
  const normalizedQuality: CandidateQuality = quality === 'ready' || quality === 'partial' || quality === 'insufficient' || quality === 'insufficient_data' ? quality : 'partial'
  const rawSignals = Array.isArray(value.matchedFactors)
    ? value.matchedFactors
    : Array.isArray(value.signals)
      ? value.signals
      : []
  const rawMissingFactors = Array.isArray(value.missingFactors) ? value.missingFactors : []
  return {
    id: readString(value, 'id') || tsCode || `candidate-${index}`,
    tsCode,
    factorVersion: readString(value, 'factorVersion', 'factor_version'),
    name: readString(value, 'name', 'stockName', 'stock_name'),
    score: readNumber(value, 'score', 'factorScore', 'factor_score'),
    close: readNumber(value, 'close', 'closePrice', 'close_price'),
    changePercent: readNumber(value, 'changePercent', 'change_percent', 'pctChange', 'pct_chg'),
    ma5: readNumber(factors, 'ma5', 'ma_5') ?? readNumber(value, 'ma5', 'ma_5'),
    ma20: readNumber(factors, 'ma20', 'ma_20') ?? readNumber(value, 'ma20', 'ma_20'),
    return20: readNumber(factors, 'return20', 'return_20') ?? readNumber(value, 'return20', 'return_20'),
    newHigh20: readBoolean(factors, 'isNewHigh20', 'newHigh20', 'new_high_20') ?? readBoolean(value, 'isNewHigh20', 'newHigh20', 'new_high_20'),
    upStreak: readNumber(factors, 'consecutiveUpDays', 'upStreak', 'up_streak', 'continuation') ?? readNumber(value, 'consecutiveUpDays', 'upStreak', 'up_streak', 'continuation'),
    volumeRatio: readNumber(factors, 'volumeRatio', 'volume_ratio') ?? readNumber(value, 'volumeRatio', 'volume_ratio'),
    relativeStrength: readNumber(factors, 'relativeStrength', 'relative_strength') ?? readNumber(value, 'relativeStrength', 'relative_strength'),
    signals: rawSignals.filter((signal): signal is string => typeof signal === 'string'),
    missingFactors: rawMissingFactors.filter((factor): factor is string => typeof factor === 'string'),
    quality: normalizedQuality,
    persistence: parseCandidatePersistence(value.persistence),
    pendingSync: readBoolean(value, 'pendingSync', 'pending_sync') ?? false,
    pendingReason: readString(value, 'pendingReason', 'pending_reason'),
  }
}

function parseSnapshot(payload: unknown): CandidateSnapshot {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const rawCandidates = readList(record, 'candidates', 'items', 'results')
  return {
    id: readString(record, 'id', 'snapshotId', 'snapshot_id') || 'latest',
    factorVersion: readString(record, 'factorVersion', 'factor_version', 'version') || 'momentum-v1',
    generatedAt: readString(record, 'generatedAt', 'generated_at', 'createdAt', 'created_at'),
    fromDate: readString(record, 'fromDate', 'from_date', 'startDate', 'start_date'),
    toDate: readString(record, 'toDate', 'to_date', 'endDate', 'end_date'),
    candidates: rawCandidates.flatMap((value, index) => {
      const item = parseCandidate(value, index)
      return item ? [item] : []
    }),
  }
}

export const quantCandidateApi = {
  async generateCandidateAiBriefing(tsCodes?: readonly string[]): Promise<QuantAiCandidateBriefing> {
    const body: GenerateCandidateAiBriefingRequestDto = tsCodes === undefined ? {} : { ts_codes: [...tsCodes] }
    return parseCandidateAiBriefing(await requestJson('/candidates/ai-briefing', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
  },

  async askCandidateAiBriefingQuestion(tsCodes: readonly string[], question: string, sessionId?: string): Promise<QuantAiCandidateBriefingQuestion> {
    const body: AskCandidateAiBriefingQuestionRequestDto = {
      ts_codes: [...tsCodes],
      question: question.trim(),
      ...(sessionId?.trim() ? { session_id: sessionId.trim() } : {}),
    }
    return parseCandidateAiBriefingQuestion(await requestJson('/candidates/ai-briefing/question', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
  },

  async getCandidateAiSessions(limit = 5): Promise<QuantAiCandidateBriefingSessionList> {
    return parseCandidateAiBriefingSessionList(await requestJson(`/candidates/ai-sessions?limit=${encodeURIComponent(String(limit))}`))
  },

  async getCandidateAiSession(sessionId: string): Promise<QuantAiCandidateBriefingSession> {
    const normalizedSessionId = sessionId.trim()
    if (!normalizedSessionId)
      throw new QuantApiError('候选 AI 会话标识无效', 400, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    return parseCandidateAiBriefingSession(await requestJson(`/candidates/ai-sessions/${encodeURIComponent(normalizedSessionId)}`))
  },

  async deleteCandidateAiSession(sessionId: string): Promise<QuantAiCandidateBriefingSessionDeletion> {
    const normalizedSessionId = sessionId.trim()
    if (!normalizedSessionId)
      throw new QuantApiError('候选 AI 会话标识无效', 400, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    const result = parseCandidateAiBriefingSessionDeletion(await requestJson(`/candidates/ai-sessions/${encodeURIComponent(normalizedSessionId)}`, {
      method: 'DELETE',
    }))
    if (result.sessionId !== normalizedSessionId)
      throw new QuantApiError('AI 候选会话删除响应标识无效', 502, 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE')
    return result
  },

  async getCandidates(): Promise<CandidateSnapshot> {
    return parseSnapshot(await requestJson('/candidates'))
  },
}
