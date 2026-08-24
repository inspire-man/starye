import { describe, expect, it } from 'vitest'
import { getResearchReviewMeta, getResearchReviewState, getTodayDate, normalizeReviewDate } from '../research-review'

describe('research review dates', () => {
  it('categorizes review dates relative to a stable reference date', () => {
    expect(getResearchReviewState('2026-08-23', '2026-08-24')).toBe('overdue')
    expect(getResearchReviewState('2026-08-24', '2026-08-24')).toBe('today')
    expect(getResearchReviewState('2026-08-31', '2026-08-24')).toBe('upcoming')
    expect(getResearchReviewState('2026-09-01', '2026-08-24')).toBe('scheduled')
    expect(getResearchReviewState(null, '2026-08-24')).toBe('unscheduled')
  })

  it('rejects malformed calendar dates instead of treating them as due', () => {
    expect(normalizeReviewDate('2026-02-30')).toBeNull()
    expect(getResearchReviewState('2026-02-30', '2026-08-24')).toBe('unscheduled')
    expect(getResearchReviewMeta(null, '2026-08-24')).toMatchObject({
      state: 'unscheduled',
      label: '未设置',
      tone: 'neutral',
      date: null,
    })
  })

  it('formats the actionable states for the queue and detail drawer', () => {
    expect(getResearchReviewMeta('2026-08-23', '2026-08-24')).toMatchObject({
      state: 'overdue',
      label: '已逾期',
      tone: 'danger',
      date: '2026-08-23',
    })
    expect(getResearchReviewMeta('2026-08-27', '2026-08-24')).toMatchObject({
      state: 'upcoming',
      label: '即将到期',
      tone: 'warning',
    })
  })

  it('formats the current date without depending on locale output', () => {
    expect(getTodayDate(new Date(2026, 7, 24))).toBe('2026-08-24')
  })
})
