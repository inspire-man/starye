import type { QuantAiDecisionReview, QuantRecommendation, QuantResearchReport } from './quant-view-models'

export type QuantDecisionPriceStatus = 'within' | 'above' | 'below' | 'not-buying' | 'unavailable'
export type QuantDecisionTrustStatus = 'complete' | 'review' | 'insufficient'

export interface QuantDecisionGuide {
  readonly priceStatus: QuantDecisionPriceStatus
  readonly priceLabel: string
  readonly priceDetail: string
  readonly trustStatus: QuantDecisionTrustStatus
  readonly trustLabel: string
  readonly trustDetail: string
  readonly checks: readonly string[]
  readonly steps: readonly string[]
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function price(value: number): string {
  return `${value.toFixed(2)} 元`
}

function observedDate(value: string | null | undefined): string {
  if (!value)
    return '日期未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : value.slice(0, 10)
}

function recommendationLabel(value: QuantRecommendation | null): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

function sourceNeedsReview(report: QuantResearchReport): boolean {
  return report.sources.some(source => /回退|fallback|quota|不可用|失败/iu.test(source.name))
}

function aiReviewDetail(review: QuantAiDecisionReview | null): string {
  if (!review)
    return 'AI 尚未复核，当前结论来自确定性因子模型'
  if (review.accepted)
    return `AI 已复核并纳入最终推荐，置信度 ${review.confidence.toFixed(0)}`
  return review.rejectionReason === 'deterministic-watch'
    ? 'AI 已复核，但数据不足，保持确定性观望'
    : `AI 已复核但置信度不足（${review.confidence.toFixed(0)}），保留确定性结论`
}

export function buildQuantDecisionGuide(input: {
  readonly report: QuantResearchReport
  readonly recommendation: QuantRecommendation | null
  readonly aiReview: QuantAiDecisionReview | null
  readonly currentPrice: number | null | undefined
  readonly currentPriceObservedAt: string | null | undefined
}): QuantDecisionGuide {
  const decision = input.report.decision
  const buyRange = decision?.buyPriceRange ?? null
  const currentPrice = finite(input.currentPrice)
  const activeRecommendation = input.recommendation
  const date = observedDate(input.currentPriceObservedAt)
  let priceStatus: QuantDecisionPriceStatus = 'unavailable'
  let priceLabel = '暂无价格条件'
  let priceDetail = '缺少最近有效收盘价或完整参考买入区间，先补齐日线数据。'

  if (activeRecommendation !== 'bullish') {
    priceStatus = 'not-buying'
    priceLabel = `当前推荐${recommendationLabel(activeRecommendation)}，不是买入方向`
    priceDetail = `当前最终推荐为${recommendationLabel(activeRecommendation)}；参考买入区间只属于确定性模型的区间，不作为当前买入依据。`
  }
  else if (currentPrice !== null && buyRange && Number.isFinite(buyRange.low) && Number.isFinite(buyRange.high)) {
    if (currentPrice < buyRange.low) {
      priceStatus = 'below'
      priceLabel = '当前收盘低于参考买入区间'
      priceDetail = `最近交易日收盘 ${price(currentPrice)}（${date}），低于 ${price(buyRange.low)} - ${price(buyRange.high)}；先核对是否有新信息或数据异常。`
    }
    else if (currentPrice > buyRange.high) {
      priceStatus = 'above'
      priceLabel = '当前收盘高于参考买入区间'
      priceDetail = `最近交易日收盘 ${price(currentPrice)}（${date}），高于 ${price(buyRange.low)} - ${price(buyRange.high)}；看多不等于当前价立即买入。`
    }
    else {
      priceStatus = 'within'
      priceLabel = '当前收盘在参考买入区间内'
      priceDetail = `最近交易日收盘 ${price(currentPrice)}（${date}），位于 ${price(buyRange.low)} - ${price(buyRange.high)}；这只表示价格条件满足，还要完成信任检查。`
    }
  }

  const factorModel = input.report.factorModel
  const factors = factorModel?.factors ?? []
  const incompleteFactors = factors.filter(factor => factor.weight > 0 && factor.status !== 'ready')
  const failedEvidence = input.report.evidence.filter(item => item.status === 'fail')
  const coverage = finite(factorModel?.coverage) ?? 0
  const readyFactorCount = factors.filter(factor => factor.weight > 0 && factor.status === 'ready').length
  const weightedEvidenceComplete = Boolean(factorModel && coverage >= 80 && incompleteFactors.length === 0 && failedEvidence.length === 0)
  const fallback = sourceNeedsReview(input.report)
  const aiNeedsReview = !input.aiReview || !input.aiReview.accepted
  const trustStatus: QuantDecisionTrustStatus = !weightedEvidenceComplete ? 'insufficient' : fallback || aiNeedsReview ? 'review' : 'complete'
  const trustLabel = trustStatus === 'complete' ? '证据链完整' : trustStatus === 'review' ? '可参考，但需核对' : '数据不足，先补证据'
  const trustDetail = `${coverage.toFixed(0)}% 覆盖 · ${readyFactorCount} / ${factors.filter(factor => factor.weight > 0).length} 个正权重因子完整`
  const sourceDetail = input.report.sources.length
    ? `${input.report.sources.length} 个来源${fallback ? '，含回退链' : ''}`
    : '来源未记录'
  const checks = [
    `硬证据：${trustDetail}`,
    `数据时效：最近交易日 ${date}，使用收盘价而非实时行情`,
    `来源：${sourceDetail}`,
    `AI：${aiReviewDetail(input.aiReview)}`,
  ]
  const steps = [
    `先核对数据日期和实时价格，${date} 的收盘价不能替代盘中行情`,
    priceStatus === 'within'
      ? '价格条件落在参考区间内，再确认信任检查全部通过'
      : priceStatus === 'above'
        ? '价格高于参考买入区间，先等待新报告或重新出现价格条件'
        : priceStatus === 'below'
          ? '价格低于参考买入区间，先核对新信息、数据日期和异常波动'
          : priceStatus === 'not-buying'
            ? `当前${recommendationLabel(activeRecommendation)}，先不建立买入计划`
            : '价格条件缺失，先补齐日线数据',
    trustStatus === 'complete'
      ? '展开因子来源与失效条件，确认结论仍符合你的研究假设'
      : '先处理信任检查中的数据缺口、来源回退或 AI 复核状态，再决定是否继续研究',
  ]

  return { priceStatus, priceLabel, priceDetail, trustStatus, trustLabel, trustDetail, checks, steps }
}
