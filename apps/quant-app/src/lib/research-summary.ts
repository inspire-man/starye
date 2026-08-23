import type {
  CandidateItem,
  QuantFinancialQualityComparison,
  QuantFinancialQualitySnapshot,
  QuantValuationComparison,
  QuantValuationSnapshot,
} from './quant-types'

export type ResearchSummaryStatus = 'research' | 'observe' | 'incomplete'
export type ResearchSummaryTone = 'positive' | 'warning' | 'neutral'

export interface ResearchSummaryRisk {
  tone: 'neutral' | 'warning' | 'danger'
  title: string
}

export interface ResearchSummaryTrend {
  label: string
  tone: 'positive' | 'negative' | 'neutral'
  state: string
}

export interface ResearchSummaryInput {
  candidate: CandidateItem | null
  valuation: QuantValuationSnapshot | null
  valuationComparison: QuantValuationComparison | null
  financial: QuantFinancialQualitySnapshot | null
  financialComparison: QuantFinancialQualityComparison | null
  trends: readonly ResearchSummaryTrend[]
  risks: readonly ResearchSummaryRisk[]
}

export interface ResearchSummary {
  status: ResearchSummaryStatus
  tone: ResearchSummaryTone
  label: string
  headline: string
  support: string[]
  watchouts: string[]
  nextChecks: string[]
}

function hasValuationBasis(value: QuantValuationSnapshot | null): boolean {
  return Boolean(value && [value.peTtm, value.pb, value.peg].some(item => item !== null))
}

function hasFinancialBasis(value: QuantFinancialQualitySnapshot | null): boolean {
  return Boolean(value && [value.revenueYoY, value.netProfitYoY, value.roe, value.debtAssetRatio].some(item => item !== null))
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value))
    target.push(value)
}

function relativePosition(value: number | null): 'low' | 'middle' | 'high' | null {
  if (value === null)
    return null
  if (value <= 33)
    return 'low'
  if (value >= 67)
    return 'high'
  return 'middle'
}

export function buildResearchSummary(input: ResearchSummaryInput): ResearchSummary | null {
  const candidate = input.candidate
  if (!candidate)
    return null

  const valuationReady = hasValuationBasis(input.valuation)
  const financialReady = hasFinancialBasis(input.financial)
  const dataIncomplete = candidate.quality !== 'ready' || (!valuationReady && !financialReady)
  const dangerCount = input.risks.filter(item => item.tone === 'danger').length
  const weakTrendCount = input.trends.filter(item => item.tone === 'negative').length
  const valuationHighCount = [
    relativePosition(input.valuationComparison?.ttmPeHigherThanPercent ?? null),
    relativePosition(input.valuationComparison?.pbHigherThanPercent ?? null),
  ].filter(value => value === 'high').length
  const signalCount = candidate.score ?? 0

  const status: ResearchSummaryStatus = dataIncomplete
    ? 'incomplete'
    : dangerCount > 0 || weakTrendCount >= 2 || valuationHighCount === 2
      ? 'observe'
      : signalCount >= 2
        ? 'research'
        : 'observe'

  const tone: ResearchSummaryTone = status === 'research' ? 'positive' : status === 'observe' ? 'warning' : 'neutral'
  const label = status === 'research' ? '继续研究' : status === 'observe' ? '先观察' : '数据不足'
  const headline = status === 'research'
    ? '基础数据齐全，适合进入下一步人工核对。'
    : status === 'observe'
      ? '已有部分支持信号，但需要先核对提示项。'
      : '当前数据不足，先补齐日线、估值或财务数据。'

  const support: string[] = []
  const watchouts: string[] = []
  const nextChecks: string[] = []

  if (dataIncomplete)
    addUnique(nextChecks, '先更新缺失的数据，再重新判断')

  for (const risk of input.risks) {
    if (risk.tone !== 'neutral')
      addUnique(watchouts, risk.title)
  }

  if (candidate.quality === 'ready')
    addUnique(support, '日线数据完整')
  if (signalCount >= 2)
    addUnique(support, `技术信号命中 ${signalCount} 项`)
  else
    addUnique(watchouts, '技术信号较少，暂时缺少明确共振')

  const valuationPositions = [
    relativePosition(input.valuationComparison?.ttmPeHigherThanPercent ?? null),
    relativePosition(input.valuationComparison?.pbHigherThanPercent ?? null),
  ]
  if (valuationPositions.includes('low'))
    addUnique(support, '估值在当前观察池中相对靠前')
  if (valuationPositions.includes('high'))
    addUnique(watchouts, '至少一个估值指标处于观察池相对高位')
  if (!valuationReady)
    addUnique(watchouts, '估值字段不完整，暂不做估值结论')

  const improvingTrendCount = input.trends.filter(item => item.tone === 'positive').length
  if (improvingTrendCount >= 2)
    addUnique(support, '最近报告的多项质量指标有所改善')
  for (const trend of input.trends) {
    if (trend.tone === 'negative')
      addUnique(watchouts, `${trend.label}${trend.state}`)
  }
  if (!financialReady)
    addUnique(watchouts, '财务质量字段不完整，暂不做基本面结论')

  if (input.financialComparison && input.financialComparison.availableSampleCount < input.financialComparison.sampleCount)
    addUnique(watchouts, '观察池部分报告缺失，横向比较样本不完整')

  if (!valuationReady || !input.valuationComparison)
    addUnique(nextChecks, '核对估值字段和观察池样本')
  if (!financialReady || input.trends.length < 2)
    addUnique(nextChecks, '补看最近两期财务质量')
  addUnique(nextChecks, '结合日线窗口和风险提示复核')

  return {
    status,
    tone,
    label,
    headline,
    support: support.slice(0, 3),
    watchouts: watchouts.slice(0, 3),
    nextChecks: nextChecks.slice(0, 3),
  }
}