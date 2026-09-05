// @vitest-environment happy-dom

import type { QuantResearchReport, QuantResearchSummary } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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
    evidence: [{
      key: 'trend-sample',
      dimension: 'trend',
      label: '日线样本',
      status: 'pass',
      value: 125,
      threshold: '至少 60 根',
      source: '本地 Quant 日线库',
      observedAt: '20260829',
      formulaVersion: 'daily-v1',
      detail: '样本完整',
    }],
    sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-v1' }],
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
    factorImpact: {
      modelVersion: 'research-factors-v1',
      totalWeight: 0.25,
      deterministicScore: 78,
      scoredWeight: 0.25,
      reviewedWeight: 0.25,
      reviewCoverage: 100,
      supportWeight: 0.25,
      cautionWeight: 0,
      opposeWeight: 0,
      unacceptedWeight: 0,
      factors: [{
        factor: 'trend',
        label: '趋势',
        weight: 0.25,
        deterministicScore: 80,
        deterministicStance: 'support',
        deterministicContribution: 80,
        aiStance: 'support',
        aiConfidence: 86,
        aiAccepted: true,
        aiWeight: 0.25,
      }],
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
    expect(wrapper.text()).toContain('因子数据健康')
    expect(wrapper.text()).toContain('字段覆盖 100%')
    expect(wrapper.text()).toContain('证据 1 / 1 可用')
    expect(wrapper.text()).toContain('最新')
  })

  it('uses an accepted AI review for the final label while retaining deterministic prices', () => {
    const wrapper = mount(QuantDecisionRecommendation, { props: { report: report(), summary: summary(), dataFreshness: 'fresh' } })

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

  it('shows a ready status only when the AI factor audit is complete', () => {
    const wrapper = mount(QuantDecisionRecommendation, {
      props: {
        report: report(),
        summary: summary(),
        currentPrice: 10.5,
        currentPriceObservedAt: '20260829',
        dataFreshness: 'fresh',
        dataFreshnessDetail: '全部数据域均在 48 小时内观测',
      },
    })

    expect(wrapper.text()).toContain('判断就绪度')
    expect(wrapper.text()).toContain('可参考')
    expect(wrapper.text()).toContain('数据完整性')
    expect(wrapper.text()).toContain('AI 复核')
  })

  it('keeps an accepted AI review visible but gates it when data is stale', () => {
    const wrapper = mount(QuantDecisionRecommendation, {
      props: {
        report: report(),
        summary: summary(),
        currentPrice: 10.5,
        currentPriceObservedAt: '20260829',
        dataFreshness: 'stale',
        dataFreshnessDetail: '1 个数据域已超过 7 天，先刷新后再判断',
      },
    })

    expect(wrapper.get('.quant-decision-source').text()).toContain('确定性因子模型')
    expect(wrapper.text()).toContain('已复核，但数据已过期，未纳入最终推荐')
    expect(wrapper.text()).toContain('1 个数据域已超过 7 天，先刷新后再判断')
    expect(wrapper.text()).toContain('数据时效')
    expect(wrapper.text()).toContain('暂不可用')
    expect(wrapper.get('.quant-decision-ai-review').classes()).toContain('quant-decision-ai-review-gated')
  })

  it('shows missing evidence and fallback source guidance without changing the recommendation', async () => {
    const base = report()
    const refreshEvidence = vi.fn()
    const wrapper = mount(QuantDecisionRecommendation, {
      props: {
        report: {
          ...base,
          factorModel: {
            ...base.factorModel!,
            factors: [{
              ...base.factorModel!.factors[0]!,
              status: 'partial',
              source: 'Eastmoney 财务，回退链：备用来源',
              evidenceKeys: ['trend-sample', 'quality-cashflow'],
              missingEvidenceKeys: ['quality-cashflow'],
            }],
          },
        },
        summary: null,
        refreshEvidence,
      },
    })

    expect(wrapper.text()).toContain('部分可用')
    expect(wrapper.text()).toContain('来源需复核')
    expect(wrapper.text()).toContain('待补证据：经营现金流 / 营收')
    expect(wrapper.text()).toContain('下一步：补齐证据：quality-cashflow')
    expect(wrapper.text()).toContain('刷新基本面并重算')
    await wrapper.get('.quant-factor-data-health-refresh-button').trigger('click')
    expect(refreshEvidence).toHaveBeenCalledWith('quality-cashflow')
    expect(wrapper.text()).toContain('看多')
    expect(wrapper.text()).toContain('10.00 - 11.00 元')
  })

  it('offers a source retry when a factor is unavailable despite having an evidence key', async () => {
    const base = report()
    const refreshEvidence = vi.fn()
    const wrapper = mount(QuantDecisionRecommendation, {
      props: {
        report: {
          ...base,
          factorModel: {
            ...base.factorModel!,
            factors: [{
              ...base.factorModel!.factors[0]!,
              status: 'unavailable',
              source: 'Eastmoney 估值，来源不可用',
            }],
          },
        },
        summary: null,
        refreshEvidence,
      },
    })

    expect(wrapper.text()).toContain('刷新日线并重算')
    await wrapper.get('.quant-factor-data-health-refresh-button').trigger('click')
    expect(refreshEvidence).toHaveBeenCalledWith('trend-sample')
  })
})
