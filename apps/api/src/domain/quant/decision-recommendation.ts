import type { QuantResearchEvidence } from './research-report'
import type { DailyBar } from './types'

export const QUANT_FACTOR_MODEL_VERSION = 'research-factors-v1' as const
export const QUANT_DECISION_VERSION = 'research-decision-v1' as const
export const QUANT_REFERENCE_PRICE_VERSION = 'reference-price-v1' as const

export type QuantResearchFactorKey = 'trend' | 'valuation' | 'quality' | 'shareholder-return' | 'risk'
export type QuantResearchFactorStatus = 'ready' | 'partial' | 'missing' | 'unavailable'
export type QuantRecommendation = 'bullish' | 'bearish' | 'watch'

export interface QuantResearchFactor {
  readonly key: QuantResearchFactorKey
  readonly label: string
  readonly weight: number
  readonly sourceId: string
  readonly source: string
  readonly status: QuantResearchFactorStatus
  readonly score: number | null
  readonly evidenceKeys: readonly string[]
  readonly missingEvidenceKeys: readonly string[]
}

export interface QuantFactorModel {
  readonly modelVersion: typeof QUANT_FACTOR_MODEL_VERSION
  readonly totalWeight: 1
  readonly coveredWeight: number
  readonly coverage: number
  readonly score: number | null
  readonly factors: readonly QuantResearchFactor[]
}

export interface QuantReferencePriceRange {
  readonly low: number
  readonly high: number
  readonly currency: 'CNY'
  readonly formulaVersion: typeof QUANT_REFERENCE_PRICE_VERSION
  readonly source: string
  readonly observedAt: string
  readonly evidenceKeys: readonly string[]
}

export interface QuantDecisionProjection {
  readonly decisionVersion: typeof QUANT_DECISION_VERSION
  readonly recommendation: QuantRecommendation
  readonly label: '看多' | '看空' | '观望'
  readonly deterministicScore: number | null
  readonly confidence: number | null
  readonly coverage: number
  readonly buyPriceRange: QuantReferencePriceRange | null
  readonly sellPriceRange: QuantReferencePriceRange | null
  readonly evidenceKeys: readonly string[]
  readonly invalidationConditions: readonly string[]
  readonly headline: string
}

interface FactorDefinition {
  readonly key: QuantResearchFactorKey
  readonly label: string
  readonly weight: number
  readonly sourceId: string
  readonly source: string
  readonly evidenceKeys: readonly string[]
}

export const QUANT_FACTOR_DEFINITIONS: readonly FactorDefinition[] = [
  {
    key: 'trend',
    label: '趋势',
    weight: 0.25,
    sourceId: 'local-daily-bars',
    source: '本地 Quant 日线与趋势因子',
    evidenceKeys: ['trend-sample', 'trend-ma20', 'trend-return20'],
  },
  {
    key: 'valuation',
    label: '估值',
    weight: 0.2,
    sourceId: 'eastmoney-valuation',
    source: 'Eastmoney 估值',
    evidenceKeys: ['valuation-pe', 'valuation-pb'],
  },
  {
    key: 'quality',
    label: '盈利质量',
    weight: 0.2,
    sourceId: 'eastmoney-financial',
    source: 'Eastmoney 最新财报',
    evidenceKeys: ['quality-profit', 'quality-roe', 'quality-cashflow', 'quality-history'],
  },
  {
    key: 'shareholder-return',
    label: '股东回报',
    weight: 0.15,
    sourceId: 'tushare-dividend',
    source: 'Tushare 实施分红 + 本地最新收盘价',
    evidenceKeys: ['shareholder-yield'],
  },
  {
    key: 'risk',
    label: '风险',
    weight: 0.2,
    sourceId: 'local-daily-bars',
    source: '本地 Quant 日线风险因子',
    evidenceKeys: ['risk-volume', 'risk-streak'],
  },
] as const

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function evidenceScore(item: QuantResearchEvidence): number | null {
  if (item.status === 'missing')
    return null
  return item.status === 'pass' ? 100 : item.status === 'caution' ? 50 : 0
}

function factorStatus(items: readonly QuantResearchEvidence[], expectedCount: number): QuantResearchFactorStatus {
  const usable = items.filter(item => evidenceScore(item) !== null)
  if (!usable.length) {
    return items.some(item => /失败|不可用|未配置/u.test(item.detail)) ? 'unavailable' : 'missing'
  }
  return usable.length === expectedCount ? 'ready' : 'partial'
}

function factorSourceId(definition: FactorDefinition, items: readonly QuantResearchEvidence[]): string {
  if (definition.key !== 'shareholder-return')
    return definition.sourceId
  const source = items.map(item => item.source).join(' ')
  if (/Eastmoney/iu.test(source))
    return 'eastmoney-dividend'
  return definition.sourceId
}

function buildFactorModel(evidence: readonly QuantResearchEvidence[]): QuantFactorModel {
  const evidenceByKey = new Map(evidence.map(item => [item.key, item] as const))
  const factors = QUANT_FACTOR_DEFINITIONS.map((definition) => {
    const items = definition.evidenceKeys.flatMap((key) => {
      const item = evidenceByKey.get(key)
      return item ? [item] : []
    })
    const status = factorStatus(items, definition.evidenceKeys.length)
    const scored = items.map(evidenceScore).filter((value): value is number => value !== null)
    const score = scored.length ? round(scored.reduce((total, value) => total + value, 0) / scored.length) : null
    const coveredRatio = definition.evidenceKeys.length > 0 ? scored.length / definition.evidenceKeys.length : 0
    return {
      key: definition.key,
      label: definition.label,
      weight: definition.weight,
      sourceId: factorSourceId(definition, items),
      source: items[0]?.source ?? definition.source,
      status,
      score,
      evidenceKeys: definition.evidenceKeys,
      missingEvidenceKeys: definition.evidenceKeys.filter(key => evidenceByKey.get(key) === undefined || evidenceScore(evidenceByKey.get(key)!) === null),
      coveredRatio,
    }
  })
  const coveredWeight = round(factors.reduce((total, factor) => total + factor.weight * factor.coveredRatio, 0), 4)
  const scoredWeight = factors.reduce((total, factor) => total + (factor.score === null ? 0 : factor.weight), 0)
  const score = scoredWeight > 0
    ? round(factors.reduce((total, factor) => total + (factor.score ?? 0) * factor.weight, 0) / scoredWeight)
    : null

  return {
    modelVersion: QUANT_FACTOR_MODEL_VERSION,
    totalWeight: 1,
    coveredWeight,
    coverage: round(coveredWeight * 100),
    score,
    factors: factors.map(({ coveredRatio: _coveredRatio, ...factor }) => factor),
  }
}

function sortedCloses(input: readonly DailyBar[]): readonly { tradeDate: string, close: number }[] {
  return [...input]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .map(bar => ({ tradeDate: bar.tradeDate, close: bar.close }))
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
}

function referencePriceRanges(input: { readonly recommendation: QuantRecommendation, readonly dailyBars: readonly DailyBar[] }): {
  readonly buy: QuantReferencePriceRange | null
  readonly sell: QuantReferencePriceRange | null
} {
  if (input.recommendation === 'watch')
    return { buy: null, sell: null }
  const bars = sortedCloses(input.dailyBars)
  const latest = bars.at(-1)
  const ma20Values = bars.slice(-20).map(bar => bar.close)
  const resistanceValues = bars.slice(-60).map(bar => bar.close)
  if (!latest || ma20Values.length < 20 || resistanceValues.length < 60)
    return { buy: null, sell: null }
  const ma20 = ma20Values.reduce((total, value) => total + value, 0) / ma20Values.length
  const resistance = Math.max(...resistanceValues)
  const buyLow = round(ma20 * 0.98)
  const buyHigh = round(ma20 * 1.02)
  const sellLow = round(Math.max(latest.close, ma20))
  const sellHigh = round(Math.max(resistance, sellLow))
  const common = {
    currency: 'CNY' as const,
    formulaVersion: QUANT_REFERENCE_PRICE_VERSION,
    source: '本地 Quant 日线库',
    observedAt: latest.tradeDate,
  }
  return {
    buy: {
      ...common,
      low: buyLow,
      high: buyHigh,
      evidenceKeys: ['trend-sample', 'trend-ma20'],
    },
    sell: {
      ...common,
      low: sellLow,
      high: sellHigh,
      evidenceKeys: ['trend-sample'],
    },
  }
}

function factorByKey(model: QuantFactorModel, key: QuantResearchFactorKey): QuantResearchFactor | undefined {
  return model.factors.find(factor => factor.key === key)
}

function recommendationLabel(value: QuantRecommendation): '看多' | '看空' | '观望' {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

export function buildQuantDecisionProjection(input: {
  readonly evidence: readonly QuantResearchEvidence[]
  readonly dailyBars: readonly DailyBar[]
}): { readonly factorModel: QuantFactorModel, readonly decision: QuantDecisionProjection } {
  const factorModel = buildFactorModel(input.evidence)
  const missingFactors = factorModel.factors.filter(factor => factor.status !== 'ready')
  const riskScore = factorByKey(factorModel, 'risk')?.score ?? null
  const score = factorModel.score
  const enoughData = factorModel.coverage >= 80 && missingFactors.length === 0 && score !== null
  const recommendation: QuantRecommendation = !enoughData
    ? 'watch'
    : riskScore !== null && riskScore <= 25
      ? 'bearish'
      : score >= 66 && (riskScore === null || riskScore >= 50)
        ? 'bullish'
        : score <= 40
          ? 'bearish'
          : 'watch'
  const priceRanges = referencePriceRanges({ recommendation, dailyBars: input.dailyBars })
  const invalidationConditions = missingFactors.map(factor => factor.status === 'unavailable'
    ? `${factor.label}来源暂不可用，恢复来源后重新生成报告`
    : `补齐${factor.label}因子：${factor.missingEvidenceKeys.join('、')}`)
  const failedEvidence = input.evidence
    .filter(item => item.status === 'fail')
    .map(item => `${item.label}：${item.detail}`)
  invalidationConditions.push(...failedEvidence)
  if (!invalidationConditions.length) {
    invalidationConditions.push(
      recommendation === 'bullish' ? '趋势或风险证据转弱时重新评估' : recommendation === 'bearish' ? '风险证据恢复且基本面改善时重新评估' : '因子分歧收敛或新数据到达后重新评估',
    )
  }
  const confidence = !enoughData || score === null
    ? null
    : round(Math.min(100, Math.max(50, 50 + Math.abs(score - 50))))
  const headline = recommendation === 'bullish'
    ? `看多：因子覆盖度 ${factorModel.coverage.toFixed(0)}%，正向证据占优`
    : recommendation === 'bearish'
      ? `看空：因子覆盖度 ${factorModel.coverage.toFixed(0)}%，风险或负向证据占优`
      : `观望：因子覆盖度 ${factorModel.coverage.toFixed(0)}%，当前不满足明确方向条件`

  return {
    factorModel,
    decision: {
      decisionVersion: QUANT_DECISION_VERSION,
      recommendation,
      label: recommendationLabel(recommendation),
      deterministicScore: score,
      confidence,
      coverage: factorModel.coverage,
      buyPriceRange: priceRanges.buy,
      sellPriceRange: priceRanges.sell,
      evidenceKeys: factorModel.factors.flatMap(factor => factor.evidenceKeys),
      invalidationConditions: [...new Set(invalidationConditions)].slice(0, 8),
      headline,
    },
  }
}
