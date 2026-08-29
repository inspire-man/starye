// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantAiCandidateBriefing from '../QuantAiCandidateBriefing.vue'

const briefing = {
  briefingVersion: 'candidate-briefing-v1' as const,
  provider: 'openai_compatible' as const,
  model: 'gpt-5.4',
  generatedAt: '2026-08-29T01:00:00.000Z',
  overview: '当前候选集中，高优先级标的需要先补齐风险核对，再回看价值与趋势证据。',
  focusItems: [
    {
      tsCode: '601899.SH',
      name: '紫金矿业',
      priorityLevel: 'high' as const,
      priorityScore: 86.5,
      actionLabel: '核对风险',
      reasons: ['风险证据待核对', '研究标记已到期'],
      explanation: '优先回看风险样本和最近研究标记，确认当前候选仍值得继续研究。',
    },
    {
      tsCode: '000001.SZ',
      name: '平安银行',
      priorityLevel: 'normal' as const,
      priorityScore: 64,
      actionLabel: '继续研究',
      reasons: ['价值数据可用'],
      explanation: '确定性优先级处于常规区间，可按现有研究队列继续核对。',
    },
  ],
  nextChecks: ['核对风险证据样本', '确认研究标记是否已更新'],
  citedCandidateCodes: ['601899.SH', '000001.SZ'],
}

const baseProps = {
  briefing: null,
  candidateCount: 2,
  filteredCandidateCount: 2,
  briefingAvailableCandidateCount: 2,
  briefingCandidateCount: null,
  loading: false,
  errorMessage: null,
  configurationError: false,
  copying: false,
  copyOutcome: null,
  copyMessage: '',
}

describe('quant ai candidate briefing', () => {
  it('renders the idle state and enables generation when candidates exist', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, { props: baseProps })

    expect(wrapper.text()).toContain('还没有生成候选简报')
    expect(wrapper.text()).toContain('当前筛选 2 个')
    expect(wrapper.text()).toContain('观察池 2 个')
    expect(wrapper.text()).toContain('可生成范围 2 个')
    expect(wrapper.get('.quant-ai-briefing-generate').attributes('disabled')).toBeUndefined()

    await wrapper.get('.quant-ai-briefing-generate').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('renders a clear loading state and disables generation', () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, loading: true },
    })

    expect(wrapper.get('[role="status"]').text()).toContain('AI 正在整理当前候选简报')
    expect(wrapper.get('.quant-ai-briefing-generate').attributes('disabled')).toBeDefined()
  })

  it('renders success content and emits focusCandidate for focus items and citations', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, briefingCandidateCount: 2 },
    })

    expect(wrapper.text()).toContain('当前候选集中，高优先级标的需要先补齐风险核对')
    expect(wrapper.text()).toContain('紫金矿业')
    expect(wrapper.text()).toContain('601899.SH')
    expect(wrapper.text()).toContain('高优先')
    expect(wrapper.text()).toContain('86.5 分')
    expect(wrapper.text()).toContain('核对风险')
    expect(wrapper.text()).toContain('确认研究标记是否已更新')
    expect(wrapper.text()).toContain('gpt-5.4')
    expect(wrapper.text()).toContain('2026-08-29')
    expect(wrapper.text()).toContain('本次简报 2 个')

    await wrapper.get('.quant-ai-briefing-focus-item').trigger('click')
    await wrapper.get('.quant-ai-briefing-citation').trigger('click')

    expect(wrapper.emitted('focusCandidate')).toEqual([
      ['601899.SH'],
      ['601899.SH'],
    ])
  })

  it('disables generation and explains an empty filtered scope', () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, filteredCandidateCount: 0, briefingAvailableCandidateCount: 0 },
    })

    expect(wrapper.text()).toContain('当前筛选没有候选')
    expect(wrapper.get('.quant-ai-briefing-generate').attributes('disabled')).toBeDefined()
  })

  it('keeps the action disabled when the filtered rows are pending snapshot data', () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefingAvailableCandidateCount: 0 },
    })

    expect(wrapper.text()).toContain('当前筛选候选尚未进入最新快照')
    expect(wrapper.get('.quant-ai-briefing-generate').attributes('disabled')).toBeDefined()
  })

  it('exposes export and copy actions only in success state and reports copy progress', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing },
    })

    expect(wrapper.get('.quant-ai-briefing-export').attributes('aria-label')).toBe('导出候选 AI 简报为 Markdown 文件')
    expect(wrapper.get('.quant-ai-briefing-copy').attributes('disabled')).toBeUndefined()

    await wrapper.get('.quant-ai-briefing-export').trigger('click')
    await wrapper.get('.quant-ai-briefing-copy').trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)

    const loading = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, loading: true, copyMessage: '上一轮已复制' },
    })
    expect(loading.find('.quant-ai-briefing-export').exists()).toBe(false)
    expect(loading.find('.quant-ai-briefing-copy').exists()).toBe(false)
    expect(loading.find('.quant-ai-briefing-copy-message').exists()).toBe(false)

    const error = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, errorMessage: '生成失败', copyMessage: '上一轮已复制' },
    })
    expect(error.find('.quant-ai-briefing-export').exists()).toBe(false)
    expect(error.find('.quant-ai-briefing-copy').exists()).toBe(false)
    expect(error.find('.quant-ai-briefing-copy-message').exists()).toBe(false)

    const copying = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, copying: true, copyMessage: '复制中' },
    })
    expect(copying.get('.quant-ai-briefing-copy').attributes('disabled')).toBeDefined()
    expect(copying.text()).toContain('复制中')
  })

  it('renders clipboard success and failure messages without changing briefing facts', () => {
    const success = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, copyOutcome: 'success', copyMessage: 'Markdown 已复制到剪贴板' },
    })
    expect(success.get('.quant-ai-briefing-copy-message').text()).toBe('Markdown 已复制到剪贴板')
    expect(success.get('.quant-ai-briefing-copy-message').classes()).not.toContain('quant-ai-briefing-copy-message-error')

    const failure = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, copyOutcome: 'error', copyMessage: '复制失败，请检查剪贴板权限后重试' },
    })
    expect(failure.get('.quant-ai-briefing-copy-message').text()).toContain('复制失败')
    expect(failure.get('.quant-ai-briefing-copy-message').classes()).toContain('quant-ai-briefing-copy-message-error')
  })

  it('opens settings for configuration errors and retries other errors', async () => {
    const settings = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, errorMessage: 'AI 尚未配置', configurationError: true },
    })
    expect(settings.text()).toContain('打开 AI 配置')
    expect(settings.find('.quant-ai-briefing-error-action').text()).toBe('打开 AI 配置')
    await settings.get('.quant-ai-briefing-error-action').trigger('click')
    expect(settings.emitted('openSettings')).toHaveLength(1)

    const retry = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, errorMessage: 'AI 请求失败' },
    })
    expect(retry.text()).toContain('重试')
    await retry.get('.quant-ai-briefing-error-action').trigger('click')
    expect(retry.emitted('generate')).toHaveLength(1)
  })

  it('keeps narrow-layout wrapping hooks and keyboard controls on the rendered surface', () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing },
    })

    expect(wrapper.get('.quant-ai-briefing-panel').classes()).toContain('quant-ai-briefing-responsive')
    expect(wrapper.get('.quant-ai-briefing-focus-item').classes()).toContain('quant-ai-briefing-wrap-anywhere')
    expect(wrapper.get('.quant-ai-briefing-citation').classes()).toContain('quant-ai-briefing-wrap-anywhere')
    expect(wrapper.get('.quant-ai-briefing-focus-item').attributes('type')).toBe('button')
    expect(wrapper.get('.quant-ai-briefing-citation').attributes('type')).toBe('button')
  })
})
