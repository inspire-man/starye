import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { getDecryptedQuantAiConfig } from '../../../domain/quant/ai-config'
import { buildQuantAiFactorImpact } from '../../../domain/quant/ai-summary'
import { applyQuantDecisionAssistantAiReview, buildQuantDecisionAssistant, buildQuantDecisionAssistantAiFailure, buildQuantDecisionAssistantAiReview, buildQuantDecisionAssistantAiUnavailable, generateQuantAiDecisionAssistant } from '../../../domain/quant/decision-assistant'
import { buildQuantDecisionRecordSnapshot } from '../../../domain/quant/decision-record'
import { QuantError } from '../../../domain/quant/errors'
import {
  createQuantDecisionAssessment,
  getLatestQuantDailyBar,
  getQuantDecisionRecord,
  getQuantResearchRun,
  listQuantDecisionAssessments,
  listQuantDecisionQueue,
  listQuantDecisionRecords,
  listQuantResearchSummaries,
  upsertQuantDecisionRecord,
} from '../../../domain/quant/repository'
import {
  QuantDecisionAssistantCreateSchema,
  QuantDecisionRecordQuerySchema,
  QuantDecisionRecordUpdateSchema,
  QuantResearchRunIdParamSchema,
  QuantWatchlistParamSchema,
} from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'
import { resolveDecisionAssistantMarket } from './market-support'
import { decisionAssistantView, decisionRecordView, parseResearchReport, researchSummaryView } from './presenters'
import { aiGenerationTimeoutMs } from './summary-runtime'

export const quantDecisionRoutes = new Hono<AppEnv>()

quantDecisionRoutes.post('/decision-assistant', quantRouteDocs('decision.assistant.create'), validator('json', QuantDecisionAssistantCreateSchema), async (c) => {
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
  let assessment = deterministic
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
          ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
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

quantDecisionRoutes.get('/decision-assistant/:tsCode', quantRouteDocs('decision.assistant.list'), validator('param', QuantWatchlistParamSchema), validator('query', QuantDecisionRecordQuerySchema), async (c) => {
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

quantDecisionRoutes.get('/research/runs/:runId/decision', quantRouteDocs('decision.record.get'), validator('param', QuantResearchRunIdParamSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const record = await getQuantDecisionRecord(c.get('db'), userId, runId)
  return c.json({ success: true as const, data: record ? decisionRecordView(record) : null })
})

quantDecisionRoutes.put('/research/runs/:runId/decision', quantRouteDocs('decision.record.upsert'), validator('param', QuantResearchRunIdParamSchema), validator('json', QuantDecisionRecordUpdateSchema), async (c) => {
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

quantDecisionRoutes.get('/research/decisions', quantRouteDocs('decision.queue.list'), validator('query', QuantDecisionRecordQuerySchema), async (c) => {
  const { limit } = c.req.valid('query')
  const data = await listQuantDecisionQueue(c.get('db'), currentQuantUserId(c), limit ? Number(limit) : undefined)
  return c.json({ success: true as const, data: data.map(decisionRecordView) })
})

quantDecisionRoutes.get('/research/decisions/:tsCode', quantRouteDocs('decision.records.list'), validator('param', QuantWatchlistParamSchema), validator('query', QuantDecisionRecordQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const data = await listQuantDecisionRecords(c.get('db'), currentQuantUserId(c), tsCode, limit ? Number(limit) : 10)
  return c.json({ success: true as const, data: data.map(decisionRecordView) })
})
