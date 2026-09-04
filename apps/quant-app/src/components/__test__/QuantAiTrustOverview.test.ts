// @vitest-environment happy-dom

import type { CandidateItem, QuantAiDecisionReview, QuantDecisionRecord, QuantDecisionRecordAction, WatchlistItem } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiTrustOverview from '../QuantAiTrustOverview.vue'

function record(accepted: boolean): QuantDecisionRecord {
  const observedAt = '20260901'
  const aiReview: QuantAiDecisionReview = {
    decisionVersion: 'ai-decision-v1',
    recommendation: 'bullish',
    confidence: 72,
    accepted,
    rejectionReason: accepted ? null : 'low-confidence',
    factorReviewCoverage: accepted ? 100 : 0,
    rationale: '测试复核',
    invalidationConditions: ['测试条件'],
    citedEvidenceKeys: ['trend-sample'],
  }
  const action: QuantDecisionRecordAction = 'plan-buy'
  return {
    id: accepted ? 'accepted' : 'rejected',
    researchRunId: 'run-1',
    tsCode: '601899.SH',
    action,
    note: null,
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: observedAt,
      recommendation: 'bullish',
      confidence: 80,
      coverage: 100,
      evidenceKeys: [],
      currentPrice: 10,
      currentPriceObservedAt: observedAt,
      buyPriceRange: null,
      sellPriceRange: null,
      aiDecisionReview: aiReview,
      aiFactorReviews: [],
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

const watchlist: WatchlistItem[] = [{
  id: 'watch-1',
  tsCode: '601899.SH',
  name: '紫金矿业',
  latestClose: 11,
  latestTradeDate: '20260902',
  latestChangePercent: null,
  barCount: 100,
  createdAt: null,
}]

const candidate = {
  id: 'candidate-1',
  tsCode: '601899.SH',
  factorVersion: 'momentum-v1',
  name: '紫金矿业',
  score: 4,
  close: 11,
  changePercent: 1,
  ma5: 10,
  ma20: 10,
  return20: 0.02,
  newHigh20: false,
  upStreak: 1,
  volumeRatio: 1,
  relativeStrength: 1,
  signals: [],
  missingFactors: [],
  quality: 'ready',
} as CandidateItem

describe('quantAiTrustOverview', () => {
  it('renders the cross-stock AI state and opens the existing detail flow', async () => {
    const wrapper = mount(QuantAiTrustOverview, {
      props: {
        records: [record(true)],
        candidates: [candidate],
        watchlist,
        candidateTradeDate: '20260902',
        loading: false,
        errorMessage: null,
      },
    })

    expect(wrapper.text()).toContain('AI 信任总览')
    expect(wrapper.text()).toContain('方向一致')
    expect(wrapper.text()).toContain('样本不足 3 条')
    expect(wrapper.text()).toContain('AI 影响分差未保存')

    await wrapper.get('.quant-ai-trust-overview-row').trigger('click')
    expect(wrapper.emitted('focus')).toEqual([['601899.SH']])
  })

  it('keeps loading, error, and no-decision states explicit', () => {
    const baseProps = {
      records: [],
      candidates: [candidate],
      watchlist,
      candidateTradeDate: '20260902',
      loading: false,
      errorMessage: null,
    }
    expect(mount(QuantAiTrustOverview, { props: { ...baseProps, loading: true } }).text()).toContain('正在读取 AI 决策状态')
    expect(mount(QuantAiTrustOverview, { props: { ...baseProps, errorMessage: '队列读取失败' } }).text()).toContain('队列读取失败')
    expect(mount(QuantAiTrustOverview, { props: baseProps }).text()).toContain('还没有保存的决策')
    expect(mount(QuantAiTrustOverview, { props: { ...baseProps, records: [record(false)] } }).text()).toContain('未纳入 AI')
  })
})
