// @vitest-environment happy-dom

import type { QuantResearchReport } from '../../lib/quant-types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiResearchQuestion from '../QuantAiResearchQuestion.vue'

function report(): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-29T00:00:00.000Z',
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
      key: 'quality-roe',
      dimension: 'quality',
      label: 'ROE',
      status: 'pass',
      value: 18,
      threshold: '至少 10%',
      source: 'Quant fixture',
      observedAt: '2026-08-28',
      formulaVersion: 'fixture-v1',
      detail: 'ROE 达到研究门槛。',
    }],
    sources: [],
  }
}

const baseProps = {
  report: report(),
  input: '',
  result: null,
  loading: false,
  errorMessage: null,
  configurationError: false,
}

describe('quant AI research question', () => {
  it('emits a trimmed question and keeps the empty submit disabled', async () => {
    const wrapper = mount(QuantAiResearchQuestion, { props: baseProps })
    const submit = wrapper.get('button[type="submit"]')
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.get('textarea').setValue('  ROE 是否达到门槛？  ')
    await wrapper.setProps({ input: '  ROE 是否达到门槛？  ' })
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update:input')).toEqual([['  ROE 是否达到门槛？  ']])
    expect(wrapper.emitted('ask')).toEqual([['ROE 是否达到门槛？']])
  })

  it('shows an answer citation and emits evidence focus without changing the answer', async () => {
    const wrapper = mount(QuantAiResearchQuestion, {
      props: {
        ...baseProps,
        input: 'ROE 是否达到门槛？',
        result: {
          questionVersion: 'research-question-v1',
          provider: 'openai_compatible',
          model: 'gpt-5.4',
          generatedAt: '2026-08-29T01:00:00.000Z',
          question: 'ROE 是否达到门槛？',
          answer: 'ROE 为 18%，高于报告门槛。',
          citedEvidenceKeys: ['quality-roe'],
        },
      },
    })

    expect(wrapper.text()).toContain('ROE 为 18%')
    expect(wrapper.text()).toContain('601899.SH')
    expect(wrapper.text()).toContain('quality-roe')
    await wrapper.get('.quant-ai-question-citation').trigger('click')
    expect(wrapper.emitted('focusEvidence')).toEqual([['quality-roe']])
  })

  it('keeps retry available after an error and exposes configuration action', async () => {
    const wrapper = mount(QuantAiResearchQuestion, {
      props: { ...baseProps, input: '问题', errorMessage: 'AI 配置未就绪', configurationError: true },
    })
    expect(wrapper.text()).toContain('AI 配置未就绪')
    expect(wrapper.text()).toContain('打开 AI 配置')
    await wrapper.get('.text-button').trigger('click')
    expect(wrapper.emitted('openSettings')).toHaveLength(1)
  })

  it('disables input and submit while a question is running', () => {
    const wrapper = mount(QuantAiResearchQuestion, { props: { ...baseProps, input: '问题', loading: true } })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).disabled).toBe(true)
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('正在基于当前报告整理回答')
  })
})
