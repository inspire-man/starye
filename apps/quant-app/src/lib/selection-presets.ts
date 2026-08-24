import type { CandidateItem, ResearchMarkerStatus } from './quant-types'
import { getResearchReviewState, getReviewDueRank, getTodayDate, normalizeReviewDate } from './research-review'

export type SelectionPresetKey = 'all' | 'balanced' | 'trend' | 'risk'
export type CandidateSortKey = 'score' | 'return20' | 'volumeRatio' | 'relativeStrength' | 'researchPriority'
export type { CandidateReviewFilter } from './research-review'
export type CandidateResearchStatus = 'all' | ResearchMarkerStatus

export interface CandidateResearchMetadata {
  status: ResearchMarkerStatus
  reviewDate: string | null
}

export interface CandidateQuery {
  preset: SelectionPresetKey
  minScore: number
  completeOnly: boolean
  sortBy: CandidateSortKey
  researchStatus: CandidateResearchStatus
  reviewDue?: import('./research-review').CandidateReviewFilter
}

export interface SelectionPreset {
  key: SelectionPresetKey
  label: string
  description: string
  detail: string
}

export const selectionPresets: readonly SelectionPreset[] = [
  {
    key: 'balanced',
    label: '推荐观察',
    description: '先看数据完整、至少命中 2 个信号，且没有明显回撤或过热的标的。',
    detail: '适合第一次打开工作台时使用，先缩小范围，再核对估值和财务质量。',
  },
  {
    key: 'trend',
    label: '趋势跟随',
    description: '优先站上 20 日均线、创新高或相对强度较高，并且至少有 2 个信号。',
    detail: '适合寻找走势更主动的标的，仍需留意连续上涨和成交放大提示。',
  },
  {
    key: 'risk',
    label: '风险过滤',
    description: '排除明显回撤、连续上涨过久和成交异常放大的标的。',
    detail: '适合先做风险排查；通过这里只代表值得继续研究，不代表更安全。',
  },
  {
    key: 'all',
    label: '全部候选',
    description: '保留观察池中所有候选，适合检查被预设排除的标的。',
    detail: '不做额外筛选，仍建议先确认数据完整，再查看风险提示。',
  },
] as const

function hasSignal(item: CandidateItem, signal: string): boolean {
  return item.signals.includes(signal)
}

function hasPullback(item: CandidateItem): boolean {
  return item.changePercent !== null && item.changePercent <= -3
}

function isStretched(item: CandidateItem): boolean {
  return item.upStreak !== null && item.upStreak >= 5
}

function hasAbnormalVolume(item: CandidateItem): boolean {
  return item.volumeRatio !== null && item.volumeRatio >= 2
}

function hasTrendSignal(item: CandidateItem): boolean {
  return hasSignal(item, 'ma20') || hasSignal(item, 'new_high_20') || hasSignal(item, 'relative_strength')
}

export function matchesSelectionPreset(item: CandidateItem, preset: SelectionPresetKey): boolean {
  if (preset === 'all')
    return true

  if (item.quality !== 'ready')
    return false

  if (preset === 'balanced')
    return (item.score ?? 0) >= 2 && !hasPullback(item) && !isStretched(item)

  if (preset === 'trend')
    return hasTrendSignal(item) && (item.score ?? 0) >= 2

  return !hasPullback(item) && !isStretched(item) && !hasAbnormalVolume(item)
}

export function filterCandidatesBySelectionPreset(items: readonly CandidateItem[], preset: SelectionPresetKey): CandidateItem[] {
  return items.filter(item => matchesSelectionPreset(item, preset))
}

function compareDescending(left: number | null, right: number | null): number {
  if (left === null && right === null)
    return 0
  if (left === null)
    return 1
  if (right === null)
    return -1
  return right - left
}

function researchStatusRank(status: ResearchMarkerStatus): number {
  return {
    priority: 0,
    unreviewed: 1,
    paused: 2,
    excluded: 3,
  }[status]
}

function compareReviewDate(left: string | null, right: string | null): number {
  const leftDate = normalizeReviewDate(left)
  const rightDate = normalizeReviewDate(right)
  if (leftDate === null && rightDate === null)
    return 0
  if (leftDate === null)
    return 1
  if (rightDate === null)
    return -1
  return leftDate.localeCompare(rightDate)
}

function compareResearchPriority(
  left: CandidateItem,
  right: CandidateItem,
  researchMetadataByCode: ReadonlyMap<string, CandidateResearchMetadata>,
  today: string,
): number {
  const leftMetadata = researchMetadataByCode.get(left.tsCode) ?? { status: 'unreviewed' as const, reviewDate: null }
  const rightMetadata = researchMetadataByCode.get(right.tsCode) ?? { status: 'unreviewed' as const, reviewDate: null }
  const dueDifference = getReviewDueRank(getResearchReviewState(leftMetadata.reviewDate, today)) - getReviewDueRank(getResearchReviewState(rightMetadata.reviewDate, today))
  if (dueDifference !== 0)
    return dueDifference
  const statusDifference = researchStatusRank(leftMetadata.status) - researchStatusRank(rightMetadata.status)
  if (statusDifference !== 0)
    return statusDifference
  return compareReviewDate(leftMetadata.reviewDate, rightMetadata.reviewDate)
}

export function filterAndSortCandidates(
  items: readonly CandidateItem[],
  query: CandidateQuery,
  researchMetadataByCode: ReadonlyMap<string, CandidateResearchMetadata> = new Map(),
  today = getTodayDate(),
): CandidateItem[] {
  return [...items
    .filter((item) => {
      if (!matchesSelectionPreset(item, query.preset))
        return false
      if (query.completeOnly && item.quality !== 'ready')
        return false
      if (query.researchStatus !== 'all' && (researchMetadataByCode.get(item.tsCode)?.status ?? 'unreviewed') !== query.researchStatus)
        return false
      if (query.reviewDue && query.reviewDue !== 'all' && getResearchReviewState(researchMetadataByCode.get(item.tsCode)?.reviewDate ?? null, today) !== query.reviewDue)
        return false
      return (item.score ?? -1) >= query.minScore
    })].sort((left: CandidateItem, right: CandidateItem) => {
    const primary = query.sortBy === 'researchPriority'
      ? compareResearchPriority(left, right, researchMetadataByCode, today)
      : compareDescending(left[query.sortBy], right[query.sortBy])
    if (primary !== 0)
      return primary
    const score = compareDescending(left.score, right.score)
    if (score !== 0)
      return score
    return left.tsCode.localeCompare(right.tsCode)
  })
}

export function getSelectionReasons(item: CandidateItem, preset: SelectionPresetKey): string[] {
  if (preset === 'all')
    return ['未使用额外筛选']

  const reasons: string[] = []
  if (item.quality === 'ready')
    reasons.push('数据完整')
  if ((item.score ?? 0) >= 2)
    reasons.push(`命中 ${item.score} 个信号`)
  if (preset === 'trend' && hasTrendSignal(item))
    reasons.push('趋势条件成立')
  if (preset === 'risk') {
    if (!hasPullback(item))
      reasons.push('未触发短线回撤')
    if (!isStretched(item))
      reasons.push('未连续上涨过久')
    if (!hasAbnormalVolume(item))
      reasons.push('成交未明显异常')
  }
  return reasons
}
