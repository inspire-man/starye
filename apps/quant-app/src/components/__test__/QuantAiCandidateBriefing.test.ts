// @vitest-environment happy-dom

import type { QuantAiCandidateBriefingSession } from '../../lib/quant-types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quantApi } from '../../lib/api-client'
import QuantAiCandidateBriefing from '../QuantAiCandidateBriefing.vue'

const briefing = {
  briefingVersion: 'candidate-briefing-v1' as const,
  sessionId: 'session-1',
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
  currentCandidateCodes: [],
  loading: false,
  errorMessage: null,
  configurationError: false,
  copying: false,
  copyOutcome: null,
  copyMessage: '',
  sessionHistory: [],
}

const historySession: QuantAiCandidateBriefingSession = {
  id: 'session-1',
  snapshotId: 'snapshot-history-1',
  snapshotGeneratedAt: '2026-08-28T03:00:00.000Z',
  fromDate: '2026-08-01',
  toDate: '2026-08-28',
  scopeKey: '601899.SH|000001.SZ',
  candidateCodes: ['601899.SH', '000001.SZ'],
  briefing: {
    briefingVersion: 'candidate-briefing-v1',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-28T03:10:00.000Z',
    overview: '历史简报：先核对数据完整性。',
    focusItems: [
      {
        tsCode: '601899.SH',
        name: '紫金矿业',
        priorityLevel: 'high',
        priorityScore: 82,
        actionLabel: '继续研究',
        reasons: ['历史重点'],
        explanation: '历史重点候选的说明。',
      },
      {
        tsCode: '000001.SZ',
        name: '平安银行',
        priorityLevel: 'normal',
        priorityScore: 66,
        actionLabel: '核对数据',
        reasons: ['历史引用'],
        explanation: '当前快照中已经不存在的历史重点候选。',
      },
    ],
    nextChecks: [],
    citedCandidateCodes: ['601899.SH', '000001.SZ'],
  },
  questions: [{
    questionVersion: 'candidate-briefing-question-v1',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-28T03:12:00.000Z',
    question: '历史范围先看什么？',
    answer: '历史事实显示应先核对数据完整性。',
    citedCandidateCodes: ['601899.SH', '000001.SZ'],
  }],
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  createdAt: '2026-08-28T03:10:00.000Z',
  updatedAt: '2026-08-28T03:12:00.000Z',
}

describe('quant ai candidate briefing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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

    expect(wrapper.get('.quant-ai-briefing-state[role="status"]').text()).toContain('AI 正在整理当前候选简报')
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
    expect(wrapper.get('.quant-ai-briefing-question-submit').attributes('disabled')).toBeDefined()
  })

  it('submits a trimmed question and renders cited candidates without changing briefing facts', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        questionInput: '  当前范围内先核对什么？  ',
        questionResult: {
          questionVersion: 'candidate-briefing-question-v1',
          provider: 'openai_compatible',
          model: 'gpt-5.4',
          generatedAt: '2026-08-29T02:00:00.000Z',
          question: '当前范围内先核对什么？',
          answer: '当前事实显示应先核对数据完整性和研究标记。',
          citedCandidateCodes: ['601899.SH'],
        },
      },
    })

    expect(wrapper.text()).toContain('当前事实显示应先核对数据完整性')
    expect(wrapper.text()).toContain('范围内追问')
    await wrapper.get('.quant-ai-briefing-question-form').trigger('submit')
    expect(wrapper.emitted('askQuestion')).toEqual([['当前范围内先核对什么？']])

    await wrapper.get('.quant-ai-briefing-question .quant-ai-briefing-citation').trigger('click')
    expect(wrapper.emitted('focusCandidate')).toContainEqual(['601899.SH'])
  })

  it('fills a bounded current next-check prompt, focuses the input, and does not submit it', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing },
      attachTo: document.body,
    })

    await wrapper.get('.quant-ai-briefing-next-prompt').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:questionInput')).toEqual([
      ['围绕“核对风险证据样本”，当前候选范围内有哪些确定性事实需要优先核对？'],
    ])
    expect(wrapper.emitted('askQuestion')).toBeUndefined()
    expect(document.activeElement).toBe(wrapper.get('.quant-ai-briefing-question-input').element)

    const longCheck = '检查'.repeat(400)
    const bounded = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        briefing: { ...briefing, nextChecks: [longCheck] },
      },
      attachTo: document.body,
    })
    await bounded.get('.quant-ai-briefing-next-prompt').trigger('click')
    const prompt = bounded.emitted('update:questionInput')?.[0]?.[0]
    expect(typeof prompt).toBe('string')
    expect((prompt as string).length).toBe(500)
    wrapper.unmount()
    bounded.unmount()
  })

  it('fills a focus candidate prompt without nesting controls or submitting it', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing },
      attachTo: document.body,
    })

    const row = wrapper.get('.quant-ai-briefing-focus-row')
    expect(row.findAll('button')).toHaveLength(2)
    expect(wrapper.get('.quant-ai-briefing-focus-item').findAll('button')).toHaveLength(0)

    await row.get('.quant-ai-briefing-focus-prompt').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:questionInput')).toEqual([
      ['请基于“紫金矿业（601899.SH）”的当前候选事实，说明其研究优先级依据和下一项核对内容。'],
    ])
    expect(wrapper.emitted('askQuestion')).toBeUndefined()
    expect(document.activeElement).toBe(wrapper.get('.quant-ai-briefing-question-input').element)

    await wrapper.get('.quant-ai-briefing-focus-item').trigger('click')
    expect(wrapper.emitted('focusCandidate')).toEqual([['601899.SH']])
    wrapper.unmount()

    const longName = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        briefing: {
          ...briefing,
          focusItems: [{ ...briefing.focusItems[0], name: '超长候选名称'.repeat(200) }],
        },
      },
    })
    await longName.get('.quant-ai-briefing-focus-prompt').trigger('click')
    const longPrompt = longName.emitted('update:questionInput')?.[0]?.[0] as string
    expect(longPrompt.length).toBeLessThanOrEqual(500)
    expect(longPrompt).toContain('601899.SH')
    expect(longPrompt).toContain('当前候选事实')
    longName.unmount()

    const unnamed = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        briefing: {
          ...briefing,
          focusItems: [{ ...briefing.focusItems[1], name: '' }],
        },
      },
    })
    await unnamed.get('.quant-ai-briefing-focus-prompt').trigger('click')
    const unnamedPrompt = unnamed.emitted('update:questionInput')?.[0]?.[0] as string
    expect(unnamedPrompt).toContain('000001.SZ')
    unnamed.unmount()
  })

  it('renders question loading, configuration error, and retry states', async () => {
    const loading = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, questionInput: '问题', questionLoading: true },
    })
    expect(loading.get('.quant-ai-briefing-question-state[role="status"]').text()).toContain('正在基于当前候选范围整理回答')
    expect((loading.get('.quant-ai-briefing-question-input').element as HTMLTextAreaElement).disabled).toBe(true)

    const settings = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, questionInput: '问题', questionErrorMessage: 'AI 配置未就绪', questionConfigurationError: true },
    })
    await settings.get('.quant-ai-briefing-question-error-action').trigger('click')
    expect(settings.emitted('openSettings')).toHaveLength(1)

    const retry = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, questionInput: '问题', questionErrorMessage: 'AI 请求失败' },
    })
    await retry.get('.quant-ai-briefing-question-error-action').trigger('click')
    expect(retry.emitted('askQuestion')).toEqual([['问题']])
  })

  it('shows recent sessions with historical snapshot metadata and restores a read-only session', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, sessionHistory: [historySession] },
    })

    expect(wrapper.text()).toContain('最近会话')
    expect(wrapper.text()).toContain('历史')
    expect(wrapper.text()).toContain('快照 2026-08-28')
    expect(wrapper.text()).toContain('范围 2026-08-01 ~ 2026-08-28')
    expect(wrapper.text()).toContain('601899.SH|000001.SZ')
    expect(wrapper.find('.quant-ai-briefing-history-detail').exists()).toBe(false)

    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')

    expect(wrapper.text()).toContain('历史会话只读恢复')
    expect(wrapper.text()).toContain('历史简报：先核对数据完整性。')
    expect(wrapper.text()).toContain('历史范围先看什么？')
    expect(wrapper.text()).toContain('历史事实显示应先核对数据完整性。')
    expect(wrapper.find('.quant-ai-briefing-generate').exists()).toBe(true)
    expect(wrapper.emitted('generate')).toBeUndefined()
  })

  it('keeps the current briefing and question separate from the selected historical session', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        briefing,
        questionResult: {
          questionVersion: 'candidate-briefing-question-v1',
          provider: 'openai_compatible',
          model: 'gpt-5.4',
          generatedAt: '2026-08-29T02:00:00.000Z',
          question: '当前问题',
          answer: '当前回答',
          citedCandidateCodes: ['000001.SZ'],
        },
        sessionHistory: [historySession],
      },
    })

    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')

    expect(wrapper.text()).toContain('当前候选集中，高优先级标的需要先补齐风险核对')
    expect(wrapper.text()).toContain('当前回答')
    expect(wrapper.text()).toContain('历史简报：先核对数据完整性。')
    expect(wrapper.text()).toContain('历史会话只读恢复')
  })

  it('reuses a historical question in the current input without changing read-only history', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        currentCandidateCodes: ['601899.SH'],
        sessionHistory: [historySession],
      },
      attachTo: document.body,
    })

    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')
    await wrapper.get('.quant-ai-briefing-history-reuse-question').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:questionInput')).toEqual([['历史范围先看什么？']])
    expect(wrapper.emitted('askQuestion')).toBeUndefined()
    expect(wrapper.text()).toContain('历史事实显示应先核对数据完整性。')
    expect(document.activeElement).toBe(wrapper.get('.quant-ai-briefing-question-input').element)
    wrapper.unmount()
  })

  it('disables quick prompts while the current question flow is unavailable or loading', async () => {
    const loading = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        briefing,
        currentCandidateCodes: ['601899.SH'],
        questionLoading: true,
        sessionHistory: [historySession],
      },
    })

    expect(loading.get('.quant-ai-briefing-next-prompt').attributes('disabled')).toBeDefined()
    expect(loading.get('.quant-ai-briefing-focus-prompt').attributes('disabled')).toBeDefined()
    await loading.get('.quant-ai-briefing-history-item').trigger('click')
    expect(loading.get('.quant-ai-briefing-history-reuse-question').attributes('disabled')).toBeDefined()
    await loading.get('.quant-ai-briefing-next-prompt').trigger('click')
    expect(loading.emitted('update:questionInput')).toBeUndefined()

    const unavailable = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, available: false },
    })
    expect(unavailable.get('.quant-ai-briefing-next-prompt').attributes('disabled')).toBeDefined()
    expect(unavailable.get('.quant-ai-briefing-focus-prompt').attributes('disabled')).toBeDefined()
  })

  it('makes current historical references actionable and keeps absent codes read-only across every surface', async () => {
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        currentCandidateCodes: ['601899.SH'],
        sessionHistory: [historySession],
      },
    })

    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')

    const currentReferences = wrapper.findAll('.quant-ai-briefing-history-code-action')
    const staleReferences = wrapper.findAll('.quant-ai-briefing-history-code-stale')
    const currentFocus = wrapper.findAll('.quant-ai-briefing-history-focus-action')
    const staleFocus = wrapper.findAll('.quant-ai-briefing-history-focus-stale')

    expect(currentReferences).toHaveLength(3)
    expect(staleReferences).toHaveLength(3)
    expect(currentFocus).toHaveLength(1)
    expect(staleFocus).toHaveLength(1)
    expect(currentReferences.every(reference => reference.element.tagName === 'BUTTON')).toBe(true)
    expect(staleReferences.every(reference => reference.element.tagName === 'SPAN')).toBe(true)
    expect(staleFocus[0].element.tagName).toBe('SPAN')

    for (const reference of currentReferences)
      await reference.trigger('click')
    await currentFocus[0].trigger('click')

    expect(wrapper.emitted('focusCandidate')).toEqual([
      ['601899.SH'],
      ['601899.SH'],
      ['601899.SH'],
      ['601899.SH'],
    ])
    expect(wrapper.findAll('.quant-ai-briefing-history-code-stale code').map(code => code.text())).toEqual([
      '000001.SZ',
      '000001.SZ',
      '000001.SZ',
    ])
  })

  it('exports and copies the selected historical session with accessible controls', async () => {
    const createObjectUrl = vi.fn(() => 'blob:history-session')
    const revokeObjectUrl = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const nativeUrl = URL
    const testUrl = class extends nativeUrl {}
    Object.assign(testUrl, { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    vi.stubGlobal('URL', testUrl)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: {
        ...baseProps,
        currentCandidateCodes: ['601899.SH'],
        sessionHistory: [historySession],
      },
    })

    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')
    const exportButton = wrapper.get('.quant-ai-briefing-history-export')
    const copyButton = wrapper.get('.quant-ai-briefing-history-copy')
    expect(exportButton.attributes('type')).toBe('button')
    expect(copyButton.attributes('type')).toBe('button')

    await exportButton.trigger('click')
    expect(createObjectUrl).toHaveBeenCalledTimes(1)

    await copyButton.trigger('click')
    await flushPromises()
    await new Promise(resolve => window.setTimeout(resolve, 0))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Quant AI 候选历史会话'))
    expect(wrapper.get('.quant-ai-briefing-history-transfer-message').text()).toContain('已复制到剪贴板')
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:history-session')
  })

  it('shows unavailable and failed clipboard states while keeping retry enabled', async () => {
    vi.stubGlobal('navigator', {})
    const unavailable = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, sessionHistory: [historySession] },
    })
    await unavailable.get('.quant-ai-briefing-history-item').trigger('click')
    await unavailable.get('.quant-ai-briefing-history-copy').trigger('click')
    await flushPromises()
    expect(unavailable.get('.quant-ai-briefing-history-transfer-message').text()).toContain('不支持剪贴板写入')
    expect(unavailable.get('.quant-ai-briefing-history-copy').attributes('disabled')).toBeUndefined()

    const writeText = vi.fn().mockRejectedValue(new Error('clipboard rejected'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const failed = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, sessionHistory: [historySession] },
    })
    await failed.get('.quant-ai-briefing-history-item').trigger('click')
    await failed.get('.quant-ai-briefing-history-copy').trigger('click')
    await flushPromises()
    expect(failed.get('.quant-ai-briefing-history-transfer-message').text()).toContain('复制失败')
    expect(failed.get('.quant-ai-briefing-history-transfer-message').classes()).toContain('quant-ai-briefing-history-transfer-message-error')
    expect(failed.get('.quant-ai-briefing-history-copy').attributes('disabled')).toBeUndefined()
  })

  it('ignores a stale copy result after selecting another historical session', async () => {
    let resolveCopy: (() => void) | undefined
    const writeText = vi.fn(() => new Promise<void>((resolve) => {
      resolveCopy = resolve
    }))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const secondSession: QuantAiCandidateBriefingSession = {
      ...historySession,
      id: 'session-2',
      scopeKey: 'SECOND.SZ',
      briefing: historySession.briefing
        ? { ...historySession.briefing, overview: '第二个历史会话。' }
        : null,
    }
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, sessionHistory: [historySession, secondSession] },
    })

    const historyItems = wrapper.findAll('.quant-ai-briefing-history-item')
    await historyItems[0].trigger('click')
    await wrapper.get('.quant-ai-briefing-history-copy').trigger('click')
    expect(wrapper.get('.quant-ai-briefing-history-copy').attributes('disabled')).toBeDefined()

    await historyItems[1].trigger('click')
    expect(wrapper.text()).toContain('第二个历史会话。')
    resolveCopy?.()
    await flushPromises()
    expect(wrapper.find('.quant-ai-briefing-history-transfer-message').exists()).toBe(false)
    expect(wrapper.get('.quant-ai-briefing-history-copy').attributes('disabled')).toBeUndefined()
  })

  it('requires confirmation and removes a self-loaded session without nested row controls', async () => {
    const getSessions = vi.spyOn(quantApi, 'getCandidateAiSessions')
      .mockResolvedValueOnce({ items: [historySession], limit: 5 })
      .mockResolvedValueOnce({ items: [], limit: 5 })
    vi.spyOn(quantApi, 'getCandidateAiSession').mockResolvedValue(historySession)
    const deleteSession = vi.spyOn(quantApi, 'deleteCandidateAiSession').mockResolvedValue({ deleted: true, sessionId: historySession.id })
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, sessionHistory: undefined },
    })

    await flushPromises()
    expect(wrapper.get('.quant-ai-briefing-history-row').element.tagName).toBe('DIV')
    await wrapper.get('.quant-ai-briefing-history-item').trigger('click')
    await flushPromises()
    expect(wrapper.find('.quant-ai-briefing-history-detail').exists()).toBe(true)

    await wrapper.get('.quant-ai-briefing-history-delete').trigger('click')
    expect(wrapper.text()).toContain('确认删除？')
    expect(deleteSession).not.toHaveBeenCalled()

    await wrapper.get('.quant-ai-briefing-history-delete-confirm-action').trigger('click')
    await flushPromises()

    expect(deleteSession).toHaveBeenCalledWith(historySession.id)
    expect(getSessions).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.quant-ai-briefing-history-row').exists()).toBe(false)
    expect(wrapper.find('.quant-ai-briefing-history-detail').exists()).toBe(false)
    expect(wrapper.text()).toContain('候选 AI 会话已删除')
    expect(wrapper.emitted('sessionDeleted')).toEqual([[historySession.id]])
  })

  it('keeps a failed session and retries deletion from an accessible error state', async () => {
    const deleteSession = vi.spyOn(quantApi, 'deleteCandidateAiSession')
      .mockRejectedValueOnce(new Error('删除会话失败'))
      .mockResolvedValueOnce({ deleted: true, sessionId: historySession.id })
    const wrapper = mount(QuantAiCandidateBriefing, {
      props: { ...baseProps, briefing, sessionHistory: [historySession] },
    })

    await wrapper.get('.quant-ai-briefing-history-delete').trigger('click')
    await wrapper.get('.quant-ai-briefing-history-delete-confirm-action').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('删除会话失败')
    expect(wrapper.find('.quant-ai-briefing-history-row').exists()).toBe(true)

    await wrapper.get('.quant-ai-briefing-history-delete-confirm-action').trigger('click')
    await flushPromises()
    expect(deleteSession).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('候选 AI 会话已删除')
    expect(wrapper.text()).toContain('当前候选集中，高优先级标的需要先补齐风险核对')
    expect(wrapper.emitted('sessionDeleted')).toEqual([[historySession.id]])
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
    expect(wrapper.get('.quant-ai-briefing-focus-row').findAll('button')).toHaveLength(2)
    expect(wrapper.get('.quant-ai-briefing-citation').classes()).toContain('quant-ai-briefing-wrap-anywhere')
    expect(wrapper.get('.quant-ai-briefing-focus-item').attributes('type')).toBe('button')
    expect(wrapper.get('.quant-ai-briefing-citation').attributes('type')).toBe('button')
  })
})
