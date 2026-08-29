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
    },
    citedEvidenceKeys,
  }
}

const baseProps = {
  loading: false,
  generating: false,
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
    expect(wrapper.text()).toContain('还没有生成解释')
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
