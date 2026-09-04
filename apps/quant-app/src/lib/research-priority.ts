import type { CandidateItem, ResearchMarkerStatus } from './quant-view-models'
import { getResearchReviewMeta } from './research-review'

export type ResearchPriorityLevel = 'urgent' | 'high' | 'normal' | 'low'
export type ResearchPriorityAction = 'complete-data' | 'review' | 'check-risk' | 'check-value' | 'continue-research' | 'observe' | 'defer'
export type ResearchPriorityTone = 'danger' | 'warning' | 'info' | 'positive' | 'neutral'
export type ResearchPriorityValueQualityStatus = 'ready' | 'partial' | 'insufficient_data'

export interface ResearchPriorityMetadata {
  status: ResearchMarkerStatus
  reviewDate: string | null
}

export interface ResearchPriorityValueQuality {
  score: number | null
  status: ResearchPriorityValueQualityStatus
  riskDeduction: number
}

export interface ResearchPriorityBreakdown {
  dataGap: number
  review: number
  risk: number
  valueQuality: number
  persistence: number
  marker: number
}

export interface ResearchPriority {
  level: ResearchPriorityLevel
  levelLabel: string
  action: ResearchPriorityAction
  actionLabel: string
  tone: ResearchPriorityTone
  score: number
  reasons: readonly string[]
  breakdown: ResearchPriorityBreakdown
  reviewState: ReturnType<typeof getResearchReviewMeta>['state']
  markerStatus: ResearchMarkerStatus
}

export interface ResearchPriorityInput {
  candidate: CandidateItem
  metadata?: ResearchPriorityMetadata
  /** undefined means the batch result is not loaded; null means this stock has no usable result. */
  valueQuality?: ResearchPriorityValueQuality | null
  today?: string
}

export interface ResearchPrioritySummary {
  total: number
  urgent: number
  dataGap: number
  review: number
  risk: number
  valueQuality: number
  continueResearch: number
  highest: ResearchPriorityLevel | null
}

const LEVEL_RANK: Record<ResearchPriorityLevel, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
}

const LEVEL_LABEL: Record<ResearchPriorityLevel, string> = {
  urgent: '先补齐',
  high: '优先处理',
  normal: '常规研究',
  low: '低优先',
}

const SCORE_BASE: Record<ResearchPriorityLevel, number> = {
  urgent: 76,
  high: 50,
  normal: 25,
  low: 0,
}

const ACTION_TONE: Record<ResearchPriorityAction, ResearchPriorityTone> = {
  'complete-data': 'warning',
  'review': 'warning',
  'check-risk': 'danger',
  'check-value': 'info',
  'continue-research': 'positive',
  'observe': 'neutral',
  'defer': 'neutral',
}

const MAX_SCORE = 100

function clamp(value: number, minimum = 0, maximum = MAX_SCORE): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value))
    target.push(value)
}

function defaultMetadata(metadata?: ResearchPriorityMetadata): ResearchPriorityMetadata {
  return metadata || { status: 'unreviewed', reviewDate: null }
}

function factorLabel(value: string): string {
  return {
    ma5: '短线趋势',
    ma20: '20 日均线',
    new_high_20: '20 日新高',
    continuation: '连续上涨',
    volume_ratio: '成交活跃度',
    relative_strength: '池内强度',
  }[value] || value
}

function dataGapReason(candidate: CandidateItem): string | null {
  if (candidate.pendingSync)
    return candidate.pendingReason || '尚未进入最新候选快照，先更新日线数据'
  if (candidate.quality === 'ready')
    return null
  if (candidate.missingFactors.length)
    return `候选数据不完整，缺少 ${candidate.missingFactors.map(factor => factorLabel(factor)).join('、')}`
  return '候选日线数据不足，先更新数据'
}

function riskReasons(candidate: CandidateItem): string[] {
  const reasons: string[] = []
  if (candidate.changePercent !== null && candidate.changePercent <= -3)
    reasons.push('近日日线回撤达到 3%')
  if (candidate.upStreak !== null && candidate.upStreak >= 5)
    reasons.push('连续上涨达到 5 日')
  if (candidate.volumeRatio !== null && candidate.volumeRatio >= 2)
    reasons.push('成交活跃度达到 2 倍')
  if (candidate.persistence?.state === 'weakening')
    reasons.push(`信号减弱，相邻分数 ${formatScoreDelta(candidate.persistence.scoreDelta)}`)
  return reasons
}

function formatScoreDelta(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return '暂无变化'
  return (value >= 0 ? '+' : '') + value
}

function reviewReason(reviewState: ResearchPriority['reviewState'], reviewDate: string | null): string | null {
  if (reviewState === 'overdue')
    return `复查已逾期${reviewDate ? `（${reviewDate}）` : ''}`
  if (reviewState === 'today')
    return '今天需要复查'
  if (reviewState === 'upcoming')
    return `近 7 日需要复查${reviewDate ? `（${reviewDate}）` : ''}`
  return null
}

function valueQualityReason(valueQuality: ResearchPriorityValueQuality | null | undefined): { concern: boolean, reason: string | null, points: number } {
  if (valueQuality === undefined)
    return { concern: false, reason: null, points: 0 }
  if (valueQuality === null)
    return { concern: true, reason: '价值质量尚未形成可比较结果', points: 14 }
  if (valueQuality.status !== 'ready' || valueQuality.score === null)
    return { concern: true, reason: '价值质量数据不完整，先补看估值和财务字段', points: 14 }
  if (valueQuality.score < 50)
    return { concern: true, reason: `价值质量 ${valueQuality.score.toFixed(1)} 分，先核对低分维度`, points: 11 }
  if (valueQuality.riskDeduction >= 5)
    return { concern: true, reason: `价值质量含 ${valueQuality.riskDeduction.toFixed(1)} 分风险扣分`, points: 8 }
  if (valueQuality.riskDeduction > 0)
    return { concern: false, reason: `价值质量有 ${valueQuality.riskDeduction.toFixed(1)} 分风险扣分`, points: 3 }
  return { concern: false, reason: null, points: 0 }
}

function persistenceReason(candidate: CandidateItem): { reason: string | null, points: number } {
  const persistence = candidate.persistence
  if (!persistence)
    return { reason: null, points: 0 }
  if (persistence.state === 'weakening')
    return { reason: `信号减弱，相邻分数 ${formatScoreDelta(persistence.scoreDelta)}`, points: 8 }
  if (persistence.state === 'first_seen')
    return { reason: '信号首次出现，先确认是否可重复', points: 4 }
  if (persistence.state === 'confirming')
    return { reason: `信号已持续出现 ${persistence.appearanceCount} / ${persistence.sampleSize} 次`, points: 2 }
  if (persistence.state === 'insufficient_history')
    return { reason: '信号历史不足，暂不判断持续性', points: 1 }
  return { reason: null, points: 0 }
}

function markerReason(status: ResearchMarkerStatus): string | null {
  return {
    priority: '已标记为重点关注',
    paused: '已标记为暂缓研究',
    excluded: '已标记为已排除',
    unreviewed: null,
  }[status]
}

function chooseAction(
  candidate: CandidateItem,
  metadata: ResearchPriorityMetadata,
  reviewState: ResearchPriority['reviewState'],
  risk: readonly string[],
  valueConcern: boolean,
): ResearchPriorityAction {
  if (dataGapReason(candidate))
    return 'complete-data'
  if (metadata.status === 'excluded' || metadata.status === 'paused')
    return 'defer'
  if (reviewState === 'overdue' || reviewState === 'today')
    return 'review'
  if (risk.length)
    return 'check-risk'
  if (valueConcern)
    return 'check-value'
  if (reviewState === 'upcoming')
    return 'review'
  if (metadata.status === 'priority' || (candidate.score ?? 0) >= 2 || ['first_seen', 'confirming'].includes(candidate.persistence?.state || ''))
    return 'continue-research'
  return 'observe'
}

function actionLabel(action: ResearchPriorityAction, markerStatus: ResearchMarkerStatus): string {
  if (action === 'complete-data')
    return '补齐数据'
  if (action === 'review')
    return '优先复查'
  if (action === 'check-risk')
    return '核对风险'
  if (action === 'check-value')
    return '补看价值质量'
  if (action === 'continue-research')
    return '继续研究'
  if (action === 'defer')
    return markerStatus === 'excluded' ? '已排除' : '暂缓研究'
  return '先观察'
}

function actionLevel(action: ResearchPriorityAction, reviewState: ResearchPriority['reviewState']): ResearchPriorityLevel {
  if (action === 'complete-data')
    return 'urgent'
  if (action === 'check-risk' || (action === 'review' && (reviewState === 'overdue' || reviewState === 'today')))
    return 'high'
  if (action === 'continue-research' || action === 'check-value' || (action === 'review' && reviewState === 'upcoming'))
    return 'normal'
  return 'low'
}

function markerPoints(status: ResearchMarkerStatus, hasDataGap: boolean): number {
  if (hasDataGap)
    return 0
  return { priority: 8, paused: -18, excluded: -30, unreviewed: 0 }[status]
}

export function getResearchPriorityLevelRank(level: ResearchPriorityLevel): number {
  return LEVEL_RANK[level]
}

export function compareResearchPriorities(left: ResearchPriority, right: ResearchPriority): number {
  const levelDifference = getResearchPriorityLevelRank(right.level) - getResearchPriorityLevelRank(left.level)
  if (levelDifference !== 0)
    return levelDifference
  return right.score - left.score
}

export function buildResearchPriority(input: ResearchPriorityInput): ResearchPriority {
  const metadata = defaultMetadata(input.metadata)
  const review = getResearchReviewMeta(metadata.reviewDate, input.today)
  const dataReason = dataGapReason(input.candidate)
  const risks = riskReasons(input.candidate)
  const value = valueQualityReason(input.valueQuality)
  const persistence = persistenceReason(input.candidate)
  const hasDataGap = dataReason !== null
  const action = chooseAction(input.candidate, metadata, review.state, risks, value.concern)
  const level = actionLevel(action, review.state)
  const reviewPoints = { overdue: 30, today: 26, upcoming: 15, scheduled: 4, unscheduled: 0 }[review.state]
  const dataGapPoints = hasDataGap ? 80 : 0
  const riskPoints = Math.min(24, risks.length * 6)
  const marker = markerPoints(metadata.status, hasDataGap)
  const breakdown = {
    dataGap: dataGapPoints,
    review: reviewPoints,
    risk: riskPoints,
    valueQuality: value.points,
    persistence: persistence.points,
    marker,
  } satisfies ResearchPriorityBreakdown
  const supportingPoints = reviewPoints + riskPoints + value.points + persistence.points + Math.max(marker, 0)
  const score = action === 'complete-data'
    ? MAX_SCORE
    : Math.round(clamp(SCORE_BASE[level] + Math.min(24, supportingPoints * 0.5)))
  const reasons: string[] = []

  if (dataReason)
    addUnique(reasons, dataReason)
  if (action === 'defer' || metadata.status === 'priority')
    addUnique(reasons, markerReason(metadata.status) || '')
  if (reviewReason(review.state, review.date))
    addUnique(reasons, reviewReason(review.state, review.date) || '')
  for (const reason of risks)
    addUnique(reasons, reason)
  if (value.reason)
    addUnique(reasons, value.reason)
  if (persistence.reason)
    addUnique(reasons, persistence.reason)
  if (!reasons.length && metadata.status === 'unreviewed')
    addUnique(reasons, '暂无到期、风险或强信号依据，保持观察')

  return {
    level,
    levelLabel: LEVEL_LABEL[level],
    action,
    actionLabel: actionLabel(action, metadata.status),
    tone: ACTION_TONE[action],
    score,
    reasons: reasons.slice(0, 3),
    breakdown,
    reviewState: review.state,
    markerStatus: metadata.status,
  }
}

export function summarizeResearchPriorities(priorities: readonly ResearchPriority[]): ResearchPrioritySummary {
  const levels = priorities.map(priority => getResearchPriorityLevelRank(priority.level))
  return {
    total: priorities.length,
    urgent: priorities.filter(priority => priority.level === 'urgent').length,
    dataGap: priorities.filter(priority => priority.action === 'complete-data').length,
    review: priorities.filter(priority => priority.action === 'review').length,
    risk: priorities.filter(priority => priority.action === 'check-risk').length,
    valueQuality: priorities.filter(priority => priority.action === 'check-value').length,
    continueResearch: priorities.filter(priority => priority.action === 'continue-research').length,
    highest: levels.length ? priorities[levels.indexOf(Math.max(...levels))]?.level ?? null : null,
  }
}
