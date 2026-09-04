// @vitest-environment happy-dom

import type { CandidateItem } from '../../lib/quant-view-models'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import QuantAiCandidateBriefing from '../QuantAiCandidateBriefing.vue'
import QuantCandidatesView from '../QuantCandidatesView.vue'

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

const secondCandidate = { ...candidate, id: 'candidate-2', tsCode: '600000.SH', name: '第二只' }

const priority = {
  level: 'normal' as const,
  levelLabel: '常规研究',
  action: 'continue-research' as const,
  actionLabel: '继续研究',
  tone: 'positive' as const,
  score: 30,
  reasons: ['有信号'],
  breakdown: { dataGap: 0, review: 0, risk: 0, valueQuality: 0, persistence: 2, marker: 0 },
  reviewState: 'unscheduled' as const,
  markerStatus: 'unreviewed' as const,
}

function mountView() {
  return shallowMount(QuantCandidatesView, {
    props: {
      candidateFilter: 'balanced',
      candidateMinScore: 0,
      candidateCompleteOnly: false,
      candidateSort: 'researchPriority',
      candidateResearchStatus: 'all',
      candidateReviewDue: 'all',
      watchCode: '',
      watchName: '',
      candidateItems: [candidate, secondCandidate],
      snapshot: {
        id: 'snapshot-1',
        factorVersion: 'momentum-v1',
        generatedAt: '2026-09-03T00:00:00.000Z',
        fromDate: '20260801',
        toDate: '20260903',
        candidates: [candidate, secondCandidate],
      },
      scannedCandidateCount: 2,
      pendingCandidateCount: 0,
      watchlist: [{
        id: 'watch-1',
        tsCode: candidate.tsCode,
        name: candidate.name,
        latestClose: 10,
        latestChangePercent: 1.2,
        latestTradeDate: '20260903',
        barCount: 10,
        createdAt: '2026-09-03T00:00:00.000Z',
      }],
      adding: false,
      candidateFilterOptions: [{
        key: 'balanced',
        label: '推荐观察',
        description: '推荐候选',
        detail: '推荐候选',
        icon: defineComponent({ template: '<span />' }),
      }],
      candidateSortOptions: [{ value: 'researchPriority', label: '研究优先' }],
      candidateResearchStatusOptions: [{ value: 'all', label: '全部状态' }],
      candidateReviewDueOptions: [{ value: 'all', label: '全部复查' }],
      candidateQueryActive: false,
      filteredCandidateItems: [candidate, secondCandidate],
      activeCandidatePreset: {
        key: 'balanced',
        label: '推荐观察',
        description: '推荐候选',
        detail: '推荐候选',
      },
      signalRuleCount: 6,
      candidateEvidenceSummary: { ready: 1, partial: 1, missing: 0, unavailable: 0 },
      valueQualityLoading: false,
      valueQualityError: false,
      automatedResearchDisplayCandidates: [],
      automatedResearchStates: {},
      automatedResearchRunning: false,
      automatedResearchAiReady: null,
      automatedResearchAiConfigErrorMessage: null,
      automatedResearchErrorMessage: null,
      researchPriorityTotal: 1,
      researchPriorityHighestLabel: '常规研究',
      researchPrioritySummary: {
        total: 1,
        urgent: 0,
        dataGap: 0,
        review: 0,
        risk: 0,
        valueQuality: 0,
        continueResearch: 1,
        highest: 'normal',
      },
      visibleResearchPriorityQueue: [{ item: candidate, priority }],
      decisionQueueRecords: [],
      decisionQueueLoading: false,
      decisionQueueErrorMessage: null,
      candidateAiBriefing: null,
      candidateBriefingScopeItemsCount: 2,
      candidateAiBriefingScopeCount: null,
      candidateBriefingScopeKey: '000001.SZ|600000.SH',
      currentCandidateCodes: [candidate.tsCode, secondCandidate.tsCode],
      candidateAiBriefingHistoryResetKey: 0,
      candidateAiBriefingAvailable: true,
      candidateAiBriefingLoading: false,
      candidateAiBriefingErrorMessage: null,
      candidateAiBriefingConfigurationError: false,
      candidateAiBriefingQuestionInput: '',
      candidateAiBriefingQuestion: null,
      candidateAiBriefingQuestionLoading: false,
      candidateAiBriefingQuestionErrorMessage: null,
      candidateAiBriefingQuestionConfigurationError: false,
      candidateAiBriefingCopying: false,
      candidateAiBriefingCopyOutcome: null,
      candidateAiBriefingCopyMessage: '',
      candidateColumns: [{ key: 'tsCode', label: '代码' }],
      candidatesLoading: false,
      selectedCandidateIds: new Set([candidate.id, secondCandidate.id]),
      selectedCandidateItems: [candidate, secondCandidate],
      canCompareCandidates: true,
      candidateEvidenceFor: () => ({
        tsCode: candidate.tsCode,
        formulaVersion: 'candidate-evidence-v1',
        status: 'ready',
        score: 100,
        coveredMetricCount: 5,
        totalMetricCount: 5,
        completeDimensionCount: 5,
        partialDimensionCount: 0,
        missingDimensionCount: 0,
        dimensions: [],
        missingReasons: [],
        summary: '证据充分',
      }),
      candidatePersistenceLabel: () => '持续确认',
      candidatePersistenceClass: () => 'candidate-persistence-confirming',
      candidatePersistenceDetail: () => '持续确认',
      candidatePriorityFor: () => priority,
      researchPriorityDetail: () => '有信号',
      researchPriorityClass: () => 'research-priority-normal',
      researchPriorityActionClass: () => 'research-priority-action-positive',
      valueQualityFor: () => null,
      valueQualityStatusLabel: () => '暂无评分',
      valueQualityStatusClass: () => 'value-quality-status-muted',
      valueQualitySummary: () => '暂无评分',
      researchReviewFor: () => ({ state: 'unscheduled', label: '待研究', date: null, detail: '待研究', tone: 'neutral' }),
      researchMarkerMap: new Map(),
      displayStockName: item => item.name || item.tsCode,
    },
  })
}

describe('quant candidates view', () => {
  it('forwards filter models and comparison actions', async () => {
    const wrapper = mountView()

    await wrapper.get('select').setValue('2')
    expect(wrapper.emitted('update:candidateMinScore')?.at(-1)).toEqual([2])

    await wrapper.get('.compare-button').trigger('click')
    expect(wrapper.emitted('openComparisonDrawer')).toHaveLength(1)

    await wrapper.get('.candidate-clear-button').trigger('click')
    expect(wrapper.emitted('clearCandidateSelection')).toHaveLength(1)
  })

  it('keeps candidate table selection and AI question input as separate events', async () => {
    const wrapper = mountView()
    const dataTable = wrapper.findComponent({ name: 'DataTable' })

    dataTable.vm.$emit('toggle-select', candidate.id)
    expect(wrapper.emitted('toggleCandidateSelection')).toEqual([[candidate.id]])

    const briefing = wrapper.findComponent(QuantAiCandidateBriefing)
    briefing.vm.$emit('update:question-input', '先核对什么？')
    expect(wrapper.emitted('updateCandidateAiBriefingQuestionInput')).toEqual([['先核对什么？']])
  })

  it('exposes the nested question prompt bridge', () => {
    const wrapper = mountView()
    expect(typeof (wrapper.vm as unknown as { useQuestionPrompt: (value: string) => void }).useQuestionPrompt).toBe('function')
  })
})
