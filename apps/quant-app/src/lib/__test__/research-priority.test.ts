import type { CandidateItem } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildResearchPriority, compareResearchPriorities, summarizeResearchPriorities } from '../research-priority'

function candidate(overrides: Partial<CandidateItem> = {}): CandidateItem {
  return {
    id: 'candidate-1',
    tsCode: '601899.SH',
    factorVersion: 'momentum-v1',
    name: '紫金矿业',
    score: 3,
    close: 34.74,
    changePercent: 1.2,
    ma5: 34.2,
    ma20: 33.4,
    return20: 0.08,
    newHigh20: false,
    upStreak: 2,
    volumeRatio: 1.3,
    relativeStrength: 0.8,
    signals: ['ma20', 'volume_ratio', 'relative_strength'],
    missingFactors: [],
    quality: 'ready',
    ...overrides,
  }
}

describe('research priority', () => {
  it('puts a pending or incomplete candidate in the urgent data queue', () => {
    const result = buildResearchPriority({
      candidate: candidate({
        pendingSync: true,
        pendingReason: '尚未同步日线',
        quality: 'insufficient_data',
        score: null,
      }),
      metadata: { status: 'priority', reviewDate: '2026-08-24' },
      today: '2026-08-24',
    })

    expect(result).toMatchObject({
      level: 'urgent',
      action: 'complete-data',
      actionLabel: '补齐数据',
      breakdown: { dataGap: 80, marker: 0 },
    })
    expect(result.reasons).toEqual(expect.arrayContaining(['尚未同步日线', '已标记为重点关注']))
  })

  it('prioritizes overdue review before ordinary risk and research actions', () => {
    const result = buildResearchPriority({
      candidate: candidate({ changePercent: -4.2, upStreak: 6 }),
      metadata: { status: 'unreviewed', reviewDate: '2026-08-23' },
      today: '2026-08-24',
    })

    expect(result).toMatchObject({
      level: 'high',
      action: 'review',
      reviewState: 'overdue',
    })
    expect(result.reasons.slice(0, 2)).toEqual(['复查已逾期（2026-08-23）', '近日日线回撤达到 3%'])
  })

  it('uses risk checking when no review is due', () => {
    const result = buildResearchPriority({
      candidate: candidate({ volumeRatio: 2.4 }),
      metadata: { status: 'unreviewed', reviewDate: null },
      today: '2026-08-24',
    })

    expect(result).toMatchObject({
      level: 'high',
      action: 'check-risk',
      actionLabel: '核对风险',
    })
    expect(result.reasons).toContain('成交活跃度达到 2 倍')
  })

  it('does not treat an unloaded value score as a low-quality finding', () => {
    const unloaded = buildResearchPriority({
      candidate: candidate({ score: 1 }),
      metadata: { status: 'unreviewed', reviewDate: null },
      today: '2026-08-24',
    })
    const incomplete = buildResearchPriority({
      candidate: candidate({ score: 1 }),
      valueQuality: { status: 'insufficient_data', score: null, riskDeduction: 0 },
      metadata: { status: 'unreviewed', reviewDate: null },
      today: '2026-08-24',
    })

    expect(unloaded.action).toBe('observe')
    expect(unloaded.reasons).not.toContain('价值质量数据不完整，先补看估值和财务字段')
    expect(incomplete.action).toBe('check-value')
    expect(incomplete.reasons).toContain('价值质量数据不完整，先补看估值和财务字段')
  })

  it('makes weakening persistence a risk reason and keeps priority markers as tie-breakers', () => {
    const weakening = buildResearchPriority({
      candidate: candidate({
        persistence: {
          sampleSize: 4,
          appearanceCount: 3,
          persistenceRate: 0.75,
          latestScore: 2,
          previousScore: 4,
          scoreDelta: -2,
          scoreChange: -1,
          state: 'weakening',
          factorPersistence: [],
          evidence: [],
        },
      }),
      metadata: { status: 'unreviewed', reviewDate: null },
      today: '2026-08-24',
    })
    const priority = buildResearchPriority({
      candidate: candidate({ score: 1 }),
      metadata: { status: 'priority', reviewDate: null },
      today: '2026-08-24',
    })

    expect(weakening.action).toBe('check-risk')
    expect(weakening.reasons).toContain('信号减弱，相邻分数 -2')
    expect(priority.action).toBe('continue-research')
    expect(priority.breakdown.marker).toBe(8)
  })

  it('keeps the displayed score bands aligned with the action level', () => {
    const high = buildResearchPriority({
      candidate: candidate({ volumeRatio: 2.4 }),
      today: '2026-08-24',
    })
    const normal = buildResearchPriority({
      candidate: candidate({ score: 1 }),
      valueQuality: { status: 'insufficient_data', score: null, riskDeduction: 0 },
      today: '2026-08-24',
    })
    const low = buildResearchPriority({
      candidate: candidate({ score: 1 }),
      today: '2026-08-24',
    })

    expect(high.score).toBeGreaterThanOrEqual(50)
    expect(normal.score).toBeGreaterThanOrEqual(25)
    expect(normal.score).toBeLessThan(50)
    expect(low.score).toBeLessThan(25)
  })

  it('promotes a priority marker within the same research action', () => {
    const priority = buildResearchPriority({
      candidate: candidate({ score: 3 }),
      metadata: { status: 'priority', reviewDate: null },
      today: '2026-08-24',
    })
    const regular = buildResearchPriority({
      candidate: candidate({ score: 3 }),
      metadata: { status: 'unreviewed', reviewDate: null },
      today: '2026-08-24',
    })

    expect(priority.action).toBe('continue-research')
    expect(regular.action).toBe('continue-research')
    expect(priority.score).toBeGreaterThan(regular.score)
    expect(compareResearchPriorities(priority, regular)).toBeLessThan(0)
  })

  it('summarizes the actionable queue without inventing a count for empty input', () => {
    const priorities = [
      buildResearchPriority({ candidate: candidate({ pendingSync: true, quality: 'insufficient_data' }), today: '2026-08-24' }),
      buildResearchPriority({ candidate: candidate({ id: 'candidate-2', tsCode: '600089.SH', volumeRatio: 2.2 }), today: '2026-08-24' }),
    ]

    expect(summarizeResearchPriorities(priorities)).toMatchObject({
      total: 2,
      urgent: 1,
      dataGap: 1,
      risk: 1,
      highest: 'urgent',
    })
    expect(summarizeResearchPriorities([])).toMatchObject({
      total: 0,
      highest: null,
    })
  })
})
