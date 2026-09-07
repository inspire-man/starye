// @vitest-environment happy-dom

import type { CandidateItem } from '../../lib/quant-view-models'
import type { TimingHistory } from '../../lib/timing-history'
import type { QuantComparisonViewProps } from '../QuantComparisonView.vue'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { idleBatchAiSummaryState } from '../../lib/research-batch-ai-summary'
import QuantComparisonView from '../QuantComparisonView.vue'

const candidate: CandidateItem = {
  id: 'candidate-1',
  tsCode: '601899.SH',
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
}

const tbeaCandidate: CandidateItem = {
  ...candidate,
  id: 'candidate-2',
  tsCode: '600089.SH',
  name: '特变电工',
  score: 4,
}

const timingHistory: TimingHistory = {
  availableBars: 482,
  evaluatedWindows: 21,
  forwardDays: 20,
  samplingInterval: 20,
  minimumReliableSampleSize: 6,
  dataStartDate: '20240909',
  dataEndDate: '20260904',
  evaluationStartDate: '20241203',
  evaluationEndDate: '20260806',
  currentState: 'weak',
  currentLabel: '趋势走弱',
  observations: [],
  baseline: {
    sampleSize: 21,
    positiveCount: 13,
    positiveRate: 13 / 21,
    positiveRateLower: 0.37,
    positiveRateUpper: 0.85,
    averageForwardReturn20: 0.01,
    medianForwardReturn20: 0.02,
  },
  buckets: [{
    state: 'weak',
    label: '趋势走弱',
    sampleSize: 9,
    positiveCount: 6,
    positiveRate: 2 / 3,
    positiveRateLower: 0.3,
    positiveRateUpper: 0.9,
    positiveRateLift: 0.0476,
    averageForwardReturn20: -0.005,
    averageForwardReturn20Delta: -0.015,
    medianForwardReturn20: 0.0336,
    medianForwardReturn20Delta: 0.0136,
    bestForwardReturn20: 0.08,
    worstForwardReturn20: -0.14,
    sampleQuality: 'limited',
    edgeAssessment: 'indeterminate',
  }],
}

const insufficientTimingHistory: TimingHistory = {
  ...timingHistory,
  availableBars: 79,
  evaluatedWindows: 0,
  currentState: 'insufficient',
  currentLabel: '数据不足',
  evaluationStartDate: null,
  evaluationEndDate: null,
  observations: [],
  baseline: {
    sampleSize: 0,
    positiveCount: 0,
    positiveRate: null,
    positiveRateLower: null,
    positiveRateUpper: null,
    averageForwardReturn20: null,
    medianForwardReturn20: null,
  },
  buckets: [],
}

const insufficientSampleTimingHistory: TimingHistory = {
  ...timingHistory,
  buckets: [{
    ...timingHistory.buckets[0]!,
    sampleSize: 5,
    positiveCount: 4,
    positiveRate: 0.8,
    positiveRateLower: 0.38,
    positiveRateUpper: 0.96,
    positiveRateLift: 0.18,
    sampleQuality: 'insufficient',
    edgeAssessment: 'insufficient',
  }],
}

function baseProps(overrides: Partial<QuantComparisonViewProps> = {}): QuantComparisonViewProps {
  const noop = () => {}
  return {
    selectedCandidateItems: [candidate],
    comparisonLoading: false,
    comparisonValuations: {},
    comparisonFinancials: {},
    comparisonErrors: {},
    comparisonTimingHistories: { [candidate.tsCode]: timingHistory },
    comparisonDailyLoading: { [candidate.tsCode]: false },
    comparisonDailyErrors: { [candidate.tsCode]: false },
    comparisonResearchButtonLabel: '批量生成研究',
    canCompareCandidates: true,
    comparisonResearchRunning: false,
    comparisonResearchSummary: {
      total: 1,
      success: 0,
      error: 0,
      running: 0,
      pending: 0,
      completed: 0,
      started: false,
      historyLoading: 0,
      historyError: 0,
    },
    comparisonResearchExportReady: false,
    comparisonResearchExporting: false,
    comparisonResearchCopying: false,
    comparisonResearchCopyOutcome: null,
    comparisonResearchExportMessage: '',
    comparisonResearchExportError: false,
    comparisonResearchCopyMessage: '',
    comparisonResearchAiSummaryReady: false,
    comparisonResearchAiSummaryRunning: false,
    comparisonResearchAiSummaryButtonLabel: '批量生成 AI 摘要',
    comparisonResearchAiSummaryMessage: '',
    comparisonResearchAiSummaryError: false,
    comparisonResearchSummaryLabel: '尚未生成本批次研究报告',
    comparisonResearchSuccessfulRuns: [],
    comparisonAiComparisonReady: true,
    comparisonAiComparisonLoading: false,
    comparisonAiComparison: {
      comparisonVersion: 'research-comparison-v1',
      provider: 'openai_compatible',
      model: 'test-model',
      generatedAt: '2026-09-03T00:00:00.000Z',
      overview: '对比摘要',
      commonGround: [],
      differences: [{ tsCode: candidate.tsCode, point: '需要核对现金流', evidenceKeys: ['quality-cashflow'] }],
      risks: [],
      nextChecks: [],
      citedEvidence: [{ tsCode: candidate.tsCode, evidenceKey: 'quality-cashflow' }],
    },
    comparisonAiComparisonError: null,
    comparisonAiComparisonErrorMessage: 'AI 对比失败',
    comparisonAiComparisonExporting: false,
    comparisonAiComparisonCopying: false,
    comparisonAiComparisonExportMessage: '',
    comparisonAiComparisonExportError: false,
    comparisonAiComparisonCopyMessage: '',
    comparisonAiComparisonCopyOutcome: null,
    comparisonAiNextCheckPromptReady: false,
    comparisonAiComparisonCitations: [{ tsCode: candidate.tsCode, evidenceKey: 'quality-cashflow' }],
    comparisonResearchAiSummaryStateFor: () => idleBatchAiSummaryState(),
    comparisonResearchAiSummaryStatusLabel: () => '未生成',
    comparisonResearchAiSummaryStatusDetail: () => '点击上方按钮生成摘要',
    comparisonResearchStatusLabelFor: () => '未开始',
    comparisonResearchStatusDetailFor: () => '等待批量启动',
    comparisonResearchHistoryMetaFor: () => null,
    comparisonResearchActionFor: () => null,
    comparisonResearchHistoryErrorFor: () => null,
    comparisonResearchHistoryLoadingFor: () => false,
    comparisonResearchAiSummaryActionFor: () => null,
    comparisonResearchItemClass: () => 'comparison-research-item-idle',
    comparisonResearchStateFor: () => ({ status: 'idle', run: null, error: null }),
    displayStockName: item => item.name || item.tsCode,
    formatNumber: value => value === null ? '--' : value.toFixed(2),
    formatPercent: value => value === null ? '--' : `${value.toFixed(2)}%`,
    formatSignalScore: value => value === null ? '--' : `${value} / 6`,
    formatMetricPercent: value => value === null ? '--' : `${value.toFixed(2)}%`,
    formatTimingHistoryRate: value => value === null ? '--' : `${Math.round(value * 100)}%`,
    formatTimingHistoryPercent: value => value === null ? '--' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`,
    formatDateTime: value => value || '--',
    startBatchResearch: noop,
    downloadComparisonResearchReports: noop,
    copyComparisonResearchReports: noop,
    startBatchResearchAiSummary: noop,
    openBatchResearchResult: noop,
    retryBatchResearchItem: noop,
    retryComparisonResearchHistory: noop,
    retryComparisonResearchAiSummary: noop,
    generateComparisonAiComparison: noop,
    downloadComparisonAiComparison: noop,
    copyComparisonAiComparison: noop,
    openComparisonAiCitation: noop,
    useComparisonAiNextCheck: noop,
    ...overrides,
  }
}

describe('quant comparison view', () => {
  it('forwards batch research and AI comparison actions', async () => {
    const startBatchResearch = vi.fn()
    const generateComparisonAiComparison = vi.fn()
    const openComparisonAiCitation = vi.fn()
    const wrapper = shallowMount(QuantComparisonView, {
      props: baseProps({ startBatchResearch, generateComparisonAiComparison, openComparisonAiCitation }),
    })

    await wrapper.get('.comparison-research-button').trigger('click')
    expect(startBatchResearch).toHaveBeenCalledOnce()

    await wrapper.get('.comparison-ai-button').trigger('click')
    expect(generateComparisonAiComparison).toHaveBeenCalledOnce()

    await wrapper.get('.comparison-ai-inline-citation').trigger('click')
    expect(openComparisonAiCitation).toHaveBeenCalledWith({ tsCode: candidate.tsCode, evidenceKey: 'quality-cashflow' })
  })

  it('shows independent historical timing evidence in the comparison table', () => {
    const wrapper = shallowMount(QuantComparisonView, {
      props: baseProps(),
    })

    expect(wrapper.text()).toContain('历史时机回看')
    expect(wrapper.text()).toContain('482 根 · 21 截点')
    expect(wrapper.text()).toContain('趋势走弱')
    expect(wrapper.text()).toContain('67% / +4.76%')
    expect(wrapper.text()).toContain('有限参考')
    expect(wrapper.text()).toContain('区间重叠')
  })

  it('keeps timing history independent for the selected target columns', () => {
    const wrapper = shallowMount(QuantComparisonView, {
      props: baseProps({
        selectedCandidateItems: [candidate, tbeaCandidate],
        comparisonTimingHistories: {
          [candidate.tsCode]: timingHistory,
          [tbeaCandidate.tsCode]: { ...timingHistory, currentState: 'pullback_watch', currentLabel: '回撤观察' },
        },
        comparisonDailyLoading: { [candidate.tsCode]: false, [tbeaCandidate.tsCode]: false },
        comparisonDailyErrors: { [candidate.tsCode]: false, [tbeaCandidate.tsCode]: false },
      }),
    })

    expect(wrapper.text()).toContain('特变电工')
    expect(wrapper.text()).toContain('测试股票')
    expect(wrapper.text()).toContain('趋势走弱')
    expect(wrapper.text()).toContain('回撤观察')
  })

  it('keeps loading and source failure visible without filling missing values', () => {
    const loading = shallowMount(QuantComparisonView, {
      props: baseProps({
        comparisonTimingHistories: {},
        comparisonDailyLoading: { [candidate.tsCode]: true },
      }),
    })
    expect(loading.text()).toContain('读取中')

    const failed = shallowMount(QuantComparisonView, {
      props: baseProps({
        comparisonTimingHistories: {},
        comparisonDailyErrors: { [candidate.tsCode]: true },
      }),
    })
    expect(failed.text()).toContain('来源不可用')
    expect(failed.text()).toContain('全体上涨比例')
    expect(failed.text()).toContain('--')
  })

  it('labels insufficient history and small state samples separately', () => {
    const insufficient = shallowMount(QuantComparisonView, {
      props: baseProps({ comparisonTimingHistories: { [candidate.tsCode]: insufficientTimingHistory } }),
    })
    expect(insufficient.text()).toContain('数据不足')
    expect(insufficient.text()).toContain('79 根')

    const smallSample = shallowMount(QuantComparisonView, {
      props: baseProps({ comparisonTimingHistories: { [candidate.tsCode]: insufficientSampleTimingHistory } }),
    })
    expect(smallSample.text()).toContain('5 · 样本不足')
    expect(smallSample.text()).toContain('80% / +18.00%')
    expect(smallSample.text()).toContain('基准区间结论')
  })
})
