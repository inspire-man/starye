// @vitest-environment happy-dom

import type { QuantDecisionRecord, QuantResearchRun } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantDecisionJournal from '../QuantDecisionJournal.vue'

const run = { id: 'run-1', tsCode: '601899.SH' } as QuantResearchRun

function record(overrides: Partial<QuantDecisionRecord> = {}): QuantDecisionRecord {
  return {
    id: 'decision-1',
    researchRunId: 'run-1',
    tsCode: '601899.SH',
    action: 'watch',
    note: '等待下一期财报',
    snapshot: {
      snapshotVersion: 'decision-record-v1',
      reportVersion: 'research-report-v2',
      generatedAt: '2026-08-29T00:00:00.000Z',
      recommendation: 'bullish',
      confidence: 82,
      coverage: 92,
      evidenceKeys: ['quality-roe'],
      currentPrice: 34.54,
      currentPriceObservedAt: '20260829',
      buyPriceRange: {
        low: 32.1,
        high: 33.6,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: 'deterministic-research',
        observedAt: '2026-08-29T00:00:00.000Z',
        evidenceKeys: ['quality-roe'],
      },
      sellPriceRange: null,
      aiDecisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 82,
        accepted: true,
        rejectionReason: null,
        factorReviewCoverage: 100,
        rationale: '正向证据占优。',
        invalidationConditions: ['趋势转弱后复核'],
        citedEvidenceKeys: ['quality-roe'],
      },
      aiFactorReviews: [],
      factorConfiguration: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        source: 'user',
        updatedAt: '2026-08-28T00:00:00.000Z',
      },
    },
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-30T00:05:00.000Z',
    ...overrides,
  }
}

const baseProps = {
  run,
  record: null,
  history: [],
  loading: false,
  historyLoading: false,
  saving: false,
  latestPrice: null,
  latestPriceObservedAt: null,
  loadErrorMessage: null,
  historyErrorMessage: null,
  saveErrorMessage: null,
  saveMessage: null,
}

describe('quant decision journal', () => {
  it('shows the four actions and a server-backed snapshot history', () => {
    const current = record()
    const wrapper = mount(QuantDecisionJournal, {
      props: { ...baseProps, record: current, history: [current] },
    })

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('继续观察')
    expect(wrapper.text()).toContain('计划买入')
    expect(wrapper.text()).toContain('已持有')
    expect(wrapper.text()).toContain('已卖出')
    expect(wrapper.text()).toContain('看多')
    expect(wrapper.text()).toContain('34.54')
    expect(wrapper.text()).toContain('32.10 - 33.60')
    expect(wrapper.text()).toContain('已纳入推荐')
    expect(wrapper.text()).toContain('等待下一期财报')
    expect(wrapper.findAll('.quant-decision-history-row')).toHaveLength(1)
  })

  it('hydrates the current record and emits the edited action and note', async () => {
    const wrapper = mount(QuantDecisionJournal, {
      props: { ...baseProps, record: record() },
    })

    expect((wrapper.get('input[value="watch"]').element as HTMLInputElement).checked).toBe(true)
    await wrapper.get('input[value="plan-buy"]').setValue(true)
    await wrapper.get('textarea').setValue('等回撤到参考买入区间')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toEqual([['plan-buy', '等回撤到参考买入区间']])
  })

  it('exposes loading and saving states through status text and disabled controls', () => {
    const wrapper = mount(QuantDecisionJournal, {
      props: { ...baseProps, loading: true, saving: true },
    })

    expect(wrapper.text()).toContain('正在读取本次决策记录')
    expect(wrapper.text()).toContain('保存中')
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps entered values visible when saving fails', async () => {
    const wrapper = mount(QuantDecisionJournal, { props: baseProps })

    await wrapper.get('input[value="holding"]').setValue(true)
    await wrapper.get('textarea').setValue('先记录实际持有状态')
    await wrapper.setProps({ saveErrorMessage: '保存失败，请稍后重试' })

    expect((wrapper.get('input[value="holding"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('先记录实际持有状态')
    expect(wrapper.get('[role="alert"]').text()).toContain('保存失败，请稍后重试')
  })
})
