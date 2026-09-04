import type { QuantCandidateAiSession as QuantCandidateAiSessionRecord } from '@starye/db/schema'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { generateQuantAiCandidateBriefing } from '../../../domain/quant/ai-candidate-briefing'
import { generateQuantAiCandidateBriefingQuestion } from '../../../domain/quant/ai-candidate-briefing-question'
import { getDecryptedQuantAiConfig } from '../../../domain/quant/ai-config'
import { readCurrentQuantCandidates } from '../../../domain/quant/candidate-service'
import { QuantError } from '../../../domain/quant/errors'
import {
  appendQuantCandidateAiSessionQuestion,
  createQuantCandidateAiSession,
  deleteQuantCandidateAiSession,
  getQuantCandidateAiSession,
  listQuantCandidateAiSessions,
} from '../../../domain/quant/repository'
import {
  QuantAiCandidateBriefingQuestionRequestSchema,
  QuantAiCandidateBriefingRequestSchema,
  QuantAiCandidateBriefingSessionIdParamSchema,
  QuantAiCandidateBriefingSessionQuerySchema,
} from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'
import {
  assertCandidateSessionMatches,
  candidateAiSessionView,
  candidateBriefingQuestionView,
  candidateBriefingView,
  candidateSessionIdentity,
  readCandidateBriefingFacts,
  scopeCurrentQuantCandidates,
} from './candidate-ai-support'
import { aiGenerationTimeoutMs } from './summary-runtime'

export const quantAiRoutes = new Hono<AppEnv>()

quantAiRoutes.get('/candidates/ai-sessions', quantRouteDocs('ai.candidateSessions.list'), validator('query', QuantAiCandidateBriefingSessionQuerySchema), async (c) => {
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

quantAiRoutes.get('/candidates/ai-sessions/:sessionId', quantRouteDocs('ai.candidateSessions.get'), validator('param', QuantAiCandidateBriefingSessionIdParamSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const session = await getQuantCandidateAiSession(c.get('db'), currentQuantUserId(c), sessionId)
  if (!session)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  return c.json({ success: true as const, data: candidateAiSessionView(session) })
})

quantAiRoutes.delete('/candidates/ai-sessions/:sessionId', quantRouteDocs('ai.candidateSessions.delete'), validator('param', QuantAiCandidateBriefingSessionIdParamSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const deleted = await deleteQuantCandidateAiSession(c.get('db'), currentQuantUserId(c), sessionId)
  if (!deleted)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  return c.json({ success: true as const, data: { deleted: true as const, sessionId } })
})

quantAiRoutes.post('/candidates/ai-briefing', quantRouteDocs('ai.candidateBriefing.generate'), validator('json', QuantAiCandidateBriefingRequestSchema), async (c) => {
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
    ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
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

quantAiRoutes.post('/candidates/ai-briefing/question', quantRouteDocs('ai.candidateBriefing.question'), validator('json', QuantAiCandidateBriefingQuestionRequestSchema), async (c) => {
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
    ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
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
