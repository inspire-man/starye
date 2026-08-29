import type {
  CandidateItem,
  CandidatePersistenceState,
  CandidateQuality,
  CandidateSignalPersistence,
  CandidateSnapshot,
  CapabilitiesResponse,
  CapabilityKey,
  DailyBar,
  QuantAiCandidateBriefing,
  QuantAiCandidateBriefingQuestion,
  QuantAiCandidateBriefingSession,
  QuantAiCandidateBriefingSessionDeletion,
  QuantAiCandidateBriefingSessionList,
  QuantAiConfig,
  QuantAiConnectionTest,
  QuantAiDecisionReview,
  QuantAiProvider,
  QuantDecisionProjection,
  QuantFactorModel,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantInvestmentKnowledge,
  QuantKnowledgeAlias,
  QuantKnowledgeFactor,
  QuantKnowledgeSource,
  QuantProviderName,
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
  QuantShareholderReturnDistribution,
  QuantShareholderReturnItem,
  QuantShareholderReturnSelection,
  QuantStockBasic,
  QuantValuationComparison,
  QuantValuationComparisonPeer,
  QuantValuationSnapshot,
  QuantValueQualityDimension,
  QuantValueQualityItem,
  QuantValueQualityMetric,
  QuantValueSelection,
  ResearchMarkerStatus,
  SyncResult,
  SyncStatus,
  WatchlistItem,
} from './quant-types'
import { CAPABILITY_ORDER } from './quant-types'

export const QUANT_API_PREFIX = '/api/quant'

type JsonRecord = Record<string, unknown>

export interface AddWatchlistInput {
  tsCode: string
  name?: string
}

export interface DailyBarQuery {
  from?: string
  to?: string
  limit?: number
}

export interface UpdateAiConfigInput {
  provider: QuantAiProvider
  model: string
  baseUrl?: string | null
  apiKey?: string
  clearApiKey?: boolean
}

export class QuantApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'QuantApiError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value)
  return null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value)
      return value
  }
  return null
}

function readNumber(record: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value !== null)
      return value
  }
  return null
}

function readBoolean(record: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = asBoolean(record[key])
    if (value !== null)
      return value
  }
  return null
}

function unwrapData(payload: unknown, allowErrorPayload = false): unknown {
  if (!isRecord(payload))
    return payload
  if (payload.success === false && !allowErrorPayload)
    throw new QuantApiError(readString(payload, 'error', 'message') || '量化接口返回失败', 422, readString(payload, 'code'))
  return 'data' in payload ? payload.data : payload
}

function readList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload))
    return payload
  if (!isRecord(payload))
    return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value))
      return value
    if (isRecord(value) && Array.isArray(value.items))
      return value.items
  }
  return []
}

function readStringList(record: JsonRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    if (Array.isArray(record[key]))
      return record[key].filter((item): item is string => typeof item === 'string')
  }
  return []
}

function capabilityLabel(key: CapabilityKey): string {
  const labels: Record<CapabilityKey, string> = {
    daily: '日线 daily',
    stock_basic: '股票基础 stock_basic',
    trade_cal: '交易日历 trade_cal',
    daily_basic: '估值基础 daily_basic',
  }
  return labels[key]
}

function defaultCapabilityReason(key: CapabilityKey, tier: number | null): string {
  if (key === 'daily' && tier !== null)
    return '当前 v1 日线能力已开放'
  if (tier === null)
    return `当前积分档位未配置，${key} 未启用`
  return `当前积分档位 ${tier} 仅开放 daily，${key} 仍未启用`
}

function capabilityReason(key: CapabilityKey, tier: number | null, value: string | null): string {
  if (value === 'enabled')
    return key === 'daily' ? '当前 v1 日线能力已开放' : '当前能力已开放'
  if (value === 'requires_points_tier_2000')
    return `需要 2000 积分，当前 ${tier ?? '未知'} 积分档位未启用`
  if (value === 'invalid_points_tier')
    return '积分档位配置无效，能力已关闭'
  if (value === 'invalid_provider')
    return '数据源配置无效，能力已关闭'
  return value || defaultCapabilityReason(key, tier)
}

function findCapability(raw: unknown, key: CapabilityKey): JsonRecord | null {
  if (Array.isArray(raw)) {
    const item = raw.find((value) => {
      if (!isRecord(value))
        return false
      return readString(value, 'key', 'name', 'capability', 'apiName', 'api_name') === key
    })
    return isRecord(item) ? item : null
  }
  if (isRecord(raw) && isRecord(raw[key]))
    return raw[key]
  return null
}

function parseCapabilities(payload: unknown): CapabilitiesResponse {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const tier = readNumber(record, 'tier', 'pointsTier', 'points_tier')
  const providerValue = readString(record, 'provider', 'dataProvider', 'data_provider')
  const provider: QuantProviderName | null = providerValue === 'tushare' || providerValue === 'eastmoney' ? providerValue : null
  const enabledValues = Array.isArray(record.enabled) ? record.enabled : []
  const enabled = CAPABILITY_ORDER.filter(key => enabledValues.includes(key))
  const rawCapabilities = record.capabilities
  const capabilities = CAPABILITY_ORDER.map((key) => {
    const item = findCapability(rawCapabilities, key)
    const itemEnabled = item ? readBoolean(item, 'enabled', 'available') : null
    const isEnabled = itemEnabled ?? enabled.includes(key)
    if (isEnabled && !enabled.includes(key))
      enabled.push(key)
    return {
      key,
      label: capabilityLabel(key),
      enabled: isEnabled,
      reason: capabilityReason(key, tier, readString(item ?? {}, 'reason', 'disabledReason', 'disabled_reason')),
      requires: item && Array.isArray(item.requires) ? item.requires.filter((value): value is string => typeof value === 'string') : undefined,
    }
  })
  return { tier, provider, enabled, capabilities }
}

function parseAiConfig(payload: unknown): QuantAiConfig | null {
  const data = unwrapData(payload)
  if (data === null)
    return null
  if (!isRecord(data))
    throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const provider = readString(data, 'provider')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI provider 数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const id = readString(data, 'id')
  const model = readString(data, 'model')
  if (!id || !model)
    throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return {
    id,
    provider,
    model,
    baseUrl: readString(data, 'baseUrl', 'base_url'),
    hasApiKey: data.hasApiKey === true || data.has_api_key === true,
    apiKeyHint: readString(data, 'apiKeyHint', 'api_key_hint'),
    createdAt: readString(data, 'createdAt', 'created_at'),
    updatedAt: readString(data, 'updatedAt', 'updated_at'),
  }
}

function parseAiConnectionTest(payload: unknown): QuantAiConnectionTest {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const provider = readString(record, 'provider')
  const model = readString(record, 'model')
  const testedAt = readString(record, 'testedAt', 'tested_at')
  const latencyMs = readNumber(record, 'latencyMs', 'latency_ms')
  if ((provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama') || !model || !testedAt || latencyMs === null || latencyMs < 0)
    throw new QuantApiError('AI 连接测试数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return { provider, model, testedAt, latencyMs }
}

function parseKnowledgeSource(value: unknown): QuantKnowledgeSource | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const title = readString(value, 'title')
  const url = readString(value, 'url')
  if (!id || !title || !url)
    return null
  return {
    id,
    title,
    url,
    publishedAt: readString(value, 'publishedAt', 'published_at'),
    access: value.access === 'preview' ? 'preview' : 'full',
    summary: readString(value, 'summary') || '',
  }
}

function parseKnowledgeFactor(value: unknown): QuantKnowledgeFactor | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const category = readString(value, 'category')
  const title = readString(value, 'title')
  if (!id || !category || !title)
    return null
  const currentDimension = readString(value, 'currentDimension', 'current_dimension')
  const status = readString(value, 'status')
  return {
    id,
    category,
    title,
    interpretation: readString(value, 'interpretation') || '',
    measurement: readString(value, 'measurement') || '',
    requiredFields: readStringList(value, 'requiredFields', 'required_fields'),
    availableFields: readStringList(value, 'availableFields', 'available_fields'),
    missingFields: readStringList(value, 'missingFields', 'missing_fields'),
    status: status === 'active' || status === 'partial' || status === 'planned' ? status : 'context',
    eligibleInValueQuality: value.eligibleInValueQuality === true || value.eligible_in_value_quality === true,
    currentDimension: currentDimension === 'valuation' || currentDimension === 'quality' || currentDimension === 'growth' || currentDimension === 'resilience' || currentDimension === 'trend' ? currentDimension : null,
    sourceIds: readStringList(value, 'sourceIds', 'source_ids'),
  }
}

function parseKnowledgeAlias(value: unknown): QuantKnowledgeAlias | null {
  if (!isRecord(value))
    return null
  const alias = readString(value, 'alias')
  if (!alias)
    return null
  const status = readString(value, 'status')
  const confidence = readString(value, 'confidence')
  return {
    alias,
    status: status === 'mapped' || status === 'ambiguous' ? status : 'context_only',
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
    tsCode: readString(value, 'tsCode', 'ts_code'),
    name: readString(value, 'name'),
    candidates: readStringList(value, 'candidates'),
    note: readString(value, 'note') || '',
  }
}

function parseInvestmentKnowledge(payload: unknown): QuantInvestmentKnowledge {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  return {
    version: readString(record, 'version') || 'investment-knowledge-v3',
    observedAt: readString(record, 'observedAt', 'observed_at') || '',
    sources: Array.isArray(record.sources)
      ? record.sources.flatMap((value) => {
          const item = parseKnowledgeSource(value)
          return item ? [item] : []
        })
      : [],
    factors: Array.isArray(record.factors)
      ? record.factors.flatMap((value) => {
          const item = parseKnowledgeFactor(value)
          return item ? [item] : []
        })
      : [],
    aliases: Array.isArray(record.aliases)
      ? record.aliases.flatMap((value) => {
          const item = parseKnowledgeAlias(value)
          return item ? [item] : []
        })
      : [],
    recommendedWatchlist: Array.isArray(record.recommendedWatchlist || record.recommended_watchlist)
      ? (Array.isArray(record.recommendedWatchlist) ? record.recommendedWatchlist : record.recommended_watchlist as unknown[]).flatMap((value) => {
          if (!isRecord(value))
            return []
          const tsCode = readString(value, 'tsCode', 'ts_code')
          const name = readString(value, 'name')
          return tsCode && name ? [{ tsCode, name }] : []
        })
      : [],
  }
}

function parseWatchlist(payload: unknown): WatchlistItem[] {
  const data = unwrapData(payload)
  if (isRecord(data)) {
    const item = parseWatchlistItem(data, 0)
    return item ? [item] : []
  }
  return readList(data, 'items', 'watchlist', 'rows').flatMap((value, index) => {
    return isRecord(value) ? [parseWatchlistItem(value, index)].filter((item): item is WatchlistItem => item !== null) : []
  })
}

function parseWatchlistItem(value: JsonRecord, index: number): WatchlistItem | null {
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  return {
    id: readString(value, 'id') || tsCode || `watch-${index}`,
    tsCode,
    name: readString(value, 'name', 'stockName', 'stock_name'),
    latestTradeDate: readString(value, 'latestTradeDate', 'latest_trade_date', 'tradeDate', 'trade_date'),
    barCount: readNumber(value, 'barCount', 'bar_count', 'dailyBarCount', 'daily_bar_count') ?? 0,
    latestClose: readNumber(value, 'latestClose', 'latest_close', 'close'),
    latestChangePercent: readNumber(value, 'latestChangePercent', 'latest_change_percent', 'pctChg', 'pct_chg'),
    createdAt: readString(value, 'createdAt', 'created_at'),
  }
}

function parseStockBasic(payload: unknown): QuantStockBasic {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('股票名称数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const tsCode = readString(data, 'tsCode', 'ts_code', 'code')
  const name = readString(data, 'name', 'stockName', 'stock_name')
  const observedAt = readString(data, 'observedAt', 'observed_at')
  if (!tsCode || !name || !observedAt)
    throw new QuantApiError('股票名称数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return { tsCode, name, observedAt }
}

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

function parseResearchSource(value: unknown): QuantResearchSource | null {
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
  return { modelVersion, totalWeight, coveredWeight, coverage, score, factors }
}

function parseReferencePriceRange(value: unknown): QuantReferencePriceRange | null {
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
  const rawDecisionReview = rawSummary.decisionReview ?? rawSummary.decision_review
  const decisionReview: QuantAiDecisionReview | null = isRecord(rawDecisionReview)
    ? (() => {
        const decisionVersion = readString(rawDecisionReview, 'decisionVersion', 'decision_version')
        const recommendation = readString(rawDecisionReview, 'recommendation')
        const confidence = readNumber(rawDecisionReview, 'confidence')
        const rationale = readString(rawDecisionReview, 'rationale')
        const invalidationConditions = readStringList(rawDecisionReview, 'invalidationConditions', 'invalidation_conditions')
        const accepted = readBoolean(rawDecisionReview, 'accepted')
        const rejectionReason = readString(rawDecisionReview, 'rejectionReason', 'rejection_reason')
        const reviewCitations = readStringList(rawDecisionReview, 'citedEvidenceKeys', 'cited_evidence_keys')
        if (!decisionVersion || !recommendation || confidence === null || confidence < 0 || confidence > 100 || !rationale || accepted === null
          || (rejectionReason !== null && rejectionReason !== 'low-confidence' && rejectionReason !== 'deterministic-watch')
          || (recommendation !== 'bullish' && recommendation !== 'bearish' && recommendation !== 'watch')) {
          return null
        }
        return {
          decisionVersion,
          recommendation,
          confidence,
          accepted,
          rejectionReason,
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
      decisionReview,
    },
    citedEvidenceKeys: readStringList(value, 'citedEvidenceKeys', 'cited_evidence_keys').length
      ? readStringList(value, 'citedEvidenceKeys', 'cited_evidence_keys')
      : citedEvidenceKeys,
  }
}

function parseResearchSummaries(payload: unknown): QuantResearchSummary[] {
  const data = unwrapData(payload)
  return readList(data, 'items', 'summaries', 'researchSummaries', 'research_summaries').flatMap((value) => {
    const summary = parseResearchSummary(value)
    return summary ? [summary] : []
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

function parseSyncResult(payload: unknown): SyncResult {
  const data = unwrapData(payload, true)
  const record = isRecord(data) ? data : {}
  const status = readString(record, 'status')
  const normalizedStatus: SyncStatus = status === 'completed' || status === 'partial' || status === 'rejected' ? status : 'rejected'
  const requestedCount = readNumber(record, 'requestedCount', 'requested_count', 'requested') ?? 0
  const writtenCount = readNumber(record, 'writtenCount', 'written_count', 'written') ?? 0
  const skippedCount = readNumber(record, 'skippedCount', 'skipped_count', 'skipped') ?? 0
  return {
    status: normalizedStatus,
    requestedCount,
    writtenCount,
    skippedCount,
    requested: requestedCount,
    processed: readNumber(record, 'processed', 'processedCount', 'processed_count') ?? 0,
    written: writtenCount,
    skipped: skippedCount,
    reason: readString(record, 'reason', 'message', 'error'),
    snapshotId: readString(record, 'snapshotId', 'snapshot_id'),
    startedAt: readString(record, 'startedAt', 'started_at'),
    completedAt: readString(record, 'completedAt', 'completed_at'),
  }
}

function parseSyncState(payload: unknown): SyncResult | null {
  const data = unwrapData(payload)
  return data === null ? null : parseSyncResult(data)
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

function parseDailyBar(value: unknown, index: number): DailyBar | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code') || ''
  const tradeDate = readString(value, 'tradeDate', 'trade_date', 'date')
  if (!tradeDate)
    return null
  return {
    id: readString(value, 'id') || `${tsCode}-${tradeDate}-${index}`,
    tsCode,
    tradeDate,
    open: readNumber(value, 'open'),
    high: readNumber(value, 'high'),
    low: readNumber(value, 'low'),
    close: readNumber(value, 'close'),
    preClose: readNumber(value, 'preClose', 'pre_close'),
    change: readNumber(value, 'change'),
    changePercent: readNumber(value, 'changePercent', 'change_percent', 'pctChange', 'pct_chg'),
    volume: readNumber(value, 'volume', 'vol'),
    amount: readNumber(value, 'amount'),
  }
}

function parseDailyBars(payload: unknown): DailyBar[] {
  const data = unwrapData(payload)
  return readList(data, 'bars', 'items', 'rows', 'daily').flatMap((value, index) => {
    const item = parseDailyBar(value, index)
    return item ? [item] : []
  })
}

function parseValuation(payload: unknown): QuantValuationSnapshot {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('估值数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const tsCode = readString(data, 'tsCode', 'ts_code', 'code')
  const observedAt = readString(data, 'observedAt', 'observed_at')
  if (!tsCode || !observedAt)
    throw new QuantApiError('估值数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return {
    tsCode,
    observedAt,
    dynamicPe: readNumber(data, 'dynamicPe', 'dynamic_pe'),
    peTtm: readNumber(data, 'peTtm', 'pe_ttm'),
    peStatic: readNumber(data, 'peStatic', 'pe_static'),
    pb: readNumber(data, 'pb'),
    ps: readNumber(data, 'ps'),
    peg: readNumber(data, 'peg'),
    marketCap: readNumber(data, 'marketCap', 'market_cap'),
  }
}

function parseValuationComparison(payload: unknown): QuantValuationComparison {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('估值比较数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const target = parseValuation({ data: data.target })
  const rawPeers = Array.isArray(data.peers) ? data.peers : []
  const peers: QuantValuationComparisonPeer[] = rawPeers.flatMap((value) => {
    if (!isRecord(value))
      return []
    const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
    if (!tsCode)
      return []
    return [{
      tsCode,
      name: readString(value, 'name', 'stockName', 'stock_name'),
      valuation: value.valuation === null ? null : parseValuation({ data: value.valuation }),
    }]
  })
  return {
    target,
    peers,
    sampleCount: readNumber(data, 'sampleCount', 'sample_count') ?? 0,
    availableSampleCount: readNumber(data, 'availableSampleCount', 'available_sample_count') ?? 0,
    ttmPeSampleCount: readNumber(data, 'ttmPeSampleCount', 'ttm_pe_sample_count') ?? 0,
    pbSampleCount: readNumber(data, 'pbSampleCount', 'pb_sample_count') ?? 0,
    ttmPeHigherThanPercent: readNumber(data, 'ttmPeHigherThanPercent', 'ttm_pe_higher_than_percent'),
    pbHigherThanPercent: readNumber(data, 'pbHigherThanPercent', 'pb_higher_than_percent'),
  }
}

function parseFinancialQuality(payload: unknown): QuantFinancialQualitySnapshot {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('基本面数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const tsCode = readString(data, 'tsCode', 'ts_code', 'code')
  const observedAt = readString(data, 'observedAt', 'observed_at')
  const reportDate = readString(data, 'reportDate', 'report_date')
  if (!tsCode || !observedAt || !reportDate)
    throw new QuantApiError('基本面数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return {
    tsCode,
    observedAt,
    reportDate,
    reportType: readString(data, 'reportType', 'report_type'),
    reportDateName: readString(data, 'reportDateName', 'report_date_name'),
    noticeDate: readString(data, 'noticeDate', 'notice_date'),
    revenue: readNumber(data, 'revenue'),
    revenueYoY: readNumber(data, 'revenueYoY', 'revenue_yoy'),
    netProfit: readNumber(data, 'netProfit', 'net_profit'),
    netProfitYoY: readNumber(data, 'netProfitYoY', 'net_profit_yoy'),
    adjustedNetProfit: readNumber(data, 'adjustedNetProfit', 'adjusted_net_profit'),
    adjustedNetProfitYoY: readNumber(data, 'adjustedNetProfitYoY', 'adjusted_net_profit_yoy'),
    roe: readNumber(data, 'roe'),
    grossMargin: readNumber(data, 'grossMargin', 'gross_margin'),
    netMargin: readNumber(data, 'netMargin', 'net_margin'),
    debtAssetRatio: readNumber(data, 'debtAssetRatio', 'debt_asset_ratio'),
    operatingCashflowToRevenue: readNumber(data, 'operatingCashflowToRevenue', 'operating_cashflow_to_revenue'),
    operatingCashflowPerShare: readNumber(data, 'operatingCashflowPerShare', 'operating_cashflow_per_share'),
    fcffBack: readNumber(data, 'fcffBack', 'fcff_back'),
    fcffForward: readNumber(data, 'fcffForward', 'fcff_forward'),
    interestCoverage: readNumber(data, 'interestCoverage', 'interest_coverage'),
    interestBearingDebtRatio: readNumber(data, 'interestBearingDebtRatio', 'interest_bearing_debt_ratio'),
    cashRatio: readNumber(data, 'cashRatio', 'cash_ratio'),
    totalLiability: readNumber(data, 'totalLiability', 'total_liability'),
    roic: readNumber(data, 'roic'),
  }
}

function parseFinancialQualityHistory(payload: unknown): QuantFinancialQualityHistory {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('基本面历史数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const tsCode = readString(data, 'tsCode', 'ts_code', 'code')
  const observedAt = readString(data, 'observedAt', 'observed_at')
  const reports = Array.isArray(data.reports) ? data.reports.map(value => parseFinancialQuality({ data: value })) : []
  if (!tsCode || !observedAt || reports.length === 0)
    throw new QuantApiError('基本面历史数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return { tsCode, observedAt, reports }
}

function parseFinancialQualityComparison(payload: unknown): QuantFinancialQualityComparison {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('基本面比较数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const target = parseFinancialQuality({ data: data.target })
  const rawPeers = Array.isArray(data.peers) ? data.peers : []
  const peers = rawPeers.flatMap((value) => {
    if (!isRecord(value))
      return []
    const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
    if (!tsCode)
      return []
    return [{
      tsCode,
      name: readString(value, 'name', 'stockName', 'stock_name'),
      quality: value.quality === null ? null : parseFinancialQuality({ data: value.quality }),
    }]
  })
  return {
    target,
    peers,
    sampleCount: readNumber(data, 'sampleCount', 'sample_count') ?? 0,
    availableSampleCount: readNumber(data, 'availableSampleCount', 'available_sample_count') ?? 0,
    revenueYoYSampleCount: readNumber(data, 'revenueYoYSampleCount', 'revenue_yoy_sample_count') ?? 0,
    netProfitYoYSampleCount: readNumber(data, 'netProfitYoYSampleCount', 'net_profit_yoy_sample_count') ?? 0,
    roeSampleCount: readNumber(data, 'roeSampleCount', 'roe_sample_count') ?? 0,
    debtAssetRatioSampleCount: readNumber(data, 'debtAssetRatioSampleCount', 'debt_asset_ratio_sample_count') ?? 0,
    revenueYoYHigherThanPercent: readNumber(data, 'revenueYoYHigherThanPercent', 'revenue_yoy_higher_than_percent'),
    netProfitYoYHigherThanPercent: readNumber(data, 'netProfitYoYHigherThanPercent', 'net_profit_yoy_higher_than_percent'),
    roeHigherThanPercent: readNumber(data, 'roeHigherThanPercent', 'roe_higher_than_percent'),
    debtAssetRatioLowerThanPercent: readNumber(data, 'debtAssetRatioLowerThanPercent', 'debt_asset_ratio_lower_than_percent'),
  }
}

function parseShareholderReturnDistribution(value: unknown): QuantShareholderReturnDistribution | null {
  if (!isRecord(value))
    return null
  const endDate = readString(value, 'endDate', 'end_date')
  const cashDividendPerShare = readNumber(value, 'cashDividendPerShare', 'cash_dividend_per_share')
  if (!endDate || cashDividendPerShare === null)
    return null
  return {
    endDate,
    annDate: readString(value, 'annDate', 'ann_date'),
    cashDividendPerShare,
    exDate: readString(value, 'exDate', 'ex_date'),
    payDate: readString(value, 'payDate', 'pay_date'),
  }
}

function parseShareholderReturnItem(value: unknown): QuantShareholderReturnItem | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  const status = readString(value, 'status')
  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.filter((item): item is string => typeof item === 'string')
    : Array.isArray(value.missing_fields)
      ? value.missing_fields.filter((item): item is string => typeof item === 'string')
      : []
  const distributions = Array.isArray(value.distributions)
    ? value.distributions.flatMap((item) => {
        const distribution = parseShareholderReturnDistribution(item)
        return distribution ? [distribution] : []
      })
    : []
  return {
    tsCode,
    name: readString(value, 'name', 'stockName', 'stock_name'),
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') || 'shareholder-return-v1',
    status: status === 'ready' || status === 'partial' ? status : 'insufficient_data',
    observedAt: readString(value, 'observedAt', 'observed_at') || '',
    latestClose: readNumber(value, 'latestClose', 'latest_close'),
    trailingCashDividendPerShare: readNumber(value, 'trailingCashDividendPerShare', 'trailing_cash_dividend_per_share'),
    trailingDividendYield: readNumber(value, 'trailingDividendYield', 'trailing_dividend_yield'),
    dividendYears: readNumber(value, 'dividendYears', 'dividend_years') ?? 0,
    distributions,
    missingFields,
  }
}

function parseShareholderReturns(payload: unknown): QuantShareholderReturnSelection {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const provider = readString(record, 'provider', 'dataProvider', 'data_provider')
  return {
    formulaVersion: readString(record, 'formulaVersion', 'formula_version') || 'shareholder-return-v1',
    observedAt: readString(record, 'observedAt', 'observed_at') || '',
    provider: provider === 'tushare' || provider === 'eastmoney' ? provider : null,
    sampleCount: readNumber(record, 'sampleCount', 'sample_count') ?? 0,
    readyCount: readNumber(record, 'readyCount', 'ready_count') ?? 0,
    partialCount: readNumber(record, 'partialCount', 'partial_count') ?? 0,
    insufficientCount: readNumber(record, 'insufficientCount', 'insufficient_count') ?? 0,
    items: readList(record, 'items', 'results').flatMap((value) => {
      const item = parseShareholderReturnItem(value)
      return item ? [item] : []
    }),
  }
}

function parseValueQualityMetric(value: unknown): QuantValueQualityMetric | null {
  if (!isRecord(value))
    return null
  const key = readString(value, 'key')
  const label = readString(value, 'label')
  if (!key || !label)
    return null
  return {
    key,
    label,
    value: readNumber(value, 'value'),
    favorablePercentile: readNumber(value, 'favorablePercentile', 'favorable_percentile'),
    sampleCount: readNumber(value, 'sampleCount', 'sample_count') ?? 0,
  }
}

function parseValueQualityDimension(value: unknown): QuantValueQualityDimension | null {
  if (!isRecord(value))
    return null
  const key = readString(value, 'key')
  const label = readString(value, 'label')
  if (key !== 'valuation' && key !== 'quality' && key !== 'growth' && key !== 'resilience' && key !== 'trend')
    return null
  const status = readString(value, 'status')
  return {
    key,
    label: label || key,
    score: readNumber(value, 'score'),
    maxScore: readNumber(value, 'maxScore', 'max_score') ?? 0,
    status: status === 'ready' || status === 'partial' ? status : 'missing',
    metrics: Array.isArray(value.metrics)
      ? value.metrics.flatMap((item) => {
          const metric = parseValueQualityMetric(item)
          return metric ? [metric] : []
        })
      : [],
  }
}

function parseValueQualityItem(value: unknown): QuantValueQualityItem | null {
  if (!isRecord(value))
    return null
  const tsCode = readString(value, 'tsCode', 'ts_code', 'code')
  if (!tsCode)
    return null
  const status = readString(value, 'status')
  return {
    tsCode,
    name: readString(value, 'name', 'stockName', 'stock_name'),
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') || 'value-quality-v2',
    status: status === 'ready' || status === 'partial' ? status : 'insufficient_data',
    score: readNumber(value, 'score'),
    observedAt: readString(value, 'observedAt', 'observed_at') || '',
    valuationObservedAt: readString(value, 'valuationObservedAt', 'valuation_observed_at'),
    financialObservedAt: readString(value, 'financialObservedAt', 'financial_observed_at'),
    financialReportDate: readString(value, 'financialReportDate', 'financial_report_date'),
    financialNoticeDate: readString(value, 'financialNoticeDate', 'financial_notice_date'),
    valuationStatus: value.valuationStatus === 'ready' || value.valuationStatus === 'failed' ? value.valuationStatus : 'missing',
    financialStatus: value.financialStatus === 'ready' || value.financialStatus === 'failed' ? value.financialStatus : 'missing',
    dailyStatus: value.dailyStatus === 'ready' || value.dailyStatus === 'partial' ? value.dailyStatus : 'missing',
    dimensions: Array.isArray(value.dimensions)
      ? value.dimensions.flatMap((item) => {
          const dimension = parseValueQualityDimension(item)
          return dimension ? [dimension] : []
        })
      : [],
    riskDeduction: readNumber(value, 'riskDeduction', 'risk_deduction') ?? 0,
    riskNotes: Array.isArray(value.riskNotes) ? value.riskNotes.filter((item): item is string => typeof item === 'string') : [],
    missingFields: Array.isArray(value.missingFields) ? value.missingFields.filter((item): item is string => typeof item === 'string') : [],
  }
}

function parseValueSelection(payload: unknown): QuantValueSelection {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  return {
    formulaVersion: readString(record, 'formulaVersion', 'formula_version') || 'value-quality-v2',
    observedAt: readString(record, 'observedAt', 'observed_at') || '',
    sampleCount: readNumber(record, 'sampleCount', 'sample_count') ?? 0,
    readyCount: readNumber(record, 'readyCount', 'ready_count') ?? 0,
    partialCount: readNumber(record, 'partialCount', 'partial_count') ?? 0,
    insufficientCount: readNumber(record, 'insufficientCount', 'insufficient_count') ?? 0,
    items: readList(record, 'items', 'results').flatMap((value) => {
      const item = parseValueQualityItem(value)
      return item ? [item] : []
    }),
  }
}

async function requestJson(path: string, init?: RequestInit, options: { readonly allowErrorResponse?: boolean } = {}): Promise<unknown> {
  const response = await fetch(`${QUANT_API_PREFIX}${path}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })
  let payload: unknown = null
  try {
    payload = await response.json() as unknown
  }
  catch {
    payload = null
  }
  if (!response.ok && !options.allowErrorResponse) {
    const record = isRecord(payload) ? payload : {}
    throw new QuantApiError(
      readString(record, 'error', 'message') || `量化接口请求失败（${response.status}）`,
      response.status,
      readString(record, 'code'),
    )
  }
  return payload
}

function queryString(query: DailyBarQuery): string {
  const params = new URLSearchParams()
  if (query.from)
    params.set('from', query.from)
  if (query.to)
    params.set('to', query.to)
  if (query.limit !== undefined)
    params.set('limit', String(query.limit))
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const quantApi = {
  async getCapabilities(): Promise<CapabilitiesResponse> {
    return parseCapabilities(await requestJson('/capabilities'))
  },

  async getInvestmentKnowledge(): Promise<QuantInvestmentKnowledge> {
    return parseInvestmentKnowledge(await requestJson('/knowledge'))
  },

  async getAiConfig(): Promise<QuantAiConfig | null> {
    return parseAiConfig(await requestJson('/ai-config'))
  },

  async updateAiConfig(input: UpdateAiConfigInput): Promise<QuantAiConfig> {
    const config = parseAiConfig(await requestJson('/ai-config', {
      method: 'PUT',
      body: JSON.stringify({
        provider: input.provider,
        model: input.model,
        base_url: input.baseUrl,
        api_key: input.apiKey,
        clear_api_key: input.clearApiKey,
      }),
    }))
    if (!config)
      throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return config
  },

  async testAiConfig(): Promise<QuantAiConnectionTest> {
    return parseAiConnectionTest(await requestJson('/ai-config/test', { method: 'POST' }))
  },

  async deleteAiConfig(): Promise<boolean> {
    const data = unwrapData(await requestJson('/ai-config', { method: 'DELETE' }))
    return isRecord(data) && data.deleted === true
  },

  async getWatchlist(): Promise<WatchlistItem[]> {
    return parseWatchlist(await requestJson('/watchlist'))
  },

  async getStockBasic(tsCode: string): Promise<QuantStockBasic> {
    return parseStockBasic(await requestJson(`/stock-basic/${encodeURIComponent(tsCode)}`))
  },

  async getResearchMarkers(): Promise<QuantResearchMarker[]> {
    return parseResearchMarkers(await requestJson('/research'))
  },

  async generateResearchRun(tsCode: string): Promise<QuantResearchRun> {
    const run = parseResearchRun(unwrapData(await requestJson('/research/runs', {
      method: 'POST',
      body: JSON.stringify({ ts_code: tsCode }),
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

  async getResearchSummaries(runId: string, limit = 1): Promise<QuantResearchSummary[]> {
    return parseResearchSummaries(await requestJson(`/research/runs/${encodeURIComponent(runId)}/summary?limit=${encodeURIComponent(String(limit))}`))
  },

  async generateResearchComparison(runIds: string[]): Promise<QuantResearchComparison> {
    const comparison = parseResearchComparison(await requestJson('/research/comparison', {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds }),
    }))
    return comparison
  },

  async askResearchQuestion(runId: string, question: string): Promise<QuantResearchQuestion> {
    return parseResearchQuestion(await requestJson(`/research/runs/${encodeURIComponent(runId)}/question`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }))
  },

  async generateResearchChangeExplanation(runId: string, previousRunId: string): Promise<QuantResearchChangeExplanation> {
    return parseResearchChangeExplanation(await requestJson(`/research/runs/${encodeURIComponent(runId)}/change-explanation`, {
      method: 'POST',
      body: JSON.stringify({ previous_run_id: previousRunId }),
    }))
  },

  async generateCandidateAiBriefing(tsCodes?: readonly string[]): Promise<QuantAiCandidateBriefing> {
    return parseCandidateAiBriefing(await requestJson('/candidates/ai-briefing', {
      method: 'POST',
      body: JSON.stringify(tsCodes === undefined ? {} : { ts_codes: [...tsCodes] }),
    }))
  },

  async askCandidateAiBriefingQuestion(tsCodes: readonly string[], question: string, sessionId?: string): Promise<QuantAiCandidateBriefingQuestion> {
    return parseCandidateAiBriefingQuestion(await requestJson('/candidates/ai-briefing/question', {
      method: 'POST',
      body: JSON.stringify({
        ts_codes: [...tsCodes],
        question: question.trim(),
        ...(sessionId?.trim() ? { session_id: sessionId.trim() } : {}),
      }),
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

  async updateResearchMarker(tsCode: string, input: { status: ResearchMarkerStatus, note: string | null, reviewDate: string | null }): Promise<QuantResearchMarker> {
    const marker = parseResearchMarker(unwrapData(await requestJson(`/research/${encodeURIComponent(tsCode)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: input.status, note: input.note, review_date: input.reviewDate }),
    })))
    if (!marker)
      throw new QuantApiError('研究标记数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return marker
  },

  async addWatchlist(input: AddWatchlistInput): Promise<WatchlistItem | null> {
    const payload = await requestJson('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ ts_code: input.tsCode, name: input.name || undefined }),
    })
    const items = parseWatchlist(payload)
    return items[0] || null
  },

  async updateWatchlistName(tsCode: string, name: string): Promise<WatchlistItem | null> {
    const payload = await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    const items = parseWatchlist(payload)
    return items[0] || null
  },

  async removeWatchlist(tsCode: string): Promise<void> {
    await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, { method: 'DELETE' })
  },

  async getSyncState(): Promise<SyncResult | null> {
    return parseSyncState(await requestJson('/sync'))
  },

  async syncDaily(): Promise<SyncResult> {
    return parseSyncResult(await requestJson('/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    }, { allowErrorResponse: true }))
  },

  async getCandidates(): Promise<CandidateSnapshot> {
    return parseSnapshot(await requestJson('/candidates'))
  },

  async getDailyBars(tsCode: string, query: DailyBarQuery = {}): Promise<DailyBar[]> {
    return parseDailyBars(await requestJson(`/daily/${encodeURIComponent(tsCode)}${queryString(query)}`))
  },

  async getValuation(tsCode: string): Promise<QuantValuationSnapshot> {
    return parseValuation(await requestJson(`/valuation/${encodeURIComponent(tsCode)}`))
  },

  async getValuationComparison(tsCode: string): Promise<QuantValuationComparison> {
    return parseValuationComparison(await requestJson(`/valuation/compare/${encodeURIComponent(tsCode)}`))
  },

  async getFinancialQuality(tsCode: string): Promise<QuantFinancialQualitySnapshot> {
    return parseFinancialQuality(await requestJson(`/financial/${encodeURIComponent(tsCode)}`))
  },

  async getFinancialQualityHistory(tsCode: string, limit = 4): Promise<QuantFinancialQualityHistory> {
    return parseFinancialQualityHistory(await requestJson(`/financial/history/${encodeURIComponent(tsCode)}?limit=${encodeURIComponent(String(limit))}`))
  },

  async getFinancialQualityComparison(tsCode: string): Promise<QuantFinancialQualityComparison> {
    return parseFinancialQualityComparison(await requestJson(`/financial/compare/${encodeURIComponent(tsCode)}`))
  },

  async getValueSelection(): Promise<QuantValueSelection> {
    return parseValueSelection(await requestJson('/value-selection'))
  },

  async getShareholderReturns(): Promise<QuantShareholderReturnSelection> {
    return parseShareholderReturns(await requestJson('/shareholder-returns'))
  },
}
