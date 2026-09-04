import type { QuantDecisionQueueItem } from './decision-queue'
import type { CandidateItem, QuantAiDecisionReview, QuantDecisionRecord, QuantRecommendation, WatchlistItem } from './quant-view-models'
import { buildQuantDecisionQueue } from './decision-queue'

export type QuantAiTrustOverviewItemStatus = 'aligned' | 'opposed' | 'flat' | 'pending' | 'unavailable' | 'not-accepted' | 'inactive'

export interface QuantAiTrustOverviewItem {
  readonly record: QuantDecisionRecord
  readonly tsCode: string
  readonly name: string
  readonly aiRecommendation: QuantRecommendation | null
  readonly recommendation: 'bullish' | 'bearish' | null
  readonly aiAccepted: boolean
  readonly confidence: number | null
  readonly factorReviewCoverage: number | null
  readonly aiScoreDelta: number | null
  readonly currentPrice: number | null
  readonly currentTradeDate: string | null
  readonly changePercent: number | null
  readonly status: QuantAiTrustOverviewItemStatus
}

export interface QuantAiTrustOverviewSummary {
  readonly total: number
  readonly accepted: number
  readonly observed: number
  readonly pending: number
  readonly unavailable: number
  readonly notAccepted: number
  readonly inactive: number
  readonly aligned: number
  readonly opposed: number
  readonly flat: number
  readonly directionalSampleCount: number
  readonly agreementRate: number | null
}

export interface QuantAiTrustOverview {
  readonly items: readonly QuantAiTrustOverviewItem[]
  readonly summary: QuantAiTrustOverviewSummary
}

type DirectionalRecommendation = 'bullish' | 'bearish'

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function dayKey(value: string | null | undefined): string | null {
  if (!value)
    return null
  const digits = value.replace(/\D/gu, '')
  if (/^\d{8}/u.test(digits))
    return digits.slice(0, 8)
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed))
    return null
  const date = new Date(parsed)
  return `${date.getUTCFullYear().toString().padStart(4, '0')}${(date.getUTCMonth() + 1).toString().padStart(2, '0')}${date.getUTCDate().toString().padStart(2, '0')}`
}

function acceptedRecommendation(review: QuantAiDecisionReview | null): DirectionalRecommendation | null {
  if (!review?.accepted || (review.recommendation !== 'bullish' && review.recommendation !== 'bearish'))
    return null
  return review.recommendation
}

function isActiveAction(record: QuantDecisionRecord): boolean {
  return record.action === 'plan-buy' || record.action === 'holding'
}

function observationChange(item: QuantDecisionQueueItem): number | null {
  const baseline = positiveFinite(item.record.snapshot.currentPrice)
  const current = positiveFinite(item.currentPrice)
  const baselineDay = dayKey(item.record.snapshot.currentPriceObservedAt)
  const currentDay = dayKey(item.currentTradeDate)
  if (baseline === null || current === null || !baselineDay || !currentDay || currentDay <= baselineDay)
    return null
  const change = (current - baseline) / baseline * 100
  return Number.isFinite(change) ? change : null
}

function statusFor(input: {
  readonly active: boolean
  readonly recommendation: DirectionalRecommendation | null
  readonly item: QuantDecisionQueueItem
  readonly changePercent: number | null
}): QuantAiTrustOverviewItemStatus {
  if (!input.active)
    return 'inactive'
  if (!input.recommendation)
    return 'not-accepted'
  if (input.changePercent !== null) {
    if (input.changePercent === 0)
      return 'flat'
    const expectedUp = input.recommendation === 'bullish'
    const observedUp = input.changePercent > 0
    return expectedUp === observedUp ? 'aligned' : 'opposed'
  }
  const baseline = positiveFinite(input.item.record.snapshot.currentPrice)
  const current = positiveFinite(input.item.currentPrice)
  const baselineDay = dayKey(input.item.record.snapshot.currentPriceObservedAt)
  const currentDay = dayKey(input.item.currentTradeDate)
  return baseline !== null && current !== null && baselineDay && currentDay ? 'pending' : 'unavailable'
}

function statusRank(status: QuantAiTrustOverviewItemStatus): number {
  return {
    'opposed': 0,
    'unavailable': 1,
    'pending': 2,
    'not-accepted': 3,
    'aligned': 4,
    'flat': 5,
    'inactive': 6,
  }[status]
}

function itemFromQueue(item: QuantDecisionQueueItem): QuantAiTrustOverviewItem {
  const review = item.record.snapshot.aiDecisionReview
  const recommendation = acceptedRecommendation(review)
  const changePercent = observationChange(item)
  return {
    record: item.record,
    tsCode: item.tsCode,
    name: item.name,
    aiRecommendation: review?.recommendation ?? null,
    recommendation,
    aiAccepted: recommendation !== null,
    confidence: typeof review?.confidence === 'number' && Number.isFinite(review.confidence) ? review.confidence : null,
    factorReviewCoverage: typeof review?.factorReviewCoverage === 'number' && Number.isFinite(review.factorReviewCoverage) ? review.factorReviewCoverage : null,
    aiScoreDelta: typeof item.record.snapshot.factorImpact?.aiScoreDelta === 'number' && Number.isFinite(item.record.snapshot.factorImpact.aiScoreDelta)
      ? item.record.snapshot.factorImpact.aiScoreDelta
      : null,
    currentPrice: positiveFinite(item.currentPrice),
    currentTradeDate: item.currentTradeDate,
    changePercent,
    status: statusFor({ active: isActiveAction(item.record), recommendation, item, changePercent }),
  }
}

export function buildQuantAiTrustOverview(input: {
  readonly records: readonly QuantDecisionRecord[]
  readonly candidates: readonly CandidateItem[]
  readonly watchlist: readonly Pick<WatchlistItem, 'tsCode' | 'name' | 'latestClose' | 'latestTradeDate'>[]
  readonly candidateTradeDate: string | null
}): QuantAiTrustOverview {
  const queue = buildQuantDecisionQueue({
    records: input.records,
    candidates: input.candidates,
    watchlist: input.watchlist,
    candidateTradeDate: input.candidateTradeDate,
    limit: Math.max(1, input.records.length),
  })
  const items = queue.items.map(itemFromQueue)
  const rankedItems = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => statusRank(left.item.status) - statusRank(right.item.status) || left.index - right.index)
    .map(entry => entry.item)
  const accepted = rankedItems.filter(item => item.aiAccepted && isActiveAction(item.record)).length
  const observed = rankedItems.filter(item => item.status === 'aligned' || item.status === 'opposed' || item.status === 'flat').length
  const pending = rankedItems.filter(item => item.status === 'pending').length
  const unavailable = rankedItems.filter(item => item.status === 'unavailable').length
  const notAccepted = rankedItems.filter(item => item.status === 'not-accepted').length
  const inactive = rankedItems.filter(item => item.status === 'inactive').length
  const aligned = rankedItems.filter(item => item.status === 'aligned').length
  const opposed = rankedItems.filter(item => item.status === 'opposed').length
  const flat = rankedItems.filter(item => item.status === 'flat').length
  const directionalSampleCount = aligned + opposed
  return {
    items: rankedItems,
    summary: {
      total: rankedItems.length,
      accepted,
      observed,
      pending,
      unavailable,
      notAccepted,
      inactive,
      aligned,
      opposed,
      flat,
      directionalSampleCount,
      agreementRate: directionalSampleCount >= 3 ? round(aligned / directionalSampleCount * 100) : null,
    },
  }
}
