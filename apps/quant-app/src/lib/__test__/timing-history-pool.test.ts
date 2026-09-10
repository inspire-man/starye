import type { DailyBar } from '../quant-view-models'
import type { TimingPoolTickerResult } from '../timing-history-pool'
import { describe, expect, it, vi } from 'vitest'
import {
  buildTickerTimingPoolResult,
  buildTimingPoolAudit,
  collectTimingPoolAudit,
  TIMING_POOL_MIN_CROSS_TICKER,
} from '../timing-history-pool'

function bars(count: number): DailyBar[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bar-${index}`,
    tsCode: '601899.SH',
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    open: 100 + index,
    high: 100 + index,
    low: 100 + index,
    close: 100 + index,
    preClose: null,
    change: null,
    changePercent: null,
    volume: 1,
    amount: null,
  }))
}

function ticker(overrides: Partial<TimingPoolTickerResult> & Pick<TimingPoolTickerResult, 'tsCode'>): TimingPoolTickerResult {
  return {
    name: overrides.name ?? overrides.tsCode,
    status: 'ready',
    availableBars: 120,
    evaluatedWindows: 3,
    currentState: 'constructive',
    currentLabel: '结构平稳',
    currentSampleSize: 8,
    currentEdgeAssessment: 'indeterminate',
    buckets: [
      { state: 'constructive', label: '结构平稳', sampleSize: 8, edgeAssessment: 'insufficient' },
      { state: 'pullback_watch', label: '回撤观察', sampleSize: 8, edgeAssessment: 'insufficient' },
      { state: 'extended', label: '短线偏热', sampleSize: 8, edgeAssessment: 'insufficient' },
      { state: 'weak', label: '趋势走弱', sampleSize: 8, edgeAssessment: 'insufficient' },
    ],
    ...overrides,
  }
}

function withEdge(count: number, edge: TimingPoolTickerResult['currentEdgeAssessment'], prefix: string): TimingPoolTickerResult[] {
  return Array.from({ length: count }, (_, index) => ticker({
    tsCode: `${prefix}${index}`,
    buckets: [
      { state: 'constructive', label: '结构平稳', sampleSize: 12, edgeAssessment: edge ?? 'insufficient' },
      { state: 'pullback_watch', label: '回撤观察', sampleSize: 0, edgeAssessment: 'insufficient' },
      { state: 'extended', label: '短线偏热', sampleSize: 0, edgeAssessment: 'insufficient' },
      { state: 'weak', label: '趋势走弱', sampleSize: 0, edgeAssessment: 'insufficient' },
    ],
  }))
}

describe('buildTickerTimingPoolResult', () => {
  it('keeps source failure separate from missing bars', () => {
    expect(buildTickerTimingPoolResult({ tsCode: '601899.SH', name: '紫金矿业' }, null, 'source-failed')).toMatchObject({
      status: 'source-failed',
      availableBars: null,
      evaluatedWindows: null,
      currentEdgeAssessment: null,
    })
    expect(buildTickerTimingPoolResult({ tsCode: '600089.SH', name: '特变电工' }, bars(79), 'insufficient-data')).toMatchObject({
      status: 'insufficient-data',
      availableBars: 79,
      currentEdgeAssessment: null,
    })
  })

  it('treats histories without a forward window as data gaps', () => {
    const result = buildTickerTimingPoolResult({ tsCode: '000001.SZ', name: '平安银行' }, bars(79), 'ready')
    expect(result.status).toBe('insufficient-data')
    expect(result.evaluatedWindows).toBe(0)
    expect(result.buckets.every(bucket => bucket.edgeAssessment === 'insufficient')).toBe(true)
  })
})

describe('buildTimingPoolAudit', () => {
  it('counts edge assessments by state and never invents a pooled win rate', () => {
    const audit = buildTimingPoolAudit([
      ...withEdge(2, 'supported', 'S'),
      ...withEdge(1, 'weaker', 'W'),
      ticker({ tsCode: 'FAIL', status: 'source-failed', availableBars: null, evaluatedWindows: null, buckets: [] }),
    ])

    expect(audit).toMatchObject({
      universeSize: 4,
      readyCount: 3,
      sourceFailedCount: 1,
      thresholdAdvice: 'hold-thresholds',
      thresholdAdviceLabel: '阈值保持不变',
    })
    expect(audit.states.find(state => state.state === 'constructive')).toMatchObject({
      supportedCount: 2,
      weakerCount: 1,
      consensus: 'insufficient-pool',
    })
    expect(audit).not.toHaveProperty('positiveRate')
    expect(JSON.stringify(audit)).not.toMatch(/买卖|看多|看空/)
  })

  it('keeps thresholds frozen even when one state has a supported consensus', () => {
    const audit = buildTimingPoolAudit(withEdge(TIMING_POOL_MIN_CROSS_TICKER, 'supported', 'S'))
    const constructive = audit.states.find(state => state.state === 'constructive')

    expect(constructive?.consensus).toBe('supported')
    expect(audit.thresholdAdvice).toBe('hold-thresholds')
    expect(audit.headline).toContain('仍不调整状态阈值')
  })

  it('marks mixed direction when supported and weaker both appear', () => {
    const audit = buildTimingPoolAudit([
      ...withEdge(4, 'supported', 'S'),
      ...withEdge(4, 'weaker', 'W'),
    ])

    expect(audit.states.find(state => state.state === 'constructive')?.consensus).toBe('mixed')
    expect(audit.headline).toContain('方向不一致')
    expect(audit.thresholdAdvice).toBe('hold-thresholds')
  })
})

describe('collectTimingPoolAudit', () => {
  it('loads bars concurrently and preserves failed names', async () => {
    const loadBars = vi.fn(async (tsCode: string) => {
      if (tsCode === 'FAIL.SH')
        throw new Error('upstream')
      return bars(tsCode === 'SHORT.SZ' ? 40 : 120)
    })

    const collection = await collectTimingPoolAudit([
      { tsCode: '601899.SH', name: '紫金矿业' },
      { tsCode: 'SHORT.SZ', name: '样本不足股' },
      { tsCode: 'FAIL.SH', name: '失败股' },
    ], loadBars, { concurrency: 2 })

    expect(collection.aborted).toBe(false)
    expect(collection.results.map(item => [item.tsCode, item.status])).toEqual([
      ['601899.SH', 'ready'],
      ['SHORT.SZ', 'insufficient-data'],
      ['FAIL.SH', 'source-failed'],
    ])
    expect(collection.audit.thresholdAdvice).toBe('hold-thresholds')
    expect(loadBars).toHaveBeenCalledTimes(3)
  })

  it('ignores in-flight results after the generation becomes stale', async () => {
    let current = true
    const loadBars = vi.fn(async () => {
      current = false
      return bars(120)
    })

    const collection = await collectTimingPoolAudit(
      [{ tsCode: '601899.SH', name: '紫金矿业' }],
      loadBars,
      { isCurrent: () => current },
    )

    expect(collection.aborted).toBe(true)
    expect(collection.results).toEqual([])
    expect(collection.audit.universeSize).toBe(0)
  })
})
