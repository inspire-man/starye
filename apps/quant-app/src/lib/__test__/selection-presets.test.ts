import type { CandidateItem } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { filterAndSortCandidates, filterCandidatesBySelectionPreset, getSelectionReasons, matchesSelectionPreset } from '../selection-presets'

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

describe('selection presets', () => {
  it('keeps newly added pending stocks visible in the default research view', () => {
    const pending = candidate({ pendingSync: true, quality: 'insufficient_data', score: 0 })
    expect(matchesSelectionPreset(pending, 'balanced')).toBe(true)
    expect(getSelectionReasons(pending, 'balanced')).toEqual(['已加入观察池，等待日线更新'])
  })

  it('keeps a balanced candidate with complete data and multiple signals', () => {
    expect(matchesSelectionPreset(candidate(), 'balanced')).toBe(true)
    expect(getSelectionReasons(candidate(), 'balanced')).toEqual(['数据完整', '命中 3 个信号'])
  })

  it('removes incomplete or overheated candidates from the balanced preset', () => {
    expect(matchesSelectionPreset(candidate({ quality: 'partial' }), 'balanced')).toBe(false)
    expect(matchesSelectionPreset(candidate({ upStreak: 5 }), 'balanced')).toBe(false)
    expect(matchesSelectionPreset(candidate({ changePercent: -3 }), 'balanced')).toBe(false)
  })

  it('requires a recognizable trend signal and at least two signals', () => {
    expect(matchesSelectionPreset(candidate({ signals: ['ma20'], score: 1 }), 'trend')).toBe(false)
    expect(matchesSelectionPreset(candidate({ signals: ['ma20', 'continuation'], score: 2 }), 'trend')).toBe(true)
    expect(getSelectionReasons(candidate({ signals: ['ma20', 'continuation'], score: 2 }), 'trend')).toContain('趋势条件成立')
  })

  it('filters risk signals without hiding the all-candidates view', () => {
    const items = [candidate(), candidate({ id: 'candidate-2', tsCode: '600089.SH', volumeRatio: 2.2 })]
    expect(filterCandidatesBySelectionPreset(items, 'risk')).toHaveLength(1)
    expect(filterCandidatesBySelectionPreset(items, 'all')).toHaveLength(2)
    expect(getSelectionReasons(candidate(), 'risk')).toEqual(['数据完整', '命中 3 个信号', '未触发短线回撤', '未连续上涨过久', '成交未明显异常'])
  })

  it('applies custom score and completeness filters before sorting', () => {
    const items = [
      candidate({ id: 'candidate-1', score: 4, return20: 0.02 }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH', score: 2, return20: 0.15 }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH', score: 4, quality: 'partial', return20: 0.3 }),
    ]

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 2,
      completeOnly: true,
      sortBy: 'return20',
      researchStatus: 'all',
    }).map(item => item.tsCode)).toEqual(['600089.SH', '601899.SH'])
  })

  it('keeps missing sort metrics after populated values and uses score as a tie-breaker', () => {
    const items = [
      candidate({ id: 'candidate-1', tsCode: '601899.SH', score: 2, volumeRatio: null }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH', score: 4, volumeRatio: 1.1 }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH', score: 3, volumeRatio: 1.1 }),
    ]

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'volumeRatio',
      researchStatus: 'all',
    }).map(item => item.tsCode)).toEqual(['600089.SH', '600938.SH', '601899.SH'])
  })

  it('filters by research status and treats missing markers as unreviewed', () => {
    const items = [
      candidate({ id: 'candidate-1', tsCode: '601899.SH' }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH' }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH' }),
    ]
    const statuses = new Map([
      ['600089.SH', { status: 'priority' as const, reviewDate: null }],
      ['600938.SH', { status: 'excluded' as const, reviewDate: null }],
    ])

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'score',
      researchStatus: 'priority',
    }, statuses).map(item => item.tsCode)).toEqual(['600089.SH'])
    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'score',
      researchStatus: 'unreviewed',
    }, statuses).map(item => item.tsCode)).toEqual(['601899.SH'])
  })

  it('sorts research priority by status, review date, and signal score', () => {
    const items = [
      candidate({ id: 'candidate-1', tsCode: '601899.SH', score: 3 }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH', score: 4 }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH', score: 2 }),
      candidate({ id: 'candidate-4', tsCode: '000001.SZ', score: 5 }),
    ]
    const metadata = new Map([
      ['601899.SH', { status: 'priority' as const, reviewDate: '2026-08-30' }],
      ['600089.SH', { status: 'priority' as const, reviewDate: '2026-08-23' }],
      ['600938.SH', { status: 'unreviewed' as const, reviewDate: '2026-08-24' }],
      ['000001.SZ', { status: 'excluded' as const, reviewDate: null }],
    ])

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'researchPriority',
      researchStatus: 'all',
    }, metadata, '2026-08-24').map(item => item.tsCode)).toEqual(['600089.SH', '600938.SH', '601899.SH', '000001.SZ'])
  })

  it('filters candidates by actionable review state', () => {
    const items = [
      candidate({ id: 'candidate-1', tsCode: '601899.SH' }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH' }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH' }),
    ]
    const metadata = new Map([
      ['601899.SH', { status: 'priority' as const, reviewDate: '2026-08-30' }],
      ['600089.SH', { status: 'priority' as const, reviewDate: '2026-08-23' }],
      ['600938.SH', { status: 'unreviewed' as const, reviewDate: '2026-08-24' }],
    ])

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'score',
      researchStatus: 'all',
      reviewDue: 'overdue',
    }, metadata, '2026-08-24').map(item => item.tsCode)).toEqual(['600089.SH'])
  })

  it('sorts candidates by the external value-quality score when available', () => {
    const items = [
      candidate({ id: 'candidate-1', tsCode: '601899.SH' }),
      candidate({ id: 'candidate-2', tsCode: '600089.SH' }),
      candidate({ id: 'candidate-3', tsCode: '600938.SH' }),
    ]

    expect(filterAndSortCandidates(items, {
      preset: 'all',
      minScore: 0,
      completeOnly: false,
      sortBy: 'valueQuality',
      researchStatus: 'all',
      valueQualityByCode: new Map([
        ['601899.SH', 58],
        ['600089.SH', null],
        ['600938.SH', 76],
      ]),
    }).map(item => item.tsCode)).toEqual(['600938.SH', '601899.SH', '600089.SH'])
  })
})
