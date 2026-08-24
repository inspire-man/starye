export type ResearchReviewState = 'overdue' | 'today' | 'upcoming' | 'scheduled' | 'unscheduled'
export type CandidateReviewFilter = 'all' | 'overdue' | 'today' | 'upcoming'
export type ResearchReviewTone = 'danger' | 'warning' | 'info' | 'neutral'

export interface ResearchReviewMeta {
  state: ResearchReviewState
  label: string
  detail: string
  tone: ResearchReviewTone
  date: string | null
}

const REVIEW_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

function parseDateOnly(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return null
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    return null
  return timestamp
}

export function normalizeReviewDate(value: string | null): string | null {
  return parseDateOnly(value) === null ? null : value
}

export function getTodayDate(value = new Date()): string {
  if (Number.isNaN(value.getTime()))
    return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizedToday(value: string): string {
  return normalizeReviewDate(value) || getTodayDate()
}

export function getResearchReviewState(reviewDate: string | null, today = getTodayDate()): ResearchReviewState {
  const dateTimestamp = parseDateOnly(normalizeReviewDate(reviewDate))
  if (dateTimestamp === null)
    return 'unscheduled'

  const todayTimestamp = parseDateOnly(normalizedToday(today))
  if (todayTimestamp === null)
    return 'unscheduled'

  const daysUntilReview = Math.round((dateTimestamp - todayTimestamp) / DAY_MS)
  if (daysUntilReview < 0)
    return 'overdue'
  if (daysUntilReview === 0)
    return 'today'
  if (daysUntilReview <= REVIEW_WINDOW_DAYS)
    return 'upcoming'
  return 'scheduled'
}

export function getReviewDueRank(state: ResearchReviewState): number {
  return {
    overdue: 0,
    today: 1,
    upcoming: 2,
    scheduled: 3,
    unscheduled: 4,
  }[state]
}

export function getResearchReviewMeta(reviewDate: string | null, today = getTodayDate()): ResearchReviewMeta {
  const date = normalizeReviewDate(reviewDate)
  const state = getResearchReviewState(date, today)
  if (state === 'overdue') {
    return { state, label: '已逾期', detail: `复查日 ${date}，建议优先核对`, tone: 'danger', date }
  }
  if (state === 'today') {
    return { state, label: '今日复查', detail: '今天需要重新核对', tone: 'warning', date }
  }
  if (state === 'upcoming') {
    return { state, label: '即将到期', detail: `复查日 ${date}`, tone: 'warning', date }
  }
  if (state === 'scheduled') {
    return { state, label: '已排期', detail: `复查日 ${date}`, tone: 'info', date }
  }
  return { state, label: '未设置', detail: '尚未设置复查日期', tone: 'neutral', date: null }
}
