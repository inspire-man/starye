import type { QuantResearchRun as QuantResearchRunRecord, QuantResearchSummary as QuantResearchSummaryRecord } from '@starye/db/schema'
import type { Context } from 'hono'
import type { QuantAiSummary } from '../../domain/quant/ai-summary'
import type { EastmoneyProviderOptions, TushareProviderOptions } from '../../domain/quant/provider'
import type { QuantResearchReport } from '../../domain/quant/research-report'
import type { QuantSignalHistoryCandidate, QuantSignalHistorySnapshot } from '../../domain/quant/signal-persistence'
import type { MomentumCandidate } from '../../domain/quant/types'
import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { deleteQuantAiConfig, getDecryptedQuantAiConfig, getQuantAiConfig, saveQuantAiConfig } from '../../domain/quant/ai-config'
import { testQuantAiConnection } from '../../domain/quant/ai-connection'
import { generateQuantAiSummary } from '../../domain/quant/ai-summary'
import { createQuantAkshareBridge, QuantAkshareBridgeError } from '../../domain/quant/akshare-bridge'
import { createQuantCapabilityRegistryFromEnv } from '../../domain/quant/capabilities'
import { buildQuantValuationComparison } from '../../domain/quant/comparison'
import { QuantError } from '../../domain/quant/errors'
import { screenMomentum } from '../../domain/quant/factor'
import { buildQuantFinancialQualityComparison } from '../../domain/quant/financial-comparison'
import { getQuantInvestmentKnowledge } from '../../domain/quant/investment-knowledge'
import { createEastmoneyFinancialProvider, createEastmoneyStockBasicProvider, createEastmoneyValuationProvider, createTushareDividendProvider, createTushareStockBasicProvider, mapQuantProviderError, resolveQuantProviderName } from '../../domain/quant/provider'
import {
  createQuantResearchRun,
  createQuantResearchSummary,
  createQuantWatchlistItem,
  deleteQuantWatchlistItem,
  ensureQuantStarterWatchlist,
  getQuantResearchRun,
  getQuantSyncState,
  getQuantWatchlistItem,
  listQuantDailyBars,
  listQuantResearchMarkers,
  listQuantResearchRuns,
  listQuantResearchSummaries,
  listQuantScanSnapshots,
  listQuantWatchlist,
  listQuantWatchlistWithStats,
  normalizeTsCode,
  updateQuantWatchlistItem,
  upsertQuantResearchMarker,
} from '../../domain/quant/repository'
import { buildQuantResearchReport } from '../../domain/quant/research-report'
import { readQuantShareholderReturn, readQuantShareholderReturns } from '../../domain/quant/shareholder-return'
import { buildQuantSignalPersistence } from '../../domain/quant/signal-persistence'
import { syncQuantDaily } from '../../domain/quant/sync'
import { readQuantValueSelection } from '../../domain/quant/value-selection-service'
import { requireAuth } from '../../middleware/guard'
import {
  QuantAiConfigUpdateSchema,
  QuantDailyQuerySchema,
  QuantFinancialHistoryQuerySchema,
  QuantResearchMarkerUpdateSchema,
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

function parseStoredAiSummary(value: string, report: QuantResearchReport): QuantAiSummary {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.summaryVersion !== 'research-summary-v1')
      throw new Error('invalid summary')
    const stringList = (field: string, max: number): string[] => {
      const items = parsed[field]
      if (!Array.isArray(items) || items.length > max || items.some(item => typeof item !== 'string'))
        throw new Error(`invalid ${field}`)
      return items as string[]
    }
    const citedEvidenceKeys = stringList('citedEvidenceKeys', 16)
    const allowed = new Set(report.evidence.map(item => item.key))
    if (citedEvidenceKeys.some(key => !allowed.has(key)))
      throw new Error('unknown evidence key')
    if (typeof parsed.overview !== 'string' || !parsed.overview.trim())
      throw new Error('invalid overview')
    return {
      summaryVersion: 'research-summary-v1',
      overview: parsed.overview,
      supports: stringList('supports', 6),
      concerns: stringList('concerns', 6),
      nextChecks: stringList('nextChecks', 6),
      citedEvidenceKeys,
    }
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

function researchSummaryView(row: QuantResearchSummaryRecord, report: QuantResearchReport) {
  const summary = parseStoredAiSummary(row.summaryJson, report)
  const citedEvidenceKeys = parseStoredEvidenceKeys(row.citedEvidenceKeysJson)
  return {
    id: row.id,
    researchRunId: row.researchRunId,
    summaryVersion: row.summaryVersion,
    reportVersion: row.reportVersion,
    provider: row.provider,
    model: row.model,
    generatedAt: row.generatedAt,
    createdAt: row.createdAt,
    summary,
    citedEvidenceKeys,
  }
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

async function readCurrentQuantCandidates(db: AppEnv['Variables']['db'], userId: string) {
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
        name: item.name ?? snapshotCandidate.name ?? null,
        pendingSync: false,
        pendingReason: null,
        persistence: persistenceByCode.get(item.tsCode),
      }
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
      pendingSync: true,
      pendingReason: '尚未进入最近一次候选快照，请更新观察池',
      persistence: persistenceByCode.get(item.tsCode),
    }
  })

  return {
    id: snapshot?.id ?? 'pending',
    factorVersion: snapshot?.factorVersion ?? 'momentum-v1',
    generatedAt: snapshot?.generatedAt ?? null,
    fromDate: snapshot?.fromDate ?? null,
    toDate: snapshot?.toDate ?? null,
    inputTsCodes: watchlist.map(item => item.tsCode),
    candidates,
  }
}

function eastmoneyProviderOptions(env?: AppEnv['Bindings']): EastmoneyProviderOptions {
  const baseUrl = env?.EASTMONEY_BASE_URL?.trim()
  const timeoutMs = Number(env?.EASTMONEY_TIMEOUT_MS)
  return {
    ...(baseUrl ? { baseUrl } : {}),
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

function aiSummaryTimeoutMs(env?: AppEnv['Bindings']): number | undefined {
  const timeoutMs = Number(env?.QUANT_AI_SUMMARY_TIMEOUT_MS)
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined
}

function stockBasicProvider(env?: AppEnv['Bindings']) {
  const options = tushareProviderOptions(env)
  return resolveQuantProviderName(env) === 'tushare'
    ? createTushareStockBasicProvider(options)
    : createEastmoneyStockBasicProvider(eastmoneyProviderOptions(env))
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
    ...(aiSummaryTimeoutMs(c.env) ? { timeoutMs: aiSummaryTimeoutMs(c.env) } : {}),
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
  const valuationProvider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
  const financialProvider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
  const dividendProvider = createTushareDividendProvider(tushareProviderOptions(c.env))
  const akshareBridge = createQuantAkshareBridge(akshareBridgeOptions(c.env))
  const [valuationResult, financialResult, shareholderResult, akshareResult] = await Promise.allSettled([
    valuationProvider.fetchValuation({ tsCode }),
    financialProvider.fetchFinancialQualityHistory({ tsCode, limit: 4 }),
    readQuantShareholderReturn(c.get('db'), userId, tsCode, dividendProvider),
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
    ...(aiSummaryTimeoutMs(c.env) ? { timeoutMs: aiSummaryTimeoutMs(c.env) } : {}),
  })
  const persisted = await createQuantResearchSummary(c.get('db'), {
    userId,
    researchRunId: run.id,
    summaryVersion: summary.summaryVersion,
    reportVersion: report.reportVersion,
    provider: config.provider,
    model: config.model,
    summaryJson: JSON.stringify(summary),
    citedEvidenceKeys: summary.citedEvidenceKeys,
    generatedAt: new Date(),
  })
  return c.json({ success: true as const, data: researchSummaryView(persisted, report) }, 201)
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
    createTushareDividendProvider(tushareProviderOptions(c.env)),
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
