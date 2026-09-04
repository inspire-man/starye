// @vitest-environment happy-dom

import type { CandidateItem, WatchlistItem } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { buildQuantDataHealth } from '../../lib/data-health'
import { buildWatchlistEnvironment } from '../../lib/watchlist-environment'
import QuantOverviewView from '../QuantOverviewView.vue'

const candidate: CandidateItem = {
  id: 'candidate-1',
  tsCode: '000001.SZ',
  factorVersion: 'momentum-v1',
  name: '测试股票',
  score: 3,
  close: 10,
  changePercent: 1.2,
  ma5: 9.8,
  ma20: 9.4,
  return20: 4.5,
  newHigh20: true,
  upStreak: 2,
  volumeRatio: 1.1,
  relativeStrength: 0.8,
  signals: ['ma20'],
  missingFactors: [],
  quality: 'ready',
  persistence: {
    sampleSize: 2,
    appearanceCount: 2,
    persistenceRate: 1,
    latestScore: 3,
    previousScore: 2,
    scoreDelta: 1,
    scoreChange: 1,
    state: 'confirming',
    factorPersistence: [],
    evidence: [],
  },
}

const watchlistItem: WatchlistItem = {
  id: 'watch-1',
  tsCode: candidate.tsCode,
  name: candidate.name,
  latestClose: 10,
  latestChangePercent: 1.2,
  latestTradeDate: '20260903',
  barCount: 120,
  createdAt: '2026-09-03T00:00:00.000Z',
}

function mountView() {
  const dataHealthSummary = buildQuantDataHealth({
    watchlist: [watchlistItem],
    sync: null,
    syncLoading: false,
    syncError: false,
    valueSelection: null,
    valueLoading: false,
    valueError: false,
    shareholderReturns: null,
    shareholderLoading: false,
    shareholderError: false,
  })
  const watchlistEnvironment = buildWatchlistEnvironment({
    watchlist: [watchlistItem],
    candidates: [candidate],
  })

  return mount(QuantOverviewView, {
    props: {
      pageBusy: false,
      candidatesLoading: false,
      watchlistCount: 1,
      upCount: 1,
      downCount: 0,
      signalCandidateCount: 1,
      dataCoverageLabel: '1 / 1',
      latestWatchlistDate: '2026-09-03',
      dataHealthSummary,
      watchlistEnvironment,
      topCandidates: [candidate],
      riskItems: [{ key: 'clear', tone: 'neutral', title: '暂未触发提示', detail: '风险提示只基于当前已保存的日线数据' }],
      dataHealthStatusClass: status => `status-${status}`,
      dataHealthStatusLabel: status => status,
      dataHealthFreshnessClass: freshness => `freshness-${freshness}`,
      dataHealthSummaryClass: status => `summary-${status}`,
      environmentStatusClass: status => `environment-${status}`,
      formatEnvironmentRatio: value => value === null ? '--' : `${Math.round(value * 100)}%`,
      formatDateTime: value => value || '--',
      focusTone: () => 'focus-tone-neutral',
      displayStockName: item => item.name || item.tsCode,
      focusSignal: () => '继续研究',
      formatSignalScore: value => value === null ? '--' : `${value} / 6`,
      signalScorePercent: value => value === null ? 0 : value / 6 * 100,
      candidateRiskTone: () => 'neutral',
      riskToneClass: tone => `risk-${tone}`,
      riskLabel: () => '暂未触发提示',
      researchPriorityDetail: () => '研究优先级 30 分',
    },
  })
}

describe('quant overview view', () => {
  it('emits navigation and stock selection from overview actions', async () => {
    const wrapper = mountView()

    await wrapper.get('.focus-row').trigger('click')
    await wrapper.get('.research-path-card').trigger('click')

    expect(wrapper.emitted('selectStock')).toEqual([[candidate]])
    expect(wrapper.emitted('navigate')).toEqual([['candidates']])
  })

  it('keeps the data-health action as an explicit parent event', async () => {
    const wrapper = mountView()
    const action = wrapper.find('.data-health-action')

    expect(action.exists()).toBe(true)
    await action.trigger('click')

    expect(wrapper.emitted('runDataHealthAction')).toEqual([['open-watchlist']])
    expect(wrapper.find('[aria-label="数据健康状态"]').exists()).toBe(true)
  })
})
