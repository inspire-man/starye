import type { DecisionOutcomeEntry } from './decision-outcome'
import type { QuantAiFactorReviewStance, QuantDecisionRecord, QuantFactorConfigurationKey } from './quant-view-models'
import { buildDecisionOutcome } from './decision-outcome'

export type QuantAiOutcomeCalibrationStatus = 'empty' | 'pending' | 'observed'
export type QuantAiOutcomeCalibrationAlignment = 'aligned' | 'opposed' | 'flat'

export interface QuantAiOutcomeCalibrationEntry {
  readonly baselineId: string
  readonly baselineAction: 'plan-buy' | 'holding'
  readonly recommendation: 'bullish' | 'bearish'
  readonly confidence: number
  readonly baselinePrice: number
  readonly baselineObservedAt: string
  readonly observationPrice: number
  readonly observationObservedAt: string
  readonly observationKind: DecisionOutcomeEntry['observationKind']
  readonly changePercent: number
  readonly alignment: QuantAiOutcomeCalibrationAlignment
  readonly aiScoreDelta: number | null
}

export interface QuantAiFactorCalibration {
  readonly factor: QuantFactorConfigurationKey
  readonly label: string
  readonly observedCount: number
  readonly alignedCount: number
  readonly opposedCount: number
  readonly indeterminateCount: number
}

export interface QuantAiOutcomeCalibration {
  readonly status: QuantAiOutcomeCalibrationStatus
  readonly headline: string
  readonly eligibleCount: number
  readonly observedCount: number
  readonly pendingCount: number
  readonly alignedCount: number
  readonly opposedCount: number
  readonly flatCount: number
  readonly directionalSampleCount: number
  readonly agreementRate: number | null
  readonly entries: readonly QuantAiOutcomeCalibrationEntry[]
  readonly factors: readonly QuantAiFactorCalibration[]
}

const FACTOR_LABELS: Readonly<Record<QuantFactorConfigurationKey, string>> = {
  'trend': '趋势',
  'valuation': '估值',
  'quality': '盈利质量',
  'shareholder-return': '股东回报',
  'risk': '风险',
}

const FACTOR_KEYS: readonly QuantFactorConfigurationKey[] = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk']

type DirectionalRecommendation = 'bullish' | 'bearish'

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function acceptedRecommendation(record: QuantDecisionRecord): DirectionalRecommendation | null {
  const review = record.snapshot.aiDecisionReview
  if (!review?.accepted || (review.recommendation !== 'bullish' && review.recommendation !== 'bearish'))
    return null
  return review.recommendation
}

function alignment(recommendation: DirectionalRecommendation, changePercent: number): QuantAiOutcomeCalibrationAlignment {
  if (changePercent === 0)
    return 'flat'
  const expectedUp = recommendation === 'bullish'
  const observedUp = changePercent > 0
  return expectedUp === observedUp ? 'aligned' : 'opposed'
}

function reviewEntries(record: QuantDecisionRecord): readonly {
  readonly factor: QuantFactorConfigurationKey
  readonly stance: QuantAiFactorReviewStance
}[] {
  if (record.snapshot.factorImpact?.factors.length) {
    return record.snapshot.factorImpact.factors
      .filter(item => item.aiAccepted && item.aiStance !== null)
      .map(item => ({ factor: item.factor, stance: item.aiStance! }))
  }
  return record.snapshot.aiFactorReviews
    .filter(item => item.accepted)
    .map(item => ({ factor: item.factor, stance: item.stance }))
}

function buildFactorCalibration(
  entries: readonly QuantAiOutcomeCalibrationEntry[],
  recordsById: ReadonlyMap<string, QuantDecisionRecord>,
): readonly QuantAiFactorCalibration[] {
  const stats = new Map<QuantFactorConfigurationKey, { observedCount: number, alignedCount: number, opposedCount: number, indeterminateCount: number }>()
  for (const entry of entries) {
    const record = recordsById.get(entry.baselineId)
    if (!record)
      continue
    for (const review of reviewEntries(record)) {
      const stat = stats.get(review.factor) || { observedCount: 0, alignedCount: 0, opposedCount: 0, indeterminateCount: 0 }
      stat.observedCount++
      if (entry.alignment === 'flat' || review.stance === 'caution' || review.stance === 'insufficient')
        stat.indeterminateCount++
      else if ((review.stance === 'support' && entry.changePercent > 0) || (review.stance === 'oppose' && entry.changePercent < 0))
        stat.alignedCount++
      else
        stat.opposedCount++
      stats.set(review.factor, stat)
    }
  }
  return FACTOR_KEYS.flatMap((factor) => {
    const stat = stats.get(factor)
    return stat
      ? [{ factor, label: FACTOR_LABELS[factor], ...stat }]
      : []
  })
}

function calibrationHeadline(input: {
  readonly eligibleCount: number
  readonly observedCount: number
  readonly pendingCount: number
  readonly directionalSampleCount: number
  readonly agreementRate: number | null
}): string {
  if (!input.eligibleCount)
    return '还没有已接受 AI 的计划买入或持有记录可回看。'
  if (!input.observedCount)
    return `已有 ${input.eligibleCount} 次已接受 AI 判断，等待更晚的有效日线或决策价格。`
  const sampleDetail = input.agreementRate === null
    ? `方向样本 ${input.directionalSampleCount} 条，样本尚不足 3 条，暂不计算方向一致率`
    : `方向一致率 ${input.agreementRate.toFixed(0)}%（${input.directionalSampleCount} 条方向样本）`
  return `已回看 ${input.observedCount} 次后续价格观察，${sampleDetail}${input.pendingCount ? `；另有 ${input.pendingCount} 次等待观察` : ''}。`
}

export function buildQuantAiOutcomeCalibration(
  history: readonly QuantDecisionRecord[],
  latestObservation: { readonly price: number | null, readonly observedAt: string | null } | null = null,
): QuantAiOutcomeCalibration {
  const recordsById = new Map(history.map(record => [record.id, record] as const))
  const eligibleRecords = history.filter(record => acceptedRecommendation(record) !== null && positiveFinite(record.snapshot.currentPrice) !== null)
  const outcome = buildDecisionOutcome(history, latestObservation)
  const entries = outcome.entries.flatMap((item): QuantAiOutcomeCalibrationEntry[] => {
    const record = recordsById.get(item.baselineId)
    const recommendation = record ? acceptedRecommendation(record) : null
    const confidence = record?.snapshot.aiDecisionReview?.confidence
    if (!record || !recommendation || typeof confidence !== 'number' || !Number.isFinite(confidence))
      return []
    const delta = record.snapshot.factorImpact?.aiScoreDelta
    return [{
      baselineId: item.baselineId,
      baselineAction: item.baselineAction,
      recommendation,
      confidence,
      baselinePrice: item.baselinePrice,
      baselineObservedAt: item.baselineObservedAt,
      observationPrice: item.observationPrice,
      observationObservedAt: item.observationObservedAt,
      observationKind: item.observationKind,
      changePercent: item.changePercent,
      alignment: alignment(recommendation, item.changePercent),
      aiScoreDelta: typeof delta === 'number' && Number.isFinite(delta) ? delta : null,
    }]
  })
  const observedIds = new Set(entries.map(entry => entry.baselineId))
  const alignedCount = entries.filter(entry => entry.alignment === 'aligned').length
  const opposedCount = entries.filter(entry => entry.alignment === 'opposed').length
  const flatCount = entries.filter(entry => entry.alignment === 'flat').length
  const directionalSampleCount = alignedCount + opposedCount
  const agreementRate = directionalSampleCount >= 3 ? round(alignedCount / directionalSampleCount * 100) : null
  const pendingCount = eligibleRecords.filter(record => !observedIds.has(record.id)).length
  const status: QuantAiOutcomeCalibrationStatus = entries.length ? 'observed' : eligibleRecords.length ? 'pending' : 'empty'
  return {
    status,
    headline: calibrationHeadline({ eligibleCount: eligibleRecords.length, observedCount: entries.length, pendingCount, directionalSampleCount, agreementRate }),
    eligibleCount: eligibleRecords.length,
    observedCount: entries.length,
    pendingCount,
    alignedCount,
    opposedCount,
    flatCount,
    directionalSampleCount,
    agreementRate,
    entries,
    factors: buildFactorCalibration(entries, recordsById),
  }
}

export interface QuantAiReviewCohort {
  readonly observedCount: number
  readonly alignedCount: number
  readonly opposedCount: number
  readonly flatCount: number
  readonly directionalSampleCount: number
  readonly agreementRate: number | null
}

export interface QuantAiReviewComparison {
  readonly accepted: QuantAiReviewCohort
  readonly unaccepted: QuantAiReviewCohort
  readonly headline: string
}

function cohortFrom(alignments: readonly QuantAiOutcomeCalibrationAlignment[]): QuantAiReviewCohort {
  const alignedCount = alignments.filter(item => item === 'aligned').length
  const opposedCount = alignments.filter(item => item === 'opposed').length
  const flatCount = alignments.filter(item => item === 'flat').length
  const directionalSampleCount = alignedCount + opposedCount
  return {
    observedCount: alignments.length,
    alignedCount,
    opposedCount,
    flatCount,
    directionalSampleCount,
    agreementRate: directionalSampleCount >= 3 ? round(alignedCount / directionalSampleCount * 100) : null,
  }
}

function comparisonHeadline(accepted: QuantAiReviewCohort, unaccepted: QuantAiReviewCohort): string {
  const side = (label: string, cohort: QuantAiReviewCohort) => cohort.agreementRate === null
    ? `${label}方向样本 ${cohort.directionalSampleCount} 条，不足 3 条`
    : `${label}方向一致 ${cohort.agreementRate.toFixed(0)}%（${cohort.directionalSampleCount} 条）`
  let comparison = '两边样本都还不能比较。'
  if (accepted.agreementRate !== null && unaccepted.agreementRate !== null) {
    if (accepted.agreementRate > unaccepted.agreementRate)
      comparison = '目前已接受复核的后续方向一致率更高，样本仍然小，不能当成胜率。'
    else if (accepted.agreementRate < unaccepted.agreementRate)
      comparison = '目前未接受复核的后续方向一致率更高，接受门槛还没有表现出优势。'
    else
      comparison = '目前两边的方向一致率相同，不能当成胜率。'
  }
  return `${side('已接受', accepted)}；${side('未接受', unaccepted)}。${comparison}这只是后续价格方向，不是收益。`
}

export function buildQuantAiReviewComparison(
  records: readonly QuantDecisionRecord[],
  watchlist: readonly { readonly tsCode: string, readonly latestClose: number | null, readonly latestTradeDate: string | null }[] = [],
): QuantAiReviewComparison {
  const accepted: QuantAiOutcomeCalibrationAlignment[] = []
  const unaccepted: QuantAiOutcomeCalibrationAlignment[] = []
  const byCode = new Map<string, QuantDecisionRecord[]>()
  for (const record of records)
    byCode.set(record.tsCode, [...(byCode.get(record.tsCode) || []), record])
  for (const [tsCode, history] of byCode) {
    const latest = watchlist.find(item => item.tsCode === tsCode)
    const outcome = buildDecisionOutcome(history, latest
      ? { price: positiveFinite(latest.latestClose), observedAt: latest.latestTradeDate }
      : null)
    const byId = new Map(history.map(record => [record.id, record]))
    for (const entry of outcome.entries) {
      const review = byId.get(entry.baselineId)?.snapshot.aiDecisionReview
      if (!review || (review.recommendation !== 'bullish' && review.recommendation !== 'bearish'))
        continue
      const bucket = review.accepted ? accepted : unaccepted
      bucket.push(alignment(review.recommendation, entry.changePercent))
    }
  }
  const acceptedCohort = cohortFrom(accepted)
  const unacceptedCohort = cohortFrom(unaccepted)
  return {
    accepted: acceptedCohort,
    unaccepted: unacceptedCohort,
    headline: comparisonHeadline(acceptedCohort, unacceptedCohort),
  }
}
