import type {
  CandidateItem,
  CandidateQuality,
  CandidateSnapshot,
  CapabilitiesResponse,
  CapabilityKey,
  DailyBar,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantInvestmentKnowledge,
  QuantKnowledgeAlias,
  QuantKnowledgeFactor,
  QuantKnowledgeSource,
  QuantProviderName,
  QuantResearchMarker,
  QuantShareholderReturnDistribution,
  QuantShareholderReturnItem,
  QuantShareholderReturnSelection,
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
    currentDimension: currentDimension === 'valuation' || currentDimension === 'quality' || currentDimension === 'growth' || currentDimension === 'trend' ? currentDimension : null,
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
    version: readString(record, 'version') || 'investment-knowledge-v1',
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
  if (key !== 'valuation' && key !== 'quality' && key !== 'growth' && key !== 'trend')
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
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') || 'value-quality-v1',
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
    formulaVersion: readString(record, 'formulaVersion', 'formula_version') || 'value-quality-v1',
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

  async getWatchlist(): Promise<WatchlistItem[]> {
    return parseWatchlist(await requestJson('/watchlist'))
  },

  async getResearchMarkers(): Promise<QuantResearchMarker[]> {
    return parseResearchMarkers(await requestJson('/research'))
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

  async removeWatchlist(tsCode: string): Promise<void> {
    await requestJson(`/watchlist/${encodeURIComponent(tsCode)}`, { method: 'DELETE' })
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
