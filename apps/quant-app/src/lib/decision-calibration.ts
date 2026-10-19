import type { QuantDecisionRecord, WatchlistItem } from './quant-view-models'
import { buildDecisionOutcome } from './decision-outcome'

export interface QuantDecisionCalibrationSummary {
  readonly recordCount: number
  readonly trackedCount: number
  readonly observedCount: number
  readonly pendingCount: number
  readonly completedCount: number
  readonly unavailableCount: number
  readonly acceptedAiCount: number
  readonly unacceptedAiCount: number
  readonly alignedCount: number
  readonly opposedCount: number
  readonly flatCount: number
  readonly directionalSampleCount: number
  readonly averageChangePercent: number | null
  readonly recommendationAlignedCount: number
  readonly recommendationOpposedCount: number
  readonly recommendationFlatCount: number
  readonly recommendationNonDirectionalCount: number
  readonly recommendationDirectionalSampleCount: number
  readonly recommendationAgreementRate: number | null
}

export interface QuantDecisionCalibration {
  readonly summary: QuantDecisionCalibrationSummary
  readonly status: 'empty' | 'observed' | 'pending'
  readonly recommendationHeadline: string
  readonly bullish: QuantRecommendationSideCalibration
  readonly bearish: QuantRecommendationSideCalibration
  readonly recommendationOutcomes: readonly QuantRecommendationOutcome[]
}

export interface QuantRecommendationSideCalibration {
  readonly alignedCount: number
  readonly opposedCount: number
  readonly sampleCount: number
  readonly agreementRate: number | null
}

export interface QuantRecommendationOutcome {
  readonly baselineId: string
  readonly tsCode: string
  readonly name: string | null
  readonly recommendation: 'bullish' | 'bearish'
  readonly direction: 'up' | 'down'
  readonly changePercent: number
  readonly matched: boolean
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

const MIN_RECOMMENDATION_SAMPLE = 6

function agreementRate(aligned: number, opposed: number): number | null {
  const sample = aligned + opposed
  return sample >= MIN_RECOMMENDATION_SAMPLE ? round(aligned / sample * 100) : null
}

function sidePhrase(label: string, aligned: number, opposed: number): string {
  const sample = aligned + opposed
  if (!sample)
    return ''
  const rate = agreementRate(aligned, opposed)
  return rate === null
    ? `${label}方向样本 ${sample} 条，不足 ${MIN_RECOMMENDATION_SAMPLE} 条`
    : `${label}方向一致 ${aligned} / ${sample}（${rate.toFixed(0)}%）`
}

function recommendationHeadline(input: {
  readonly aligned: number
  readonly opposed: number
  readonly flat: number
  readonly nonDirectional: number
  readonly rate: number | null
  readonly bullishAligned: number
  readonly bullishOpposed: number
  readonly bearishAligned: number
  readonly bearishOpposed: number
}): string {
  const sample = input.aligned + input.opposed
  const excluded = [
    input.nonDirectional ? `观望 ${input.nonDirectional} 条` : '',
    input.flat ? `价格持平 ${input.flat} 条` : '',
  ].filter(Boolean).join('、')
  const exclusion = excluded ? `另有${excluded}不计入。` : ''
  const sides = [
    sidePhrase('看多', input.bullishAligned, input.bullishOpposed),
    sidePhrase('看空', input.bearishAligned, input.bearishOpposed),
  ].filter(Boolean).join('；')
  const sideSentence = sides ? `${sides}。` : ''
  if (input.rate === null)
    return `确定性建议方向样本 ${sample} 条，不足 ${MIN_RECOMMENDATION_SAMPLE} 条，不计算一致率。${sideSentence}${exclusion}这不是胜率。`
  return `确定性建议方向一致 ${input.aligned} / ${sample}（${input.rate.toFixed(0)}%）。${sideSentence}${exclusion}这不是胜率，也不是收益。`
}

export function buildQuantDecisionCalibration(
  records: readonly QuantDecisionRecord[],
  watchlist: readonly (Pick<WatchlistItem, 'tsCode' | 'latestClose' | 'latestTradeDate'> & { readonly name?: string | null })[],
): QuantDecisionCalibration {
  const byCode = new Map<string, QuantDecisionRecord[]>()
  for (const record of records)
    byCode.set(record.tsCode, [...(byCode.get(record.tsCode) || []), record])

  let trackedCount = 0
  let observedCount = 0
  let pendingCount = 0
  let completedCount = 0
  let unavailableCount = 0
  let alignedCount = 0
  let opposedCount = 0
  let flatCount = 0
  let totalChange = 0
  let changeCount = 0
  let acceptedAiCount = 0
  let unacceptedAiCount = 0
  let recommendationAlignedCount = 0
  let recommendationOpposedCount = 0
  let recommendationFlatCount = 0
  let recommendationNonDirectionalCount = 0
  let bullishAlignedCount = 0
  let bullishOpposedCount = 0
  let bearishAlignedCount = 0
  let bearishOpposedCount = 0
  const recommendationOutcomes: QuantRecommendationOutcome[] = []

  for (const [tsCode, history] of byCode) {
    for (const record of history) {
      if (record.snapshot.aiDecisionReview?.accepted)
        acceptedAiCount++
      else if (record.snapshot.aiDecisionReview)
        unacceptedAiCount++
    }
    const latest = watchlist.find(item => item.tsCode === tsCode)
    const outcome = buildDecisionOutcome(history, latest
      ? {
          price: finitePositive(latest.latestClose),
          observedAt: latest.latestTradeDate,
        }
      : null)
    trackedCount += outcome.trackedCount
    observedCount += outcome.entries.length
    pendingCount += outcome.pendingCount
    completedCount += outcome.completedCount
    if (outcome.status === 'empty' && history.some(record => record.action === 'plan-buy' || record.action === 'holding'))
      unavailableCount++
    for (const entry of outcome.entries) {
      totalChange += entry.changePercent
      changeCount++
      if (entry.direction === 'up')
        alignedCount++
      else if (entry.direction === 'down')
        opposedCount++
      else
        flatCount++
      const recommendation = history.find(record => record.id === entry.baselineId)?.snapshot.recommendation
      if (recommendation !== 'bullish' && recommendation !== 'bearish') {
        recommendationNonDirectionalCount++
        continue
      }
      if (entry.direction === 'flat') {
        recommendationFlatCount++
        continue
      }
      const matched = (recommendation === 'bullish' && entry.direction === 'up') || (recommendation === 'bearish' && entry.direction === 'down')
      if (recommendation === 'bullish') {
        if (matched)
          bullishAlignedCount++
        else
          bullishOpposedCount++
      }
      else if (matched) {
        bearishAlignedCount++
      }
      else {
        bearishOpposedCount++
      }
      if (matched)
        recommendationAlignedCount++
      else
        recommendationOpposedCount++
      recommendationOutcomes.push({
        baselineId: entry.baselineId,
        tsCode,
        name: watchlist.find(item => item.tsCode === tsCode)?.name ?? null,
        recommendation,
        direction: entry.direction,
        changePercent: entry.changePercent,
        matched,
      })
    }
  }

  const directionalSampleCount = alignedCount + opposedCount
  const recommendationDirectionalSampleCount = recommendationAlignedCount + recommendationOpposedCount
  const recommendationAgreementRate = agreementRate(recommendationAlignedCount, recommendationOpposedCount)
  const bullish = {
    alignedCount: bullishAlignedCount,
    opposedCount: bullishOpposedCount,
    sampleCount: bullishAlignedCount + bullishOpposedCount,
    agreementRate: agreementRate(bullishAlignedCount, bullishOpposedCount),
  }
  const bearish = {
    alignedCount: bearishAlignedCount,
    opposedCount: bearishOpposedCount,
    sampleCount: bearishAlignedCount + bearishOpposedCount,
    agreementRate: agreementRate(bearishAlignedCount, bearishOpposedCount),
  }
  const averageChangePercent = directionalSampleCount >= 3 && changeCount ? round(totalChange / changeCount) : null
  return {
    status: observedCount ? 'observed' : pendingCount ? 'pending' : 'empty',
    recommendationHeadline: recommendationHeadline({
      aligned: recommendationAlignedCount,
      opposed: recommendationOpposedCount,
      flat: recommendationFlatCount,
      nonDirectional: recommendationNonDirectionalCount,
      rate: recommendationAgreementRate,
      bullishAligned: bullishAlignedCount,
      bullishOpposed: bullishOpposedCount,
      bearishAligned: bearishAlignedCount,
      bearishOpposed: bearishOpposedCount,
    }),
    bullish,
    bearish,
    recommendationOutcomes: recommendationOutcomes.sort((left, right) => Number(left.matched) - Number(right.matched) || left.tsCode.localeCompare(right.tsCode) || left.baselineId.localeCompare(right.baselineId)),
    summary: {
      recordCount: records.length,
      trackedCount,
      observedCount,
      pendingCount,
      completedCount,
      unavailableCount,
      acceptedAiCount,
      unacceptedAiCount,
      alignedCount,
      opposedCount,
      flatCount,
      directionalSampleCount,
      averageChangePercent,
      recommendationAlignedCount,
      recommendationOpposedCount,
      recommendationFlatCount,
      recommendationNonDirectionalCount,
      recommendationDirectionalSampleCount,
      recommendationAgreementRate,
    },
  }
}
