import type { QuantFinancialQualitySnapshot, QuantValuationSnapshot } from './provider'
import type { DailyBar, MomentumCandidate } from './types'

export const VALUE_QUALITY_FACTOR_VERSION = 'value-quality-v1' as const

export type ValueQualityStatus = 'ready' | 'partial' | 'insufficient_data'
export type ValueQualityDimensionKey = 'valuation' | 'quality' | 'growth' | 'trend'
export type ValueQualityMetricKey
  = | 'pe_ttm'
    | 'pb'
    | 'ps'
    | 'peg'
    | 'roe'
    | 'roic'
    | 'gross_margin'
    | 'net_margin'
    | 'cashflow_to_revenue'
    | 'debt_asset_ratio'
    | 'revenue_yoy'
    | 'net_profit_yoy'
    | 'adjusted_net_profit_yoy'
    | 'growth_stability'
    | 'return_60'
    | 'ma60_gap'
    | 'drawdown_60'

export interface ValueQualityMetric {
  readonly key: ValueQualityMetricKey
  readonly label: string
  readonly value: number | null
  /** 0-100; higher means more favorable within the current watchlist. */
  readonly favorablePercentile: number | null
  readonly sampleCount: number
}

export interface ValueQualityDimension {
  readonly key: ValueQualityDimensionKey
  readonly label: string
  readonly score: number | null
  readonly maxScore: number
  readonly status: 'ready' | 'partial' | 'missing'
  readonly metrics: readonly ValueQualityMetric[]
}

export interface ValueQualityInput {
  readonly tsCode: string
  readonly name: string | null
  readonly valuation: QuantValuationSnapshot | null
  readonly financialReports: readonly QuantFinancialQualitySnapshot[]
  readonly dailyBars: readonly DailyBar[]
  readonly candidate: MomentumCandidate | null
  readonly valuationErrorCode: string | null
  readonly financialErrorCode: string | null
  readonly observedAt: string
}

export interface ValueQualityResult {
  readonly tsCode: string
  readonly name: string | null
  readonly formulaVersion: typeof VALUE_QUALITY_FACTOR_VERSION
  readonly status: ValueQualityStatus
  readonly score: number | null
  readonly observedAt: string
  readonly valuationObservedAt: string | null
  readonly financialObservedAt: string | null
  readonly financialReportDate: string | null
  readonly financialNoticeDate: string | null
  readonly valuationStatus: 'ready' | 'failed' | 'missing'
  readonly financialStatus: 'ready' | 'failed' | 'missing'
  readonly dailyStatus: 'ready' | 'partial' | 'missing'
  readonly dimensions: readonly ValueQualityDimension[]
  readonly riskDeduction: number
  readonly riskNotes: readonly string[]
  readonly missingFields: readonly string[]
}

export interface ValueQualityBatchResult {
  readonly formulaVersion: typeof VALUE_QUALITY_FACTOR_VERSION
  readonly observedAt: string
  readonly sampleCount: number
  readonly readyCount: number
  readonly partialCount: number
  readonly insufficientCount: number
  readonly items: readonly ValueQualityResult[]
}

interface MetricDefinition {
  readonly key: ValueQualityMetricKey
  readonly label: string
  readonly direction: 'higher' | 'lower'
  readonly weight: number
  readonly read: (input: ValueQualityInput) => number | null
}

const VALUATION_METRICS: readonly MetricDefinition[] = [
  { key: 'pe_ttm', label: 'TTM PE', direction: 'lower', weight: 0.4, read: input => positive(input.valuation?.peTtm) },
  { key: 'pb', label: 'PB', direction: 'lower', weight: 0.3, read: input => positive(input.valuation?.pb) },
  { key: 'ps', label: 'PS', direction: 'lower', weight: 0.15, read: input => positive(input.valuation?.ps) },
  { key: 'peg', label: 'PEG', direction: 'lower', weight: 0.15, read: input => positive(input.valuation?.peg) },
]

const QUALITY_METRICS: readonly MetricDefinition[] = [
  { key: 'roe', label: 'ROE 股东回报', direction: 'higher', weight: 0.25, read: input => finite(input.financialReports[0]?.roe) },
  { key: 'roic', label: 'ROIC 投入资本回报', direction: 'higher', weight: 0.25, read: input => finite(input.financialReports[0]?.roic) },
  { key: 'cashflow_to_revenue', label: '经营现金流 / 营收', direction: 'higher', weight: 0.2, read: input => finite(input.financialReports[0]?.operatingCashflowToRevenue) },
  { key: 'gross_margin', label: '毛利率', direction: 'higher', weight: 0.1, read: input => finite(input.financialReports[0]?.grossMargin) },
  { key: 'net_margin', label: '净利率', direction: 'higher', weight: 0.1, read: input => finite(input.financialReports[0]?.netMargin) },
  { key: 'debt_asset_ratio', label: '资产负债率', direction: 'lower', weight: 0.1, read: input => finite(input.financialReports[0]?.debtAssetRatio) },
]

const GROWTH_METRICS: readonly MetricDefinition[] = [
  { key: 'revenue_yoy', label: '营收同比', direction: 'higher', weight: 0.3, read: input => finite(input.financialReports[0]?.revenueYoY) },
  { key: 'net_profit_yoy', label: '净利润同比', direction: 'higher', weight: 0.35, read: input => finite(input.financialReports[0]?.netProfitYoY) },
  { key: 'adjusted_net_profit_yoy', label: '扣非净利润同比', direction: 'higher', weight: 0.2, read: input => finite(input.financialReports[0]?.adjustedNetProfitYoY) },
  { key: 'growth_stability', label: '增长稳定性', direction: 'higher', weight: 0.15, read: input => calculateGrowthStability(input.financialReports) },
]

const TREND_METRICS: readonly MetricDefinition[] = [
  { key: 'return_60', label: '60 日表现', direction: 'higher', weight: 0.4, read: input => calculateReturn(input.dailyBars, 60) },
  { key: 'ma60_gap', label: '距 60 日均线', direction: 'higher', weight: 0.3, read: input => calculateMovingAverageGap(input.dailyBars, 60) },
  { key: 'drawdown_60', label: '60 日回撤', direction: 'higher', weight: 0.3, read: input => calculateDrawdown(input.dailyBars, 60) },
]

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positive(value: number | null | undefined): number | null {
  const normalized = finite(value)
  return normalized !== null && normalized > 0 ? normalized : null
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100) * 10) / 10
}

function sortedBars(input: readonly DailyBar[]): readonly DailyBar[] {
  return [...input]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
}

function calculateReturn(input: readonly DailyBar[], intervals: number): number | null {
  const bars = sortedBars(input)
  const latest = bars.at(-1)
  const base = bars.at(-(intervals + 1))
  return latest && base && base.close > 0 ? latest.close / base.close - 1 : null
}

function calculateMovingAverageGap(input: readonly DailyBar[], window: number): number | null {
  const bars = sortedBars(input)
  const latest = bars.at(-1)
  const values = bars.slice(-window).map(bar => bar.close)
  if (values.length < window)
    return null
  const movingAverage = average(values)
  return latest && movingAverage !== null && movingAverage > 0 ? latest.close / movingAverage - 1 : null
}

function calculateDrawdown(input: readonly DailyBar[], window: number): number | null {
  const bars = sortedBars(input).slice(-window)
  const latest = bars.at(-1)
  if (!latest || bars.length < window)
    return null
  const peak = Math.max(...bars.map(bar => bar.close))
  return peak > 0 ? latest.close / peak - 1 : null
}

function calculateGrowthStability(reports: readonly QuantFinancialQualitySnapshot[]): number | null {
  const ordered = [...reports].sort((left, right) => right.reportDate.localeCompare(left.reportDate))
  const values = ordered.map(report => finite(report.netProfitYoY)).filter((value): value is number => value !== null)
  if (values.length < 2)
    return null

  const positiveRatio = values.filter(value => value >= 0).length / values.length
  const changes = values.slice(1).map((value, index) => Math.abs(value - values[index]!))
  const volatility = average(changes) ?? 0
  const volatilityFactor = clamp(1 - volatility / 100, 0, 1)
  return (positiveRatio * 0.6 + clamp((average(values)! + 20) / 60, 0, 1) * 0.4) * volatilityFactor
}

function favorablePercentile(value: number, samples: readonly number[], direction: MetricDefinition['direction']): number | null {
  if (samples.length < 2)
    return null
  const betterCount = samples.filter(sample => direction === 'higher' ? sample < value : sample > value).length
  const equalCount = samples.filter(sample => sample === value).length
  return roundScore((betterCount + equalCount * 0.5) / samples.length * 100)
}

function createDimension(
  key: ValueQualityDimensionKey,
  label: string,
  maxScore: number,
  minimumMetrics: number,
  definitions: readonly MetricDefinition[],
  target: ValueQualityInput,
  pool: readonly ValueQualityInput[],
): ValueQualityDimension {
  const metrics = definitions.map((definition) => {
    const value = definition.read(target)
    const samples = pool.map(definition.read).filter((sample): sample is number => sample !== null)
    return {
      key: definition.key,
      label: definition.label,
      value,
      favorablePercentile: value === null ? null : favorablePercentile(value, samples, definition.direction),
      sampleCount: samples.length,
    } satisfies ValueQualityMetric
  })
  const scored = metrics.filter(metric => metric.favorablePercentile !== null)
  const weightByKey = new Map(definitions.map(definition => [definition.key, definition.weight]))
  const totalWeight = scored.reduce((total, metric) => total + (weightByKey.get(metric.key) ?? 0), 0)
  const weightedPercentile = totalWeight > 0
    ? scored.reduce((total, metric) => total + (metric.favorablePercentile ?? 0) * (weightByKey.get(metric.key) ?? 0), 0) / totalWeight
    : null

  return {
    key,
    label,
    score: weightedPercentile === null ? null : roundScore(weightedPercentile / 100 * maxScore),
    maxScore,
    status: scored.length >= minimumMetrics ? 'ready' : scored.length > 0 ? 'partial' : 'missing',
    metrics,
  }
}

function metricByKey(dimension: ValueQualityDimension, key: ValueQualityMetricKey): ValueQualityMetric | undefined {
  return dimension.metrics.find(metric => metric.key === key)
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value))
    target.push(value)
}

function buildRisk(
  input: ValueQualityInput,
  dimensions: readonly ValueQualityDimension[],
): { readonly deduction: number, readonly notes: readonly string[] } {
  const notes: string[] = []
  let deduction = 0
  const latest = input.financialReports[0]
  const drawdown = metricByKey(dimensions.find(dimension => dimension.key === 'trend')!, 'drawdown_60')?.value
  const trendScore = dimensions.find(dimension => dimension.key === 'trend')?.score ?? null

  if (drawdown !== null && drawdown !== undefined && drawdown < -0.2) {
    deduction += 3
    addUnique(notes, '60 日回撤超过 20%，先核对下跌原因')
  }
  else if (drawdown !== null && drawdown !== undefined && drawdown < -0.1) {
    deduction += 1
    addUnique(notes, '60 日回撤较大，注意趋势仍在修复')
  }

  if (input.candidate?.factors.return20 !== null && (input.candidate?.factors.return20 ?? 0) > 0.2
    && ((input.candidate?.factors.consecutiveUpDays ?? 0) >= 5 || (input.candidate?.factors.volumeRatio ?? 0) >= 2)) {
    deduction += 2
    addUnique(notes, '短期上涨或放量偏快，避免把强势当成价值')
  }

  if (latest?.netProfitYoY !== null && latest?.netProfitYoY !== undefined && latest.netProfitYoY > 0
    && latest.operatingCashflowToRevenue !== null && latest.operatingCashflowToRevenue !== undefined && latest.operatingCashflowToRevenue < 0) {
    deduction += 3
    addUnique(notes, '净利润增长与经营现金流方向不一致')
  }

  const valuation = dimensions.find(dimension => dimension.key === 'valuation')
  const expensiveCount = valuation?.metrics
    .filter(metric => metric.key === 'pe_ttm' || metric.key === 'pb')
    .filter(metric => metric.favorablePercentile !== null && metric.favorablePercentile < 35)
    .length
    ?? 0
  if (trendScore !== null && trendScore >= 10 && expensiveCount >= 2) {
    deduction += 2
    addUnique(notes, '趋势较强但估值处于观察池相对高位')
  }

  return { deduction: Math.min(10, deduction), notes }
}

export function buildValueQualityResult(input: ValueQualityInput, pool: readonly ValueQualityInput[]): ValueQualityResult {
  const valuation = createDimension('valuation', '估值', 35, 2, VALUATION_METRICS, input, pool)
  const quality = createDimension('quality', '盈利质量', 30, 3, QUALITY_METRICS, input, pool)
  const growth = createDimension('growth', '增长稳定性', 20, 2, GROWTH_METRICS, input, pool)
  const trend = createDimension('trend', '趋势与风险', 15, 2, TREND_METRICS, input, pool)
  const dimensions = [valuation, quality, growth, trend] as const
  const risk = buildRisk(input, dimensions)
  const missingFields: string[] = []
  const qualityMetricCount = quality.metrics.filter(metric => metric.favorablePercentile !== null).length
  const growthMetricCount = growth.metrics.filter(metric => metric.favorablePercentile !== null).length
  const trendMetricCount = trend.metrics.filter(metric => metric.favorablePercentile !== null).length
  const hasLongTrendWindow = sortedBars(input.dailyBars).length >= 61

  if (input.valuationErrorCode)
    addUnique(missingFields, `估值数据暂不可用（${input.valuationErrorCode}）`)
  else if (valuation.status !== 'ready')
    addUnique(missingFields, '估值可比指标不足（至少需要 2 项正值）')
  if (input.financialErrorCode)
    addUnique(missingFields, `财务报告暂不可用（${input.financialErrorCode}）`)
  else if (!input.financialReports[0])
    addUnique(missingFields, '最近已披露财务报告')
  if (qualityMetricCount < 3)
    addUnique(missingFields, '盈利质量指标不足（至少需要 3 项）')
  if (input.financialReports.length < 2 || growthMetricCount < 2)
    addUnique(missingFields, '最近两期财务增长数据')
  if (!hasLongTrendWindow || trendMetricCount < 2)
    addUnique(missingFields, '60 日趋势窗口')

  const status: ValueQualityStatus = missingFields.length === 0
    ? 'ready'
    : input.valuationErrorCode || input.financialErrorCode
      ? 'partial'
      : 'insufficient_data'
  const rawScore = dimensions.reduce((total, dimension) => total + (dimension.score ?? 0), 0) - risk.deduction

  return {
    tsCode: input.tsCode,
    name: input.name,
    formulaVersion: VALUE_QUALITY_FACTOR_VERSION,
    status,
    score: status === 'ready' ? roundScore(rawScore) : null,
    observedAt: input.observedAt,
    valuationObservedAt: input.valuation?.observedAt ?? null,
    financialObservedAt: input.financialReports[0]?.observedAt ?? null,
    financialReportDate: input.financialReports[0]?.reportDate ?? null,
    financialNoticeDate: input.financialReports[0]?.noticeDate ?? null,
    valuationStatus: input.valuation ? 'ready' : input.valuationErrorCode ? 'failed' : 'missing',
    financialStatus: input.financialReports[0] ? 'ready' : input.financialErrorCode ? 'failed' : 'missing',
    dailyStatus: hasLongTrendWindow && trendMetricCount >= 2 ? 'ready' : input.dailyBars.length > 0 ? 'partial' : 'missing',
    dimensions,
    riskDeduction: risk.deduction,
    riskNotes: risk.notes,
    missingFields,
  }
}

export function buildValueQualityBatch(inputs: readonly ValueQualityInput[], observedAt: string): ValueQualityBatchResult {
  const items = inputs.map(input => buildValueQualityResult(input, inputs))
  return {
    formulaVersion: VALUE_QUALITY_FACTOR_VERSION,
    observedAt,
    sampleCount: items.length,
    readyCount: items.filter(item => item.status === 'ready').length,
    partialCount: items.filter(item => item.status === 'partial').length,
    insufficientCount: items.filter(item => item.status === 'insufficient_data').length,
    items,
  }
}
