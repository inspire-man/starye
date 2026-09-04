import type {
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantProviderName,
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
} from '../../lib/quant-view-models'
import type { QuantRequestOptions } from '../http-client'
import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readList, readNumber, readString, readStringList } from '../payload'

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
  const provider = readString(value, 'provider', 'dataProvider', 'data_provider')
  const providerChain = readStringList(value, 'providerChain', 'provider_chain').filter((item): item is QuantProviderName => item === 'tushare' || item === 'eastmoney')
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
    provider: provider === 'tushare' || provider === 'eastmoney' ? provider : null,
    providerChain,
    fallbackUsed: value.fallbackUsed === true || value.fallback_used === true,
    fallbackReason: readString(value, 'fallbackReason', 'fallback_reason'),
    providerErrorCode: readString(value, 'providerErrorCode', 'provider_error_code'),
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
  const providerChain = readStringList(record, 'providerChain', 'provider_chain').filter((item): item is QuantProviderName => item === 'tushare' || item === 'eastmoney')
  return {
    formulaVersion: readString(record, 'formulaVersion', 'formula_version') || 'shareholder-return-v1',
    observedAt: readString(record, 'observedAt', 'observed_at') || '',
    provider: provider === 'tushare' || provider === 'eastmoney' ? provider : null,
    providerChain,
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

export const quantMarketApi = {
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

  async getValueSelection(options: QuantRequestOptions = {}): Promise<QuantValueSelection> {
    return parseValueSelection(await requestJson('/value-selection', options.signal ? { signal: options.signal } : undefined))
  },

  async getShareholderReturns(options: QuantRequestOptions = {}): Promise<QuantShareholderReturnSelection> {
    return parseShareholderReturns(await requestJson('/shareholder-returns', options.signal ? { signal: options.signal } : undefined))
  },
}
