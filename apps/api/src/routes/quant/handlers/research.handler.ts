import type { QuantAiRunAudit as QuantAiRunAuditRecord, QuantResearchRun as QuantResearchRunRecord } from '@starye/db/schema'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { generateQuantAiChangeExplanation } from '../../../domain/quant/ai-change-explanation'
import { generateQuantAiComparison } from '../../../domain/quant/ai-comparison'
import { getDecryptedQuantAiConfig } from '../../../domain/quant/ai-config'
import { generateQuantAiQuestion } from '../../../domain/quant/ai-question'
import { createQuantAkshareBridge } from '../../../domain/quant/akshare-bridge'
import { QuantError } from '../../../domain/quant/errors'
import { screenMomentum } from '../../../domain/quant/factor'
import { createEastmoneyFinancialProvider, createEastmoneyValuationProvider, mapQuantProviderError } from '../../../domain/quant/provider'
import {
  createQuantResearchRun,
  ensureQuantStarterWatchlist,
  getQuantFactorConfiguration,
  getQuantResearchRun,
  getQuantWatchlistItem,
  listQuantAiRunAudits,
  listQuantDailyBars,
  listQuantResearchMarkers,
  listQuantResearchRuns,
  listQuantResearchSummaries,
  listQuantScanSnapshots,
  normalizeTsCode,
  upsertQuantResearchMarker,
} from '../../../domain/quant/repository'
import { buildQuantResearchReport } from '../../../domain/quant/research-report'
import { readQuantShareholderReturn } from '../../../domain/quant/shareholder-return'
import {
  QuantResearchChangeExplanationSchema,
  QuantResearchComparisonSchema,
  QuantResearchMarkerUpdateSchema,
  QuantResearchQuestionSchema,
  QuantResearchRunCreateSchema,
  QuantResearchRunIdParamSchema,
  QuantResearchRunsQuerySchema,
  QuantResearchSummaryQuerySchema,
  QuantWatchlistParamSchema,
} from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId, eastmoneyProviderOptions } from '../route-context'
import { dividendProvider } from './market-support'
import {
  isComparableResearchReport,
  parseResearchReport,
  quantAiRunAuditView,
  researchChangeExplanationView,
  researchComparisonView,
  researchQuestionView,
  researchRunView,
  researchSummaryView,
} from './presenters'
import {
  aiGenerationTimeoutMs,
  akshareBridgeErrorCode,
  akshareBridgeOptions,
  createQuantAiSummaryStream,
  generateAndPersistQuantAiSummary,
} from './summary-runtime'

export const quantResearchRoutes = new Hono<AppEnv>()

function snapshotIncludesCode(snapshot: { readonly inputTsCodesJson: string }, tsCode: string): boolean {
  try {
    const parsed: unknown = JSON.parse(snapshot.inputTsCodesJson)
    return Array.isArray(parsed) && parsed.some(code => typeof code === 'string' && code.trim().toUpperCase() === tsCode)
  }
  catch {
    return false
  }
}

quantResearchRoutes.get('/research', quantRouteDocs('research.markers.list'), async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const data = await listQuantResearchMarkers(c.get('db'), userId)
  return c.json({ success: true as const, data })
})

quantResearchRoutes.post('/research/runs', quantRouteDocs('research.runs.create'), validator('json', QuantResearchRunCreateSchema), async (c) => {
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

quantResearchRoutes.post('/research/runs/:runId/summary', quantRouteDocs('research.summary.generate'), validator('param', QuantResearchRunIdParamSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI summary configuration is not available', 503)
  const persisted = await generateAndPersistQuantAiSummary({
    db: c.get('db'),
    userId,
    run,
    report,
    config,
    env: c.env,
  })
  return c.json({ success: true as const, data: researchSummaryView(persisted.summary, report, new Date(), persisted.audit) }, 201)
})

quantResearchRoutes.post('/research/runs/:runId/summary/stream', quantRouteDocs('research.summary.stream'), validator('param', QuantResearchRunIdParamSchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI summary configuration is not available', 503)
  return createQuantAiSummaryStream({
    db: c.get('db'),
    userId,
    run,
    report,
    config,
    env: c.env,
    requestSignal: c.req.raw.signal,
  })
})

quantResearchRoutes.post('/research/runs/:runId/question', quantRouteDocs('research.question.ask'), validator('param', QuantResearchRunIdParamSchema), validator('json', QuantResearchQuestionSchema), async (c) => {
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
    ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
  })
  return c.json({ success: true as const, data: researchQuestionView(generated) })
})

quantResearchRoutes.post('/research/runs/:runId/change-explanation', quantRouteDocs('research.changeExplanation.generate'), validator('param', QuantResearchRunIdParamSchema), validator('json', QuantResearchChangeExplanationSchema), async (c) => {
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
    ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
  })
  return c.json({ success: true as const, data: researchChangeExplanationView(explanation) })
})

quantResearchRoutes.post('/research/comparison', quantRouteDocs('research.comparison.generate'), validator('json', QuantResearchComparisonSchema), async (c) => {
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
    ...(aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) ? { timeoutMs: aiGenerationTimeoutMs(c.env, config.generationTimeoutMs) } : {}),
  })
  return c.json({ success: true as const, data: researchComparisonView(comparison) })
})

quantResearchRoutes.get('/research/runs/:runId/summary', quantRouteDocs('research.summary.list'), validator('param', QuantResearchRunIdParamSchema), validator('query', QuantResearchSummaryQuerySchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const report = parseResearchReport(run.reportJson)
  const summaries = await listQuantResearchSummaries(c.get('db'), userId, run.id, limit ? Number(limit) : 10)
  let audits: QuantAiRunAuditRecord[] = []
  try {
    audits = await listQuantAiRunAudits(c.get('db'), userId, run.id, 10)
  }
  catch {
    // AI audit metadata is additive; an unavailable audit table must not hide saved summaries.
  }
  return c.json({ success: true as const, data: summaries.map(summary => researchSummaryView(summary, report, new Date(), audits.find(audit => audit.summaryId === summary.id) || null)) })
})

quantResearchRoutes.get('/research/runs/:runId/ai-audits', quantRouteDocs('research.aiAudits.list'), validator('param', QuantResearchRunIdParamSchema), validator('query', QuantResearchSummaryQuerySchema), async (c) => {
  const userId = currentQuantUserId(c)
  const { runId } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const run = await getQuantResearchRun(c.get('db'), userId, runId)
  if (!run)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const audits = await listQuantAiRunAudits(c.get('db'), userId, run.id, limit ? Number(limit) : 10)
  return c.json({ success: true as const, data: audits.map(quantAiRunAuditView) })
})

quantResearchRoutes.get('/research/runs/:tsCode', quantRouteDocs('research.runs.list'), validator('param', QuantWatchlistParamSchema), validator('query', QuantResearchRunsQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const data = await listQuantResearchRuns(c.get('db'), currentQuantUserId(c), tsCode, limit ? Number(limit) : 5)
  return c.json({ success: true as const, data: data.map(researchRunView) })
})

quantResearchRoutes.put(
  '/research/:tsCode',
  quantRouteDocs('research.markers.update'),
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
