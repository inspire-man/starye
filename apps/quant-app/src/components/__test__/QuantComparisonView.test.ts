// @vitest-environment happy-dom

import type { CandidateItem } from '../../lib/quant-view-models'
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

function baseProps(overrides: Partial<QuantComparisonViewProps> = {}): QuantComparisonViewProps {
  const noop = () => {}
  return {
    selectedCandidateItems: [candidate],
    comparisonLoading: false,
    comparisonValuations: {},
    comparisonFinancials: {},
    comparisonErrors: {},
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
})
