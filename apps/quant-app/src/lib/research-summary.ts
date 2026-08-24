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
  dimensions: ResearchSummaryDimension[]
  support: string[]
  watchouts: string[]
  nextChecks: string[]
}

export type ResearchSummaryDimensionState = 'positive' | 'caution' | 'missing'

export interface ResearchSummaryDimension {
  key: 'technical' | 'valuation' | 'financial' | 'completeness'
  label: string
  state: ResearchSummaryDimensionState
  detail: string
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

function buildResearchDimensions(input: ResearchSummaryInput, valuationReady: boolean, financialReady: boolean, technicalSupport: boolean, financialSupport: boolean, valuationHighCount: number): ResearchSummaryDimension[] {
  const candidate = input.candidate
  if (!candidate)
    return []

  const technicalState: ResearchSummaryDimensionState = candidate.quality !== 'ready' ? 'missing' : technicalSupport ? 'positive' : 'caution'
  const valuationState: ResearchSummaryDimensionState = !valuationReady ? 'missing' : valuationHighCount > 0 || !input.valuationComparison ? 'caution' : 'positive'
  const financialState: ResearchSummaryDimensionState = !financialReady ? 'missing' : financialSupport ? 'positive' : 'caution'
  const completenessState: ResearchSummaryDimensionState = candidate.quality !== 'ready' || (!valuationReady && !financialReady)
    ? 'missing'
    : candidate.quality !== 'ready' || !valuationReady || !financialReady
      ? 'caution'
      : 'positive'

  return [
    {
      key: 'technical',
      label: '技术结构',
      state: technicalState,
      detail: candidate.quality !== 'ready' ? '日线不足' : technicalSupport ? `信号 ${candidate.score ?? 0} 项` : '信号仍偏少',
    },
    {
      key: 'valuation',
      label: '估值位置',
      state: valuationState,
      detail: !valuationReady ? '估值字段缺失' : valuationHighCount > 0 ? '有指标处于池内高位' : input.valuationComparison ? '暂未见池内高位' : '缺少同池样本',
    },
    {
      key: 'financial',
      label: '基本面',
      state: financialState,
      detail: !financialReady ? '报告字段缺失' : financialSupport ? '质量指标有支撑' : '趋势需要核对',
    },
    {
      key: 'completeness',
      label: '数据完整度',
      state: completenessState,
      detail: completenessState === 'positive' ? '四个维度均可读' : completenessState === 'caution' ? '部分维度待补齐' : '关键数据不足',
    },
  ]
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
  const technicalSupport = candidate.quality === 'ready' && signalCount >= 2
  const improvingTrendCount = input.trends.filter(item => item.tone === 'positive').length
  const cashflowSupport = input.financial?.operatingCashflowToRevenue !== null && (input.financial?.operatingCashflowToRevenue ?? -1) >= 0
  const financialSupport = financialReady && (improvingTrendCount >= 2 || [
    input.financial?.revenueYoY,
    input.financial?.netProfitYoY,
    input.financial?.roe,
    cashflowSupport ? 1 : null,
  ].filter((item): item is number => item !== null && item !== undefined).length >= 3)
  const cashflowConcern = input.financial?.operatingCashflowToRevenue !== null && (input.financial?.operatingCashflowToRevenue ?? 0) < 0
  const growthCashflowConflict = input.financial?.netProfitYoY !== null && (input.financial?.netProfitYoY ?? 0) > 0 && cashflowConcern

  const status: ResearchSummaryStatus = dataIncomplete
    ? 'incomplete'
    : dangerCount > 0 || weakTrendCount >= 2 || valuationHighCount === 2
      ? 'observe'
      : signalCount >= 2
        ? 'research'
        : 'observe'

  const tone: ResearchSummaryTone = status === 'research' ? 'positive' : status === 'observe' ? 'warning' : 'neutral'
  const label = status === 'research' ? '继续研究' : status === 'observe' ? '先观察' : '数据不足'
  const headline = dataIncomplete
    ? '当前数据不足，先补齐日线、估值或财务数据。'
    : valuationHighCount === 2 && technicalSupport
      ? '技术面较强，但估值处于观察池高位，先核对盈利持续性。'
      : technicalSupport && financialSupport
        ? '技术与基本面方向一致，适合优先核对估值和数据时点。'
        : financialSupport
          ? '基本面有一定支撑，但技术信号尚未确认，先观察趋势。'
          : technicalSupport
            ? '技术面偏强，但基本面支撑有限，先核对利润与现金流。'
            : status === 'research'
              ? '基础数据齐全，适合进入下一步人工核对。'
              : '已有部分支持信号，但需要先核对提示项。'

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

  if (improvingTrendCount >= 2)
    addUnique(support, '最近报告的多项质量指标有所改善')
  if (technicalSupport && financialSupport && valuationHighCount === 0)
    addUnique(support, '技术与基本面方向一致')
  if (financialSupport && !technicalSupport)
    addUnique(nextChecks, '等待技术信号进一步确认')
  if (growthCashflowConflict)
    addUnique(watchouts, '净利润增长与经营现金流方向不一致')
  if (cashflowConcern)
    addUnique(nextChecks, '核对利润质量和经营现金流')
  for (const trend of input.trends) {
    if (trend.tone === 'negative')
      addUnique(watchouts, `${trend.label}${trend.state}`)
  }
  if (technicalSupport && valuationHighCount === 2)
    addUnique(watchouts, '技术较强但估值偏高，避免只看涨势')
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
    dimensions: buildResearchDimensions(input, valuationReady, financialReady, technicalSupport, financialSupport, valuationHighCount),
    support: support.slice(0, 3),
    watchouts: watchouts.slice(0, 3),
    nextChecks: nextChecks.slice(0, 3),
  }
}
