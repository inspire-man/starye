// @vitest-environment happy-dom

import type { QuantFactorConfiguration } from '../../lib/quant-view-models'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quantApi } from '../../lib/api-client'
import QuantFactorSettingsDrawer from '../QuantFactorSettingsDrawer.vue'

const defaultConfiguration: QuantFactorConfiguration = {
  version: 'research-factor-config-v1',
  weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
  source: 'default',
  updatedAt: null,
}

const customConfiguration: QuantFactorConfiguration = {
  version: 'research-factor-config-v1',
  weights: { 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 },
  source: 'user',
  updatedAt: '2026-08-30T00:00:00.000Z',
}

describe('quant factor settings drawer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads defaults, validates the total, and saves a user configuration', async () => {
    vi.spyOn(quantApi, 'getFactorConfiguration').mockResolvedValue(defaultConfiguration)
    const update = vi.spyOn(quantApi, 'updateFactorConfiguration').mockResolvedValue(customConfiguration)
    const wrapper = mount(QuantFactorSettingsDrawer, { props: { open: false }, global: { stubs: { Teleport: true } } })

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(wrapper.text()).toContain('内置默认配置')
    expect(wrapper.text()).toContain('100%')

    await wrapper.get('#quant-factor-trend-number').setValue('40')
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
    await wrapper.get('#quant-factor-valuation-number').setValue('10')
    await wrapper.get('#quant-factor-shareholder-return-number').setValue('10')
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(update).toHaveBeenCalledWith({ 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 })
    expect(wrapper.text()).toContain('重新生成研究报告后生效')
  })

  it('resets the persisted configuration through the delete contract', async () => {
    vi.spyOn(quantApi, 'getFactorConfiguration').mockResolvedValue(customConfiguration)
    const reset = vi.spyOn(quantApi, 'resetFactorConfiguration').mockResolvedValue(defaultConfiguration)
    const wrapper = mount(QuantFactorSettingsDrawer, { props: { open: false }, global: { stubs: { Teleport: true } } })

    await wrapper.setProps({ open: true })
    await flushPromises()
    await wrapper.get('button[title="删除当前用户配置并恢复内置默认权重"]').trigger('click')
    await flushPromises()

    expect(reset).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('已恢复默认权重')
  })
})
