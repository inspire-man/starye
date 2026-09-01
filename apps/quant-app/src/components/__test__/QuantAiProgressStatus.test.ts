// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuantAiProgressStatus from '../QuantAiProgressStatus.vue'

describe('quant AI progress status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows elapsed time while active and resets for the next request', async () => {
    const wrapper = mount(QuantAiProgressStatus, { props: { active: true, label: 'AI 处理中' } })

    expect(wrapper.text()).toContain('AI 处理中')
    expect(wrapper.text()).toContain('已等待 00:00')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')

    vi.advanceTimersByTime(61_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('已等待 01:01')

    await wrapper.setProps({ active: false })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.setProps({ active: true })
    expect(wrapper.text()).toContain('已等待 00:00')
  })

  it('cleans up its interval when unmounted', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = mount(QuantAiProgressStatus, { props: { active: true, label: 'AI 处理中' } })

    wrapper.unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
