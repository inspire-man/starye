// @vitest-environment happy-dom

import type { QuantResearchChangeExplanation } from '../../lib/quant-types'
import type { ResearchEvidenceHistoryComparison } from '../../lib/research-evidence-history'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiResearchChangeExplanation from '../QuantAiResearchChangeExplanation.vue'

const comparison: ResearchEvidenceHistoryComparison = {
  currentGeneratedAt: '2026-08-29T00:00:00.000Z',
  previousGeneratedAt: '2026-08-28T00:00:00.000Z',
  items: [{ key: 'trend-strength', label: '趋势强度', kind: 'weakened', kindLabel: '状态转弱', direction: 'down', previous: null, current: null, previousValue: 12, currentValue: 8, valueDelta: -4 }],
  totalEvidenceCount: 4,
  changedCount: 1,
  improvedCount: 0,
  weakenedCount: 1,
  missingCount: 0,
}

const explanation: QuantResearchChangeExplanation = {
  changeExplanationVersion: 'research-change-explanation-v1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  generatedAt: '2026-08-29T01:00:00.000Z',
  currentGeneratedAt: comparison.currentGeneratedAt,
  previousGeneratedAt: comparison.previousGeneratedAt,
  overview: '趋势强度较上次走弱，先核对样本和来源。',
  changes: [{ evidenceKey: 'trend-strength', label: '趋势强度', kind: 'weakened', kindLabel: '状态转弱', explanation: '数值下降，值得回看对应时间窗口。' }],
  nextChecks: ['核对趋势样本'],
  citedEvidenceKeys: ['trend-strength'],
}

const base = { comparison, explanation: null, loading: false, generating: false, errorMessage: null, configurationError: false }

describe('quant ai research change explanation', () => {
  it('renders idle and honest empty-comparison states', () => {
    const idle = mount(QuantAiResearchChangeExplanation, { props: base })
    expect(idle.text()).toContain('已找到可比较的快照')
    expect(idle.get('button').attributes('disabled')).toBeUndefined()

    const empty = mount(QuantAiResearchChangeExplanation, { props: { ...base, comparison: null } })
    expect(empty.text()).toContain('至少需要本次和上次报告')
    expect(empty.get('button').attributes('disabled')).toBeDefined()
  })

  it('renders loading, success, citations and emits focusEvidence', async () => {
    const wrapper = mount(QuantAiResearchChangeExplanation, { props: { ...base, explanation, generating: true } })
    expect(wrapper.text()).toContain('AI 正在整理')
    await wrapper.setProps({ generating: false })
    expect(wrapper.text()).toContain('趋势强度较上次走弱')
    expect(wrapper.text()).toContain('核对趋势样本')
    await wrapper.get('.quant-ai-change-citation-link').trigger('click')
    expect(wrapper.emitted('focusEvidence')).toEqual([['trend-strength']])
  })

  it('renders configuration and retry error actions', async () => {
    const settings = mount(QuantAiResearchChangeExplanation, { props: { ...base, errorMessage: 'AI 未配置', configurationError: true } })
    await settings.get('.text-button').trigger('click')
    expect(settings.emitted('openSettings')).toHaveLength(1)
    const retry = mount(QuantAiResearchChangeExplanation, { props: { ...base, errorMessage: '请求失败' } })
    await retry.get('.text-button').trigger('click')
    expect(retry.emitted('generate')).toHaveLength(1)
  })
})
