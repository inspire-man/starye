// @vitest-environment happy-dom

import type { QuantAiDecisionReview, QuantDecisionRecord, QuantDecisionRecordAction } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiOutcomeCalibration from '../QuantAiOutcomeCalibration.vue'

function record(id: string, action: QuantDecisionRecordAction, price: number, observedAt: string, accepted = true): QuantDecisionRecord {
  const review: QuantAiDecisionReview | null = action === 'plan-buy'
    ? {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 70,
        accepted,
        rejectionReason: accepted ? null : 'low-confidence',
        factorReviewCoverage: accepted ? 100 : 0,
        rationale: '测试复核',
        invalidationConditions: ['测试条件'],
        citedEvidenceKeys: ['trend-sample'],
      }
    : null
  return {
    id,
    researchRunId: `run-${id}`,
    tsCode: '601899.SH',
    action,
    note: null,
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: observedAt,
      recommendation: 'watch',
      confidence: null,
      coverage: null,
      evidenceKeys: [],
      currentPrice: price,
      currentPriceObservedAt: observedAt,
      buyPriceRange: null,
      sellPriceRange: null,
      aiDecisionReview: review,
      aiFactorReviews: [],
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

describe('quantAiOutcomeCalibration', () => {
  it('renders observed direction checks and the reliability boundary', () => {
    const wrapper = mount(QuantAiOutcomeCalibration, {
      props: {
        history: [record('observation', 'watch', 12, '20260910'), record('baseline', 'plan-buy', 10, '20260901')],
        latestPrice: null,
        latestPriceObservedAt: null,
      },
    })

    expect(wrapper.text()).toContain('AI 结果校准')
    expect(wrapper.text()).toContain('方向一致')
    expect(wrapper.text()).toContain('样本不足')
    expect(wrapper.text()).toContain('不代表实际成交收益')
  })

  it('renders an honest empty state when AI was not accepted', () => {
    const wrapper = mount(QuantAiOutcomeCalibration, {
      props: {
        history: [record('rejected', 'plan-buy', 10, '20260901', false)],
        latestPrice: 12,
        latestPriceObservedAt: '20260910',
      },
    })

    expect(wrapper.text()).toContain('暂无样本')
    expect(wrapper.text()).toContain('先完成一次达到纳入条件的 AI 复核')
    expect(wrapper.text()).not.toContain('方向一致率')
  })
})
