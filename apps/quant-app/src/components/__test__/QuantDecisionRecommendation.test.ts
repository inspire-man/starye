// @vitest-environment happy-dom

import type { QuantResearchReport, QuantResearchSummary } from '../../lib/quant-types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantDecisionRecommendation from '../QuantDecisionRecommendation.vue'

function report(overrides: Partial<QuantResearchReport> = {}): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-29T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'ready',
    action: 'research-window',
    score: 90,
    headline: '进入研究窗口',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [],
    sources: [],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 78,
      factors: [{
        key: 'trend',
        label: '趋势',
        weight: 0.25,
        sourceId: 'local-daily-bars',
        source: '本地 Quant 日线与趋势因子',
        status: 'ready',
        score: 80,
        evidenceKeys: ['trend-sample'],
        missingEvidenceKeys: [],
      }],
      configuration: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        source: 'user',
        updatedAt: '2026-08-29T00:00:00.000Z',
      },
    },
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 78,
      confidence: 78,
      coverage: 100,
      buyPriceRange: {
        low: 10,
        high: 11,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample'],
      },
      sellPriceRange: {
        low: 12,
        high: 14,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample'],
      },
      evidenceKeys: ['trend-sample'],
      invalidationConditions: ['趋势转弱后重新评估'],
      headline: '看多：正向证据占优',
    },
    ...overrides,
  }
}

function summary(): QuantResearchSummary {
  return {
    id: 'summary-1',
    researchRunId: 'run-1',
    summaryVersion: 'research-summary-v2',
    reportVersion: 'research-report-v2',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-29T01:00:00.000Z',
    createdAt: '2026-08-29T01:00:00.000Z',
    summary: {
      summaryVersion: 'research-summary-v2',
      overview: '需要复核。',
      supports: [],
      concerns: [],
      nextChecks: [],
      citedEvidenceKeys: [],
      factorReviews: [],
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bearish',
        confidence: 84,
        accepted: true,
        rejectionReason: null,
        factorReviewCoverage: 100,
        rationale: '风险证据需要优先处理。',
        invalidationConditions: ['风险证据恢复后复核'],
        citedEvidenceKeys: ['trend-sample'],
      },
    },
    citedEvidenceKeys: [],
  }
}

describe('quant decision recommendation', () => {
  it('shows the deterministic recommendation and traceable price ranges', () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: null } })

    expect(wrapper.text()).toContain('看多')
    expect(wrapper.text()).toContain('10.00 - 11.00 元')
    expect(wrapper.text()).toContain('12.00 - 14.00 元')
    expect(wrapper.text()).toContain('确定性因子模型')
    expect(wrapper.text()).toContain('查看因子来源、权重和失效条件')
    expect(wrapper.text()).toContain('当前用户配置')
  })

  it('uses an accepted AI review for the final label while retaining deterministic prices', () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: summary() } })

    expect(wrapper.text()).toContain('看空')
    expect(wrapper.text()).toContain('AI 决策复核')
    expect(wrapper.text()).toContain('已影响最终推荐')
    expect(wrapper.text()).toContain('10.00 - 11.00 元')
  })

  it('exposes a one-click AI review event when no structured review exists', async () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: null } })

    const button = wrapper.get('.quant-decision-ai-review-button')
    expect(button.text()).toContain('让 AI 复核')
    await button.trigger('click')

    expect(wrapper.emitted('requestAiReview')).toEqual([[]])
  })

  it('keeps the review entry for legacy summaries without decisionReview', () => {
    const legacy = summary()
    legacy.summary.decisionReview = null
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: legacy } })

    expect(wrapper.text()).toContain('摘要已有，尚无结构化 AI 决策复核')
    expect(wrapper.get('.quant-decision-ai-review-button').text()).toContain('重新复核')
  })

  it('disables the entry while an AI review is running', () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: null, aiReviewGenerating: true } })

    const button = wrapper.get('.quant-decision-ai-review-button')
    expect(button.text()).toContain('AI 复核中')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the no-report decision state explicit', () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report({ decision: undefined }), summary: null } })

    expect(wrapper.text()).toContain('生成新版研究报告')
    expect(wrapper.text()).not.toContain('参考买入区间')
  })
})
