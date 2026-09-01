import type { QuantDataHealthFreshness } from './data-health'
import type { QuantAiDecisionReview, QuantAiFactorImpact, QuantRecommendation, QuantResearchReport } from './quant-types'

export const QUANT_DECISION_READINESS_VERSION = 'decision-readiness-v1' as const
export type QuantDecisionReadinessStatus = 'ready' | 'review' | 'blocked'
export type QuantDecisionReadinessCheckStatus = 'pass' | 'review' | 'blocked'
export type QuantDecisionReadinessCheckKey = 'data' | 'freshness' | 'ai' | 'price'

export interface QuantDecisionReadinessCheck {
  readonly key: QuantDecisionReadinessCheckKey
  readonly status: QuantDecisionReadinessCheckStatus
  readonly label: string
  readonly detail: string
}

export interface QuantDecisionReadiness {
  readonly version: typeof QUANT_DECISION_READINESS_VERSION
  readonly status: QuantDecisionReadinessStatus
  readonly label: '可参考' | '仅供参考' | '暂不可用'
  readonly detail: string
  readonly checks: readonly QuantDecisionReadinessCheck[]
  readonly unresolvedFactors: readonly string[]
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recommendationLabel(value: QuantRecommendation | null | undefined): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

function rejectionReasonLabel(value: QuantAiDecisionReview['rejectionReason']): string {
  return value === 'deterministic-watch'
    ? '确定性结论为观望'
    : value === 'factor-review-incomplete'
      ? '有权重因子复核不完整'
      : value === 'factor-conflict'
        ? '因子方向存在冲突'
        : value === 'low-confidence'
          ? 'AI 置信度不足'
          : 'AI 尚未达到纳入条件'
}

function freshnessCheck(freshness: QuantDataHealthFreshness, detail: string | undefined): QuantDecisionReadinessCheck {
  const fallback = {
    fresh: '数据观察时间在 48 小时内',
    aging: '数据观察时间超过 48 小时，建议刷新',
    stale: '数据观察时间超过 7 天，先刷新数据',
    unknown: '没有可验证的数据观察时间',
  }[freshness]
  return {
    key: 'freshness',
    status: freshness === 'fresh' ? 'pass' : freshness === 'aging' ? 'review' : 'blocked',
    label: '数据时效',
    detail: detail || fallback,
  }
}

function factorLabels(factorImpact: QuantAiFactorImpact | null | undefined): string[] {
  return factorImpact?.factors.filter(factor => !factor.aiAccepted || (factor.freshness !== undefined && factor.freshness.status !== 'fresh')).map(factor => factor.label) ?? []
}

function dataCheck(report: QuantResearchReport): { readonly check: QuantDecisionReadinessCheck, readonly unresolvedFactors: string[] } {
  const factorModel = report.factorModel
  const factors = factorModel?.factors.filter(factor => factor.weight > 0 && Number.isFinite(factor.weight)) ?? []
  const readyFactors = factors.filter(factor => factor.status === 'ready').length
  const coverage = finite(factorModel?.coverage ?? report.decision?.coverage) ?? 0
  const requiredEvidence = report.evidence.filter(item => item.optional !== true)
  const missingEvidence = requiredEvidence.filter(item => item.status === 'missing').length
  const failedEvidence = requiredEvidence.filter(item => item.status === 'fail').length
  const incompleteFactors = factors.filter(factor => factor.status !== 'ready')
  const blockingReasons: string[] = []
  if (!report.decision)
    blockingReasons.push('缺少研究决策')
  if (!factors.length)
    blockingReasons.push('没有正权重因子')
  if (coverage < 80)
    blockingReasons.push(`因子覆盖仅 ${coverage.toFixed(0)}%`)
  if (incompleteFactors.length)
    blockingReasons.push(`${incompleteFactors.map(factor => factor.label).join('、')}未完整`)
  if (!report.evidence.length)
    blockingReasons.push('没有研究证据')
  if (missingEvidence)
    blockingReasons.push(`${missingEvidence} 条证据缺失`)
  if (failedEvidence)
    blockingReasons.push(`${failedEvidence} 条证据失败`)
  if (!report.sources.length)
    blockingReasons.push('没有数据来源')

  const fallbackSource = report.sources.some(source => /回退|fallback|quota|不可用|失败/iu.test(source.name))
  const status: QuantDecisionReadinessCheckStatus = blockingReasons.length ? 'blocked' : fallbackSource ? 'review' : 'pass'
  const detail = blockingReasons.length
    ? blockingReasons.join('；')
    : `${coverage.toFixed(0)}% 因子覆盖，${readyFactors} / ${factors.length} 个正权重因子完整${fallbackSource ? '；来源包含回退链，需复核' : ''}`
  return {
    check: { key: 'data', status, label: '数据完整性', detail },
    unresolvedFactors: incompleteFactors.map(factor => factor.label),
  }
}

function aiCheck(
  aiReview: QuantAiDecisionReview | null | undefined,
  factorImpact: QuantAiFactorImpact | null | undefined,
  report: QuantResearchReport,
): { readonly check: QuantDecisionReadinessCheck, readonly unresolvedFactors: string[] } {
  const unresolvedFactors = factorImpact
    ? factorLabels(factorImpact)
    : report.factorModel?.factors.filter(factor => factor.weight > 0).map(factor => factor.label) ?? []
  if (!aiReview) {
    return {
      check: {
        key: 'ai',
        status: 'review',
        label: 'AI 复核',
        detail: factorImpact
          ? `已纳入 ${factorImpact.reviewCoverage.toFixed(0)}% 权重，${unresolvedFactors.length ? '仍有因子未纳入' : '尚无结构化最终复核'}`
          : '尚未完成结构化 AI 复核，因子纳入状态未知',
      },
      unresolvedFactors,
    }
  }

  if (!aiReview.accepted) {
    return {
      check: {
        key: 'ai',
        status: 'review',
        label: 'AI 复核',
        detail: `已复核但仅供参考：${rejectionReasonLabel(aiReview.rejectionReason)}${factorImpact ? `，已纳入 ${factorImpact.reviewCoverage.toFixed(0)}% 权重` : ''}`,
      },
      unresolvedFactors,
    }
  }

  if (!factorImpact) {
    return {
      check: { key: 'ai', status: 'review', label: 'AI 复核', detail: 'AI 最终复核已接受，但历史摘要缺少因子影响审计' },
      unresolvedFactors,
    }
  }

  const freshnessBlocked = factorImpact.factors.filter(factor => factor.freshness !== undefined && factor.freshness.status !== 'fresh')
  if (freshnessBlocked.length || factorImpact.freshnessBlockedFactors?.length) {
    return {
      check: {
        key: 'ai',
        status: 'review',
        label: 'AI 复核',
        detail: `AI 已复核，但 ${freshnessBlocked.map(factor => factor.label).join('、') || factorImpact.freshnessBlockedFactors?.join('、')} 的证据时间不足，未纳入最终判断`,
      },
      unresolvedFactors,
    }
  }

  if (factorImpact.reviewCoverage < 100 || factorImpact.unacceptedWeight > 0) {
    return {
      check: {
        key: 'ai',
        status: 'review',
        label: 'AI 复核',
        detail: `AI 最终复核已接受，但只有 ${factorImpact.reviewCoverage.toFixed(0)}% 权重纳入，仍需核对未纳入因子`,
      },
      unresolvedFactors,
    }
  }

  return {
    check: { key: 'ai', status: 'pass', label: 'AI 复核', detail: `全部有权重因子已纳入，整体置信度 ${aiReview.confidence.toFixed(0)}` },
    unresolvedFactors,
  }
}

function priceCheck(report: QuantResearchReport, currentPrice: number | null | undefined): QuantDecisionReadinessCheck {
  const price = finite(currentPrice)
  if (price === null)
    return { key: 'price', status: 'blocked', label: '价格条件', detail: '当前价格尚未加载，无法核对参考区间' }

  const recommendation = report.decision?.recommendation
  if (recommendation !== 'bullish')
    return { key: 'price', status: 'pass', label: '价格条件', detail: `当前推荐为${recommendationLabel(recommendation)}，买入区间不作为本次方向依据` }

  const range = report.decision?.buyPriceRange
  if (!range)
    return { key: 'price', status: 'blocked', label: '价格条件', detail: '看多报告缺少参考买入区间' }
  if (price < range.low || price > range.high)
    return { key: 'price', status: 'review', label: '价格条件', detail: `当前 ${price.toFixed(2)} 元不在 ${range.low.toFixed(2)} - ${range.high.toFixed(2)} 元参考区间内` }
  return { key: 'price', status: 'pass', label: '价格条件', detail: `当前 ${price.toFixed(2)} 元位于参考买入区间内` }
}

export function buildQuantDecisionReadiness(input: {
  readonly report: QuantResearchReport
  readonly aiReview?: QuantAiDecisionReview | null
  readonly factorImpact?: QuantAiFactorImpact | null
  readonly currentPrice?: number | null
  readonly dataFreshness: QuantDataHealthFreshness
  readonly dataFreshnessDetail?: string
}): QuantDecisionReadiness {
  const data = dataCheck(input.report)
  const freshness = freshnessCheck(input.dataFreshness, input.dataFreshnessDetail)
  const ai = aiCheck(input.aiReview, input.factorImpact, input.report)
  const price = priceCheck(input.report, input.currentPrice)
  const checks = [data.check, ai.check, price, freshness]
  const status: QuantDecisionReadinessStatus = checks.some(check => check.status === 'blocked')
    ? 'blocked'
    : checks.some(check => check.status === 'review')
      ? 'review'
      : 'ready'
  const label = status === 'ready' ? '可参考' : status === 'review' ? '仅供参考' : '暂不可用'
  const unresolvedFactors = [...new Set([...data.unresolvedFactors, ...ai.unresolvedFactors])]
  const detail = status === 'ready'
    ? '数据检查和 AI 因子复核均达到当前参考线'
    : status === 'review'
      ? '确定性数据可以阅读，但仍有项目需要人工核对'
      : '关键数据尚未齐备，当前结果只用于定位缺口'
  return { version: QUANT_DECISION_READINESS_VERSION, status, label, detail, checks, unresolvedFactors }
}
