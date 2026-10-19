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
      watchlist: [watchlistItem],
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

  it('shows open holdings and does not treat an unwatched stock as research', async () => {
    const wrapper = mountView()
    await wrapper.setProps({
      holdings: {
        '000001.SZ': { name: '测试股票', openQuantity: 500, cost: 24.7881, dividendCash: 144, realizedPnl: 0 },
        '600989.SH': { name: '宝丰能源', openQuantity: 200, cost: 30.7075, dividendCash: 182.42, realizedPnl: 0 },
      },
    })
    const steps = wrapper.findAll('.holding-step')
    expect(steps[0]?.text()).toContain('宝丰能源')
    expect(steps[1]?.text()).toContain('测试股票')
    expect(steps[1]?.text()).toContain('500 股')
    expect(steps[1]?.text()).toContain('不是收益结论')
    const watched = wrapper.get('[aria-label="打开 测试股票 的研究"]')
    expect(wrapper.get('[aria-label="宝丰能源 不在观察池"]').text()).toContain('打不开研究详情')
    await wrapper.get('[aria-label="把 宝丰能源 加入观察池"]').trigger('click')
    expect(wrapper.emitted('addHolding')?.[0]).toEqual([{ tsCode: '600989.SH', name: '宝丰能源' }])
    await wrapper.get('[aria-label="为 宝丰能源 记一笔"]').trigger('click')
    expect(wrapper.emitted('recordFill')?.[0]).toEqual(['600989.SH'])
    await watched.trigger('click')
    expect(wrapper.emitted('selectStock')?.[0]).toEqual([{ tsCode: '000001.SZ', name: '测试股票' }])
  })

  it('keeps the data-health action as an explicit parent event', async () => {
    const wrapper = mountView()
    const action = wrapper.find('.data-health-action')

    expect(action.exists()).toBe(true)
    await action.trigger('click')

    expect(wrapper.emitted('runDataHealthAction')).toEqual([['refresh-daily']])
    expect(wrapper.find('[aria-label="数据健康状态"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('历史时机样本审计')
    expect(wrapper.text()).toContain('尚未运行后台研究')
  })

  it('shows the latest scheduled research run without trading copy', async () => {
    const wrapper = mountView()
    await wrapper.setProps({
      scheduledResearch: {
        id: 'job-1',
        status: 'completed',
        dueCount: 1,
        processedCount: 1,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        startedAt: '2026-09-13T00:00:00.000Z',
        completedAt: '2026-09-13T00:01:00.000Z',
        items: [{
          tsCode: candidate.tsCode,
          name: candidate.name,
          reasons: ['overdue'],
          stage: 'completed',
          aiStatus: 'skipped',
          errorStage: null,
          errorCode: null,
          researchRunId: 'run-1',
          reviewDateBefore: '2026-09-01',
          reviewDateAfter: '2026-09-20',
        }],
      },
    })
    expect(wrapper.text()).toContain('后台定时研究')
    expect(wrapper.text()).toContain('已逾期')
    expect(wrapper.text()).not.toContain('买入')
    expect(wrapper.text()).not.toContain('卖出')
  })

  it('shows changed daily evidence on the scan list and the focus row', async () => {
    const wrapper = mountView()
    await wrapper.setProps({
      invalidationChecks: [
        {
          tsCode: candidate.tsCode,
          name: candidate.name,
          triggeredCount: 1,
          recoveredCount: 0,
          unchangedCount: 3,
          unavailableCount: 0,
          uncheckedCount: 10,
          label: '1 条日线证据转弱',
          checks: [
            { key: 'trend-ma20', label: '收盘价 / MA20', savedStatus: 'pass', currentStatus: 'fail', change: 'triggered' },
            { key: 'trend-return20', label: '20 日收益', savedStatus: 'pass', currentStatus: 'pass', change: 'unchanged' },
          ],
        },
        {
          tsCode: '600900.SH',
          name: '长江电力',
          triggeredCount: 0,
          recoveredCount: 0,
          unchangedCount: 4,
          unavailableCount: 0,
          uncheckedCount: 10,
          label: '可对照的日线证据未转弱',
          checks: [],
        },
      ],
    })

    expect(wrapper.text()).toContain('收盘价 / MA20转弱')
    expect(wrapper.text()).toContain('其余 1 只未转弱')
    expect(wrapper.text()).not.toContain('长江电力')
    expect(wrapper.get('.focus-stock').text()).toContain('收盘价 / MA20已转弱')
    expect(wrapper.text()).not.toContain('买入')
    expect(wrapper.text()).not.toContain('卖出')
  })
})
