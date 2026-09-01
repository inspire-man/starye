// @vitest-environment happy-dom

import type { QuantAiConfig, QuantAiConnectionTest } from '../../lib/quant-types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quantApi } from '../../lib/api-client'
import QuantAiSettingsDrawer from '../QuantAiSettingsDrawer.vue'

const config: QuantAiConfig = {
  id: 'ai-config-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  responseMode: 'stream',
  generationTimeoutMs: 300000,
  hasApiKey: true,
  apiKeyHint: '1234',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const savedConfig: QuantAiConfig = {
  ...config,
  responseMode: 'json',
  generationTimeoutMs: 600000,
}

const connection: QuantAiConnectionTest = {
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  testedAt: '2026-09-01T00:00:00.000Z',
  latencyMs: 120,
}

describe('quant AI settings drawer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads runtime settings and persists response mode with the selected budget', async () => {
    vi.spyOn(quantApi, 'getAiConfig').mockResolvedValue(config)
    const update = vi.spyOn(quantApi, 'updateAiConfig').mockResolvedValue(savedConfig)
    const wrapper = mount(QuantAiSettingsDrawer, { props: { open: false }, global: { stubs: { Teleport: true } } })

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(wrapper.text()).toContain('流式响应')
    expect(wrapper.text()).toContain('已保存 5 分钟')

    await wrapper.get('button[title="等待服务端一次返回完整 JSON"]').trigger('click')
    await wrapper.findAll('select')[1]!.setValue('600000')
    expect(wrapper.text()).toContain('待保存 10 分钟')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ responseMode: 'json', generationTimeoutMs: 600000 }))
    expect(wrapper.text()).toContain('当前选择：完整 JSON')
    expect(wrapper.text()).toContain('已保存 10 分钟')
  })

  it('tests the saved runtime mode and keeps the test state visible', async () => {
    vi.spyOn(quantApi, 'getAiConfig').mockResolvedValue(config)
    vi.spyOn(quantApi, 'testAiConfig').mockResolvedValue(connection)
    const wrapper = mount(QuantAiSettingsDrawer, { props: { open: false }, global: { stubs: { Teleport: true } } })

    await wrapper.setProps({ open: true })
    await flushPromises()
    await wrapper.get('button[title="仅测试已保存的配置"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('连接成功')
    expect(wrapper.text()).toContain('流式响应')
  })
})
