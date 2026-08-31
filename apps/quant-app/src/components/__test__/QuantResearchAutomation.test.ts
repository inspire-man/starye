// @vitest-environment happy-dom

import type { AutomatedResearchItemState } from '../../lib/research-automation'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantResearchAutomation from '../QuantResearchAutomation.vue'

const candidates = [
  { tsCode: '601899.SH', name: '紫金矿业' },
  { tsCode: '000001.SZ', name: '平安银行' },
]

function state(overrides: Partial<AutomatedResearchItemState> = {}): AutomatedResearchItemState {
  return {
    tsCode: '601899.SH',
    name: '紫金矿业',
    stage: 'watchlist',
    aiStatus: 'pending',
    errorStage: null,
    run: null,
    summary: null,
    error: null,
    ...overrides,
  }
}

describe('quant research automation', () => {
  it('shows the pipeline entry and emits start for current candidates', async () => {
    const wrapper = mount(QuantResearchAutomation, {
      props: {
        candidates,
        states: {
          '601899.SH': state(),
          '000001.SZ': state({ tsCode: '000001.SZ', name: '平安银行' }),
        },
        running: false,
        aiReady: true,
        aiConfigErrorMessage: null,
        errorMessage: null,
      },
    })

    expect(wrapper.text()).toContain('自动研究闭环')
    expect(wrapper.text()).toContain('确认入池')
    expect(wrapper.text()).toContain('AI 已启用')
    await wrapper.get('.quant-research-automation-start').trigger('click')
    expect(wrapper.emitted('start')).toEqual([[]])
  })

  it('keeps a saved report actionable when the AI stage fails', async () => {
    const wrapper = mount(QuantResearchAutomation, {
      props: {
        candidates: [candidates[0]],
        states: {
          '601899.SH': state({
            stage: 'error',
            aiStatus: 'error',
            errorStage: 'ai',
            run: { id: 'run-1' } as AutomatedResearchItemState['run'],
            error: new Error('AI upstream'),
          }),
        },
        running: false,
        aiReady: true,
        aiConfigErrorMessage: null,
        errorMessage: null,
      },
    })

    expect(wrapper.text()).toContain('报告已保存，AI 复核失败')
    expect(wrapper.text()).toContain('AI 复核失败')
    expect(wrapper.html()).toContain('aria-label="查看 紫金矿业 研究报告"')
    expect(wrapper.html()).toContain('aria-label="重试 紫金矿业 自动研究"')
    await wrapper.get('button[aria-label="查看 紫金矿业 研究报告"]').trigger('click')
    await wrapper.get('button[aria-label="重试 紫金矿业 自动研究"]').trigger('click')
    expect(wrapper.emitted('focus')).toEqual([['601899.SH']])
    expect(wrapper.emitted('retry')).toEqual([['601899.SH']])
  })

  it('shows local configuration and pipeline errors without hiding the rows', () => {
    const wrapper = mount(QuantResearchAutomation, {
      props: {
        candidates: [candidates[0]],
        states: { '601899.SH': state({ stage: 'completed', aiStatus: 'skipped' }) },
        running: false,
        aiReady: false,
        aiConfigErrorMessage: '配置读取失败',
        errorMessage: '批次刷新失败',
      },
    })

    expect(wrapper.text()).toContain('仅确定性报告')
    expect(wrapper.text()).toContain('配置读取失败')
    expect(wrapper.text()).toContain('批次刷新失败')
    expect(wrapper.text()).toContain('闭环完成')
  })

  it('shows an explicit empty state when no candidate is available', () => {
    const wrapper = mount(QuantResearchAutomation, {
      props: {
        candidates: [],
        states: {},
        running: false,
        aiReady: null,
        aiConfigErrorMessage: null,
        errorMessage: null,
      },
    })

    expect(wrapper.text()).toContain('当前筛选没有可处理的候选')
    expect((wrapper.get('.quant-research-automation-start').element as HTMLButtonElement).disabled).toBe(true)
  })
})
