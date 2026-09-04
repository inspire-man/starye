import type { CandidateItem } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { getCandidateAction } from '../candidate-action'

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

describe('candidate research action', () => {
  it('shows a pending sync action for a newly added watchlist stock', () => {
    expect(getCandidateAction(candidate({ pendingSync: true, pendingReason: '先更新观察池' }))).toMatchObject({
      action: 'complete-data',
      label: '待更新数据',
      detail: '先更新观察池',
    })
  })

  it('asks for missing data before interpreting a candidate', () => {
    expect(getCandidateAction(candidate({ quality: 'partial', score: 5 }))).toMatchObject({
      action: 'complete-data',
      label: '补齐数据',
      tone: 'neutral',
    })
  })

  it('puts risk checks before a strong signal conclusion', () => {
    expect(getCandidateAction(candidate({ score: 5, changePercent: -3.2, upStreak: 6, volumeRatio: 2.4 }))).toMatchObject({
      action: 'check-risk',
      label: '先核对风险',
      tone: 'warning',
      detail: '短线回撤、连续上涨、成交放大，先核对波动原因',
    })
  })

  it('turns complete multi-signal candidates into a research action', () => {
    expect(getCandidateAction(candidate({ score: 2 }))).toMatchObject({
      action: 'continue-research',
      label: '继续研究',
      tone: 'positive',
    })
  })

  it('keeps low-signal candidates in observation', () => {
    expect(getCandidateAction(candidate({ score: 1, signals: ['ma20'] }))).toMatchObject({
      action: 'observe',
      label: '先观察',
      tone: 'info',
    })
  })
})
