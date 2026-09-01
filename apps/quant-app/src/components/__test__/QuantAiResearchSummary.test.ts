// @vitest-environment happy-dom

import type { QuantResearchReport, QuantResearchSummary } from '../../lib/quant-types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiResearchSummary from '../QuantAiResearchSummary.vue'

function report(overrides: Partial<QuantResearchReport> = {}): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-26T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'partial',
    action: 'wait-confirmation',
    score: 72.5,
    headline: '等待确认：部分证据可用',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'akshare-roe',
      dimension: 'quality',
      label: 'AkShare ROE',
      status: 'pass',
      value: 18,
      threshold: '至少 10%',
      source: 'AkShare stock_financial_analysis_indicator',
      observedAt: '20260630',
      formulaVersion: 'akshare-adapter-v1',
      detail: 'ROE 达到基础价值研究门槛',
      optional: true,
    }],
    sources: [],
    ...overrides,
  }
}

function summary(citedEvidenceKeys: string[]): QuantResearchSummary {
  return {
    id: 'summary-1',
    researchRunId: 'run-1',
    summaryVersion: 'research-summary-v1',
    reportVersion: 'research-report-v2',
    provider: 'openai_compatible',
    model: 'gpt-5.5',
    generatedAt: '2026-08-26T01:00:00.000Z',
    createdAt: '2026-08-26T01:00:00.000Z',
    summary: {
      summaryVersion: 'research-summary-v1',
      overview: '当前证据需要继续核对。',
      supports: ['ROE 达到门槛'],
      concerns: ['估值仍需比较'],
      nextChecks: ['等待下一期报告'],
      citedEvidenceKeys,
      factorReviews: [],
    },
    citedEvidenceKeys,
  }
}

const baseProps = {
  loading: false,
  generating: false,
  streamMode: null,
  streamReceivedChars: 0,
  errorMessage: null,
  configurationError: false,
  questionPromptReady: true,
}

describe('quant ai research summary', () => {
  it('shows deterministic conclusion and report-backed citation provenance', () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: report(), summary: summary(['akshare-roe']) },
    })

    expect(wrapper.text()).toContain('部分可用')
    expect(wrapper.text()).toContain('等待确认')
    expect(wrapper.text()).toContain('72.5 / 100')
    expect(wrapper.text()).toContain('18.00%')
    expect(wrapper.text()).toContain('至少 10%')
    expect(wrapper.text()).toContain('AkShare stock_financial_analysis_indicator')
    expect(wrapper.text()).toContain('2026-06-30 · akshare-adapter-v1')
  })

  it('shows deterministic factor coverage and missing AI factor reviews', () => {
    const factorReport = report({
      factorModel: {
        modelVersion: 'research-factors-v1',
        totalWeight: 1,
        coveredWeight: 0.5,
        coverage: 50,
        score: 80,
        factors: [{
          key: 'quality',
          label: '盈利质量',
          weight: 0.5,
          sourceId: 'eastmoney-financial',
          source: 'Eastmoney 最新财报',
          status: 'ready',
          score: 90,
          evidenceKeys: ['akshare-roe'],
          missingEvidenceKeys: [],
        }, {
          key: 'valuation',
          label: '估值',
          weight: 0.5,
          sourceId: 'eastmoney-valuation',
          source: 'Eastmoney 估值',
          status: 'missing',
          score: null,
          evidenceKeys: ['valuation-pe'],
          missingEvidenceKeys: ['valuation-pe'],
        }],
      },
    })
    const current = summary(['akshare-roe'])
    current.summary.factorReviews = [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量有可核对证据。',
      citedEvidenceKeys: ['akshare-roe'],
    }]
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: factorReport, summary: current },
    })

    expect(wrapper.text()).toContain('因子覆盖与 AI 复核')
    expect(wrapper.text()).toContain('1 / 2 个有权重因子已纳入')
    expect(wrapper.text()).toContain('盈利质量')
    expect(wrapper.text()).toContain('估值')
    expect(wrapper.text()).toContain('数据缺失')
    expect(wrapper.text()).toContain('待补证据：valuation-pe')
    expect(wrapper.text()).toContain('AI 未返回复核')
    expect(wrapper.text()).toContain('当前推荐仍以确定性结论为准')
  })

  it('shows deterministic contributions separately from accepted AI weight', () => {
    const factorReport = report({
      status: 'ready',
      score: 82,
      factorModel: {
        modelVersion: 'research-factors-v1',
        totalWeight: 1,
        coveredWeight: 1,
        coverage: 100,
        score: 82,
        factors: [{
          key: 'quality',
          label: '盈利质量',
          weight: 0.5,
          sourceId: 'eastmoney-financial',
          source: 'Eastmoney 最新财报',
          status: 'ready',
          score: 90,
          evidenceKeys: ['akshare-roe'],
          missingEvidenceKeys: [],
        }, {
          key: 'valuation',
          label: '估值',
          weight: 0.5,
          sourceId: 'eastmoney-valuation',
          source: 'Eastmoney 估值',
          status: 'ready',
          score: 74,
          evidenceKeys: ['valuation-pe'],
          missingEvidenceKeys: [],
        }],
      },
    })
    const current = summary(['akshare-roe'])
    current.factorImpact = {
      modelVersion: 'research-factors-v1',
      evaluatedAt: '2026-09-01T08:00:00.000Z',
      totalWeight: 1,
      deterministicScore: 82,
      aiScore: 100,
      aiScoreDelta: 18,
      scoredWeight: 1,
      reviewedWeight: 0.5,
      reviewCoverage: 50,
      supportWeight: 0.5,
      cautionWeight: 0,
      opposeWeight: 0,
      unacceptedWeight: 0.5,
      factors: [{
        factor: 'quality',
        label: '盈利质量',
        weight: 0.5,
        deterministicScore: 90,
        deterministicStance: 'support',
        deterministicContribution: 45,
        aiStance: 'support',
        aiConfidence: 88,
        aiAccepted: true,
        aiWeight: 0.5,
        aiContribution: 100,
      }, {
        factor: 'valuation',
        label: '估值',
        weight: 0.5,
        deterministicScore: 74,
        deterministicStance: 'support',
        deterministicContribution: 37,
        aiStance: null,
        aiConfidence: null,
        aiAccepted: false,
        aiWeight: 0,
        aiContribution: null,
      }],
    }
    current.summary.factorReviews = [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量有可核对证据。',
      citedEvidenceKeys: ['akshare-roe'],
    }]
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: factorReport, summary: current },
    })

    expect(wrapper.text()).toContain('因子贡献与 AI 影响')
    expect(wrapper.text()).toContain('AI 已纳入权重')
    expect(wrapper.text()).toContain('AI 方向权重')
    expect(wrapper.text()).toContain('AI 影响分')
    expect(wrapper.text()).toContain('100.0 分')
    expect(wrapper.text()).toContain('相对确定性 +18.0 分')
    expect(wrapper.text()).toContain('确定性贡献 45.0 分')
    expect(wrapper.text()).toContain('AI 支持 · 计入 50%')
    expect(wrapper.text()).toContain('AI 贡献 100.0 分')
    expect(wrapper.text()).toContain('确定性贡献 37.0 分')
    expect(wrapper.text()).toContain('AI 未复核')
    expect(wrapper.text()).toContain('不改写确定性分数或参考价格区间')
  })

  it('shows factor gaps before an AI summary has been generated', () => {
    const factorReport = report({
      factorModel: {
        modelVersion: 'research-factors-v1',
        totalWeight: 1,
        coveredWeight: 1,
        coverage: 100,
        score: 90,
        factors: [{
          key: 'quality',
          label: '盈利质量',
          weight: 1,
          sourceId: 'eastmoney-financial',
          source: 'Eastmoney 最新财报',
          status: 'ready',
          score: 90,
          evidenceKeys: ['akshare-roe'],
          missingEvidenceKeys: [],
        }],
      },
    })
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: factorReport, summary: null },
    })

    expect(wrapper.text()).toContain('0 / 1 个有权重因子已纳入')
    expect(wrapper.text()).toContain('AI 未返回复核')
    expect(wrapper.text()).toContain('等待生成 AI 复核')
  })

  it('keeps unknown historical citation keys visible without a fabricated value', () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: report(), summary: summary(['old-evidence-key']) },
    })

    expect(wrapper.text()).toContain('old-evidence-key')
    expect(wrapper.text()).toContain('当前报告未找到')
    expect(wrapper.text()).toContain('当前报告未返回可核验数值')
    expect(wrapper.text()).toContain('确定性分数')
  })

  it('keeps the deterministic strip visible while the AI summary is unavailable', () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: report({ score: null, action: 'complete-data' }), summary: null },
    })

    expect(wrapper.text()).toContain('补齐数据')
    expect(wrapper.text()).toContain('确定性分数')
    expect(wrapper.text()).toContain('生成新研究报告会自动进行决策复核')
  })

  it('shows the automatic decision review state and disables duplicate generation', () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, generating: true, report: report(), summary: null },
    })

    expect(wrapper.text()).toContain('正在生成 AI 决策复核')
    expect(wrapper.get('.quant-ai-summary-button').text()).toContain('AI 复核中')
    expect((wrapper.get('.quant-ai-summary-button').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows verified streaming progress without rendering partial conclusions', () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, generating: true, streamMode: 'stream', streamReceivedChars: 128, report: report(), summary: null },
    })

    expect(wrapper.text()).toContain('已接收 128 字')
    expect(wrapper.text()).toContain('结构校验通过后显示结论')
    expect(wrapper.text()).not.toContain('AI 研究摘要')
  })

  it('shows accepted and rejected states for persisted factor reviews', () => {
    const current = summary(['akshare-roe'])
    current.summary.factorReviews = [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量有报告证据支持。',
      citedEvidenceKeys: ['akshare-roe'],
    }, {
      factor: 'valuation',
      stance: 'insufficient',
      confidence: 42,
      accepted: false,
      rationale: '估值证据尚未充分覆盖。',
      citedEvidenceKeys: [],
    }]
    current.summary.decisionReview = {
      decisionVersion: 'ai-decision-v1',
      recommendation: 'watch',
      confidence: 64,
      accepted: false,
      rejectionReason: 'factor-review-incomplete',
      factorReviewCoverage: 20,
      rationale: '因子复核覆盖不足。',
      invalidationConditions: [],
      citedEvidenceKeys: ['akshare-roe'],
    }
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: report(), summary: current },
    })

    expect(wrapper.text()).toContain('因子覆盖与 AI 复核')
    expect(wrapper.text()).toContain('盈利质量')
    expect(wrapper.text()).toContain('已计入 AI 复核')
    expect(wrapper.text()).toContain('数据不足，未计入')
    expect(wrapper.text()).toContain('因子复核 20%')
  })

  it('offers a same-level next-check action without submitting a question', async () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, report: report(), summary: summary(['akshare-roe']) },
    })

    const nextCheck = wrapper.get('.quant-ai-summary-next-check')
    expect(nextCheck.findAll('button')).toHaveLength(1)
    expect(nextCheck.get('button').attributes('aria-label')).toContain('等待下一期报告')
    expect(nextCheck.get('button').attributes('title')).toBe('将摘要核对项转换为当前追问')

    await nextCheck.get('button').trigger('click')

    expect(wrapper.emitted('useNextCheck')).toEqual([['等待下一期报告']])
    expect(wrapper.emitted('generate')).toBeUndefined()
  })

  it('disables summary reuse while the question flow is unavailable', async () => {
    const wrapper = mount(QuantAiResearchSummary, {
      props: { ...baseProps, questionPromptReady: false, report: report(), summary: summary([]) },
    })

    const button = wrapper.get('.quant-ai-summary-next-prompt')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    await button.trigger('click')
    expect(wrapper.emitted('useNextCheck')).toBeUndefined()
  })
})
