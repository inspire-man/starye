// @vitest-environment happy-dom

import type { QuantDecisionRecord, QuantDecisionRecordAction } from '../../lib/quant-types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantDecisionOutcome from '../QuantDecisionOutcome.vue'

function record(id: string, action: QuantDecisionRecordAction, price: number | null, observedAt: string): QuantDecisionRecord {
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
      aiDecisionReview: null,
      factorConfiguration: null,
    },
    createdAt: observedAt,
    updatedAt: observedAt,
  }
}

describe('quant decision outcome', () => {
  it('shows a sold pairing and keeps the actual-return boundary visible', () => {
    const wrapper = mount(QuantDecisionOutcome, {
      props: {
        history: [record('sold', 'sold', 12, '20260910'), record('buy', 'plan-buy', 10, '20260901')],
        latestPrice: 13,
        latestPriceObservedAt: '20260912',
      },
    })

    expect(wrapper.text()).toContain('已有卖出配对')
    expect(wrapper.text()).toContain('已卖出配对')
    expect(wrapper.text()).toContain('+20.00%')
    expect(wrapper.text()).toContain('不等同于实际收益')
    expect(wrapper.text()).toContain('实际成交价')
  })

  it('shows a current daily-bar observation for an open plan', () => {
    const wrapper = mount(QuantDecisionOutcome, {
      props: {
        history: [record('buy', 'plan-buy', 20, '20260901')],
        latestPrice: 18,
        latestPriceObservedAt: '20260908',
      },
    })

    expect(wrapper.text()).toContain('已有后续观察')
    expect(wrapper.text()).toContain('当前最新日线')
    expect(wrapper.text()).toContain('-10.00%')
  })

  it('shows an honest empty state without fabricating a percentage', () => {
    const wrapper = mount(QuantDecisionOutcome, {
      props: {
        history: [record('watch', 'watch', 10, '20260901')],
        latestPrice: 11,
        latestPriceObservedAt: '20260908',
      },
    })

    expect(wrapper.text()).toContain('暂无可回看')
    expect(wrapper.text()).toContain('先记录“计划买入”或“已持有”')
    expect(wrapper.text()).not.toContain('%')
  })
})
