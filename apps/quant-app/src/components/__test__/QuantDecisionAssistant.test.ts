// @vitest-environment happy-dom

import type { QuantDecisionAssistant, QuantResearchRun } from '../../lib/quant-types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantDecisionAssistantPanel from '../QuantDecisionAssistant.vue'

const run = { id: 'run-1', tsCode: '601899.SH', name: '紫金矿业' } as QuantResearchRun

const baseProps = {
  run,
  latestClose: 33.2,
  latestTradeDate: '20260829',
  assessment: null,
  history: [],
  loading: false,
  generating: false,
  errorMessage: null,
  aiConfigAvailable: true,
}

function assessment(overrides: Partial<QuantDecisionAssistant> = {}): QuantDecisionAssistant {
  return {
    id: 'assessment-1',
    snapshotVersion: 'decision-assistant-v1',
    tsCode: '601899.SH',
    name: '紫金矿业',
    researchRunId: 'run-1',
    assessedAt: '2026-08-30T01:00:00.000Z',
    createdAt: '2026-08-30T01:00:00.000Z',
    reportGeneratedAt: '2026-08-29T01:00:00.000Z',
    scenario: { mode: 'holding', currentPrice: 28.8, costBasis: 33.4, quantity: null },
    market: { currentPrice: 28.8, currentPriceSource: 'eastmoney-realtime', currentPriceStatus: 'realtime', currentPriceObservedAt: '2026-08-30T00:00:00.000Z', currentPriceChangePercent: -13.25, quoteErrorCode: null, latestClose: 33.2, latestTradeDate: '20260829', latestCloseSource: 'local-daily-bars', priceDeltaPercent: -13.25 },
    evidence: { total: 12, usable: 12, missing: 0, failed: 0 },
    sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-v1' }],
    deterministic: {
      recommendation: 'bullish',
      label: '看多',
      action: 'add-review',
      actionLabel: '加仓复核',
      rationale: '低价本身不是加仓理由。',
      priceStatus: 'below',
      priceLabel: '当前价低于参考买入区间',
      priceDetail: 'Eastmoney 实时行情 28.80 元。',
      score: 78,
      coverage: 100,
      buyPriceRange: { low: 30, high: 35, currency: 'CNY', formulaVersion: 'reference-price-v1', source: '本地 Quant 日线库', observedAt: '20260829', evidenceKeys: ['trend-sample'] },
      sellPriceRange: { low: 38, high: 42, currency: 'CNY', formulaVersion: 'reference-price-v1', source: '本地 Quant 日线库', observedAt: '20260829', evidenceKeys: ['trend-sample'] },
      unrealizedPnlPercent: -13.77,
      recoveryPercent: 15.97,
      trust: { level: 'high', score: 92, coverage: 100, evidenceCoverage: 100, sourceCount: 3, latestObservedAt: '20260829', freshnessDays: 1, missingEvidenceCount: 0, failedEvidenceCount: 0, crossSourceAlertCount: 0, reasons: ['覆盖充分'] },
      evidence: { total: 12, usable: 12, missing: 0, failed: 0 },
      evidenceKeys: ['trend-sample'],
      sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-v1' }],
      checks: ['覆盖充分'],
      invalidationConditions: ['趋势转弱'],
    },
    ai: {
      aiVersion: 'decision-assistant-ai-v1',
      status: 'failed',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      recommendation: null,
      action: null,
      confidence: null,
      accepted: false,
      rejectionReason: null,
      factorReviewCoverage: 0,
      rationale: null,
      risks: [],
      invalidationConditions: [],
      citedEvidenceKeys: [],
      factorReviews: [],
      errorCode: 'QUANT_DECISION_ASSISTANT_TIMEOUT',
    },
    final: { recommendation: 'bullish', label: '看多', action: 'add-review', actionLabel: '加仓复核', confidence: 92, source: 'deterministic', rationale: '低价本身不是加仓理由。' },
    ...overrides,
  }
}

describe('quant decision assistant panel', () => {
  it('does not expose a current-price input and delegates the quote lookup to the server', async () => {
    const wrapper = mount(QuantDecisionAssistantPanel, { props: baseProps })

    expect(wrapper.find('input[aria-label="当前价格"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('服务端自动获取')
    await wrapper.get('.quant-decision-assistant-submit').trigger('click')

    expect(wrapper.emitted('assess')).toEqual([[{ mode: 'buy', costBasis: null, quantity: null, includeAi: true }]])
    expect(wrapper.get('input[aria-label="使用 AI 交叉核对"]').attributes('type')).toBe('checkbox')
  })

  it('requires cost basis for holding mode and shows the loss/recovery result', async () => {
    const wrapper = mount(QuantDecisionAssistantPanel, { props: baseProps })

    await wrapper.get('.quant-decision-assistant-mode button:nth-child(2)').trigger('click')
    expect(wrapper.text()).toContain('持有场景需要成本价')
    expect((wrapper.get('.quant-decision-assistant-submit').element as HTMLButtonElement).disabled).toBe(true)
    await wrapper.get('input[aria-label="持仓成本"]').setValue('33.4')
    await wrapper.get('.quant-decision-assistant-submit').trigger('click')
    expect(wrapper.emitted('assess')?.at(-1)).toEqual([{ mode: 'holding', costBasis: 33.4, quantity: null, includeAi: true }])
    await wrapper.setProps({ assessment: assessment() })
    expect(wrapper.text()).toContain('加仓复核')
    expect(wrapper.text()).toContain('-13.77%')
    expect(wrapper.text()).toContain('15.97%')
  })

  it('keeps the deterministic result visible when AI fails', () => {
    const wrapper = mount(QuantDecisionAssistantPanel, { props: { ...baseProps, assessment: assessment() } })

    expect(wrapper.text()).toContain('AI 请求失败，保留确定性判断')
    expect(wrapper.text()).toContain('QUANT_DECISION_ASSISTANT_TIMEOUT')
    expect(wrapper.text()).toContain('参考买入区间')
    expect(wrapper.text()).toContain('30.00 元 - 35.00 元')
  })

  it('hydrates the saved scenario so a repeated assessment uses the same inputs', () => {
    const saved = assessment()
    const wrapper = mount(QuantDecisionAssistantPanel, { props: { ...baseProps, assessment: saved } })

    expect((wrapper.get('input[aria-label="持仓成本"]').element as HTMLInputElement).value).toBe('33.4')
    expect(wrapper.get('.quant-decision-assistant-mode button:nth-child(2)').attributes('aria-pressed')).toBe('true')
  })
})
