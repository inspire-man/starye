// @vitest-environment happy-dom

import type { CandidateItem, QuantDecisionRecord, WatchlistItem } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantDecisionQueue from '../QuantDecisionQueue.vue'

function record(overrides: Partial<QuantDecisionRecord> = {}): QuantDecisionRecord {
  return {
    id: 'decision-1',
    researchRunId: 'run-1',
    tsCode: '601899.SH',
    action: 'plan-buy',
    note: null,
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: '2026-08-29T00:00:00.000Z',
      recommendation: 'bullish',
      confidence: 82,
      coverage: 92,
      evidenceKeys: [],
      currentPrice: 34.54,
      currentPriceObservedAt: '20260829',
      buyPriceRange: null,
      sellPriceRange: null,
      aiDecisionReview: null,
      aiFactorReviews: [],
      factorConfiguration: null,
    },
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-30T00:05:00.000Z',
    ...overrides,
  }
}

const candidate = {
  id: 'candidate-1',
  tsCode: '601899.SH',
  factorVersion: 'momentum-v1',
  name: '紫金矿业',
  score: 4,
  close: 34.57,
  changePercent: 1,
  ma5: 34,
  ma20: 33,
  return20: 0.02,
  newHigh20: false,
  upStreak: 1,
  volumeRatio: 1,
  relativeStrength: 1,
  signals: [],
  missingFactors: [],
  quality: 'ready',
} as CandidateItem

const watchlist = [{
  id: 'watch-1',
  tsCode: '601899.SH',
  name: '紫金矿业',
  latestClose: 34.57,
  latestTradeDate: '20260830',
  latestChangePercent: 0,
  barCount: 100,
  createdAt: null,
}] as WatchlistItem[]

const baseProps = {
  records: [],
  candidates: [],
  watchlist,
  candidateTradeDate: '20260830',
  loading: false,
  errorMessage: null,
}

describe('quant decision queue', () => {
  it('shows the latest action and emits a detail focus request', async () => {
    const wrapper = mount(QuantDecisionQueue, {
      props: { ...baseProps, records: [record()], candidates: [candidate] },
    })

    expect(wrapper.text()).toContain('决策待办')
    expect(wrapper.text()).toContain('计划买入')
    expect(wrapper.text()).toContain('看多')
    expect(wrapper.text()).toContain('已有新日线')
    expect(wrapper.text()).toContain('34.54 元')
    expect(wrapper.text()).toContain('34.57 元')

    await wrapper.get('.candidate-decision-queue-row').trigger('click')
    expect(wrapper.emitted('focus')).toEqual([['601899.SH']])
  })

  it('exposes loading, error, and empty states without changing the surrounding contract', () => {
    const loading = mount(QuantDecisionQueue, { props: { ...baseProps, loading: true } })
    expect(loading.text()).toContain('正在读取决策待办')

    const error = mount(QuantDecisionQueue, { props: { ...baseProps, errorMessage: '队列读取失败' } })
    expect(error.get('[role="alert"]').text()).toContain('队列读取失败')

    const empty = mount(QuantDecisionQueue, { props: baseProps })
    expect(empty.text()).toContain('还没有保存的决策')
  })

  it('shows same-day observations without fabricating a percentage', () => {
    const wrapper = mount(QuantDecisionQueue, {
      props: { ...baseProps, candidateTradeDate: '20260829', records: [record()], candidates: [candidate] },
    })
    expect(wrapper.text()).toContain('等待新日线')
    expect(wrapper.text()).toContain('暂不计算价格变化')
  })
})
